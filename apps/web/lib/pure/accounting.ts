/**
 * Pure accounting logic (unit-tested, no IO) — double-entry validation and
 * P&L math shared by the finance seam and (later) manual-entry UI.
 */
export interface JournalLine {
  account: string;
  debit: number;
  credit: number;
}

const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

/** A valid entry: ≥2 lines, no negative sides, Σdebit = Σcredit (in fils). */
export function isBalanced(lines: JournalLine[]): boolean {
  if (lines.length < 2) return false;
  let d = 0;
  let c = 0;
  for (const l of lines) {
    if (l.debit < 0 || l.credit < 0) return false;
    if (l.debit > 0 && l.credit > 0) return false;
    d += l.debit;
    c += l.credit;
  }
  return r3(d) === r3(c) && r3(d) > 0;
}

export interface PnlRow {
  kind: 'revenue' | 'expense';
  amount: number;
}

/** Net profit = Σrevenue − Σexpense, rounded to fils. */
export function netProfit(rows: PnlRow[]): number {
  const rev = rows.filter((r) => r.kind === 'revenue').reduce((s, r) => s + r.amount, 0);
  const exp = rows.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.amount, 0);
  return r3(rev - exp);
}
