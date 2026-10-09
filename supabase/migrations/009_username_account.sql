-- Turn the existing email login into the account name "benedict".
-- The ledger stays on the same user id, and the password is unchanged.
-- Run this before anyone registers the name benedict, or the name is already taken.
-- Supabase Auth still requires an email-shaped id, so the stored address is
-- benedict@users.record. The app shows and accepts only "benedict".

do $$
declare
  old_email text := 'ben111611@gmail.com';
  new_email text := 'benedict@users.record';
  username text := 'benedict';
  target_id uuid;
  has_provider_id boolean;
  has_identity_updated_at boolean;
begin
  if exists (
    select 1 from auth.users where lower(email) = new_email
  ) then
    raise exception
      'account % already exists; do not register it before this migration',
      username;
  end if;

  select id into target_id
  from auth.users
  where lower(email) = old_email;

  if target_id is null then
    raise notice 'no auth user for %, nothing to rename', old_email;
    return;
  end if;

  update auth.users
  set
    email = new_email,
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_user_meta_data =
      coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('username', username),
    updated_at = now()
  where id = target_id;

  update auth.identities
  set identity_data = jsonb_set(
    identity_data,
    '{email}',
    to_jsonb(new_email),
    true
  )
  where user_id = target_id
    and provider = 'email';

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'identities'
      and column_name = 'provider_id'
  ) into has_provider_id;

  if has_provider_id then
    execute
      'update auth.identities set provider_id = $1 where user_id = $2 and provider = ''email'''
      using new_email, target_id;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'identities'
      and column_name = 'updated_at'
  ) into has_identity_updated_at;

  if has_identity_updated_at then
    execute
      'update auth.identities set updated_at = now() where user_id = $1 and provider = ''email'''
      using target_id;
  end if;
end $$;
