"use client";

type NoteSuggestProps = {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder: string;
  label: string;
};

export function NoteSuggest({
  value,
  onChange,
  suggestions,
  placeholder,
  label,
}: NoteSuggestProps) {
  const query = value.trim().toLowerCase();
  const chips = suggestions
    .filter((note) => {
      if (note === value.trim()) return false;
      if (!query) return true;
      return note.toLowerCase().includes(query);
    })
    .slice(0, 6);

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--muted)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-base outline-none focus:border-[var(--accent)]"
      />
      {chips.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((note) => (
            <button
              key={note}
              type="button"
              onClick={() => onChange(note)}
              className="max-w-full truncate rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--ink)] active:bg-[var(--paper)]"
            >
              {note}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}
