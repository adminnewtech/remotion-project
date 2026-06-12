/**
 * Shared formatters for the gold orders + analytics UI. Western-digit, tabular
 * (mono LTR) numbers for the `.num` spans; KWD money keeps 3 decimals.
 */
export function num3(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export function int(n: number): string {
  return n.toLocaleString('en-US');
}

/** Short Gregorian date for table cells, e.g. `8 Jun, 09:00`. */
export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${date}, ${time}`;
}

export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}
