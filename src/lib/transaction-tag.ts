/** Extra mark on an expense. It is not a second category. */
export const TREAT_TAG = "treat" as const;

export type TransactionTag = typeof TREAT_TAG;

export const TREAT_TAG_LABEL = "請客";

/** Expenses may carry the treat tag. Every other type stores none. */
export function normalizeTransactionTag(
  type: string,
  tag: string | null | undefined,
): TransactionTag | null {
  if (type !== "expense") return null;
  return tag === TREAT_TAG ? TREAT_TAG : null;
}

/** Text search can find a tagged row even when the category is 晚餐. */
export function tagSearchText(tag: string | null | undefined): string {
  return tag === TREAT_TAG ? TREAT_TAG_LABEL : "";
}
