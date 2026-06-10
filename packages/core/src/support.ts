/**
 * Support & warranty — tickets and threaded realtime chat.
 * Tickets sync to Zoho Desk server-side; this surface covers the in-app side.
 * RLS scopes customers to their own tickets/messages.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Ticket, TicketKind, TicketMessage } from '@elite/types';
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
