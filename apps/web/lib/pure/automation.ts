/**
 * Pure automation logic (unit-tested, no IO) — the same condition matcher the
 * runner applies; shared so the admin UI can preview which subjects match.
 */
export type Conditions = Record<string, unknown>;

/** Every key in `conditions` must equal the subject's value (shallow). */
export function matchesConditions(subject: Record<string, unknown>, conditions: Conditions): boolean {
  for (const [k, v] of Object.entries(conditions ?? {})) {
    if (v === undefined || v === null || v === '') continue;
    if (subject[k] !== v) return false;
  }
  return true;
}
