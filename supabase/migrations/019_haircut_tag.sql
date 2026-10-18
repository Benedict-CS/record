-- Update existing haircut transactions to 'haircut' tag.
update public.transactions
set tag = 'haircut'
where type = 'expense'
  and (tag is null or tag = '' or tag = '剪頭髮')
  and (note = '剪頭髮' or note like '%剪頭髮%' or note like '%剪髮%' or note like '%理髮%' or tag = '剪頭髮' or tag = 'haircut');

notify pgrst, 'reload schema';
