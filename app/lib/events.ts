export type EffortLevel = 'S' | 'M' | 'L'

export type EventFormState = {
  paymentSummary: string
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
}

export const EMPTY_FORM: EventFormState = {
  paymentSummary: '',
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

