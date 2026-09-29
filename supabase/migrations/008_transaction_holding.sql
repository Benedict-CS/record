-- Bank expenses can name the 存款 holding (活存／定存) they draw from.
-- Cash expenses leave this null. No foreign key: deleting a holding must not block the ledger row.
alter table public.transactions
  add column if not exists holding_id uuid;

create index if not exists transactions_holding_id_idx
  on public.transactions (holding_id);
