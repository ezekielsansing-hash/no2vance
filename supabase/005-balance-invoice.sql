-- Migration 005 — the balance invoice
--
-- Run once in the Supabase SQL Editor. Safe to run twice.
--
-- Section 3 of the agreement splits the money in two: half to reserve the
-- date, the rest no later than seven days before the event. The deposit
-- invoice has lived on booking_links since 004; the balance gets its own
-- columns rather than a second link row, because a link is one agreement and
-- both invoices belong to it.
--
-- Keeping them in separate columns is what lets the payment webhook tell the
-- two apart. It confirms a booking on the deposit landing, and must not
-- re-confirm or re-stamp the deposit date when the balance lands months later.

alter table booking_links add column if not exists qbo_balance_invoice_id text;
alter table booking_links add column if not exists qbo_balance_doc_number text;
alter table booking_links add column if not exists qbo_balance_payment_link text;
-- Formatted the same way deposit_amount is ("$1,250"), so the acceptance page
-- and the booking detail can show it without re-deriving it.
alter table booking_links add column if not exists balance_amount text not null default '';
-- Seven days before the first event date, as sent to QuickBooks. Stored so the
-- renter is shown the same date the invoice carries.
alter table booking_links add column if not exists balance_due_on date;
alter table booking_links add column if not exists balance_paid_at timestamptz;

create index if not exists booking_links_qbo_balance_invoice_idx
  on booking_links (qbo_balance_invoice_id);
