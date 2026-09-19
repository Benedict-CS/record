-- Hold (扣住): money deducted but not "spent"; can be released later.
alter table public.transactions
  drop constraint if exists transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check
  check (type in ('income', 'expense', 'transfer', 'hold'));

alter table public.transactions
  add column if not exists hold_status text;

alter table public.transactions
  add column if not exists release_transaction_id uuid;

-- Null for normal rows; held/released only for type=hold.
alter table public.transactions
  drop constraint if exists transactions_hold_status_check;

alter table public.transactions
  add constraint transactions_hold_status_check
  check (
    hold_status is null
    or hold_status in ('held', 'released')
  );

alter table public.transactions
  drop constraint if exists transactions_hold_type_status_check;

alter table public.transactions
  add constraint transactions_hold_type_status_check
  check (
    (type = 'hold' and hold_status in ('held', 'released'))
    or (type <> 'hold' and hold_status is null)
  );
