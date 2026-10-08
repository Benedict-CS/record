/** PostgREST returns at most this many rows unless the client asks for the next page. */
export const PULL_PAGE_SIZE = 1000;

/**
 * Bump when a device that already synced must download the whole ledger again.
 * Older cursors stop at the first thousand rows and then skip the rest.
 */
export const FULL_PULL_VERSION = 2;

export function needsFullCloudPull(input: {
  forceFull?: boolean;
  since: string | null | undefined;
  localCount: number;
  pullVersion: number | null | undefined;
  storageFlag?: boolean;
}): boolean {
  return Boolean(
    input.forceFull ||
      !input.since ||
      input.localCount === 0 ||
      input.pullVersion !== FULL_PULL_VERSION ||
      input.storageFlag,
  );
}

type PullRow = { id?: string | null };

/**
 * Keep one page of a cloud pull. A short page is the end. A repeated first id
 * means the server ignored the offset, so the page is dropped instead of
 * appended forever.
 */
export function takePullPage<T extends PullRow>(
  page: readonly T[],
  seenFirstIds: Set<string>,
  pageSize = PULL_PAGE_SIZE,
): { rows: readonly T[]; done: boolean } {
  const firstId = page[0]?.id ?? null;
  if (firstId && seenFirstIds.has(firstId)) {
    return { rows: [], done: true };
  }
  if (firstId) seenFirstIds.add(firstId);
  return { rows: page, done: page.length < pageSize };
}
