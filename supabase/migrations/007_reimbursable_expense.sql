-- Expense reimbursable (待報銷): part of an expense the company will repay later.
-- Does not create a second cash movement; mark received when subsidy arrives with salary.
alter table public.transactions
  add column if not exists reimbursable_amount numeric;

alter table public.transactions
  add column if not exists reimbursement_status text;

alter table public.transactions
  drop constraint if exists transactions_reimbursement_status_check;

alter table public.transactions
  add constraint transactions_reimbursement_status_check
  check (
    reimbursement_status is null
    or reimbursement_status in ('pending', 'received')
  );
