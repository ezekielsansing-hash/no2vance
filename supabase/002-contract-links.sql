-- Migration 002 — contract links and acceptance records
--
-- Run this once in the Supabase SQL Editor, the same way you ran schema.sql
-- (Dashboard > SQL Editor > New query > paste > Run). Safe to run twice.

-- ---------------------------------------------------------------------------
-- Booking fields the rental agreement needs but the app never captured.
-- The renter's own details (address, cell, on-site party) are deliberately
-- absent: those are collected from the customer on the acceptance page.
-- ---------------------------------------------------------------------------

alter table events add column if not exists access_time text not null default '';
alter table events add column if not exists exit_time text not null default '';
alter table events add column if not exists additional_items text not null default '';
alter table events add column if not exists photography_opt_out boolean not null default false;
-- Section 14 checkboxes: { damageDeposit: { checked: true, value: "$500" }, ... }
alter table events add column if not exists requirements jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- One link per booking-send. The booking-side field values are frozen here at
-- generation time, so later edits to the booking can't change what a renter
-- was shown.
-- ---------------------------------------------------------------------------

create table if not exists booking_links (
  token text primary key,
  event_id text not null references events(id) on delete cascade,
  contract_version text not null,
  booking_fields jsonb not null,
  deposit_amount text not null default '',
  created_at timestamptz not null default now(),
  -- Set when a link is superseded or withdrawn; a voided link stops working
  -- but is kept, because it may already have an acceptance attached.
  voided_at timestamptz
);

create index if not exists booking_links_event_id_idx on booking_links (event_id);

-- ---------------------------------------------------------------------------
-- The evidence record. contract_text is the full, final agreement exactly as
-- rendered to the renter — not a reference to a template that might change.
-- ---------------------------------------------------------------------------

create table if not exists contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  token text not null references booking_links(token) on delete cascade,
  accepted_at timestamptz not null default now(),
  ip text not null default '',
  user_agent text not null default '',
  typed_name text not null default '',
  renter_fields jsonb not null,
  contract_text text not null
);

create index if not exists contract_acceptances_token_idx on contract_acceptances (token);

-- ---------------------------------------------------------------------------
-- RLS. Signed-in staff get full access, same as every other table. Renters are
-- never signed in — the acceptance page reads and writes through the server
-- using the service role key, which bypasses RLS entirely. That is why these
-- policies grant nothing to anon.
-- ---------------------------------------------------------------------------

alter table booking_links enable row level security;
alter table contract_acceptances enable row level security;

drop policy if exists "authenticated full access" on booking_links;
create policy "authenticated full access" on booking_links
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on contract_acceptances;
create policy "authenticated full access" on contract_acceptances
  for all to authenticated using (true) with check (true);
