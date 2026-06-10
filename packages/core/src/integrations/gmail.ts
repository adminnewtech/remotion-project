/**
 * Gmail adapter (transactional + marketing email).
 *
 * Stub: credentials read from passed `config` (env-backed); never hardcoded.
 * Throws `NotConfiguredError` until configured.
 *
 * TODO: implement against Gmail API.
 *   - sendEmail → POST https://gmail.googleapis.com/gmail/v1/users/{sender}/messages/send
 *     (body is a base64url-encoded RFC 2822 MIME message)
 *   Docs: https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send
 */
import {
  type Adapter,
  type EmailInput,
  type ExternalRef,
  type GmailConfig,
  requireConfig,
} from './types';

const API_REF =
  'https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send';

export interface GmailAdapter extends Adapter {
  sendEmail(input: EmailInput): Promise<ExternalRef>;
}

export function createGmailAdapter(config?: Partial<GmailConfig>): GmailAdapter {
  const configured = Boolean(config?.sender && config?.accessToken);

  return {
    service: 'Gmail',
    configured,

    async sendEmail(_input: EmailInput): Promise<ExternalRef> {
      requireConfig('Gmail', config, ['sender', 'accessToken'], API_REF);
      // TODO: build RFC 2822 MIME, base64url-encode, POST to messages/send.
      throw new Error('Gmail sendEmail: not implemented (stub).');
    },
  };
}
