-- Account opening balances + recurring transaction templates

alter table public.accounts
  add column if not exists opening_balance numeric(14, 2) not null default 0;

create table if not exists public.templates (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid references public.books (id),
  name text not null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  note text not null default '',
  account_id uuid not null,
  category_id uuid,
  transfer_account_id uuid,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  client_id text not null
);

create index if not exists templates_user_book_idx
  on public.templates (user_id, book_id);

create index if not exists templates_user_updated_idx
  on public.templates (user_id, updated_at);

alter table public.templates enable row level security;

drop policy if exists "templates_select_own" on public.templates;
create policy "templates_select_own"
  on public.templates for select
  using (auth.uid() = user_id);

drop policy if exists "templates_insert_own" on public.templates;
create policy "templates_insert_own"
  on public.templates for insert
  with check (auth.uid() = user_id);

drop policy if exists "templates_update_own" on public.templates;
create policy "templates_update_own"
  on public.templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "templates_delete_own" on public.templates;
create policy "templates_delete_own"
  on public.templates for delete
  using (auth.uid() = user_id);
