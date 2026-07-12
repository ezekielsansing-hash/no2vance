import { getSupabase } from './supabase'

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

export type SavedVendor = {
  id: string
  name: string
  category: string
  description: string
  phone: string
  website: string
  address: string
  priceRange: string
  notes: string
  savedAt: string
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

export const DEFAULT_EVENT_TYPES = [
  'Wedding',
  'Birthday',
  'Baby Shower',
  'Rehearsal Dinner',
  'Anniversary',
  'Corporate Event',
  'Holiday Party',
]

// ---------------------------------------------------------------------------
// Row mapping (snake_case DB columns <-> camelCase app types)
// ---------------------------------------------------------------------------

type EventRow = Record<string, unknown>

function rowToEvent(row: EventRow): EventRecord {
  return {
    id: row.id as string,
    status: (row.status as BookingStatus) || 'prospect',
    eventType: (row.event_type as string) || '',
    eventDate: (row.event_date as string) || '',
    customerId: (row.customer_id as string) || undefined,
    customerName: (row.customer_name as string) || '',
    customerContact: (row.customer_contact as string) || '',
    ratePackage: (row.rate_package as string) || '',
    leadSource: (row.lead_source as string) || '',
    heardFrom: (row.heard_from as string) || '',
    dateOfDeposit: (row.date_of_deposit as string) || '',
    depositAmount: (row.deposit_amount as string) || '',
    contractLink: (row.contract_link as string) || '',
    airbnb: (row.airbnb as string) || '',
    estimatedGuestCount: (row.estimated_guest_count as string) || '',
    eventTimeStart: (row.event_time_start as string) || '',
    eventTimeEnd: (row.event_time_end as string) || '',
    setupLayout: (row.setup_layout as string) || '',
    effortLevel: (row.effort_level as EffortLevel | '') || '',
    vendorList: (row.vendor_list as string) || '',
    photoFolder: (row.photo_folder as string) || '',
    postEventNotes: (row.post_event_notes as string) || '',
    createdAt: (row.created_at as string) || '',
    convertedAt: (row.converted_at as string) || undefined,
  }
}

function eventToRow(event: EventRecord): EventRow {
  return {
    id: event.id,
    status: event.status,
    event_type: event.eventType,
    event_date: event.eventDate,
    customer_id: event.customerId ?? null,
    customer_name: event.customerName,
    customer_contact: event.customerContact,
    rate_package: event.ratePackage,
    lead_source: event.leadSource,
    heard_from: event.heardFrom,
    date_of_deposit: event.dateOfDeposit,
    deposit_amount: event.depositAmount,
    contract_link: event.contractLink,
    airbnb: event.airbnb,
    estimated_guest_count: event.estimatedGuestCount,
    event_time_start: event.eventTimeStart,
    event_time_end: event.eventTimeEnd,
    setup_layout: event.setupLayout,
    effort_level: event.effortLevel,
    vendor_list: event.vendorList,
    photo_folder: event.photoFolder,
    post_event_notes: event.postEventNotes,
    created_at: event.createdAt || new Date().toISOString(),
    converted_at: event.convertedAt ?? null,
  }
}

function rowToCustomer(row: EventRow): Customer {
  return {
    id: row.id as string,
    name: (row.name as string) || '',
    contact: (row.contact as string) || '',
    email: (row.email as string) || undefined,
    notes: (row.notes as string) || undefined,
    createdAt: (row.created_at as string) || '',
  }
}

function customerToRow(customer: Customer): EventRow {
  return {
    id: customer.id,
    name: customer.name,
    contact: customer.contact,
    email: customer.email ?? null,
    notes: customer.notes ?? null,
    created_at: customer.createdAt || new Date().toISOString(),
  }
}

function rowToVendor(row: EventRow): SavedVendor {
  return {
    id: row.id as string,
    name: (row.name as string) || '',
    category: (row.category as string) || '',
    description: (row.description as string) || '',
    phone: (row.phone as string) || '',
    website: (row.website as string) || '',
    address: (row.address as string) || '',
    priceRange: (row.price_range as string) || '',
    notes: (row.notes as string) || '',
    savedAt: (row.saved_at as string) || '',
  }
}

function vendorToRow(vendor: SavedVendor): EventRow {
  return {
    id: vendor.id,
    name: vendor.name,
    category: vendor.category,
    description: vendor.description,
    phone: vendor.phone,
    website: vendor.website,
    address: vendor.address,
    price_range: vendor.priceRange,
    notes: vendor.notes,
    saved_at: vendor.savedAt || new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Events (bookings)
// ---------------------------------------------------------------------------

export async function loadEvents(): Promise<EventRecord[]> {
  const { data, error } = await getSupabase()
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Failed to load events:', error.message)
    return []
  }
  return (data ?? []).map(rowToEvent)
}

export async function insertEvent(event: EventRecord): Promise<void> {
  const { error } = await getSupabase().from('events').insert(eventToRow(event))
  if (error) throw new Error(`Could not save booking: ${error.message}`)
}

export async function insertEvents(events: EventRecord[]): Promise<void> {
  if (events.length === 0) return
  const { error } = await getSupabase()
    .from('events')
    .upsert(events.map(eventToRow))
  if (error) throw new Error(`Could not save bookings: ${error.message}`)
}

export async function updateEvent(event: EventRecord): Promise<void> {
  const { error } = await getSupabase()
    .from('events')
    .update(eventToRow(event))
    .eq('id', event.id)
  if (error) throw new Error(`Could not update booking: ${error.message}`)
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await getSupabase().from('events').delete().eq('id', id)
  if (error) throw new Error(`Could not delete booking: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function loadCustomers(): Promise<Customer[]> {
  const { data, error } = await getSupabase()
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Failed to load customers:', error.message)
    return []
  }
  return (data ?? []).map(rowToCustomer)
}

export async function insertCustomer(customer: Customer): Promise<void> {
  const { error } = await getSupabase()
    .from('customers')
    .insert(customerToRow(customer))
  if (error) throw new Error(`Could not save customer: ${error.message}`)
}

export async function insertCustomers(customers: Customer[]): Promise<void> {
  if (customers.length === 0) return
  const { error } = await getSupabase()
    .from('customers')
    .upsert(customers.map(customerToRow))
  if (error) throw new Error(`Could not save customers: ${error.message}`)
}

export async function updateCustomer(customer: Customer): Promise<void> {
  const { error } = await getSupabase()
    .from('customers')
    .update(customerToRow(customer))
    .eq('id', customer.id)
  if (error) throw new Error(`Could not update customer: ${error.message}`)
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await getSupabase().from('customers').delete().eq('id', id)
  if (error) throw new Error(`Could not delete customer: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Custom event types
// ---------------------------------------------------------------------------

export async function loadCustomEventTypes(): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from('event_types')
    .select('name')
    .order('created_at', { ascending: true })
  if (error) {
    console.error('Failed to load event types:', error.message)
    return []
  }
  return (data ?? []).map((row) => row.name as string)
}

export async function saveCustomEventType(eventType: string): Promise<void> {
  if (DEFAULT_EVENT_TYPES.includes(eventType)) return
  const { error } = await getSupabase()
    .from('event_types')
    .upsert({ name: eventType })
  if (error) throw new Error(`Could not save event type: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Saved vendors
// ---------------------------------------------------------------------------

export async function loadSavedVendors(): Promise<SavedVendor[]> {
  const { data, error } = await getSupabase()
    .from('saved_vendors')
    .select('*')
    .order('saved_at', { ascending: true })
  if (error) {
    console.error('Failed to load vendors:', error.message)
    return []
  }
  return (data ?? []).map(rowToVendor)
}

export async function insertSavedVendor(vendor: SavedVendor): Promise<void> {
  const { error } = await getSupabase()
    .from('saved_vendors')
    .insert(vendorToRow(vendor))
  if (error) throw new Error(`Could not save vendor: ${error.message}`)
}

export async function insertSavedVendors(vendors: SavedVendor[]): Promise<void> {
  if (vendors.length === 0) return
  const { error } = await getSupabase()
    .from('saved_vendors')
    .upsert(vendors.map(vendorToRow))
  if (error) throw new Error(`Could not save vendors: ${error.message}`)
}

export async function updateSavedVendor(vendor: SavedVendor): Promise<void> {
  const { error } = await getSupabase()
    .from('saved_vendors')
    .update(vendorToRow(vendor))
    .eq('id', vendor.id)
  if (error) throw new Error(`Could not update vendor: ${error.message}`)
}

export async function deleteSavedVendor(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('saved_vendors')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`Could not delete vendor: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Full backup / danger zone
// ---------------------------------------------------------------------------

export async function exportAllData() {
  const [events, customers, eventTypes, vendors] = await Promise.all([
    loadEvents(),
    loadCustomers(),
    loadCustomEventTypes(),
    loadSavedVendors(),
  ])
  return {
    exportedAt: new Date().toISOString(),
    events,
    customers,
    eventTypes,
    vendors,
  }
}

export async function deleteAllData(): Promise<void> {
  const supabase = getSupabase()
  // Events first (they reference customers).
  const steps: Array<{ table: string; pk: string }> = [
    { table: 'events', pk: 'id' },
    { table: 'customers', pk: 'id' },
    { table: 'event_types', pk: 'name' },
    { table: 'saved_vendors', pk: 'id' },
  ]
  for (const { table, pk } of steps) {
    const { error } = await supabase.from(table).delete().neq(pk, '')
    if (error) throw new Error(`Could not clear ${table}: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Legacy localStorage data (used only by the one-time cloud migration)
// ---------------------------------------------------------------------------

export const LEGACY_KEYS = {
  events: 'no2vance-events',
  customers: 'no2vance-customers',
  eventTypes: 'no2vance-custom-event-types',
  vendors: 'no2vance-saved-vendors',
} as const

function readLocalArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

export function readLegacyLocalData() {
  return {
    events: readLocalArray<EventRecord>(LEGACY_KEYS.events),
    customers: readLocalArray<Customer>(LEGACY_KEYS.customers),
    eventTypes: readLocalArray<string>(LEGACY_KEYS.eventTypes),
    vendors: readLocalArray<SavedVendor>(LEGACY_KEYS.vendors),
  }
}

export function hasLegacyLocalData(): boolean {
  const { events, customers, eventTypes, vendors } = readLegacyLocalData()
  return (
    events.length > 0 ||
    customers.length > 0 ||
    eventTypes.length > 0 ||
    vendors.length > 0
  )
}

export function clearLegacyLocalData(): void {
  if (typeof window === 'undefined') return
  Object.values(LEGACY_KEYS).forEach((key) =>
    window.localStorage.removeItem(key),
  )
}

/**
 * One-time migration: push everything in this browser's localStorage into
 * Supabase. Derives customer records from bookings that predate the
 * customers feature (same logic the old localStorage migration used).
 * Upserts by id, so running it twice cannot create duplicates.
 */
export async function migrateLocalDataToCloud(): Promise<{
  events: number
  customers: number
  eventTypes: number
  vendors: number
}> {
  const local = readLegacyLocalData()

  // Derive customers from bookings that only have denormalized name/contact.
  const customersById = new Map(local.customers.map((c) => [c.id, c]))
  const customersByContact = new Map(
    local.customers.map((c) => [c.contact.replace(/\D/g, ''), c]),
  )
  const events = local.events.map((event) => {
    if (event.customerId && customersById.has(event.customerId)) return event
    const contactKey = (event.customerContact || '').replace(/\D/g, '')
    if (!event.customerName || !contactKey) return event
    let customer = customersByContact.get(contactKey)
    if (!customer) {
      customer = {
        id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: event.customerName,
        contact: event.customerContact,
        createdAt: event.createdAt || new Date().toISOString(),
      }
      customersByContact.set(contactKey, customer)
      customersById.set(customer.id, customer)
    }
    return { ...event, customerId: customer.id }
  })
  const customers = Array.from(customersById.values())

  await insertCustomers(customers)
  await insertEvents(events)
  for (const eventType of local.eventTypes) {
    await saveCustomEventType(eventType)
  }
  await insertSavedVendors(local.vendors)

  return {
    events: events.length,
    customers: customers.length,
    eventTypes: local.eventTypes.length,
    vendors: local.vendors.length,
  }
}
