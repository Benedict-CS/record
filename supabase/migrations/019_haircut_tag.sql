-- Add migration to normalize existing haircut transactions into 'haircut' tag.
update public.transactions
set tag = 'haircut'
where type = 'expense'
  and (tag is null or tag = '' or tag = '剪頭髮')
  and (note = '剪頭髮' or tag = '剪頭髮' or tag = 'haircut');

notify pgrst, 'reload schema';
