# QuickBooks Integration Plan

Goal: when a prospect is ready to book, generate one link that shows them the
contract, records that they accepted it, and collects the deposit through
QuickBooks — so booking, contract, and money all live in one place.

## The shape of it

QuickBooks handles the invoice and the payment. It does **not** handle the
contract — it has no e-signature, no way to add a checkbox to its payment
page, and no record of who read what. So the contract lives on a page we own,
and QuickBooks is only ever the checkout step.

```
Prospect (name + date + rate + deposit filled in)
   |
   |  [Copy Link]  ->  no2vance.vercel.app/accept/k3f9x2mq
   |                   creates QBO invoice, snapshots contract
   |
   |  manually flip status -> Contract Sent
   v
Customer opens link
   |  reads contract on the page
   |  checks "I have read and agree"    <- acceptance recorded here
   |  clicks Pay Deposit                -> QuickBooks payment page
   v
Payment lands -> QBO webhook -> deposit recorded, status -> Confirmed
```

The link is stable and reusable. Reopening it shows where they left off:
not yet accepted, accepted but unpaid, or paid (receipt). People lose texts
and ask you to resend — same link works.

## Decisions already made

- **Deposit payment is what confirms a booking**, not sending the invoice.
  Keeps "Confirmed" meaning money actually landed, and keeps the revenue
  figures in Analytics honest.
- **Status flip is manual** for now. Generating a link does not change status;
  you flip it to Contract Sent yourself. Revisit once the flow has some miles.
- **Contract Sent never auto-expires.** Sending a contract usually converts;
  one sitting there is a follow-up signal, not noise to be cleaned up.
- **Text by hand, at least at first.** The Copy Link button covers it, a text
  from your own number lands better than one from a registered short code,
  and it skips the A2P 10DLC registration entirely (see Phase 4).
- **Deposit is half the rate, and stays editable.** It auto-fills from the
  rate, but typing your own number pins it and a rate edit won't overwrite it.
  Clearing the field hands control back to the rate. On an existing booking a
  saved deposit is always treated as deliberate and never re-derived.

---

## Phase 0 — Groundwork

Nothing here is blocked on anyone. **Start the Intuit production key
application at the same time** — it's the long pole (see Phase 2).

### 0.1 One shared money module — DONE

`ratePackage` and `depositAmount` are free-text strings like `"$1,200"`.
There are three copies of `formatCurrency` and five separate
`.replace(/[^\d]/g, '')` calls scattered across the pages. QuickBooks needs
real numbers, so this has to be consolidated before anything else.

New `app/lib/money.ts` with `parseAmount(s): number` and
`formatCurrency(n): string`. Replace every copy. Pure refactor — no behavior
change, easy to verify against the existing pages.

Amounts stay whole dollars. `formatCurrency` drops cents by design; do not
write cents into rate or deposit fields.

`defaultDeposit` lives here too, with the 50% rule as a single `DEPOSIT_RATIO`
constant so an exception year is a one-line change.

### 0.2 Contract template moves into the repo — DONE

`app/lib/contract/v1.ts` holds the Facility Rental Agreement with the legal
language unchanged, `index.ts` holds `CONTRACT_VERSION`, the venue-wide terms,
and `renderContract()`. Changing terms means adding `v2.ts` and bumping the
constant — never editing v1, so past acceptances keep pointing at the text
that was actually agreed to.

Stored as `.ts` rather than `.md` so it bundles on Vercel without a filesystem
read or a webpack loader. `renderContract()` throws if any placeholder is left
unfilled, because a contract reaching a customer with `{{renterCity}}` still
in it is worse than an error page.

**The two blanks the Word template left are now filled**: the returned-check
fee (Section 3) and the overtime hourly rate (Section 5) are both $100.

**The Credit Card Authorization page was deliberately not ported.** It collects
a card number, expiration, and CVV as free-text fields. That cannot become a
web form — it would put raw card data on a public URL and pull the whole app
into PCI scope. QuickBooks Payments vaults cards properly; card-on-file should
go through it, or stay a paper form handled in person. Section 14's
`cardOnFile` item now refers to "a separate authorization form" instead.

**Section 3's payment wording is versioned — DONE, v2 IS CURRENT.** v1 carried
the pre-QuickBooks wording (Venmo, Cash App, cash, or check) because a contract
must not point a renter at a payment link that doesn't exist. v2 points at the
payment link on the QuickBooks invoice, and became current once production was
connected to the real company.

Flipping `CONTRACT_VERSION` was deliberately the *last* step of going live, not
the first: while QuickBooks is unreachable, invoice creation fails non-fatally
and a v2 contract would send renters to an invoice that was never issued. If
the connection ever lapses for any length of time, drop back to `v1`.

The two versions share one body: they differ only in the `{{paymentMethods}}`
placeholder, so the terms are versioned rather than the text. `CONTRACT_TERMS`
in `contract/index.ts` holds one frozen entry per version, and `CONTRACT_TEXT`
maps both v1 and v2 at the same `v1.ts` body. A v1 link still renders v1's
wording; editing a version's entry would rewrite what past links say, which is
the one thing the scheme exists to prevent.

Two consequences of the change worth noting. **Cash App is gone**, since
QuickBooks doesn't offer it; if you still want to take it, it has to stay in
the line explicitly. And **PayPal and Venmo can be added back** — QuickBooks
can offer both on invoices — but only after confirming they're enabled on the
account, not on the assumption that they are.

Two things the contract confirmed, both helpful: Section 3 states the deposit
is "One-half (1/2) of the total rental rate," so the 50% default is
contractual rather than just habit; and Section 18 already allows this
Agreement to be "delivered electronically," which is what the acceptance page
relies on.

### 0.4 The field gap

The contract has 26 fill-in slots. The booking record covers ten of them:
event type, dates, attendance, start, end, rate, deposit, renter name, phone,
and email. The rest split cleanly by who actually knows the answer.

**Yours to set — these need to be on the booking before a link can go out:**

- Access / Setup Time
- **Contracted Exit Time** — load-bearing, since overtime charges in Section 5
  are measured from it
- Additional items included for this event (Section 6)
- The Section 14 requirement checkboxes, plus the damage-deposit amount and
  security-officer count where those apply
- Photography opt-out

**The renter's own details — collect these on the acceptance page:**

- Address, City, State, Zip
- Cell phone
- Contact Name, if different from the renter
- On-Site Responsible Party and their cell

That second group is the useful realization: they're the customer's own
details, not yours, so they don't belong on the booking form at all. The
acceptance page asks for them as part of accepting — which is exactly what
the paper form did — and they're stored with the acceptance record. Less data
entry for you, and better data, since it comes from the person who knows it.

### 0.3 The fourth status — DONE

Add `'pending'` to `BookingStatus` in `app/lib/events.ts`, labeled
**Contract Sent**. `status` is plain text with no CHECK constraint, so there
is no database migration.

Touches:

- `BookingStatus` union and the three status pickers that map over it
- Filter chips in `app/page.tsx` — include it in the default filter set,
  it's the most active part of the pipeline
- The import validator's list of allowed statuses
- **Analytics**: the status pie chart enumerates exactly three statuses, so
  Contract Sent bookings would silently vanish from it until a slice is
  added. The conversion rate math needs no change — it counts
  `confirmed + lost` as resolved, so pending correctly sits out until it
  lands one way or the other.

Design: pills are shape-coded (prospect square, confirmed circle, lost
diamond). Contract Sent is a pink triangle, with `--pink-soft` and
`--pink-ink` added to `globals.css` alongside the bare `--pink` that already
existed.

The triangle is cut with `clip-path`, which also clips the 1.5px ink border
the other three shapes carry — so it's drawn as a solid fill instead, one
pixel larger to match their visual weight. At actual size the missing outline
isn't noticeable, but it is the one place the status pills aren't strictly
consistent.

Status labels and pill classes now come from `STATUS_LABELS` and
`STATUS_PILL_CLASS` in `events.ts` rather than inline ternaries. The ternaries
they replaced all ended in `: 'Confirmed'`, so a Contract Sent booking would
have rendered as Confirmed in three separate places.

The list detail panel gained a **Contract Sent** button for prospects — this
is the manual flip — and its Convert button now reads **Deposit Paid** on a
booking whose contract is already out.

---

## Phase 1 — The link and the acceptance page — BUILT

**This phase works without QuickBooks.** Ship it before Intuit approval comes
through: the Pay button initially just states the deposit amount and how to
pay you today. Phase 2 swaps in the real checkout. That means contract
acceptance starts working weeks earlier and isn't hostage to an approval queue.

### 1.1 First server-side code

The app currently has no API routes — everything talks to Supabase from the
browser with the anon key. The acceptance page is opened by customers who are
not signed in, and RLS grants access only to `authenticated`. So this phase
introduces `app/api/` backed by the Supabase **service role** key.

That key goes in Vercel env vars and **must not** be prefixed
`NEXT_PUBLIC_`. RLS policies stay exactly as they are; the public page reads
through the server, never directly.

### 1.2 Two new tables

`booking_links` — token (unguessable), event_id, contract_version,
contract_snapshot, deposit_amount, created_at.

`contract_acceptances` — link_token, accepted_at, ip, user_agent, typed_name.

The snapshot is the point: it freezes what they actually agreed to. A year
from now "what did they sign" has an answer that later template edits can't
rewrite.

### 1.3 The pieces

- **Copy Link** button on the booking detail, enabled once name, date, rate,
  and deposit are all present. In practice the deposit fills itself in from
  the rate (Phase 0.1), so the real gate is name, date, and rate.
- **`/accept/[token]`** — server-rendered public page in the Memphis style.
  Name, event date, contract text, checkbox, Pay button disabled until
  checked. Three states depending on what's already happened.
- **Status strip** on the booking detail: link generated → contract accepted
  (with timestamp) → deposit paid.

### 1.5 What shipped

- `supabase/002-contract-links.sql` — the contract fields on `events`, plus the
  `booking_links` and `contract_acceptances` tables. **Not yet run** against
  the database; see SETUP.md step 6.
- `app/lib/supabase-server.ts` — the service-role client, server only.
- `app/lib/links.ts` — token generation, the booking-to-contract field
  mapping, and `missingForLink()`, which lists the blanks that must be filled
  before a link can be created.
- `app/accept/[token]/` — the public page, its form, and its styles.
- `app/api/accept/[token]/route.ts` — records the acceptance.
- `app/lib/contract/markdown.ts` — a deliberately small Markdown renderer that
  escapes every character before formatting, because renter-supplied values
  are interpolated into the contract text.
- Booking detail gained access time, contracted exit time, additional items,
  the Section 14 checkboxes, the photography opt-out, and the Contract
  section with the link button and its status.

**Link generation runs signed-in**, through the ordinary RLS-backed client —
only the public acceptance page and its POST endpoint need the service role.
That kept the new server-side surface to two files.

**Resolved:** Section 3 carried the pre-QuickBooks wording so contracts could
go out before approval. Production keys have since landed and
`CONTRACT_VERSION` is now `v2`, whose Section 3 points at the invoice payment
link.

### 1.6 One bug the end-to-end run caught

The acceptance recorded correctly, but the page kept showing the form
afterwards — a customer would have accepted, seen no change, and assumed it
failed.

Next.js patches global `fetch` and caches GET responses, and supabase-js goes
through `fetch`. So the "no acceptance yet" result from the first page view was
being replayed on every later view. `dynamic = 'force-dynamic'` didn't help:
the page really was re-executing, the query really did return without error —
it just never reached the database.

The service-role client now passes `cache: 'no-store'` on every request. Worth
remembering for any future server-side Supabase use in this app: the query
looking correct and erroring cleanly is exactly what this failure looks like.

### 1.4 Worth noting

Anyone holding the link can open it — it's a share link, not a login. It
carries their name, event date, and amount. Standard tradeoff, but don't post
one publicly.

Clickwrap acceptance like this is generally enforceable when the terms are
conspicuous and the act of agreeing is unambiguous, which is what this
design is doing. That's not legal advice — worth having your actual contract
looked at by someone who does this for a living, since that's about the
contract's contents, not the mechanism.

---

## Phase 2 — QuickBooks — LIVE

**Intuit approved the app.** Intuit requires an app assessment questionnaire
before issuing production keys, even for a private app used only by your own
company — it was the long pole, as expected.

**Production is connected to the real company** and `CONTRACT_VERSION` is `v2`.
Going live took three passes worth recording, because each looked like success:

1. `/settings` said *not configured* — the variables weren't set for Vercel's
   **Production** scope, and Vercel reads them at deploy time, so setting them
   without redeploying changes nothing.
2. Then it said *Connected / sandbox* — the variables were set to the
   Development key pair, and the leftover sandbox connection row agreed with
   them, so the page looked healthy while pointing at fake books.
3. Swapping in the Production key pair plus `QUICKBOOKS_ENVIRONMENT=production`
   left the stored sandbox connection mismatched, which needed a **Reconnect**
   against the real company.

Settings now names the specific missing variable, and warns when the stored
connection's environment disagrees with the configured one — both added
because neither state was distinguishable from healthy.

Sandbox and production are separate app configs at Intuit: redirect URIs,
webhook endpoints, and verifier tokens are registered per environment, so a URI
on the sandbox app does nothing for production.

`QUICKBOOKS_ENVIRONMENT` selects the API host, so the switch from sandbox to
production is configuration, not code. A connection made in one environment
while the app is configured for the other is rejected with an explicit
"reconnect before continuing" rather than writing test invoices into the real
books.

- **OAuth 2.0 connect flow.** A one-time "Connect QuickBooks" screen in
  settings. Tokens go in a Supabase table, server-side only. Refresh tokens
  expire on a rolling window (~100 days) and need refreshing on a schedule —
  if it lapses you just reconnect, but silently failing invoices would be bad,
  so it needs to surface when the connection is stale.
- **On link generation**: find or create the QBO customer, create an invoice
  for the deposit with online card/ACH payment enabled, store the invoice ID
  and its payment link on the booking link record.
- **The Pay button** on the acceptance page points at that payment link.
- **`/api/quickbooks/webhook`** listens for payment events, records the
  deposit against the booking, and flips status to Confirmed. Intuit signs
  webhooks with an HMAC — verify the signature, don't trust the payload.

Open question: if you change a booking's deposit *after* the link is out,
the invoice is already in QuickBooks. Simplest rule is that editing the
deposit updates the existing invoice; the alternative is voiding and
reissuing. Worth deciding once you see how often it actually happens.

**QuickBooks Payments is already active** on the company — approved merchant
account, card and bank transfer both enabled, deposits going to Truist. So
there is no second application to wait on, and the Section 3 wording (card,
debit, ACH, or check) describes what the invoice will actually offer.

Confirmed settings: cards deposit in 1 business day, bank transfers in 1–5,
and the processing limit is $300,000 per 30 days — far above anything a
deposit will approach.

**Sales tax: not applicable.** Facility rental is not taxable in Tennessee, so
the deposit invoice correctly carries no tax line and sets no tax fields. If
that ever changes, the invoice body in `quickbooks/invoice.ts` is where a
`TxnTaxDetail` would go.

Cost: roughly 2.9% on cards and ~1% on ACH. On a $1,250 deposit that's about
$36 versus $12.50, so it's worth presenting bank transfer first.

One consequence of ACH's 1–5 day settlement: the payment webhook fires when
the customer pays, not when the money lands. That's the right trigger — they
have paid and the transfer is in flight — but it means a booking can flip to
Confirmed a few days before the deposit appears in the Truist account. Worth
knowing before that gap looks like a bug.

### What the first live link generation caught

Two things, both found on the first real attempt against the company file.

**Names are one namespace.** QuickBooks keeps customers, vendors, and
employees in a single list of names — a name used by any of the three cannot
be used by the other two. `findOrCreateCustomer` looks for an active customer
and creates one when there isn't one, so a renter who is already an employee
or vendor fails the create with Intuit's `6240` duplicate-name error. The
first test booking hit exactly that: an *employee* named "Anna Barnett"
already existed. Resolving it means renaming someone in the books, which is a
decision about the venue's records, so the code names the record standing in
the way instead of inventing a display name.

**The income account is named, not guessed.** `findIncomeAccountRef` used to
take the first active Income account Intuit returned, which on these books is
*Billable Expense Income* — every deposit would have been filed there. It now
looks up `Event Income` (id 164) by name and fails loudly if it's missing.
This only matters when the `Facility Rental Deposit` item is created, which
happens once, so it was worth catching before the first invoice rather than
after.

**Intuit's fault text now reaches the error message.** Every validation
failure is a 400 and the body carries the only useful part — the code and the
Detail line. `describeQuickBooksFault` pulls it out, so the alert says what
was wrong instead of just naming the endpoint that failed.

### Phase 2.5 — The balance invoice — BUILT

Section 3 splits the money in two, so the app does too. The deposit invoice
rides along with the contract link; the balance is a second invoice raised from
the booking detail, weeks or months later, with a due date seven days before
the event (`BALANCE_DUE_DAYS_BEFORE`, clamped to today for a booking taken
inside that window).

Both invoices hang off the same `booking_links` row in their own columns
(`005-balance-invoice.sql`). That separation is load-bearing: the payment
webhook confirms a booking when the *deposit* lands, and a balance arriving
months later must not re-confirm it or restamp `date_of_deposit`. `settleInvoice`
now looks the invoice up in both columns and branches.

The amount comes from the **frozen contract fields**, not the booking's current
rate — the renter owes what the signed agreement says, and an edit made
afterwards doesn't change that. A rate left as free text like "TBD" parses to
zero and produces a negative balance; that case is named explicitly rather than
reported as "the deposit covers the full rate."

The renter pays it on the link they already hold. `/accept/[token]` gained a
fourth state: deposit paid and balance outstanding, with its own Pay button.

**Not covered, deliberately.** The Section 14 refundable damage / cleaning
deposit is "due with the balance" but isn't on this invoice — it isn't income
the venue keeps, so it needs its own account decision first. Post-event charges
under Additional Charges are a third invoice, raised in QuickBooks by hand.

### Two things the live books taught us

**A BillEmail is what mints the payment link.** `include=invoiceLink` returns
nothing unless the invoice carries a `BillEmail` — checked across eight open
invoices in the company file, four with an address and four without, and the
correlation is exact (`EmailStatus` makes no difference; the link appears while
the invoice is still unsent). Since `customers.email` is optional and mostly
empty, the first deposit invoice came back with no payment link at all, which
would have shown the renter a contract and no way to pay it.

Invoices now always carry a BillEmail: the customer's if there is one, and
`SUPPORT_EMAIL` otherwise. That's what the venue's own books already do —
invoices 1053 and 1050 use no2vance@gmail.com for exactly this reason. Setting
the field sends nothing; sending needs a separate `send` call the app never
makes.

**API-created invoices come out unnumbered.** The company has *Custom
transaction numbers* switched on (`SalesFormsPrefs.CustomTxnNumbers: true`),
which stops QuickBooks auto-assigning a `DocNumber` to anything the API
creates. Invoices raised inside QuickBooks are numbered normally (…1100, 1105,
1132); invoice 2712, raised by the app, has no number at all. Either turn that
setting off in QuickBooks so it numbers them again, or have the app supply a
`DocNumber` — which means owning the sequence and not colliding with the
numbers QuickBooks hands out. Until then the UI says "invoice raised" instead
of printing an empty `#`.

**Redirect URIs to register** on the Intuit app's settings page:

- `http://localhost:3000/api/quickbooks/callback` (development)
- `https://book.no2vance.com/api/quickbooks/callback` (production)

The custom domain is also what contract links should use. The Copy Link button
builds the URL from whatever origin the app is open at, so working from
`book.no2vance.com` rather than the vercel.app address is what puts the good
domain in front of customers.

---

## Phase 3 — Email sending

A sending domain through Resend or Postmark, with SPF/DKIM records. Maybe
half an hour, free at your volume.

The real constraint is data: `customers.email` is optional and mostly empty,
and the imported 2021 bookings have essentially none. So the email option
stays greyed out on any prospect without an address on file. It gets more
useful over time as addresses accumulate — no point blocking on a backfill.

---

## Phase 4 — Automated text (probably not)

Sending SMS programmatically in the US means Twilio plus A2P 10DLC
registration — registering your business and your messaging campaign with the
carriers, with an approval wait and a small monthly fee.

Only worth doing if copying the link and texting it yourself becomes a real
chore. A message from your own number is more likely to be read than one from
an unfamiliar number, so this may never be an upgrade.

---

## Order of operations

1. ~~Start the Intuit production key application.~~ Approved.
2. ~~Phase 0 — money module, contract into the repo, Contract Sent status.~~
3. ~~Phase 1 — links and acceptance page, working without QuickBooks.~~
4. ~~Phase 2 — wire up QuickBooks whenever approval lands.~~ Live on production
   keys, connected to the real company, contract `v2` current.
5. Phase 3 — email, once it's worth it. **Next**, alongside the two gaps this
   phase left: nothing writes `booking_links.voided_at`, so there is no
   void-and-reissue path and a second link means a second invoice; and the
   payment webhook is unproven until a real payment runs through it.
