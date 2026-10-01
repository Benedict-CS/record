export function TreatTagField({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-start gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
      />
      <span className="min-w-0">
        <span className="block text-sm text-[var(--ink)]">這筆也是請客</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--muted)]">
          分類照算（例如晚餐）。請客只是標籤，不會把這筆再加進支出一次。
        </span>
      </span>
    </label>
  );
}
