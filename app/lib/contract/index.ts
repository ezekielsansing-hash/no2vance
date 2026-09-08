import { CONTRACT_V1 } from './v1'

/**
 * The version every new link is issued under. Bump this whenever anything a
 * renter reads changes — the body text or the terms injected into it. Every
 * acceptance stores its version alongside a full snapshot, so a booking
 * accepted under v1 keeps showing v1 no matter what later versions say.
 *
 * Two kinds of change, two places to make them, and neither ever edits an
 * existing version:
 *
 *   - the agreement's **wording** changes -> add `vN.ts` and register it in
 *     CONTRACT_TEXT below
 *   - only the **injected terms** change (a fee, the payment methods) -> add
 *     an entry to CONTRACT_TERMS, reusing the body it shares
 *
 * v2 since QuickBooks went live on production keys. Its Section 3 sends the
 * renter to the payment link on the invoice, which is only honest while the app
 * can actually issue one: if QuickBooks is ever disconnected, invoice creation
 * fails non-fatally and a v2 contract points the renter at an invoice that was
 * never sent. Should that happen for any length of time, drop back to v1 — its
 * Venmo/cash/check wording is actionable either way.
 */
export const CONTRACT_VERSION = 'v2'

export const CONTRACT_TEXT: Record<string, string> = {
  v1: CONTRACT_V1,
  /**
   * v2 is v1's body, unedited. The only difference between the two versions is
   * Section 3's payment methods, which the body carries as a
   * {{paymentMethods}} placeholder — see CONTRACT_TERMS. Copying two hundred
   * lines of legal text to change one injected line would leave two copies to
   * keep in step, and the next fix to Section 7 would land in only one of
   * them. What must never change is a version's *rendered* output, and
   * freezing the terms per version is what guarantees that.
   */
  v2: CONTRACT_V1,
}

/**
 * Fire-code occupancy limit. Stated twice in the agreement (Sections 1 and 5)
 * as a hard limit that will be strictly enforced, so a booking above it would
 * produce a contract that contradicts itself. Must match the number written
 * into the contract text.
 */
export const MAX_OCCUPANCY = 75

/**
 * Keeps a guest-count input at or below the fire-code limit as it is typed.
 * The `max` attribute alone only constrains the spinner, so a pasted or typed
 * 150 would still reach the form. Blank stays blank so the field can be
 * cleared, and anything non-numeric is dropped.
 */
export function clampGuestCount(value: string): string {
  const digits = value.replace(/[^\d]/g, '')
  if (digits === '') return ''
  return String(Math.min(parseInt(digits, 10), MAX_OCCUPANCY))
}

/**
 * Venue-wide terms — the same on every contract of a given version, so they
 * live here rather than on the booking.
 *
 * They are versioned along with the text because changing one changes what a
 * renter is agreeing to. An entry here is frozen the moment a contract goes
 * out under its version: edit the v1 entry and you have rewritten what past
 * v1 links render, which is the one thing this whole scheme exists to prevent.
 */
export type VenueTerms = {
  returnedCheckFee: string
  overtimeRate: string
  /** Section 3. */
  paymentMethods: string
}

const MAILED_CHECK =
  'check made payable to: ' +
  'H & S Printing Co., Inc. / P.O. Box 2045 / Memphis, TN 38101'

export const CONTRACT_TERMS: Record<string, VenueTerms> = {
  /**
   * The pre-QuickBooks wording, from before Intuit issued production keys.
   * Kept exactly as it was: links created under v1 still render from it.
   */
  v1: {
    returnedCheckFee: '$100',
    overtimeRate: '$100',
    paymentMethods: `Venmo, Cash App, cash, or ${MAILED_CHECK}`,
  },
  /**
   * QuickBooks is issuing the invoices, so Section 3 points at the payment
   * link on the invoice. Card and ACH are what QuickBooks Payments always
   * offers, and both are confirmed active on the company.
   *
   * Cash App is deliberately gone — QuickBooks doesn't offer it, and a
   * contract shouldn't name a method the invoice can't take. PayPal and Venmo
   * *can* appear on QuickBooks invoices, but add them only after confirming
   * they're enabled on the account, and in a new version.
   */
  v2: {
    returnedCheckFee: '$100',
    overtimeRate: '$100',
    paymentMethods:
      'Credit card, debit card, or bank transfer (ACH) using the secure ' +
      `payment link on the invoice we send you, or ${MAILED_CHECK}`,
  },
}

// --------------------------------------------------------------------------
// Section 14 — per-event requirements
// --------------------------------------------------------------------------

export type RequirementKey =
  | 'damageDeposit'
  | 'cardOnFile'
  | 'certificateOfInsurance'
  | 'vendorInsurance'
  | 'securityOfficer'
  | 'other'

/** `value` fills the blank the paper form left in that line, where it has one. */
export type Requirements = Partial<
  Record<RequirementKey, { checked: boolean; value?: string }>
>

const REQUIREMENT_TEXT: Record<RequirementKey, (value: string) => string> = {
  damageDeposit: (v) =>
    `**Refundable Damage / Cleaning Deposit** — ${v || '$____'}, due with the balance and held separately from the rental fee. It will be returned within fourteen (14) days after the event, less any deductions, with an itemized statement of any amounts withheld.`,
  cardOnFile: () =>
    `**Credit Card Authorization on File** — The Renter completes a separate authorization form. The card is charged only for overtime, damage, or extra cleaning actually incurred, up to the limit stated, and only after the Renter is notified.`,
  certificateOfInsurance: () =>
    `**Certificate of Insurance** — At least seven (7) days before the event, the Renter shall furnish a certificate of general liability insurance with limits of not less than $1,000,000 per occurrence, naming H. & S. Printing Co., Inc. dba No. 2 Vance as an additional insured for the date of the event. One-day event policies are widely available online and typically cost roughly $100–$150; ask us and we will point you to a provider.`,
  vendorInsurance: () =>
    `**Vendor Insurance** — The Renter's bartender, caterer, and other commercial vendors shall furnish certificates of liability insurance (and, for the bartender, proof of license and liquor liability coverage) at least seven (7) days before the event.`,
  securityOfficer: (v) =>
    `**Security Officer** — The Renter shall engage ${v || '____'} licensed security officer(s) for the duration of the event at the Renter's expense.`,
  other: (v) => `**Other:** ${v || '____'}`,
}

/** Section 14 as it appears in the booking form. Same order as the contract. */
export const REQUIREMENT_OPTIONS: Array<{
  key: RequirementKey
  label: string
  valueLabel?: string
}> = [
  {
    key: 'damageDeposit',
    label: 'Refundable damage / cleaning deposit',
    valueLabel: 'Amount',
  },
  { key: 'cardOnFile', label: 'Credit card authorization on file' },
  { key: 'certificateOfInsurance', label: 'Certificate of insurance' },
  { key: 'vendorInsurance', label: 'Vendor insurance' },
  { key: 'securityOfficer', label: 'Security officer(s)', valueLabel: 'How many' },
  { key: 'other', label: 'Other', valueLabel: 'Describe' },
]

const REQUIREMENT_ORDER: RequirementKey[] = [
  'damageDeposit',
  'cardOnFile',
  'certificateOfInsurance',
  'vendorInsurance',
  'securityOfficer',
  'other',
]

/**
 * Renders Section 14 as a checked/unchecked list, the way the paper form reads.
 * Unchecked items stay visible so the renter can see what was *not* required.
 */
export function renderRequirements(requirements: Requirements): string {
  return REQUIREMENT_ORDER.map((key) => {
    const item = requirements[key]
    const box = item?.checked ? '☑' : '☐'
    return `${box}  ${REQUIREMENT_TEXT[key](item?.value ?? '')}`
  }).join('\n\n')
}

// --------------------------------------------------------------------------
// Filling the template
// --------------------------------------------------------------------------

/** Set by us, from the booking record, before the link is sent. */
export type BookingContractFields = {
  eventType: string
  eventDates: string
  expectedAttendance: string
  accessTime: string
  eventStart: string
  eventEnd: string
  exitTime: string
  rentalRate: string
  depositAmount: string
  additionalItems: string
  requirements: Requirements
  photographyOptOut: boolean
}

/** Supplied by the renter on the acceptance page — we don't hold most of it. */
export type RenterContractFields = {
  renterName: string
  renterAddress: string
  renterCity: string
  renterState: string
  renterZip: string
  renterPhone: string
  renterCell: string
  contactName: string
  renterEmail: string
  onSiteParty: string
  onSiteCell: string
}

/**
 * Produce the final contract text for one booking.
 *
 * Throws if any placeholder is left unfilled. A contract that reaches a
 * customer with `{{renterCity}}` still in it is worse than an error page, so
 * this fails loudly rather than rendering.
 */
export function renderContract(
  booking: BookingContractFields,
  renter: RenterContractFields,
  version: string = CONTRACT_VERSION,
): string {
  const template = CONTRACT_TEXT[version]
  if (!template) throw new Error(`Unknown contract version: ${version}`)

  // Terms are part of the version, not global: whatever CONTRACT_VERSION says
  // today, a v1 link has to keep rendering v1's payment methods.
  const terms = CONTRACT_TERMS[version]
  if (!terms) throw new Error(`No venue terms for contract version: ${version}`)

  const values: Record<string, string> = {
    ...renter,
    eventType: booking.eventType,
    eventDates: booking.eventDates,
    expectedAttendance: booking.expectedAttendance,
    accessTime: booking.accessTime,
    eventStart: booking.eventStart,
    eventEnd: booking.eventEnd,
    exitTime: booking.exitTime,
    rentalRate: booking.rentalRate,
    depositAmount: booking.depositAmount,
    additionalItems: booking.additionalItems || 'None',
    additionalRequirements: renderRequirements(booking.requirements),
    photographyOptOut: booking.photographyOptOut
      ? 'the Renter has opted out.'
      : 'the Renter has not opted out.',
    contactName: renter.contactName || renter.renterName,
    onSiteParty: renter.onSiteParty || 'Same as Renter',
    onSiteCell: renter.onSiteCell || renter.renterCell,
    returnedCheckFee: terms.returnedCheckFee,
    overtimeRate: terms.overtimeRate,
    paymentMethods: terms.paymentMethods,
  }

  const filled = template.replace(
    /\{\{(\w+)\}\}/g,
    (match, key: string) => values[key] ?? match,
  )

  const unfilled = filled.match(/\{\{\w+\}\}/g)
  if (unfilled) {
    throw new Error(
      `Contract ${version} has unfilled placeholders: ${Array.from(
        new Set(unfilled),
      ).join(', ')}`,
    )
  }
  return filled
}
