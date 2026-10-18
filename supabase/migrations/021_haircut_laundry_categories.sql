-- 1. Ensure '剪頭髮' and '洗衣' categories exist for all books if missing, 
-- and migrate matching transactions from '其他支出' (or other categories) to these true categories.

do $$
declare
  b record;
  haircut_cat_id uuid;
  laundry_cat_id uuid;
begin
  for b in select id, user_id from public.books where deleted_at is null
  loop
    -- Ensure '剪頭髮' category exists
    select id into haircut_cat_id
    from public.categories
    where book_id = b.id and name = '剪頭髮' and deleted_at is null;

    if haircut_cat_id is null then
      haircut_cat_id := gen_random_uuid();
      insert into public.categories (id, book_id, user_id, name, kind, icon, color, sort_order, updated_at, client_id)
      values (haircut_cat_id, b.id, b.user_id, '剪頭髮', 'expense', 'scissors', '#2980b9', 14, timezone('utc'::text, now()), 'migration');
    end if;

    -- Ensure '洗衣' category exists
    select id into laundry_cat_id
    from public.categories
    where book_id = b.id and name = '洗衣' and deleted_at is null;

    if laundry_cat_id is null then
      laundry_cat_id := gen_random_uuid();
      insert into public.categories (id, book_id, user_id, name, kind, icon, color, sort_order, updated_at, client_id)
      values (laundry_cat_id, b.id, b.user_id, '洗衣', 'expense', 'shirt', '#8e44ad', 15, timezone('utc'::text, now()), 'migration');
    end if;

    -- Migrate haircut transactions matching notes or tags
    update public.transactions
    set category_id = haircut_cat_id,
        tag = null
    where book_id = b.id
      and type = 'expense'
      and deleted_at is null
      and (
        note like '%頭髮%' or
        note like '%剪髮%' or
        note like '%理髮%' or
        note like '%染髮%' or
        note like '%燙髮%' or
        tag = 'haircut' or tag = '剪頭髮'
      );

    -- Migrate laundry transactions matching notes or tags
    update public.transactions
    set category_id = laundry_cat_id,
        tag = null
    where book_id = b.id
      and type = 'expense'
      and deleted_at is null
      and (
        note like '%洗衣%' or
        note like '%洗衣服%' or
        tag = 'laundry' or tag = '洗衣'
      );
  end loop;
end $$;

notify pgrst, 'reload schema';
