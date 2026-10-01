-- Optional expense tag. One value for now: 'treat' (請客).
-- It is not a second category, so reports keep counting the row once.
alter table public.transactions
  add column if not exists tag text;

notify pgrst, 'reload schema';
