/** Extra mark on an expense. It is not a second category. */
export const TREAT_TAG = "treat" as const;
export const HAIRCUT_TAG = "haircut" as const;

export type TransactionTag = typeof TREAT_TAG | typeof HAIRCUT_TAG;

export const TREAT_TAG_LABEL = "請客";
export const HAIRCUT_TAG_LABEL = "剪頭髮";

/** Expenses may carry allowed tags. Every other type stores none. */
export function normalizeTransactionTag(
  type: string,
  tag: string | null | undefined,
): TransactionTag | null {
  if (type !== "expense") return null;
  if (tag === TREAT_TAG) return TREAT_TAG;
  if (tag === HAIRCUT_TAG || tag === HAIRCUT_TAG_LABEL) return HAIRCUT_TAG;
  return null;
}

/** Text search can find a tagged row even when the category is different. */
export function tagSearchText(tag: string | null | undefined): string {
  if (tag === TREAT_TAG) return TREAT_TAG_LABEL;
  if (tag === HAIRCUT_TAG || tag === HAIRCUT_TAG_LABEL) return HAIRCUT_TAG_LABEL;
  return "";
}
