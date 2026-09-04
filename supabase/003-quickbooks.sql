-- Migration 003 — QuickBooks connection
--
-- Run once in the Supabase SQL Editor. Safe to run twice.

-- A single row holding the OAuth tokens for the connected QuickBooks company.
-- Tokens are only ever read server-side; RLS grants nothing to anyone, so even
-- a signed-in browser session cannot read them. The service role bypasses RLS,
-- which is the only path that touches this table.
create table if not exists quickbooks_connection (
  id text primary key default 'default',
  realm_id text not null,
  access_token text not null,
  refresh_token text not null,
  -- Access tokens last about an hour; refresh tokens roll on a ~100 day
  -- window. Both expiries are stored so a stale connection can be surfaced
  -- before it silently stops issuing invoices.
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  environment text not null default 'sandbox',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quickbooks_connection_single_row check (id = 'default')
);

alter table quickbooks_connection enable row level security;
-- Deliberately no policy: no client-side role may read or write this table.

-- Short-lived CSRF state for the OAuth handshake. Rows are deleted on use and
-- anything older than an hour is stale.
create table if not exists quickbooks_oauth_state (
  state text primary key,
  created_at timestamptz not null default now()
);

alter table quickbooks_oauth_state enable row level security;
