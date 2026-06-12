/**
 * Support & warranty — tickets and threaded realtime chat.
 * Tickets sync to Zoho Desk server-side; this surface covers the in-app side.
 * RLS scopes customers to their own tickets/messages.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  Ticket,
  TicketChannel,
  TicketKind,
  TicketMessage,
  TicketStatus,
} from '@elite/types';
import type { EliteClient } from './client';
import { subscribeToTable } from './realtime';

/** A ticket together with its messages, for a detail view. */
export interface TicketWithMessages extends Ticket {
  messages: TicketMessage[];
}

/**
 * List tickets. Customers omit `userId` (RLS scopes to their own); staff may
 * pass a `userId` to filter, or omit it to see everything they can.
 */
export async function listTickets(client: EliteClient, userId?: string): Promise<Ticket[]> {
  let query = client.from('tickets').select('*');
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Ticket[];
}

/** Fetch one ticket with its messages (chronological), or `null`. */
export async function getTicket(
  client: EliteClient,
  id: string,
): Promise<TicketWithMessages | null> {
  const { data: ticket, error } = await client
    .from('tickets')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!ticket) return null;

  const { data: messages, error: msgError } = await client
    .from('ticket_messages')
    .select('*')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });
  if (msgError) throw msgError;

  return { ...(ticket as Ticket), messages: (messages ?? []) as TicketMessage[] };
}

export interface CreateTicketInput {
  user_id: string;
  subject: string;
  kind?: TicketKind;
  order_id?: string | null;
  /** Optional first message body to seed the thread. */
  message?: string;
}

/** Open a new support ticket, optionally seeding it with a first message. */
export async function createTicket(
  client: EliteClient,
  input: CreateTicketInput,
): Promise<Ticket> {
  const { data, error } = await client
    .from('tickets')
    .insert({
      user_id: input.user_id,
      subject: input.subject,
      kind: input.kind ?? 'general',
      order_id: input.order_id ?? null,
      status: 'open',
    })
    .select('*')
    .single();
  if (error) throw error;
  const ticket = data as Ticket;

  if (input.message && input.message.trim()) {
    await sendTicketMessage(client, ticket.id, input.user_id, input.message.trim());
  }
  return ticket;
}

/** Post a message to a ticket thread. */
export async function sendTicketMessage(
  client: EliteClient,
  ticketId: string,
  senderId: string,
  body: string,
  attachments: string[] = [],
): Promise<TicketMessage> {
  const { data, error } = await client
    .from('ticket_messages')
    .insert({ ticket_id: ticketId, sender_id: senderId, body, attachments })
    .select('*')
    .single();
  if (error) throw error;
  return data as TicketMessage;
}

/**
 * Subscribe to new messages on a ticket (realtime chat). Returns the channel;
 * call `client.removeChannel(channel)` to clean up.
 */
export function streamTicketMessages(
  client: EliteClient,
  ticketId: string,
  cb: (message: TicketMessage) => void,
): RealtimeChannel {
  return subscribeToTable<TicketMessage>(
    client,
    'ticket_messages',
    (payload) => {
      const next = payload.new as TicketMessage | undefined;
      if (next && next.id) cb(next);
    },
    {
      event: 'INSERT',
      filter: `ticket_id=eq.${ticketId}`,
      channelName: `rt:ticket_messages:${ticketId}`,
    },
  );
}

// ── Omnichannel (WhatsApp / Chatwoot / in-app unified inbox) ─────────────────

export interface ListTicketsByChannelFilter {
  /** Restrict to a single channel. Omit for all channels. */
  channel?: TicketChannel;
  /** Restrict to a single status. Omit for all statuses. */
  status?: TicketStatus;
}

/**
 * List tickets for the omnichannel ops inbox, filtered by channel and/or status.
 * RLS still scopes the result: ops see everything, customers see their own.
 */
export async function listTicketsByChannel(
  client: EliteClient,
  filter: ListTicketsByChannelFilter = {},
): Promise<Ticket[]> {
  let query = client.from('tickets').select('*');
  if (filter.channel) query = query.eq('channel', filter.channel);
  if (filter.status) query = query.eq('status', filter.status);
  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Ticket[];
}

/** Result of an omnichannel reply (in-app insert vs WhatsApp send action). */
export interface ReplyResult {
  channel: TicketChannel;
  /** The recorded message, when available (in-app insert / send-action echo). */
  message: TicketMessage | null;
  /** Whether an outbound provider send was attempted/succeeded. */
  sent?: boolean;
  skipped?: string;
}

/**
 * Reply to a ticket, routing by channel:
 *   - in_app           → insert an outbound `ticket_message` directly.
 *   - whatsapp         → invoke the `whatsapp-webhook` send action (which sends
 *                        via Graph API and records the outbound message).
 *   - chatwoot / other → insert an outbound `ticket_message` (the agent replies
 *                        in Chatwoot's own UI for provider delivery).
 *
 * `senderId` is the ops agent's profile id (required for in-app inserts so RLS
 * accepts the row). For WhatsApp the edge function binds the JWT user instead.
 */
export async function replyToTicket(
  client: EliteClient,
  ticketId: string,
  body: string,
  senderId?: string,
): Promise<ReplyResult> {
  const text = body.trim();
  if (!text) throw new Error('replyToTicket: body is empty');

  const { data: ticket, error } = await client
    .from('tickets')
    .select('id, channel')
    .eq('id', ticketId)
    .maybeSingle();
  if (error) throw error;
  if (!ticket) throw new Error('replyToTicket: ticket not found');

  const channel = ((ticket as { channel?: TicketChannel }).channel ?? 'in_app') as TicketChannel;

  if (channel === 'whatsapp') {
    const { data, error: invokeErr } = await client.functions.invoke('whatsapp-webhook', {
      body: { action: 'send', ticket_id: ticketId, body: text },
    });
    if (invokeErr) throw invokeErr;
    const res = data as { message?: TicketMessage; send?: { sent?: boolean; skipped?: string } };
    return {
      channel,
      message: res?.message ?? null,
      sent: res?.send?.sent,
      skipped: res?.send?.skipped,
    };
  }

  // in_app / chatwoot / instagram / email → durable outbound record.
  const { data: msg, error: insErr } = await client
    .from('ticket_messages')
    .insert({
      ticket_id: ticketId,
      sender_id: senderId ?? null,
      body: text,
      direction: 'outbound',
    })
    .select('*')
    .single();
  if (insErr) throw insErr;
  return { channel, message: msg as TicketMessage };
}

/** Update a ticket's status (ops control). */
export async function setTicketStatus(
  client: EliteClient,
  ticketId: string,
  status: TicketStatus,
): Promise<Ticket> {
  const { data, error } = await client
    .from('tickets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', ticketId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Ticket;
}
