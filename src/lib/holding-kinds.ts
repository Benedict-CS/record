import type { HoldingKind, InterestCompounding } from "@/lib/types";

export const HOLDING_KINDS: {
  id: HoldingKind;
  label: string;
  hint: string;
}[] = [
  { id: "cash", label: "現金", hint: "手上的紙鈔與零錢" },
  { id: "savings", label: "活存／儲蓄", hint: "銀行活期存款" },
  { id: "deposit", label: "定存", hint: "定期存款，可填年利率" },
  { id: "fund", label: "基金", hint: "基金、信託，可填預估年化" },
  { id: "ewallet", label: "電子錢包", hint: "Touch n Go、ShopeePay 等" },
  { id: "stock", label: "股票", hint: "持股市值" },
  { id: "other", label: "其他", hint: "自行命名的資產" },
];

export const COMPOUNDING_OPTIONS: {
  id: InterestCompounding;
  label: string;
}[] = [
  { id: "none", label: "無利息" },
  { id: "simple", label: "單利" },
  { id: "monthly", label: "月複利" },
  { id: "yearly", label: "年複利" },
];

export function holdingKindLabel(kind: HoldingKind) {
  return HOLDING_KINDS.find((item) => item.id === kind)?.label ?? kind;
}

export function compoundingLabel(value: InterestCompounding) {
  return COMPOUNDING_OPTIONS.find((item) => item.id === value)?.label ?? value;
}