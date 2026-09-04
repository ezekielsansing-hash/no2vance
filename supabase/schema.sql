-- no2vance schema
-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New query > paste > Run).
-- Then run 002-contract-links.sql in the same way.

create table if not exists customers (
  id text primary key,
  name text not null,
  contact text not null,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id text primary key,
  status text not null default 'prospect',
  event_type text not null default '',
  event_date text not null default '',
  customer_id text references customers(id) on delete set null,
  customer_name text not null default '',
  customer_contact text not null default '',
  rate_package text not null default '',
  lead_source text not null default '',
  heard_from text not null default '',
  date_of_deposit text not null default '',
  deposit_amount text not null default '',
  contract_link text not null default '',
  airbnb text not null default '',
  estimated_guest_count text not null default '',
  event_time_start text not null default '',
  event_time_end text not null default '',
  setup_layout text not null default '',
  effort_level text not null default '',
  vendor_list text not null default '',
  photo_folder text not null default '',
  post_event_notes text not null default '',
  created_at timestamptz not null default now(),
  converted_at timestamptz
);

create table if not exists event_types (
  name text primary key,
  created_at timestamptz not null default now()
);

create table if not exists saved_vendors (
  id text primary key,
  name text not null,
  category text not null,
  description text not null default '',
  phone text not null default '',
  website text not null default '',
  address text not null default '',
  price_range text not null default '',
  notes text not null default '',
  saved_at timestamptz not null default now()
);

-- Row Level Security: any signed-in user has full access; anonymous visitors have none.
alter table customers enable row level security;
alter table events enable row level security;
alter table event_types enable row level security;
alter table saved_vendors enable row level security;

create policy "authenticated full access" on customers
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on events
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on event_types
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on saved_vendors
  for all to authenticated using (true) with check (true);

create index if not exists events_event_date_idx on events (event_date);
create index if not exists events_customer_id_idx on events (customer_id);
