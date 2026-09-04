import { CONTRACT_V1 } from './v1'

/**
 * Bump this whenever the contract text changes, and add the new text as its
 * own file rather than editing an existing one. Every acceptance stores the
 * version and a full snapshot, so a booking accepted under v1 keeps showing v1
 * no matter what later versions say.
 */
export const CONTRACT_VERSION = 'v1'

export const CONTRACT_TEXT: Record<string, string> = {
  v1: CONTRACT_V1,
}

/**
 * Venue-wide terms. These are the same on every contract, so they live here
 * rather than on the booking — but they are versioned along with the text,
 * because changing one changes what a renter is agreeing to.
 */
export const VENUE_TERMS = {
  returnedCheckFee: '$100',
  overtimeRate: '$100',
  /**
   * Section 3. Currently the pre-QuickBooks wording, because the app cannot
   * issue invoices until Intuit grants production keys — a contract must not
   * point a renter at a payment link that doesn't exist.
   *
   * When production keys land, switch this to QUICKBOOKS_PAYMENT_METHODS below
   * and bump CONTRACT_VERSION, so agreements accepted under each wording stay
   * distinguishable.
   */
  paymentMethods:
    'Venmo, Cash App, cash, or check made payable to: ' +
    'H & S Printing Co., Inc. / P.O. Box 2045 / Memphis, TN 38101',
} as const

/**
 * Section 3 once QuickBooks is issuing invoices. Card and ACH are what
 * QuickBooks Payments always offers, and both are confirmed active on the
 * company. PayPal and Venmo can also appear on QuickBooks invoices if enabled
 * on the account — add them here only after confirming, not before.
 */
export const QUICKBOOKS_PAYMENT_METHODS =
  'Credit card, debit card, or bank transfer (ACH) using the secure payment ' +
  'link on the invoice we send you, or check made payable to: ' +
  'H & S Printing Co., Inc. / P.O. Box 2045 / Memphis, TN 38101'

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
    returnedCheckFee: VENUE_TERMS.returnedCheckFee,
    overtimeRate: VENUE_TERMS.overtimeRate,
    paymentMethods: VENUE_TERMS.paymentMethods,
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
