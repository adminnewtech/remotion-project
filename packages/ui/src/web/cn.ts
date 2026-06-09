/**
 * Tiny dependency-light `cn` class-name helper.
 *
 * Joins truthy class values into a single space-separated string, supporting
 * strings, numbers, arrays, and conditional `{ 'class': boolean }` maps.
 * Deliberately avoids `clsx`/`tailwind-merge` to keep the package light;
 * later classes naturally win in Tailwind's source order.
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];

  const push = (value: ClassValue): void => {
    if (!value) return;
    if (typeof value === 'string' || typeof value === 'number') {
      out.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) push(item);
      return;
    }
    if (typeof value === 'object') {
      for (const key of Object.keys(value)) {
        if (value[key]) out.push(key);
      }
    }
  };

  for (const input of inputs) push(input);
  return out.join(' ');
}
