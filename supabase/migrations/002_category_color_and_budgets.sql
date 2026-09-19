alter table public.categories
  add column if not exists color text not null default '#0f7a5f';

create table if not exists public.budgets (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  category_id uuid,
  amount numeric(14, 2) not null check (amount >= 0),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  client_id text not null
);

create index if not exists budgets_user_period_idx
  on public.budgets (user_id, year, month);

alter table public.budgets enable row level security;

create policy "budgets_select_own"
  on public.budgets for select
  using (auth.uid() = user_id);

create policy "budgets_insert_own"
  on public.budgets for insert
  with check (auth.uid() = user_id);

create policy "budgets_update_own"
  on public.budgets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "budgets_delete_own"
  on public.budgets for delete
  using (auth.uid() = user_id);