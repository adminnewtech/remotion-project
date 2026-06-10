/**
 * Zoho Desk adapter (support backbone) — tickets & comments.
 *
 * Stub: credentials read from passed `config` (env-backed); never hardcoded.
 * Throws `NotConfiguredError` until configured.
 *
 * TODO: implement against Zoho Desk API.
 *   - createTicket → POST {apiBase}/tickets   (header: orgId)
 *   - addComment   → POST {apiBase}/tickets/{ticketId}/comments
 *   Docs: https://desk.zoho.com/DeskAPIDocument#Tickets
 */
import {
  type Adapter,
  type DeskTicketInput,
  type ExternalRef,
  type ZohoDeskConfig,
  requireConfig,
} from './types';

const API_REF = 'https://desk.zoho.com/DeskAPIDocument#Tickets';

export interface ZohoDeskAdapter extends Adapter {
  createTicket(input: DeskTicketInput): Promise<ExternalRef>;
  addComment(ticketId: string, body: string): Promise<ExternalRef>;
}

export function createZohoDeskAdapter(config?: Partial<ZohoDeskConfig>): ZohoDeskAdapter {
  const configured = Boolean(config?.orgId && config?.accessToken);

  return {
    service: 'Zoho Desk',
    configured,

    async createTicket(_input: DeskTicketInput): Promise<ExternalRef> {
      requireConfig('Zoho Desk', config, ['orgId', 'accessToken'], API_REF);
      // TODO: POST {apiBase}/tickets with orgId header.
      throw new Error('Zoho Desk createTicket: not implemented (stub).');
    },

    async addComment(_ticketId: string, _body: string): Promise<ExternalRef> {
      requireConfig('Zoho Desk', config, ['orgId', 'accessToken'], API_REF);
      // TODO: POST {apiBase}/tickets/{ticketId}/comments
      throw new Error('Zoho Desk addComment: not implemented (stub).');
    },
  };
}
