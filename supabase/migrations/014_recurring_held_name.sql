-- The held part of a monthly charge can use a different name, such as 電費預繳.

alter table public.recurring_rules
  add column if not exists held_name text;

notify pgrst, 'reload schema';
