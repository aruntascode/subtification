-- Subtification backend rebuild / repair SQL.
-- Safe by default: it does NOT drop tables and does NOT delete rows.
-- Paste this whole file into Supabase SQL Editor and run it.

create extension if not exists pgcrypto;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  amount numeric(12, 2) not null default 0,
  currency text not null default '₺',
  billing_cycle text not null default 'monthly',
  next_billing_date date not null default current_date,
  category text not null default 'other',
  emoji text not null default 'apps',
  color text not null default '#002e73',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.subscriptions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists name text,
  add column if not exists amount numeric(12, 2) default 0,
  add column if not exists currency text default '₺',
  add column if not exists billing_cycle text default 'monthly',
  add column if not exists next_billing_date date default current_date,
  add column if not exists category text default 'other',
  add column if not exists emoji text default 'apps',
  add column if not exists color text default '#002e73',
  add column if not exists notes text,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- If an older table used `price`, copy it into `amount`.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'price'
  ) then
    execute
      'update public.subscriptions set amount = price where amount is null or amount = 0';
  end if;
end $$;

update public.subscriptions
set
  currency = coalesce(currency, '₺'),
  billing_cycle = coalesce(billing_cycle, 'monthly'),
  next_billing_date = coalesce(next_billing_date, current_date),
  category = coalesce(category, 'other'),
  emoji = coalesce(emoji, 'apps'),
  color = coalesce(color, '#002e73'),
  is_active = coalesce(is_active, true),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

-- Remove old category/billing constraints before installing the current app constraints.
do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.subscriptions'::regclass
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) ilike '%category%'
        or pg_get_constraintdef(oid) ilike '%billing_cycle%'
      )
  loop
    execute format(
      'alter table public.subscriptions drop constraint if exists %I',
      constraint_record.conname
    );
  end loop;
end $$;

alter table public.subscriptions
  alter column amount set not null,
  alter column currency set not null,
  alter column billing_cycle set not null,
  alter column next_billing_date set not null,
  alter column category set not null,
  alter column emoji set not null,
  alter column color set not null,
  alter column is_active set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table public.subscriptions
  add constraint subscriptions_billing_cycle_check
  check (billing_cycle in ('monthly', 'yearly', 'weekly', 'quarterly'));

alter table public.subscriptions
  add constraint subscriptions_category_check
  check (
    category in (
      'entertainment',
      'music',
      'gaming',
      'news',
      'finance',
      'utilities',
      'shopping',
      'productivity',
      'cloud',
      'developer',
      'design',
      'health',
      'fitness',
      'food',
      'travel',
      'education',
      'social',
      'security',
      'other'
    )
  );

create table if not exists public.email_import_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_part text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_import_addresses_local_part_format
    check (local_part ~ '^[a-z0-9][a-z0-9._-]{2,62}$')
);

create table if not exists public.email_import_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_address_id uuid references public.email_import_addresses(id) on delete set null,
  source_message_id text not null,
  from_email text,
  to_email text,
  subject text,
  received_at timestamptz,
  body_preview text,
  parsing_status text not null default 'received'
    check (parsing_status in ('received', 'parsed', 'ignored', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  unique (user_id, source_message_id)
);

create table if not exists public.detected_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_address_id uuid references public.email_import_addresses(id) on delete set null,
  source_message_id text not null,
  provider_key text,
  service_name text not null,
  amount numeric(12, 2) not null,
  currency text not null default '₺',
  due_date date,
  billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'yearly', 'weekly', 'quarterly')),
  category text not null default 'utilities',
  status text not null default 'pending'
    check (status in ('pending', 'imported', 'ignored')),
  confidence numeric(4, 3) not null default 0,
  sender_email text,
  raw_subject text,
  received_at timestamptz,
  parsed_payload jsonb not null default '{}'::jsonb,
  imported_subscription_id uuid references public.subscriptions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_message_id)
);

create index if not exists subscriptions_user_date_idx
  on public.subscriptions(user_id, next_billing_date);

create index if not exists email_import_addresses_user_id_idx
  on public.email_import_addresses(user_id);

create index if not exists detected_bills_user_status_idx
  on public.detected_bills(user_id, status, created_at desc);

create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists subscriptions_updated_at
  on public.subscriptions;

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.update_updated_at();

drop trigger if exists email_import_addresses_updated_at
  on public.email_import_addresses;

create trigger email_import_addresses_updated_at
  before update on public.email_import_addresses
  for each row execute function public.update_updated_at();

drop trigger if exists detected_bills_updated_at
  on public.detected_bills;

create trigger detected_bills_updated_at
  before update on public.detected_bills
  for each row execute function public.update_updated_at();

alter table public.subscriptions enable row level security;
alter table public.email_import_addresses enable row level security;
alter table public.email_import_messages enable row level security;
alter table public.detected_bills enable row level security;

drop policy if exists "Users can manage their own subscriptions"
  on public.subscriptions;

create policy "Users can manage their own subscriptions"
  on public.subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own import addresses"
  on public.email_import_addresses;

create policy "Users can manage own import addresses"
  on public.email_import_addresses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own import messages"
  on public.email_import_messages;

create policy "Users can read own import messages"
  on public.email_import_messages
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can manage own detected bills"
  on public.detected_bills;

create policy "Users can manage own detected bills"
  on public.detected_bills
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
