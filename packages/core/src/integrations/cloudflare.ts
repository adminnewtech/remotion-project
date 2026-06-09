/**
 * Cloudflare Images adapter — edge image resizing / optimization.
 *
 * `imageUrl` is a pure URL builder (no network), so it works on web and mobile
 * with no creds. The delivery base is read from passed `config` (env-backed);
 * never hardcoded. If the base is missing, throws `NotConfiguredError`.
 *
 * TODO: if signed URLs / private variants are needed, sign here per:
 *   https://developers.cloudflare.com/images/transform-images/
 */
import {
  type Adapter,
  type CloudflareConfig,
  type CloudflareResizeOptions,
  requireConfig,
} from './types';

const API_REF = 'https://developers.cloudflare.com/images/transform-images/';

export interface CloudflareAdapter extends Adapter {
  /** Build a transformed image URL for a given source path/URL. */
  imageUrl(source: string, opts?: CloudflareResizeOptions): string;
}

function serializeOptions(opts: CloudflareResizeOptions): string {
  const parts: string[] = [];
  if (opts.width != null) parts.push(`width=${opts.width}`);
  if (opts.height != null) parts.push(`height=${opts.height}`);
  if (opts.fit) parts.push(`fit=${opts.fit}`);
  if (opts.quality != null) parts.push(`quality=${opts.quality}`);
  parts.push(`format=${opts.format ?? 'auto'}`);
  return parts.join(',');
}

export function createCloudflareAdapter(
  config?: Partial<CloudflareConfig>,
): CloudflareAdapter {
  const configured = Boolean(config?.deliveryBase);

  return {
    service: 'Cloudflare Images',
    configured,

    imageUrl(source: string, opts: CloudflareResizeOptions = {}): string {
      requireConfig<CloudflareConfig>('Cloudflare Images', config, ['deliveryBase'], API_REF);
      const base = config.deliveryBase.replace(/\/$/, '');
      const options = serializeOptions(opts);
      const src = encodeURIComponent(source);
      // Cloudflare `/cdn-cgi/image/<options>/<source>` transform path.
      return `${base}/cdn-cgi/image/${options}/${src}`;
    },
  };
}
