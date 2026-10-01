-- Optional end month, and a reimbursable amount for expense rules such as gym.
-- Open-ended rules leave end_month null and keep posting on each due day.

alter table public.recurring_rules
  add column if not exists end_month text;

alter table public.recurring_rules
  add column if not exists reimbursable_amount numeric(14, 2);

alter table public.recurring_rules
  drop constraint if exists recurring_rules_reimbursable_amount_check;

alter table public.recurring_rules
  add constraint recurring_rules_reimbursable_amount_check
  check (reimbursable_amount is null or reimbursable_amount >= 0);

notify pgrst, 'reload schema';
