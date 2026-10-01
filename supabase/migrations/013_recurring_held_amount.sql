-- Part of a monthly expense can be 扣住 (a hold, not spending), such as rent.

alter table public.recurring_rules
  add column if not exists held_amount numeric(14, 2);

alter table public.recurring_rules
  drop constraint if exists recurring_rules_held_amount_check;

alter table public.recurring_rules
  add constraint recurring_rules_held_amount_check
  check (held_amount is null or held_amount >= 0);

notify pgrst, 'reload schema';
