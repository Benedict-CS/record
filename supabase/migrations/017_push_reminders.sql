-- Daily reminder prefs + Web Push subscriptions for signed-in devices.
-- Cron reads these with the service role and sends 「今天記了沒」.

create table if not exists public.reminder_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  time text not null default '21:00',
  timezone text not null default 'Asia/Taipei',
  notified_on date,
  dismissed_on date,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.reminder_prefs enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "reminder_prefs_select_own"
  on public.reminder_prefs for select
  using (auth.uid() = user_id);

create policy "reminder_prefs_insert_own"
  on public.reminder_prefs for insert
  with check (auth.uid() = user_id);

create policy "reminder_prefs_update_own"
  on public.reminder_prefs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "reminder_prefs_delete_own"
  on public.reminder_prefs for delete
  using (auth.uid() = user_id);

create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rel text;
  tables text[] := array[
    'push_subscriptions',
    'reminder_prefs',
    'transactions',
    'recurring_rules',
    'templates',
    'budgets',
    'holdings',
    'accounts',
    'categories',
    'books'
  ];
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  foreach rel in array tables loop
    if to_regclass('public.' || rel) is not null then
      execute format('delete from public.%I where user_id = $1', rel) using uid;
    end if;
  end loop;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

notify pgrst, 'reload schema';
