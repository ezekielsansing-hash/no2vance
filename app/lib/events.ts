export type EffortLevel = 'S' | 'M' | 'L'
export type BookingStatus = 'prospect' | 'confirmed'

export type EventFormState = {
  status: BookingStatus
  eventType: string
  eventDate: string
  customerName: string
  customerContact: string
  ratePackage: string
  leadSource: string
  heardFrom: string
  dateOfDeposit: string
  contractLink: string
  paymentDetails: string
  airbnb: string
  estimatedGuestCount: string
  eventTimeStart: string
  eventTimeEnd: string
  setupLayout: string
  effortLevel: EffortLevel | ''
  vendorList: string
  photoFolder: string
  postEventNotes: string
}

export type EventRecord = EventFormState & {
  id: string
  createdAt: string
  convertedAt?: string
}

export const EMPTY_FORM: EventFormState = {
  status: 'prospect',
  eventType: '',
  eventDate: '',
  customerName: '',
  customerContact: '',
  ratePackage: '',
  leadSource: '',
  heardFrom: '',
  dateOfDeposit: '',
  contractLink: '',
  paymentDetails: '',
  airbnb: '',
  estimatedGuestCount: '',
  eventTimeStart: '',
  eventTimeEnd: '',
  setupLayout: '',
  effortLevel: '',
  vendorList: '',
  photoFolder: '',
  postEventNotes: '',
}

export const STORAGE_KEY = 'no2vance-events'
export const CUSTOM_EVENT_TYPES_KEY = 'no2vance-custom-event-types'

export const DEFAULT_EVENT_TYPES = [
  'Wedding',
  'Birthday',
  'Baby Shower',
  'Rehearsal Dinner',
  'Anniversary',
  'Corporate Event',
  'Holiday Party',
]

export function loadCustomEventTypes(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CUSTOM_EVENT_TYPES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as string[]
  } catch {
    return []
  }
}

export function saveCustomEventType(eventType: string): void {
  if (typeof window === 'undefined') return
  const existing = loadCustomEventTypes()
  if (!existing.includes(eventType) && !DEFAULT_EVENT_TYPES.includes(eventType)) {
    existing.push(eventType)
    window.localStorage.setItem(CUSTOM_EVENT_TYPES_KEY, JSON.stringify(existing))
  }
}

export function loadEvents(): EventRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as EventRecord[]
  } catch {
    return []
  }
}

export function saveEvents(events: EventRecord[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
}

