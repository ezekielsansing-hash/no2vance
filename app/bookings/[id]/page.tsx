'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import styles from '../../new/page.module.css'
import {
  EffortLevel,
  EMPTY_FORM,
  EventFormState,
  EventRecord,
  loadEvents,
  saveEvents,
} from '../../lib/events'

export default function EditBookingPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''

  const [form, setForm] = useState<EventFormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!id) return
    const events = loadEvents()
    const existing = events.find((e) => e.id === id)
    if (!existing) {
      router.push('/')
      return
    }
    const { id: _id, createdAt: _createdAt, ...rest } = existing
    setForm(rest)
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

  function validate(): boolean {
    const nextErrors: Record<string, string> = {}

    if (!form.eventType.trim()) nextErrors.eventType = 'Required'
    if (!form.eventDate.trim()) nextErrors.eventDate = 'Required'
    if (!form.customerName.trim()) nextErrors.customerName = 'Required'
    if (!form.customerContact.trim()) nextErrors.customerContact = 'Required'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !id) return

    const events = loadEvents()
    const updated: EventRecord[] = events.map((event) =>
      event.id === id
        ? {
            ...event,
            ...form,
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
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Overview</h3>
                <span className={styles.sectionHint}>
                  High-level event and contact details
                </span>
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.label}>Payment Summary</span>
                  <input
                    className={styles.input}
                    placeholder="$475.00 received on 12/5"
                    value={form.paymentSummary}
                    onChange={(e) =>
                      handleChange('paymentSummary', e.target.value)
                    }
                  />
                </label>
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.label}>
                    Event Type<span className={styles.required}>*</span>
                  </span>
                  <input
                    className={`${styles.input} ${
                      errors.eventType ? styles.inputError : ''
                    }`}
                    placeholder="Baby Shower"
                    value={form.eventType}
                    onChange={(e) => handleChange('eventType', e.target.value)}
                  />
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
                </label>
              </div>

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
                    className={`${styles.input} ${
                      errors.customerContact ? styles.inputError : ''
                    }`}
                    placeholder="902-715-2645"
                    value={form.customerContact}
                    onChange={(e) =>
                      handleChange('customerContact', e.target.value)
                    }
                  />
                  {errors.customerContact && (
                    <span className={styles.errorText}>
                      {errors.customerContact}
                    </span>
                  )}
                </label>
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.label}>Rate / Package</span>
                  <input
                    className={styles.input}
                    placeholder="Sunday rate"
                    value={form.ratePackage}
                    onChange={(e) =>
                      handleChange('ratePackage', e.target.value)
                    }
                  />
                </label>

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
              </div>

              <div className={styles.fieldRow}>
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
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Logistics</h3>
                <span className={styles.sectionHint}>
                  Payments, timing, and layout
                </span>
              </div>

              <div className={styles.fieldRow}>
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
                  <span className={styles.label}>Payment Details</span>
                  <textarea
                    className={`${styles.input} ${styles.textarea}`}
                    placeholder="Deposit amount, remaining balance, due dates..."
                    value={form.paymentDetails}
                    onChange={(e) =>
                      handleChange('paymentDetails', e.target.value)
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

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Vendors &amp; Notes</h3>
                <span className={styles.sectionHint}>
                  Keep track of partners and follow-ups
                </span>
              </div>

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

