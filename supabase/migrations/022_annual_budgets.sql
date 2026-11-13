-- Migration 022: Support annual budgets (month = 0)
-- Allow month = 0 in public.budgets to represent an annual budget for that year.
alter table public.budgets drop constraint if exists budgets_month_check;
alter table public.budgets add constraint budgets_month_check check (month between 0 and 12);
comment on column public.budgets.month is '1-12 for monthly budget, 0 for annual budget';
