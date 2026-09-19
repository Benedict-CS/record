-- Books (TWD / MYR ledgers) + book_id on child tables

create table if not exists public.books (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  currency text not null check (currency in ('TWD', 'MYR')),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  client_id text not null
);

create index if not exists books_user_updated_idx
  on public.books (user_id, updated_at);

alter table public.books enable row level security;

create policy "books_select_own"
  on public.books for select
  using (auth.uid() = user_id);

create policy "books_insert_own"
  on public.books for insert
  with check (auth.uid() = user_id);

create policy "books_update_own"
  on public.books for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "books_delete_own"
  on public.books for delete
  using (auth.uid() = user_id);

-- 001_init / 002 created child tables without book_id
alter table public.accounts
  add column if not exists book_id uuid references public.books (id);

alter table public.categories
  add column if not exists book_id uuid references public.books (id);

alter table public.transactions
  add column if not exists book_id uuid references public.books (id);

alter table public.budgets
  add column if not exists book_id uuid references public.books (id);

create index if not exists accounts_book_id_idx on public.accounts (book_id);
create index if not exists categories_book_id_idx on public.categories (book_id);
create index if not exists transactions_book_id_idx on public.transactions (book_id);
create index if not exists budgets_book_id_idx on public.budgets (book_id);
