'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import styles from '../../new/page.module.css'
import {
  BookingStatus,
  Customer,
  DEFAULT_EVENT_TYPES,
  EffortLevel,
  EMPTY_FORM,
  EventFormState,
  EventRecord,
  loadCustomers,
  loadCustomEventTypes,
  loadEvents,
  migrateExistingBookingsToCustomers,
  saveCustomers,
  saveCustomEventType,
  saveEvents,
} from '../../lib/events'

export default function EditBookingPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''

  const [form, setForm] = useState<EventFormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [customEventTypes, setCustomEventTypes] = useState<string[]>([])
  const [showCustomEventType, setShowCustomEventType] = useState(false)
  const [customEventTypeInput, setCustomEventTypeInput] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [logisticsOpen, setLogisticsOpen] = useState(true)
  const [vendorsOpen, setVendorsOpen] = useState(true)
  const [existingEvents, setExistingEvents] = useState<EventRecord[]>([])

  useEffect(() => {
    migrateExistingBookingsToCustomers()
    setCustomEventTypes(loadCustomEventTypes())
    setCustomers(loadCustomers())
    setExistingEvents(loadEvents())
  }, [])

  // Check for existing events on the selected date (excluding current event)
  const eventsOnDate = form.eventDate
    ? existingEvents.filter((e) => e.eventDate === form.eventDate && e.id !== id)
    : []

  function handleCustomerSelect(customerId: string) {
    if (customerId === '__new__') {
      setShowNewCustomer(true)
      setSelectedCustomerId('')
      handleChange('customerId', undefined)
      handleChange('customerName', '')
      handleChange('customerContact', '')
    } else if (customerId) {
      setShowNewCustomer(false)
      setSelectedCustomerId(customerId)
      const customer = customers.find((c) => c.id === customerId)
      if (customer) {
        handleChange('customerId', customer.id)
        handleChange('customerName', customer.name)
        handleChange('customerContact', customer.contact)
      }
    } else {
      setShowNewCustomer(false)
      setSelectedCustomerId('')
      handleChange('customerId', undefined)
      handleChange('customerName', '')
      handleChange('customerContact', '')
    }
  }

  useEffect(() => {
    if (!id) return
    const events = loadEvents()
    const existing = events.find((e) => e.id === id)
    if (!existing) {
      router.push('/')
      return
    }
    const { id: _id, createdAt: _createdAt, ...rest } = existing
    // Format phone number if it exists but isn't formatted
    if (rest.customerContact) {
      rest.customerContact = formatPhoneNumber(rest.customerContact)
    }
    // Format rate/package as currency if it exists
    if (rest.ratePackage && !rest.ratePackage.startsWith('$')) {
      rest.ratePackage = formatCurrency(rest.ratePackage)
    }
    setForm(rest)
    // Set selected customer if customerId exists
    if (rest.customerId) {
      setSelectedCustomerId(rest.customerId)
    }
    // Check if event type is custom (not in default or saved custom types)
    const allKnownTypes = [...DEFAULT_EVENT_TYPES, ...loadCustomEventTypes()]
    if (rest.eventType && !allKnownTypes.includes(rest.eventType)) {
      setShowCustomEventType(true)
      setCustomEventTypeInput(rest.eventType)
    }
    // Set collapsed state based on status (prospects collapsed, confirmed expanded)
    const isConfirmed = rest.status === 'confirmed'
    setLogisticsOpen(isConfirmed)
    setVendorsOpen(isConfirmed)
    setLoaded(true)
  }, [id, router])

  function handleChange<K extends keyof EventFormState>(
    key: K,
    value: EventFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key as string]
      return next
    })
  }

  function isValidPhone(value: string): boolean {
    const digits = value.replace(/\D/g, '')
    return digits.length >= 10 && digits.length <= 15
  }

  function formatPhoneNumber(value: string): string {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  function formatCurrency(value: string): string {
    const digits = value.replace(/[^\d]/g, '')
    if (!digits) return ''
    const num = parseInt(digits, 10)
    return '$' + num.toLocaleString('en-US')
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {}

    if (!form.eventType.trim()) nextErrors.eventType = 'Required'
    if (!form.eventDate.trim()) nextErrors.eventDate = 'Required'
    if (!form.customerName.trim()) nextErrors.customerName = 'Required'
    if (!form.customerContact.trim()) {
      nextErrors.customerContact = 'Required'
    } else if (!isValidPhone(form.customerContact)) {
      nextErrors.customerContact = 'Enter a valid phone number'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !id) return

    // Save custom event type if it's new
    if (showCustomEventType && form.eventType) {
      saveCustomEventType(form.eventType)
    }

    const now = new Date()
    let customerId = form.customerId

    // If adding new customer, create the customer record first
    if (showNewCustomer && form.customerName && form.customerContact) {
      const newCustomer: Customer = {
        id: `cust-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
        name: form.customerName,
        contact: form.customerContact,
        createdAt: now.toISOString(),
      }
      const existingCustomers = loadCustomers()
      saveCustomers([newCustomer, ...existingCustomers])
      customerId = newCustomer.id
    }

    const events = loadEvents()
    const updated: EventRecord[] = events.map((event) =>
      event.id === id
        ? {
            ...event,
            ...form,
            customerId,
          }
        : event,
    )
    saveEvents(updated)
    router.push('/')
  }

  function handleReset() {
    if (!id) return
    const events = loadEvents()
    const existing = events.find((e) => e.id === id)
    if (!existing) return
    const { id: _id, createdAt: _createdAt, ...rest } = existing
    setForm(rest)
    setErrors({})
  }

  function handleDateClick(key: 'eventDate' | 'dateOfDeposit') {
    // Clear invalid partial dates so the picker starts fresh
    const value = form[key]
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      handleChange(key, '')
    }
  }

  if (!loaded) {
    return (
      <main className={styles.page}>
        <section className={styles.shell}>
          <p className={styles.subtitle}>Loading booking…</p>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Edit Booking</h1>
            <p className={styles.subtitle}>
              Update details for this event. Changes will be saved back to your bookings list.
            </p>
          </div>
          <div>
            <Link href="/" className={`${styles.button} ${styles.ghostButton}`}>
              Back to Bookings
            </Link>
          </div>
        </header>

        <section className={styles.formPanel}>
          <h2 className={styles.panelTitle}>Event Details</h2>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.statusSection}>
              <span className={styles.statusLabel}>Status</span>
              <div className={styles.segmented}>
                {(['prospect', 'confirmed', 'lost'] as BookingStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`${styles.segment} ${
                      form.status === s ? styles.segmentActive : ''
                    } ${form.status === s && s === 'lost' ? styles.segmentLost : ''}`}
                    onClick={() => handleChange('status', s)}
                  >
                    {s === 'prospect' ? 'Prospect' : s === 'confirmed' ? 'Confirmed' : 'Lost'}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Overview</h3>
                <span className={styles.sectionHint}>
                  High-level event and contact details
                </span>
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.label}>
                    Event Type<span className={styles.required}>*</span>
                  </span>
                  <select
                    className={`${styles.input} ${
                      errors.eventType ? styles.inputError : ''
                    }`}
                    value={showCustomEventType ? '__other__' : form.eventType}
                    onChange={(e) => {
                      if (e.target.value === '__other__') {
                        setShowCustomEventType(true)
                        handleChange('eventType', '')
                      } else {
                        setShowCustomEventType(false)
                        setCustomEventTypeInput('')
                        handleChange('eventType', e.target.value)
                      }
                    }}
                  >
                    <option value="">Select event type...</option>
                    {DEFAULT_EVENT_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                    {customEventTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                    <option value="__other__">+ Add new type...</option>
                  </select>
                  {showCustomEventType && (
                    <input
                      className={`${styles.input} ${styles.customTypeInput}`}
                      placeholder="Enter custom event type"
                      value={customEventTypeInput}
                      onChange={(e) => {
                        setCustomEventTypeInput(e.target.value)
                        handleChange('eventType', e.target.value)
                      }}
                      autoFocus
                    />
                  )}
                  {errors.eventType && (
                    <span className={styles.errorText}>
                      {errors.eventType}
                    </span>
                  )}
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>
                    Date of Event<span className={styles.required}>*</span>
                  </span>
                  <input
                    type="date"
                    className={`${styles.input} ${
                      errors.eventDate ? styles.inputError : ''
                    }`}
                    value={form.eventDate}
                    onClick={() => handleDateClick('eventDate')}
                    onChange={(e) => handleChange('eventDate', e.target.value)}
                  />
                  {errors.eventDate && (
                    <span className={styles.errorText}>
                      {errors.eventDate}
                    </span>
                  )}
                  {eventsOnDate.length > 0 && (
                    <span className={styles.warningText}>
                      {eventsOnDate.length} event{eventsOnDate.length > 1 ? 's' : ''} already scheduled on this date
                    </span>
                  )}
                </label>
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.label}>
                    Customer<span className={styles.required}>*</span>
                  </span>
                  <select
                    className={`${styles.input} ${
                      errors.customerName ? styles.inputError : ''
                    }`}
                    value={showNewCustomer ? '__new__' : selectedCustomerId}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                  >
                    <option value="">Select customer...</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} - {formatPhoneNumber(customer.contact)}
                      </option>
                    ))}
                    <option value="__new__">+ Add new customer...</option>
                  </select>
                  {errors.customerName && !showNewCustomer && (
                    <span className={styles.errorText}>
                      {errors.customerName}
                    </span>
                  )}
                </label>
              </div>

              {showNewCustomer && (
                <div className={styles.fieldRow}>
                  <label className={styles.field}>
                    <span className={styles.label}>
                      Customer Name<span className={styles.required}>*</span>
                    </span>
                    <input
                      className={`${styles.input} ${
                        errors.customerName ? styles.inputError : ''
                      }`}
                      placeholder="First Last"
                      value={form.customerName}
                      onChange={(e) =>
                        handleChange('customerName', e.target.value)
                      }
                    />
                    {errors.customerName && (
                      <span className={styles.errorText}>
                        {errors.customerName}
                      </span>
                    )}
                  </label>

                  <label className={styles.field}>
                    <span className={styles.label}>
                      Customer Contact
                      <span className={styles.required}>*</span>
                    </span>
                    <input
                      type="tel"
                      className={`${styles.input} ${
                        errors.customerContact ? styles.inputError : ''
                      }`}
                      placeholder="(555) 123-4567"
                      value={form.customerContact}
                      onChange={(e) =>
                        handleChange('customerContact', formatPhoneNumber(e.target.value))
                      }
                    />
                    {errors.customerContact && (
                      <span className={styles.errorText}>
                        {errors.customerContact}
                      </span>
                    )}
                  </label>
                </div>
              )}

              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.label}>Lead Source</span>
                  <input
                    className={styles.input}
                    placeholder="Referral, Yelp, etc."
                    value={form.leadSource}
                    onChange={(e) =>
                      handleChange('leadSource', e.target.value)
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>How They Heard About Us</span>
                  <input
                    className={styles.input}
                    placeholder="Instagram"
                    value={form.heardFrom}
                    onChange={(e) => handleChange('heardFrom', e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className={styles.section}>
              <button
                type="button"
                className={styles.sectionHeaderCollapsible}
                onClick={() => setLogisticsOpen(!logisticsOpen)}
              >
                <div className={styles.sectionHeaderLeft}>
                  <span className={styles.collapseIcon}>{logisticsOpen ? '−' : '+'}</span>
                  <h3 className={styles.sectionTitle}>Logistics</h3>
                </div>
                <span className={styles.sectionHint}>
                  Payments, timing, and layout
                </span>
              </button>

              {logisticsOpen && (
                <div className={styles.sectionContent}>
                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      <span className={styles.label}>Rate / Package</span>
                      <input
                        className={styles.input}
                        placeholder="$2,500"
                        value={form.ratePackage}
                        onChange={(e) =>
                          handleChange('ratePackage', formatCurrency(e.target.value))
                        }
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>Deposit Amount</span>
                      <input
                        className={styles.input}
                        placeholder="$500"
                        value={form.depositAmount}
                        onChange={(e) =>
                          handleChange('depositAmount', formatCurrency(e.target.value))
                        }
                      />
                    </label>
                  </div>

                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <span className={styles.label}>Balance Due</span>
                      <div className={styles.calculatedField}>
                        {(() => {
                          const rate = parseInt(form.ratePackage.replace(/[^\d]/g, '') || '0')
                          const deposit = parseInt(form.depositAmount.replace(/[^\d]/g, '') || '0')
                          const balance = rate - deposit
                          return balance > 0 ? `$${balance.toLocaleString()}` : '—'
                        })()}
                      </div>
                    </div>

                    <label className={styles.field}>
                      <span className={styles.label}>Date of Deposit</span>
                      <input
                        type="date"
                        className={styles.input}
                        value={form.dateOfDeposit}
                        onClick={() => handleDateClick('dateOfDeposit')}
                        onChange={(e) =>
                          handleChange('dateOfDeposit', e.target.value)
                        }
                      />
                    </label>
                  </div>

                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      <span className={styles.label}>Contract Link</span>
                      <input
                        className={styles.input}
                        placeholder="URL to contract"
                        value={form.contractLink}
                        onChange={(e) =>
                          handleChange('contractLink', e.target.value)
                        }
                      />
                    </label>
                  </div>

                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      <span className={styles.label}>Airbnb</span>
                      <input
                        className={styles.input}
                        placeholder="Listing link or notes"
                        value={form.airbnb}
                        onChange={(e) => handleChange('airbnb', e.target.value)}
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>Estimated Guest Count</span>
                      <input
                        type="number"
                        min={0}
                        className={styles.input}
                        value={form.estimatedGuestCount}
                        onChange={(e) =>
                          handleChange('estimatedGuestCount', e.target.value)
                        }
                      />
                    </label>
                  </div>

                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      <span className={styles.label}>Event Time (Start)</span>
                      <input
                        type="time"
                        className={styles.input}
                        value={form.eventTimeStart}
                        onChange={(e) =>
                          handleChange('eventTimeStart', e.target.value)
                        }
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>Event Time (End)</span>
                      <input
                        type="time"
                        className={styles.input}
                        value={form.eventTimeEnd}
                        onChange={(e) =>
                          handleChange('eventTimeEnd', e.target.value)
                        }
                      />
                    </label>
                  </div>

                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      <span className={styles.label}>Setup &amp; Layout</span>
                      <textarea
                        className={`${styles.input} ${styles.textarea}`}
                        placeholder="Floorplan, tables, decor notes..."
                        value={form.setupLayout}
                        onChange={(e) =>
                          handleChange('setupLayout', e.target.value)
                        }
                      />
                    </label>
                  </div>

                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <span className={styles.label}>Level of Effort</span>
                      <div className={styles.segmented}>
                        {(['S', 'M', 'L'] as EffortLevel[]).map((level) => (
                          <button
                            key={level}
                            type="button"
                            className={`${styles.segment} ${
                              form.effortLevel === level
                                ? styles.segmentActive
                                : ''
                            }`}
                            onClick={() => handleChange('effortLevel', level)}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                      <span className={styles.sectionHint}>
                        S = simple, M = moderate, L = high touch
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.section}>
              <button
                type="button"
                className={styles.sectionHeaderCollapsible}
                onClick={() => setVendorsOpen(!vendorsOpen)}
              >
                <div className={styles.sectionHeaderLeft}>
                  <span className={styles.collapseIcon}>{vendorsOpen ? '−' : '+'}</span>
                  <h3 className={styles.sectionTitle}>Vendors &amp; Notes</h3>
                </div>
                <span className={styles.sectionHint}>
                  Keep track of partners and follow-ups
                </span>
              </button>

              {vendorsOpen && (
                <div className={styles.sectionContent}>
                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      <span className={styles.label}>Vendor List</span>
                      <textarea
                        className={`${styles.input} ${styles.textarea}`}
                        placeholder="Caterer, DJ, planner, florist..."
                        value={form.vendorList}
                        onChange={(e) => handleChange('vendorList', e.target.value)}
                      />
                    </label>
                  </div>

                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      <span className={styles.label}>Photo Folder</span>
                      <input
                        className={styles.input}
                        placeholder="Drive / Dropbox / iCloud link"
                        value={form.photoFolder}
                        onChange={(e) =>
                          handleChange('photoFolder', e.target.value)
                        }
                      />
                    </label>
                  </div>

                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      <span className={styles.label}>Post-Event Notes</span>
                      <textarea
                        className={`${styles.input} ${styles.textarea}`}
                        placeholder="What worked well, what to improve..."
                        value={form.postEventNotes}
                        onChange={(e) =>
                          handleChange('postEventNotes', e.target.value)
                        }
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <footer className={styles.formFooter}>
              <div className={styles.footerLeft}>
                <button
                  type="submit"
                  className={`${styles.button} ${styles.primaryButton}`}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className={`${styles.button} ${styles.ghostButton}`}
                >
                  Reset
                </button>
              </div>
              <p className={styles.footerHint}>
                Your changes will be saved to this booking only.
              </p>
            </footer>
          </form>
        </section>
      </section>
    </main>
  )
}

