-- Hesap silme (App Store Guideline 5.1.1(v) gereği uygulama içinden yapılabilmeli)
--
-- Client anon key ile auth.users tablosuna yazamaz. Bu yüzden oturumdaki
-- kullanıcının KENDİ kaydını silen, SECURITY DEFINER bir fonksiyon tanımlıyoruz.
-- Fonksiyon auth.uid() dışında hiçbir id kabul etmiyor; parametre almadığı için
-- başkasının hesabını silmek mümkün değil.
--
-- subscriptions tablosundaki kayıtlar user_id üzerindeki
-- "on delete cascade" sayesinde otomatik siliniyor.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
