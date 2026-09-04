import type { BookingContractFields, Requirements } from './contract'
import { CONTRACT_VERSION } from './contract'
import { formatCurrency } from './money'
import type { EventRecord } from './events'
import { getSupabase } from './supabase'

export type BookingLink = {
  token: string
  eventId: string
  contractVersion: string
  bookingFields: BookingContractFields
  depositAmount: string
  createdAt: string
  voidedAt?: string
}

export type ContractAcceptance = {
  id: string
  token: string
  acceptedAt: string
  ip: string
  userAgent: string
  typedName: string
  renterFields: Record<string, string>
}

/**
 * 18 random bytes, base64url. Long enough that a link can't be found by
 * guessing, short enough to survive being pasted into a text message.
 */
export function generateToken(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ---------------------------------------------------------------------------
// Turning a booking into contract field values
// ---------------------------------------------------------------------------

/** "2026-10-11" -> "October 11, 2026". Parsed by hand to dodge timezone drift. */
export function formatContractDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return value
  const [, year, month, day] = match
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const name = months[parseInt(month, 10) - 1]
  if (!name) return value
  return `${name} ${parseInt(day, 10)}, ${year}`
}

/** "17:00" -> "5:00 PM". Anything else passes through untouched. */
export function formatContractTime(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return value
  const hours = parseInt(match[1], 10)
  if (hours > 23) return value
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const display = hours % 12 === 0 ? 12 : hours % 12
  return `${display}:${match[2]} ${suffix}`
}

export function bookingContractFields(event: EventRecord): BookingContractFields {
  return {
    eventType: event.eventType,
    eventDates: formatContractDate(event.eventDate),
    expectedAttendance: event.estimatedGuestCount,
    accessTime: formatContractTime(event.accessTime),
    eventStart: formatContractTime(event.eventTimeStart),
    eventEnd: formatContractTime(event.eventTimeEnd),
    exitTime: formatContractTime(event.exitTime),
    rentalRate: formatCurrency(event.ratePackage),
    depositAmount: formatCurrency(event.depositAmount),
    additionalItems: event.additionalItems,
    requirements: (event.requirements ?? {}) as Requirements,
    photographyOptOut: event.photographyOptOut,
  }
}

// ---------------------------------------------------------------------------
// What has to be filled in before a contract can go out
// ---------------------------------------------------------------------------

const REQUIRED_FOR_LINK: Array<{ key: keyof EventRecord; label: string }> = [
  { key: 'customerName', label: 'Customer name' },
  { key: 'eventType', label: 'Event type' },
  { key: 'eventDate', label: 'Event date' },
  { key: 'estimatedGuestCount', label: 'Expected attendance' },
  { key: 'accessTime', label: 'Access / setup time' },
  { key: 'eventTimeStart', label: 'Event start' },
  { key: 'eventTimeEnd', label: 'Event end' },
  { key: 'exitTime', label: 'Contracted exit time' },
  { key: 'ratePackage', label: 'Rental rate' },
  { key: 'depositAmount', label: 'Deposit amount' },
]

/**
 * Field labels still blank on this booking. Every one of them appears as a
 * term in Sections 1 or 3, so sending a contract without them would put blanks
 * in the agreement the renter is agreeing to.
 */
export function missingForLink(event: EventRecord): string[] {
  return REQUIRED_FOR_LINK.filter(({ key }) => {
    const value = event[key]
    return typeof value !== 'string' || value.trim() === ''
  }).map(({ label }) => label)
}

// ---------------------------------------------------------------------------
// Storage — these run signed-in, so the ordinary RLS-backed client is fine
// ---------------------------------------------------------------------------

type LinkRow = Record<string, unknown>

function rowToLink(row: LinkRow): BookingLink {
  return {
    token: row.token as string,
    eventId: row.event_id as string,
    contractVersion: row.contract_version as string,
    bookingFields: row.booking_fields as BookingContractFields,
    depositAmount: (row.deposit_amount as string) || '',
    createdAt: (row.created_at as string) || '',
    voidedAt: (row.voided_at as string) || undefined,
  }
}

/**
 * Freeze the booking's terms into a new link. Later edits to the booking do
 * not change a link that has already been sent — that's the whole point of
 * copying the values in rather than reading them live.
 */
export async function createBookingLink(
  event: EventRecord,
): Promise<BookingLink> {
  const link: BookingLink = {
    token: generateToken(),
    eventId: event.id,
    contractVersion: CONTRACT_VERSION,
    bookingFields: bookingContractFields(event),
    depositAmount: formatCurrency(event.depositAmount),
    createdAt: new Date().toISOString(),
  }
  const { error } = await getSupabase().from('booking_links').insert({
    token: link.token,
    event_id: link.eventId,
    contract_version: link.contractVersion,
    booking_fields: link.bookingFields,
    deposit_amount: link.depositAmount,
    created_at: link.createdAt,
  })
  if (error) throw new Error(`Could not create contract link: ${error.message}`)
  return link
}

/** Most recent link for a booking, plus whether it has been accepted. */
export async function loadLinkStatus(
  eventId: string,
): Promise<{ link: BookingLink; acceptedAt?: string } | null> {
  const { data, error } = await getSupabase()
    .from('booking_links')
    .select('*')
    .eq('event_id', eventId)
    .is('voided_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) {
    console.error('Failed to load contract link:', error.message)
    return null
  }
  const row = (data ?? [])[0]
  if (!row) return null
  const link = rowToLink(row)

  const { data: acceptances } = await getSupabase()
    .from('contract_acceptances')
    .select('accepted_at')
    .eq('token', link.token)
    .order('accepted_at', { ascending: false })
    .limit(1)
  return { link, acceptedAt: (acceptances ?? [])[0]?.accepted_at as string }
}
