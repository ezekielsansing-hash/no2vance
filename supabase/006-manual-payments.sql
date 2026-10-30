-- Migration 006 — payments recorded by hand
--
-- Run once in the Supabase SQL Editor. Safe to run twice.
--
-- Some bookings were paid by Venmo, Cash App, Zelle, cash or check and never
-- went through a contract link, so QuickBooks has no record of them. These
-- columns let a booking carry what was actually paid. The deposit already has
-- deposit_amount and date_of_deposit; it gains a method. The balance gets an
-- amount, a date and a method of its own.
--
-- A method on a payment is what marks it as received: cash flow counts it on
-- its date instead of estimating.

alter table events add column if not exists deposit_method text not null default '';
alter table events add column if not exists balance_paid_amount text not null default '';
-- YYYY-MM-DD, the same as date_of_deposit.
alter table events add column if not exists balance_paid_on text not null default '';
alter table events add column if not exists balance_method text not null default '';
-- The deposit was the whole deal: no balance is owed, whatever the rate says.
alter table events add column if not exists no_balance_expected boolean not null default false;
