export type EffortLevel = 'S' | 'M' | 'L'
export type BookingStatus = 'prospect' | 'confirmed' | 'lost'

export type Customer = {
  id: string
  name: string
  contact: string  // phone number
  email?: string
  notes?: string
  createdAt: string
}

export type EventFormState = {
  status: BookingStatus
  eventType: string
  eventDate: string
  customerId?: string  // Reference to Customer
  customerName: string  // Denormalized for display/backward compatibility
  customerContact: string  // Denormalized for display/backward compatibility
  ratePackage: string
  leadSource: string
  heardFrom: string
  dateOfDeposit: string
  depositAmount: string
  contractLink: string
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
  depositAmount: '',
  contractLink: '',
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
export const CUSTOMERS_KEY = 'no2vance-customers'

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

export function loadCustomers(): Customer[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CUSTOMERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as Customer[]
  } catch {
    return []
  }
}

export function saveCustomers(customers: Customer[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers))
}

export function migrateExistingBookingsToCustomers(): void {
  if (typeof window === 'undefined') return

  const events = loadEvents()
  const existingCustomers = loadCustomers()

  // Skip if migration already done (customers exist)
  if (existingCustomers.length > 0) return

  // Create unique customer map from existing bookings
  const customerMap = new Map<string, Customer>()

  events.forEach((event) => {
    if (!event.customerName || !event.customerContact) return

    // Use contact as unique key (normalized to digits only)
    const contactKey = event.customerContact.replace(/\D/g, '')
    if (!contactKey) return

    if (!customerMap.has(contactKey)) {
      const customer: Customer = {
        id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: event.customerName,
        contact: event.customerContact,
        createdAt: event.createdAt || new Date().toISOString(),
      }
      customerMap.set(contactKey, customer)
    }
  })

  const newCustomers = Array.from(customerMap.values())
  if (newCustomers.length === 0) return

  saveCustomers(newCustomers)

  // Update events with customerId references
  const updatedEvents = events.map((event) => {
    if (!event.customerContact) return event
    const contactKey = event.customerContact.replace(/\D/g, '')
    const customer = customerMap.get(contactKey)
    if (customer) {
      return { ...event, customerId: customer.id }
    }
    return event
  })

  saveEvents(updatedEvents)
}

