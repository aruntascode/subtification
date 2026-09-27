-- Süreli abonelik ve taksit desteği
-- duration_months: kaç ay sürecek (null = süresiz)
-- is_installment: taksitli alım mı
-- first_billing_date: süreli kayıtlarda ilk ödemenin tarihi (kalan ay bundan hesaplanır)
alter table public.subscriptions
  add column if not exists duration_months integer,
  add column if not exists is_installment boolean not null default false,
  add column if not exists first_billing_date date;

alter table public.subscriptions
  drop constraint if exists subscriptions_duration_months_check;

alter table public.subscriptions
  add constraint subscriptions_duration_months_check
  check (duration_months is null or (duration_months between 1 and 120));
