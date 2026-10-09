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

/**
 * Last-writer-wins on updated_at: true when `candidate` is at or after `other`.
 * Local rows carry `…Z`; PostgREST returns `…+00:00` and may trim trailing
 * zeros, so compare instants, not strings.
 */
export function remoteWins(
  candidateUpdatedAt: string | null | undefined,
  otherUpdatedAt: string | null | undefined,
): boolean {
  if (!otherUpdatedAt) return true;
  if (!candidateUpdatedAt) return false;
  const candidateMs = Date.parse(candidateUpdatedAt);
  const otherMs = Date.parse(otherUpdatedAt);
  if (Number.isFinite(candidateMs) && Number.isFinite(otherMs)) {
    return candidateMs >= otherMs;
  }
  return candidateUpdatedAt >= otherUpdatedAt;
}

/**
 * Schema mismatches should read as a saved-local / not-uploaded note,
 * not a PostgREST paragraph.
 */
export function plainSyncFailure(error: {
  code?: string | null;
  message?: string | null;
} | null): string | null {
  if (!error) return null;
  const message = error.message ?? "";
  if (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /Could not find the '.+' column/.test(message) ||
    message.includes("略過的欄位")
  ) {
    return "這台已存好，雲端還沒這欄，所以上不去。";
  }
  if (
    error.code === "PGRST205" ||
    /does not exist/i.test(message) ||
    message.includes("recurring_rules")
  ) {
    return "這台已存好，雲端還沒這張表，所以上不去。";
  }
  if (
    error.code === "23514" ||
    /check constraint/i.test(message) ||
    /violates check/i.test(message)
  ) {
    return "這台已存好，雲端還不接受這筆資料，所以上不去。";
  }
  return null;
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
