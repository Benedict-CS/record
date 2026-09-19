-- Holdings (cash, savings, deposits, funds, etc.)

create table if not exists public.holdings (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid references public.books (id),
  name text not null,
  kind text not null check (kind in ('cash', 'savings', 'deposit', 'fund', 'ewallet', 'stock', 'other')),
  institution text not null default '',
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  annual_rate numeric(8, 4) not null default 0 check (annual_rate >= 0),
  compounding text not null default 'none' check (compounding in ('none', 'simple', 'monthly', 'yearly')),
  start_date date not null,
  maturity_date date,
  note text not null default '',
  color text not null default '#0f7a5f',
  icon text not null default 'dots',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  client_id text not null
);

create index if not exists holdings_user_updated_idx
  on public.holdings (user_id, updated_at);

create index if not exists holdings_book_id_idx
  on public.holdings (book_id);

alter table public.holdings enable row level security;

drop policy if exists "holdings_select_own" on public.holdings;
create policy "holdings_select_own"
  on public.holdings for select
  using (auth.uid() = user_id);

drop policy if exists "holdings_insert_own" on public.holdings;
create policy "holdings_insert_own"
  on public.holdings for insert
  with check (auth.uid() = user_id);

drop policy if exists "holdings_update_own" on public.holdings;
create policy "holdings_update_own"
  on public.holdings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "holdings_delete_own" on public.holdings;
create policy "holdings_delete_own"
  on public.holdings for delete
  using (auth.uid() = user_id);
