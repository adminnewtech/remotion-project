# Elite v1 — Data Model

The relational model is the contract. SQL lives in `supabase/migrations/`. This document is the human-readable map.

## Enums

| Enum | Values |
|---|---|
| `user_role` | `customer`, `employee`, `technician`, `driver`, `admin` |
| `order_status` | `draft`, `pending_payment`, `paid`, `processing`, `out_for_delivery`, `delivered`, `installing`, `completed`, `cancelled`, `refunded` |
| `payment_status` | `pending`, `authorized`, `paid`, `failed`, `refunded` |
| `payment_method` | `knet`, `apple_pay`, `google_pay`, `card`, `cod` |
| `fulfillment_type` | `delivery`, `installation`, `pickup` |
| `task_status` | `unassigned`, `assigned`, `accepted`, `en_route`, `arrived`, `in_progress`, `completed`, `failed`, `cancelled` |
| `ticket_status` | `open`, `pending`, `resolved`, `closed` |
| `ticket_kind` | `general`, `warranty`, `complaint`, `return` |

## Core tables

### Identity
- **`profiles`** — `id (=auth.users.id)`, `role`, `full_name`, `phone`, `email`, `avatar_url`, `locale (ar|en)`, `created_at`. One per user.
- **`staff_zones`** — links staff (driver/technician) to service `areas` for dispatch.
- **`addresses`** — `id`, `user_id`, `label`, `governorate`, `area`, `block`, `street`, `building`, `floor`, `apartment`, `extra_directions`, `lat`, `lng`, `is_default`. Kuwait addressing model.

### Catalog (commerce)
- **`categories`** — `id`, `parent_id`, `name_ar`, `name_en`, `slug`, `image_url`, `sort`, `is_active`.
- **`products`** — `id`, `category_id`, `name_ar`, `name_en`, `description_ar`, `description_en`, `brand`, `slug`, `requires_installation (bool)`, `installation_fee`, `warranty_months`, `is_active`, `search_tsv (tsvector)`.
- **`product_variants`** — `id`, `product_id`, `sku`, `attributes (jsonb e.g. {color, model})`, `price`, `sale_price`, `barcode`, `weight_g`, `is_active`.
- **`product_media`** — `id`, `product_id`, `variant_id?`, `url`, `kind (image|video)`, `sort`.
- **`inventory`** — `id`, `variant_id`, `location_id`, `on_hand`, `reserved`. (available = on_hand − reserved)
- **`locations`** — warehouses/stores: `id`, `name`, `area`, `lat`, `lng`.

### Cart & orders
- **`carts`** — `id`, `user_id`, `status`, `updated_at`.
- **`cart_items`** — `id`, `cart_id`, `variant_id`, `qty`, `with_installation (bool)`.
- **`orders`** — `id`, `order_number`, `user_id`, `status`, `subtotal`, `delivery_fee`, `installation_fee`, `discount_total`, `total`, `currency (KWD)`, `address_id`, `delivery_slot`, `placed_at`, `notes`.
- **`order_items`** — `id`, `order_id`, `variant_id`, `name_snapshot`, `unit_price`, `qty`, `line_total`, `with_installation`, `warranty_expires_at`.
- **`payments`** — `id`, `order_id`, `method`, `status`, `amount`, `gateway_ref`, `raw (jsonb)`.
- **`discounts`** — `id`, `code`, `kind (percent|amount|free_delivery)`, `value`, `min_subtotal`, `starts_at`, `ends_at`, `usage_limit`, `used_count`, `is_active`.

### Fulfillment / logistics / services
- **`fulfillment_tasks`** — `id`, `order_id`, `type (fulfillment_type)`, `status (task_status)`, `assignee_id (staff)`, `area`, `scheduled_for`, `window_start`, `window_end`, `sequence`, `created_at`.
- **`driver_locations`** — `id`, `driver_id`, `task_id`, `lat`, `lng`, `heading`, `speed`, `recorded_at`. (high-write, realtime)
- **`proof_of_delivery`** — `id`, `task_id`, `photo_url`, `signature_url?`, `otp_verified`, `recipient_name`, `delivered_at`.
- **`installation_jobs`** — `id`, `task_id`, `order_id`, `checklist (jsonb)`, `before_photos (text[])`, `after_photos (text[])`, `customer_signature_url`, `notes`, `completed_at`.

### Support & warranty
- **`tickets`** — `id`, `order_id?`, `user_id`, `kind (ticket_kind)`, `status`, `subject`, `zoho_desk_id?`, `assignee_id?`, `created_at`.
- **`ticket_messages`** — `id`, `ticket_id`, `sender_id`, `body`, `attachments (text[])`, `created_at`. (realtime chat)
- **`warranty_claims`** — `id`, `order_item_id`, `ticket_id`, `status`, `resolution`, `job_task_id?`.

### Reviews, notifications, audit
- **`reviews`** — `id`, `product_id`, `user_id`, `order_item_id`, `rating (1-5)`, `body`, `is_published`.
- **`notifications`** — `id`, `user_id`, `kind`, `title_ar/en`, `body_ar/en`, `data (jsonb)`, `read_at`.
- **`push_tokens`** — `id`, `user_id`, `expo_token`, `platform`.
- **`audit_events`** — `id`, `actor_id`, `action`, `entity`, `entity_id`, `before (jsonb)`, `after (jsonb)`, `created_at`.

## Key relationships

```
profiles 1─┬─< addresses
           ├─< carts 1─< cart_items >─ product_variants >─ products >─ categories
           ├─< orders 1─┬─< order_items >─ product_variants
           │            ├─< payments
           │            └─< fulfillment_tasks 1─┬─< driver_locations
           │                                    ├─1 proof_of_delivery
           │                                    └─1 installation_jobs
           └─< tickets 1─< ticket_messages
products 1─< product_variants 1─< inventory >─ locations
order_items 1─1 warranty_claims >─ tickets
```

## RLS summary

| Table | customer | employee | technician | driver | admin |
|---|---|---|---|---|---|
| products / categories | read (active) | read/write | read | read | full |
| orders | own | all | jobs' orders | tasks' orders | full |
| fulfillment_tasks | own order's | all | assigned | assigned | full |
| driver_locations | own order's (read) | all | — | own (write) | full |
| tickets / messages | own | all | — | — | full |
| inventory / payments | — | read | — | — | full |

`has_role(uid, role)` and `is_staff(uid)` SQL helpers back these policies. Service-role-only writes: dispatch assignment, refunds, payouts, inventory reservation.
