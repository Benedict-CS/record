-- Let a signed-in person delete their own Supabase account.
-- Public ledger rows reference auth.users with on delete cascade; this
-- function also deletes them explicitly so a table added without that
-- cascade is still cleared. Other devices keep their local copy.
-- Run this in the Supabase SQL editor, then: notify is included below.

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
