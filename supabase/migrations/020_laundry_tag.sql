-- Update existing laundry transactions to 'laundry' tag.
update public.transactions
set tag = 'laundry'
where type = 'expense'
  and (tag is null or tag = '' or tag = '洗衣')
  and (note = '洗衣' or note = '洗衣服' or note like '%洗衣%' or note like '%洗衣服%' or tag = '洗衣' or tag = 'laundry');

notify pgrst, 'reload schema';
