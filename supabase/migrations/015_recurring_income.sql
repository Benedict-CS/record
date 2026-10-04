-- Monthly income (salary) uses the same recurring_rules row as expenses.
-- Widen the kind check so 'income' can sync. The original check was unnamed
-- in some databases, so drop every check that mentions kind.

do $$
declare
  cname text;
begin
  for cname in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'recurring_rules'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%kind%'
  loop
    execute format('alter table public.recurring_rules drop constraint %I', cname);
  end loop;
end $$;

alter table public.recurring_rules
  add constraint recurring_rules_kind_check
  check (kind in ('expense', 'income', 'invest'));

notify pgrst, 'reload schema';
