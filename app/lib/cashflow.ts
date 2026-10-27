/**
 * Cash flow: when money actually arrives, as opposed to when events happen.
 *
 * Every confirmed booking produces two payments, the deposit and the balance
 * (Section 3 of the agreement). Each payment is in one of four states:
 *
 * - received:  QuickBooks told us it was paid (booking_links.paid_at /
 *              balance_paid_at, stamped by the payment webhook).
 * - estimated: a booking from before contract links existed. Nothing recorded
 *              when it was paid, so the deposit is placed on date_of_deposit and
 *              the balance on its due date, and the chart shades them lighter.
 * - scheduled: owed but not yet due.
 * - overdue:   owed and past its due date.
 *
 * Everything here is pure, so the page can stay a thin view over it.
 */
import { BALANCE_DUE_DAYS_BEFORE } from './contract'
import type { EventRecord } from './events'
import type { BookingLink } from './links'
import { DEPOSIT_RATIO, parseAmount } from './money'

// ---------------------------------------------------------------------------
// Settings. Plain constants so a change is a one-line edit.
// ---------------------------------------------------------------------------

/**
 * What it costs to run the venue each month, including Kim's $500/week base.
 * Source: "H&S Monthly Operating Costs (2026)" in Finance & Taxes, built from
 * the Jan to Sep 2026 bank and card statements. $4,123 building, taxes and
 * operations + $2,167 Kim. Excludes her 10% commission and renovation.
 */
export const MONTHLY_COSTS = 6290

/** The year the pace targets track. */
export const PACE_YEAR = 2027

/**
 * Proposed 2027 booking-pace targets from the 2027 planning deck: total value
 * of 2027 events booked (deposit paid) by each date.
 */
export const PACE_TARGETS: { date: string; amount: number }[] = [
  { date: '2026-12-31', amount: 20000 },
  { date: '2027-03-31', amount: 45000 },
  { date: '2027-06-30', amount: 65000 },
  { date: '2027-09-30', amount: 82000 },
  { date: '2027-12-31', amount: 92000 },
]

/**
 * Where the targets were set from: about $8,500 of 2027 events were booked
 * when the plan was written (Oct 20, 2026). The target line starts here.
 */
export const PACE_BASELINE = { date: '2026-10-20', amount: 8500 }

/** The fallback-plan trigger: under this much booked by this date. */
export const PANIC_TRIGGER = { date: '2027-06-30', amount: 45000 }

/** How far ahead "coming due" looks, in days. */
export const LOOKAHEAD_DAYS = 60

/** Payments are dated in the venue's own zone, not UTC. */
const VENUE_TIME_ZONE = 'America/Chicago'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaymentKind = 'deposit' | 'balance'
export type PaymentState = 'received' | 'estimated' | 'scheduled' | 'overdue'

export type CashItem = {
  eventId: string
  customerName: string
  eventType: string
  eventDate: string
  kind: PaymentKind
  amount: number
  /** Paid date for received/estimated, due date for scheduled/overdue. */
  date: string
  state: PaymentState
  /** Balance only: whether the QuickBooks balance invoice has been raised. */
  invoiceRaised?: boolean
  /** Booked through a contract link (vs. an older, pre-link booking). */
  viaLink: boolean
}

export type MonthBucket = {
  key: string // "2026-10"
  label: string // "Oct 26"
  received: number
  estimated: number
  scheduled: number
  costs: number
}

// ---------------------------------------------------------------------------
// Date helpers. ISO strings throughout; parsed by hand to dodge UTC drift.
// ---------------------------------------------------------------------------

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isIsoDate(value: string | undefined): value is string {
  return !!value && ISO_DATE.test(value.trim())
}

/** A timestamp ("2026-09-21T15:04:00Z") as a calendar date in Memphis. */
export function toVenueDate(timestamp: string): string {
  if (isIsoDate(timestamp)) return timestamp.trim()
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return ''
  // en-CA formats as YYYY-MM-DD.
  return d.toLocaleDateString('en-CA', { timeZone: VENUE_TIME_ZONE })
}

export function todayVenueDate(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: VENUE_TIME_ZONE })
}

export function addDays(iso: string, days: number): string {
  const m = ISO_DATE.exec(iso.trim())
  if (!m) return ''
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function addMonths(key: string, months: number): string {
  const [y, m] = key.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[m - 1]} ${String(y).slice(2)}`
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

/**
 * The link that carries a booking's money. Prefer one that has been paid
 * (nothing voids links yet, so a second link is possible); otherwise the
 * newest that isn't voided.
 */
export function primaryLinks(links: BookingLink[]): Map<string, BookingLink> {
  const byEvent = new Map<string, BookingLink>()
  for (const link of links) {
    const current = byEvent.get(link.eventId)
    if (!current) {
      if (!link.voidedAt || link.paidAt) byEvent.set(link.eventId, link)
      continue
    }
    const better =
      (link.paidAt && !current.paidAt) ||
      (!!link.paidAt === !!current.paidAt &&
        !link.voidedAt &&
        link.createdAt > current.createdAt)
    if (better) byEvent.set(link.eventId, link)
  }
  return byEvent
}

/**
 * The deposit and balance for every confirmed booking.
 *
 * Amounts come from the link when there is one (the frozen contract terms the
 * renter agreed to), otherwise from the booking itself. A booking with no rate
 * (internal events, "TBD") produces nothing.
 */
export function buildCashItems(
  events: EventRecord[],
  links: BookingLink[],
  today: string = todayVenueDate(),
): CashItem[] {
  const linkFor = primaryLinks(links)
  const items: CashItem[] = []

  for (const event of events) {
    if (event.status !== 'confirmed') continue
    if (!isIsoDate(event.eventDate)) continue
    const eventDate = event.eventDate.trim()
    const link = linkFor.get(event.id)

    const rate = parseAmount(link?.bookingFields?.rentalRate || event.ratePackage)
    if (rate <= 0) continue

    let deposit = parseAmount(link?.depositAmount || event.depositAmount)
    // Older bookings often left the deposit blank. Assume the contract's
    // half; a deposit larger than the rate is a typo, so cap it.
    if (deposit <= 0) deposit = Math.round(rate * DEPOSIT_RATIO)
    deposit = Math.min(deposit, rate)

    const base = {
      eventId: event.id,
      customerName: event.customerName || 'Unknown',
      eventType: event.eventType,
      eventDate,
      viaLink: !!link,
    }

    // --- Deposit -----------------------------------------------------------
    if (link?.paidAt) {
      items.push({ ...base, kind: 'deposit', amount: deposit, date: toVenueDate(link.paidAt), state: 'received' })
    } else {
      // Confirmed without a webhook-recorded payment: an older booking, or one
      // confirmed by hand. Take the recorded deposit date if there is one.
      const when =
        (isIsoDate(event.dateOfDeposit) && event.dateOfDeposit.trim()) ||
        (event.convertedAt && toVenueDate(event.convertedAt)) ||
        (event.createdAt && toVenueDate(event.createdAt)) ||
        eventDate
      items.push({ ...base, kind: 'deposit', amount: deposit, date: when, state: 'estimated' })
    }

    // --- Balance -----------------------------------------------------------
    const balance =
      parseAmount(link?.balanceAmount) || Math.max(0, rate - deposit)
    if (balance <= 0) continue

    const due =
      (isIsoDate(link?.balanceDueOn) && link!.balanceDueOn!.trim()) ||
      addDays(eventDate, -BALANCE_DUE_DAYS_BEFORE)

    if (link?.balancePaidAt) {
      items.push({ ...base, kind: 'balance', amount: balance, date: toVenueDate(link.balancePaidAt), state: 'received', invoiceRaised: true })
    } else if (!link && eventDate < today) {
      // A pre-link booking whose event has happened: assume it was settled
      // on time, since nothing in the app recorded otherwise.
      items.push({ ...base, kind: 'balance', amount: balance, date: due, state: 'estimated' })
    } else {
      items.push({
        ...base,
        kind: 'balance',
        amount: balance,
        date: due,
        state: due < today ? 'overdue' : 'scheduled',
        invoiceRaised: !!link?.balanceInvoiceId,
      })
    }
  }

  return items
}

/** Monthly totals over [from, from + count) months. */
export function monthlyBuckets(items: CashItem[], fromKey: string, count: number): MonthBucket[] {
  const buckets: MonthBucket[] = []
  const index = new Map<string, MonthBucket>()
  for (let i = 0; i < count; i++) {
    const key = addMonths(fromKey, i)
    const bucket = { key, label: monthLabel(key), received: 0, estimated: 0, scheduled: 0, costs: MONTHLY_COSTS }
    buckets.push(bucket)
    index.set(key, bucket)
  }
  for (const item of items) {
    const bucket = index.get(monthKey(item.date))
    if (!bucket) continue
    if (item.state === 'received') bucket.received += item.amount
    else if (item.state === 'estimated') bucket.estimated += item.amount
    else bucket.scheduled += item.amount // scheduled + overdue: still owed
  }
  return buckets
}

// ---------------------------------------------------------------------------
// Booking pace
// ---------------------------------------------------------------------------

export type PacePoint = { date: string; booked: number }

/**
 * When a booking counts as booked: the day its deposit landed. converted_at is
 * stamped by the webhook (or when a prospect was converted by hand); older
 * rows fall back to the recorded deposit date, then to when the row was made.
 */
export function bookedOn(event: EventRecord, link?: BookingLink): string {
  if (link?.paidAt) return toVenueDate(link.paidAt)
  if (event.convertedAt) return toVenueDate(event.convertedAt)
  if (isIsoDate(event.dateOfDeposit)) return event.dateOfDeposit.trim()
  return event.createdAt ? toVenueDate(event.createdAt) : ''
}

/** Confirmed bookings for `year`, with their rate and booked date. */
export function paceBookings(events: EventRecord[], links: BookingLink[], year: number = PACE_YEAR) {
  const linkFor = primaryLinks(links)
  return events
    .filter((e) => e.status === 'confirmed' && isIsoDate(e.eventDate) && e.eventDate.startsWith(`${year}-`))
    .map((e) => {
      const link = linkFor.get(e.id)
      return {
        event: e,
        bookedOn: bookedOn(e, link),
        rate: parseAmount(link?.bookingFields?.rentalRate || e.ratePackage),
      }
    })
    .filter((b) => b.rate > 0 && b.bookedOn)
    .sort((a, b) => a.bookedOn.localeCompare(b.bookedOn))
}

/** Running total of value booked, one point per booking date. */
export function paceSeries(bookings: { bookedOn: string; rate: number }[]): PacePoint[] {
  const points: PacePoint[] = []
  let total = 0
  for (const b of bookings) {
    total += b.rate
    const last = points[points.length - 1]
    if (last && last.date === b.bookedOn) last.booked = total
    else points.push({ date: b.bookedOn, booked: total })
  }
  return points
}

export function bookedBy(series: PacePoint[], date: string): number {
  let value = 0
  for (const p of series) {
    if (p.date > date) break
    value = p.booked
  }
  return value
}

/** The first target whose date hasn't passed, or the last one. */
export function nextTarget(today: string) {
  return PACE_TARGETS.find((t) => t.date >= today) ?? PACE_TARGETS[PACE_TARGETS.length - 1]
}

/**
 * Where the target line sits on a given day, interpolated between the
 * baseline and the checkpoints, so "on pace" can be judged between
 * checkpoints rather than only on them. Null before the baseline.
 */
export function targetOn(date: string): number | null {
  const points = [PACE_BASELINE, ...PACE_TARGETS]
  if (date < PACE_BASELINE.date) return null
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (date <= b.date) {
      const span = daysBetween(a.date, b.date)
      const into = daysBetween(a.date, date)
      return Math.round(a.amount + ((b.amount - a.amount) * into) / span)
    }
  }
  return PACE_TARGETS[PACE_TARGETS.length - 1].amount
}

export function daysBetween(a: string, b: string): number {
  const pa = ISO_DATE.exec(a)
  const pb = ISO_DATE.exec(b)
  if (!pa || !pb) return 0
  const ta = Date.UTC(+pa[1], +pa[2] - 1, +pa[3])
  const tb = Date.UTC(+pb[1], +pb[2] - 1, +pb[3])
  return Math.round((tb - ta) / 86400000)
}
