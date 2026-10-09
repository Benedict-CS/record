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

/**
 * A column added after rows were uploaded is null in the cloud, while this
 * device still has the value. Matching timestamps mean that upload omitted
 * the field. Keep the local value and send it again.
 */
export function preserveUnsyncedField<T extends string>(input: {
  remoteHasKey: boolean;
  remoteValue: T | null | undefined;
  localValue: T | null | undefined;
  remoteUpdatedAt: string;
  localUpdatedAt: string | undefined;
}): { value: T | null; needsUpload: boolean } {
  const local = input.localValue || null;
  if (!input.remoteHasKey) {
    return { value: local, needsUpload: false };
  }
  const remote = input.remoteValue || null;
  const remoteMs = Date.parse(input.remoteUpdatedAt);
  const localMs = input.localUpdatedAt ? Date.parse(input.localUpdatedAt) : NaN;
  if (
    local &&
    !remote &&
    Number.isFinite(remoteMs) &&
    Number.isFinite(localMs) &&
    remoteMs <= localMs + 2000
  ) {
    return { value: local, needsUpload: true };
  }
  return { value: remote, needsUpload: false };
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
