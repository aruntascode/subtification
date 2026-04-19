-- Bill email import MVP.
-- Run this in Supabase SQL editor or with `supabase db push`.

alter table if exists public.subscriptions
  add column if not exists currency text default '₺';

alter table if exists public.subscriptions
  drop constraint if exists subscriptions_category_check;

alter table if exists public.subscriptions
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

alter table public.email_import_addresses enable row level security;
alter table public.email_import_messages enable row level security;
alter table public.detected_bills enable row level security;

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
