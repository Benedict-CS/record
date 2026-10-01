-- Monthly bills and 定期定額. One rule posts at most one transaction per month.
-- Invest purchases also name the stock or fund on the transaction.

alter table public.transactions
  add column if not exists target_holding_id uuid;

create table if not exists public.recurring_rules (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid references public.books (id),
  name text not null,
  kind text not null check (kind in ('expense', 'invest')),
  amount numeric(14, 2) not null check (amount >= 0),
  day_of_month integer not null check (day_of_month between 1 and 31),
  start_month text not null,
  last_posted text,
  last_error text,
  account_id uuid not null,
  category_id uuid,
  holding_id uuid,
  target_holding_id uuid,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  client_id text not null
);

create index if not exists recurring_rules_user_book_idx
  on public.recurring_rules (user_id, book_id);

create index if not exists recurring_rules_user_updated_idx
  on public.recurring_rules (user_id, updated_at);

alter table public.recurring_rules enable row level security;

drop policy if exists "recurring_rules_select_own" on public.recurring_rules;
create policy "recurring_rules_select_own"
  on public.recurring_rules for select
  using (auth.uid() = user_id);

drop policy if exists "recurring_rules_insert_own" on public.recurring_rules;
create policy "recurring_rules_insert_own"
  on public.recurring_rules for insert
  with check (auth.uid() = user_id);

drop policy if exists "recurring_rules_update_own" on public.recurring_rules;
create policy "recurring_rules_update_own"
  on public.recurring_rules for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "recurring_rules_delete_own" on public.recurring_rules;
create policy "recurring_rules_delete_own"
  on public.recurring_rules for delete
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
