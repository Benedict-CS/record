/**
 * PostgREST returns PGRST204 when the app sends a column the hosted
 * database has not added yet. Sync should drop that column and retry
 * instead of failing the whole ledger upload.
 */

export function missingColumnName(error: {
  code?: string | null;
  message?: string | null;
} | null): string | null {
  if (!error || error.code !== "PGRST204") return null;
  const match = /Could not find the '([^']+)' column/.exec(error.message ?? "");
  return match?.[1] ?? null;
}

export function withoutColumn(
  rows: Record<string, unknown>[],
  column: string,
): Record<string, unknown>[] {
  return rows.map((row) => {
    if (!(column in row)) return row;
    const next = { ...row };
    delete next[column];
    return next;
  });
}
