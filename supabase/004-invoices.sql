-- Migration 004 — QuickBooks invoice on a contract link
--
-- Run once in the Supabase SQL Editor. Safe to run twice.

-- A link may exist without an invoice: the acceptance page works whether or
-- not QuickBooks is connected, so these are all nullable.
alter table booking_links add column if not exists qbo_invoice_id text;
alter table booking_links add column if not exists qbo_doc_number text;
alter table booking_links add column if not exists qbo_payment_link text;
-- Set when the invoice balance reaches zero, so a repeated webhook can tell
-- "already handled" from "newly paid" without re-confirming the booking.
alter table booking_links add column if not exists paid_at timestamptz;

create index if not exists booking_links_qbo_invoice_idx
  on booking_links (qbo_invoice_id);
