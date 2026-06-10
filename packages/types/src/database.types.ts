/**
 * Placeholder for generated Supabase types.
 *
 * Once a Supabase project is linked, regenerate this file with:
 *   pnpm db:types
 * (runs `supabase gen types typescript --linked`).
 *
 * Until then, hand-written domain types in `./index.ts` are the contract.
 *
 * This placeholder intentionally describes a *permissive* schema: every table
 * accepts/returns a flexible row shape. It satisfies the `SupabaseClient<Database>`
 * generic constraint (a `GenericSchema` with `Tables`/`Views`/`Functions`) so
 * that `.from(...)`, `.insert(...)`, `.update(...)` etc. type-check, while the
 * call sites continue to cast results to the strong domain types in `./index.ts`.
 * Regenerating with `pnpm db:types` replaces this with the exact schema.
 */
/**
 * Row shape returned by `.select()`. Uses an `any`-valued index signature so
 * results can be cast to the strong domain types in `./index.ts` without
 * "insufficient overlap" errors, mirroring how generated row types behave.
 */
type GenericRow = Record<string, any>;
/** Write shape — kept to `unknown` values so insert/update payloads stay checked-ish. */
type GenericWrite = Record<string, unknown>;

interface GenericTable {
  Row: GenericRow;
  Insert: GenericWrite;
  Update: GenericWrite;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      [table: string]: GenericTable;
    };
    Views: {
      [view: string]: {
        Row: GenericRow;
        Relationships: [];
      };
    };
    Functions: {
      [fn: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: {
      [enumName: string]: string;
    };
    CompositeTypes: {
      [type: string]: GenericRow;
    };
  };
}
