/**
 * A prefilled Google Calendar event, as a link.
 *
 * Deliberately not a sync. The calendar stays hand-managed — which calendar an
 * event lands on, and whether it goes on at all, is still a decision made in
 * Google. This only removes the retyping: the date, the times and the details
 * arrive already filled in, and the venue presses Save.
 */

/** The booking fields the link needs. EventFormState satisfies this. */
export type CalendarLinkFields = {
  eventType: string
  eventDate: string
  customerName: string
  eventTimeStart: string
  eventTimeEnd: string
  accessTime: string
  exitTime: string
  estimatedGuestCount: string
  ratePackage: string
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{2}:\d{2}$/

/**
 * The zone the app's bare "HH:MM" times are in. Passed to Google as `ctz` so
 * the times mean the same thing to someone opening the link from anywhere.
 */
const TIME_ZONE = 'America/Chicago'

/**
 * Calendar-day arithmetic in UTC, then sliced back to a date string.
 *
 * These are days on a wall calendar, not instants. Going through a local-time
 * Date puts the day either side of a DST change on the wrong date, which is
 * the drift the rest of this app avoids by never parsing dates at all.
 */
function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10)
}

/** "2026-10-24" -> "20261024", the only date format Google takes here. */
function compactDate(date: string): string {
  return date.replace(/-/g, '')
}

/** "2026-10-24" + "18:00" -> "20261024T180000". */
function compactDateTime(date: string, time: string): string {
  return `${compactDate(date)}T${time.replace(':', '')}00`
}

function titleFor(booking: CalendarLinkFields): string {
  // Matches how the calendar is already written by hand: "Jenny White
  // Reception", "Carly Smith B-Day" — the customer, then what it is.
  const title = [booking.customerName, booking.eventType]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
  return title || 'Booking'
}

function detailsFor(booking: CalendarLinkFields, bookingId: string): string {
  const lines: string[] = []
  const add = (label: string, value: string) => {
    if (value.trim()) lines.push(`${label}: ${value.trim()}`)
  }

  add('Guests', booking.estimatedGuestCount)
  add('Package', booking.ratePackage)
  // Carried as text rather than as separate calendar entries: setup and
  // breakdown blocks are the venue's to add if they want them, and this is
  // the information needed to do that.
  add('Access / setup', booking.accessTime)
  add('Contracted exit', booking.exitTime)

  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (site && bookingId) lines.push(`${site}/bookings/${bookingId}`)

  return lines.join('\n')
}

/**
 * A Google Calendar "create event" URL for a booking, or null when there is
 * nothing to place — a booking with no date can't go on a calendar, and
 * guessing one would be worse than offering nothing.
 */
export function googleCalendarUrl(
  booking: CalendarLinkFields,
  bookingId = '',
): string | null {
  const date = booking.eventDate.trim()
  if (!DATE_PATTERN.test(date)) return null

  const start = TIME_PATTERN.test(booking.eventTimeStart)
    ? booking.eventTimeStart
    : ''
  const end = TIME_PATTERN.test(booking.eventTimeEnd)
    ? booking.eventTimeEnd
    : ''

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: titleFor(booking),
    details: detailsFor(booking, bookingId),
  })

  if (start && end) {
    // A reception running to 1am ends the following day. The times carry no
    // date, so the only signal is the end reading as earlier than the start —
    // for a venue that's the ordinary case, not an edge one.
    const endDate = end <= start ? shiftDate(date, 1) : date
    params.set(
      'dates',
      `${compactDateTime(date, start)}/${compactDateTime(endDate, end)}`,
    )
    params.set('ctz', TIME_ZONE)
  } else {
    // Without both ends there is no duration to state, and inventing one would
    // put a wrong time on the calendar. An all-day entry says the date is
    // taken without claiming to know more. Google reads the end as exclusive.
    params.set('dates', `${compactDate(date)}/${compactDate(shiftDate(date, 1))}`)
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
