-- Bulletproof migration 021: Ensure '剪頭髮' and '洗衣' categories exist per user 
-- and update matching expense transactions by user_id and note/tag patterns.

insert into public.categories (id, book_id, user_id, name, kind, icon, color, sort_order, updated_at, client_id)
select 
  gen_random_uuid(),
  (select id from public.books b where b.user_id = t.user_id and b.deleted_at is null order by sort_order limit 1),
  t.user_id,
  '剪頭髮',
  'expense',
  'scissors',
  '#2980b9',
  14,
  timezone('utc'::text, now()),
  'migration'
from (select distinct user_id from public.transactions where note like '%頭髮%' or note like '%剪髮%' or note like '%理髮%' or note like '%染髮%' or note like '%燙髮%' or tag = 'haircut' or tag = '剪頭髮') t
where not exists (
  select 1 from public.categories c where c.user_id = t.user_id and c.name = '剪頭髮' and c.deleted_at is null
);

insert into public.categories (id, book_id, user_id, name, kind, icon, color, sort_order, updated_at, client_id)
select 
  gen_random_uuid(),
  (select id from public.books b where b.user_id = t.user_id and b.deleted_at is null order by sort_order limit 1),
  t.user_id,
  '洗衣',
  'expense',
  'shirt',
  '#8e44ad',
  15,
  timezone('utc'::text, now()),
  'migration'
from (select distinct user_id from public.transactions where note like '%洗衣%' or note like '%洗衣服%' or tag = 'laundry' or tag = '洗衣') t
where not exists (
  select 1 from public.categories c where c.user_id = t.user_id and c.name = '洗衣' and c.deleted_at is null
);

-- Update haircut transactions
update public.transactions tr
set category_id = c.id,
    tag = null
from public.categories c
where c.user_id = tr.user_id
  and c.name = '剪頭髮'
  and c.deleted_at is null
  and tr.type = 'expense'
  and tr.deleted_at is null
  and (
    tr.note like '%頭髮%' or
    tr.note like '%剪髮%' or
    tr.note like '%理髮%' or
    tr.note like '%染髮%' or
    tr.note like '%燙髮%' or
    tr.tag = 'haircut' or tr.tag = '剪頭髮'
  );

-- Update laundry transactions
update public.transactions tr
set category_id = c.id,
    tag = null
from public.categories c
where c.user_id = tr.user_id
  and c.name = '洗衣'
  and c.deleted_at is null
  and tr.type = 'expense'
  and tr.deleted_at is null
  and (
    tr.note like '%洗衣%' or
    tr.note like '%洗衣服%' or
    tr.tag = 'laundry' or tr.tag = '洗衣'
  );

notify pgrst, 'reload schema';
