# NewTech OS — Omnichannel Support

Every customer conversation — **in-app, WhatsApp, Instagram, email** — lands in
**one inbox** bound to the customer/order. This is the integration layer on top
of Elite v1's existing support schema (`tickets` / `ticket_messages`), not a
rebuild.

- In-app chat → writes `ticket_messages` directly (existing flow).
- **WhatsApp Cloud API** → `whatsapp-webhook` Edge Function.
- **Instagram / email / others** → **Chatwoot** (self-hosted) → `chatwoot-webhook`.

Ops work the unified inbox at `/{locale}/admin/support`.

---

## 1. Data model (migration `0014_omnichannel.sql`)

Additive, idempotent, live-safe. Extends the 0005 schema:

**`tickets`** new columns
| column | type | notes |
|---|---|---|
| `channel` | `text not null default 'in_app'` | check: `in_app · whatsapp · instagram · email · chatwoot` |
| `external_id` | `text` | WhatsApp `wa_id` or Chatwoot conversation id |
| `customer_phone` | `text` | E.164-ish for channel tickets |
| `user_id` | (now **nullable**) | channel tickets bind a profile only once the phone matches |

Index: `idx_tickets_channel_external (channel, external_id)`.

**`ticket_messages`** new columns
| column | type | notes |
|---|---|---|
| `direction` | `text not null default 'inbound'` | check: `inbound · outbound` |
| `external_id` | `text` | provider message id (idempotency / receipts) |
| `sender_id` | (now **nullable**) | inbound channel messages have no auth user |

**RLS** (additive — existing policies untouched):
- `tickets service_role write` / `ticket msgs service_role write` — webhooks write channel rows.
- `ticket msgs ops write` / `ticket msgs ops read` — ops post/read on any ticket regardless of `sender_id`.
- Customers still see only their own tickets/messages (original `"tickets owner"` / `"ticket msgs participant"`).

---

## 2. WhatsApp Cloud API

### Meta app setup
1. **developers.facebook.com** → create a Business app → add **WhatsApp**.
2. Add the Newtech WABA phone number; note the **Phone number ID** and generate a
   **permanent system-user access token** (WhatsApp Business Management + messaging perms).
3. **WhatsApp → Configuration → Webhook**:
   - **Callback URL:** `https://wslvotaodwdftmexkfpd.functions.supabase.co/whatsapp-webhook`
   - **Verify token:** the value you set as `WHATSAPP_VERIFY_TOKEN`.
   - **Subscribe** to the `messages` field.
4. Meta sends a `GET` with `hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`;
   the function echoes the challenge when the token matches.

### Env / Supabase secrets
```
WHATSAPP_VERIFY_TOKEN       # webhook verification (GET)
WHATSAPP_ACCESS_TOKEN       # permanent / system-user token (send)
WHATSAPP_PHONE_NUMBER_ID    # Cloud API sender phone-number id
WHATSAPP_API_VERSION        # optional, default v19.0
```
Set via `supabase secrets set …`. When send creds are absent, the webhook still
records inbound messages and returns 200 (auto-ack is skipped/logged).

### Webhook contract — `whatsapp-webhook`
**GET** (verification)
```
GET ?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<n>
→ 200 "<n>"   when token == WHATSAPP_VERIFY_TOKEN
→ 403         otherwise
```

**POST** (Meta message event) — body is the standard Cloud API envelope
(`entry[].changes[].value.{contacts,messages}`). For each text message:
1. find-or-create ticket: `channel='whatsapp'`, `external_id=wa_id`; bind
   `user_id` by matching `profiles.phone` and their latest `orders` row.
2. insert inbound `ticket_message` (`direction='inbound'`, `external_id=msg.id`).
3. `enqueue_notification` (service-role rpc) for the bound user.
4. auto-ack text reply via Graph API (best-effort).
Returns `{ ok: true, processed }`. Status/read events → no-op 200.

**POST** (ops outbound) — `{ action: 'send', ticket_id, body }`, with the ops
agent's JWT in `Authorization`:
- verifies `role ∈ {employee, admin}` (else 403/401),
- sends a free-form WhatsApp **text** via Graph API,
- records an outbound `ticket_message`.
Returns `{ ok: true, message, send: { sent, skipped? } }`.

> Note: outside WhatsApp's 24h customer-service window only **approved templates**
> send (use `_shared/whatsapp.ts` `sendTemplate` for milestone notifications).
> Free-form text in the send action works within the open window.

---

## 3. Chatwoot (Instagram / email / web-widget)

Self-host Chatwoot (docker-compose / Render) and connect its inboxes
(Instagram, email, web-widget). Chatwoot fans those channels into NewTech via a
webhook.

### Chatwoot config
1. **Settings → Integrations → Webhooks → Add** new webhook:
   - **URL:** `https://wslvotaodwdftmexkfpd.functions.supabase.co/chatwoot-webhook`
   - Subscribe to **`message_created`** (and optionally `message_updated`).
2. Add a custom header `X-Chatwoot-Token: <CHATWOOT_WEBHOOK_TOKEN>` (Chatwoot
   sends configured headers), or proxy it — the function rejects mismatches when
   `CHATWOOT_WEBHOOK_TOKEN` is set.

### Env / secrets
```
CHATWOOT_WEBHOOK_TOKEN      # shared secret expected in X-Chatwoot-Token header
```

### Webhook contract — `chatwoot-webhook`
**POST** — header `X-Chatwoot-Token` checked against `CHATWOOT_WEBHOOK_TOKEN`
(when set). For `message_created` / `message_updated`:
1. map conversation → ticket: `channel='chatwoot'`, `external_id=conversation.id`;
   bind `user_id` by `meta.sender.phone_number` when known.
2. insert message with `direction` from `message_type`
   (`incoming → inbound`, `outgoing → outbound`); dedupe by `external_id`.
3. `enqueue_notification` for inbound messages on bound tickets.
Any other event → safe no-op `200 { ok: true, ignored }`. Returns
`{ ok: true, ticket_id, direction }`.

---

## 4. Admin inbox (`/{locale}/admin/support`)

Premium omnichannel inbox (`components/admin/support-queue.tsx`):
- Ticket list with **channel badges** (WhatsApp green pill, Instagram pink, etc.).
- Filters: **channel / status / kind**.
- Conversation view with **direction-aware bubbles** — inbound start-aligned,
  outbound end-aligned (RTL-correct via `me-auto` / `ms-auto`, `rounded-ss/se`).
- **Customer context** side card: name/phone, linked order, warranty.
- **Reply box** routes by channel: `in_app` → insert `ticket_message`;
  `whatsapp` → `functions.invoke('whatsapp-webhook', { action: 'send', … })`.
- **Status controls** + **realtime** updates via `support.streamTicketMessages`.

Arabic-first labels with locale-ternary fallbacks throughout.

---

## 5. Core API (`@elite/core` → `support`)

New (existing exports unchanged):
- `listTicketsByChannel(client, { channel?, status? })` → `Ticket[]`.
- `replyToTicket(client, ticketId, body, senderId?)` → routes in-app insert vs
  WhatsApp send-action invoke; returns `{ channel, message, sent?, skipped? }`.
- `setTicketStatus(client, ticketId, status)` → `Ticket`.

---

## 6. Data flow

```
                          ┌─────────────────────────────┐
  WhatsApp customer ──────► whatsapp-webhook (Edge, Deno)│
                          │  GET verify · POST events    │
                          └──────────────┬──────────────┘
                                         │ service-role
 Instagram / email ──► Chatwoot ──► chatwoot-webhook ────┤
                                         │                │
  In-app customer ──► ticket_messages ◄──┘                │
                                         ▼                ▼
                              ┌───────────────────────────────┐
                              │ tickets / ticket_messages (RLS)│
                              │  channel · external_id · dir.  │
                              └───────────────┬───────────────┘
                                              │ realtime
                                              ▼
                          /admin/support — unified ops inbox
                          (filters · bubbles · customer card)
                                              │
                          ops reply ──► replyToTicket ──► in_app insert
                                              └──────────► whatsapp send action
                                                            └► Graph API → customer
```
