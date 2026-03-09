'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import styles from './page.module.css'
import { EventRecord, loadEvents, saveEvents } from './lib/events'

export default function Home() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const initial = loadEvents()
    setEvents(initial)
    if (initial[0]) setActiveId(initial[0].id)
  }, [])

  const activeEvent = useMemo(
    () => events.find((e) => e.id === activeId) ?? null,
    [events, activeId],
  )

  function handleDelete(id: string) {
    setEvents((prev) => {
      const next = prev.filter((e) => e.id !== id)
      saveEvents(next)
      return next
    })
    setActiveId((current) => {
      if (current !== id) return current
      const currentEvents = loadEvents()
      return currentEvents[0]?.id ?? null
    })
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Venue Bookings</h1>
            <p className={styles.subtitle}>
              Quick overview of all saved events for your multi-use venue.
            </p>
          </div>
          <div>
            <Link href="/new" className={`${styles.button} ${styles.primaryButton}`}>
              New Booking
            </Link>
          </div>
        </header>

        <section className={styles.listPanel}>
          <h2 className={styles.panelTitle}>Saved Bookings</h2>

          {events.length === 0 ? (
            <p className={styles.emptyState}>
              No bookings yet. Click &quot;New Booking&quot; to create your first event.
            </p>
          ) : (
            <div className={styles.listLayout}>
              <div className={styles.eventList}>
                {events.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className={`${styles.eventCard} ${
                      activeId === event.id ? styles.eventCardActive : ''
                    }`}
                    onClick={() => setActiveId(event.id)}
                  >
                    <div className={styles.eventCardMain}>
                      <div className={styles.eventTitleRow}>
                        <span className={styles.eventType}>
                          {event.eventType || 'Untitled Event'}
                        </span>
                        {event.effortLevel && (
                          <span className={`${styles.pill} ${styles.pillEffort}`}>
                            {event.effortLevel}
                          </span>
                        )}
                      </div>
                      <span className={styles.eventMetaPrimary}>
                        {event.eventDate
                          ? new Date(event.eventDate).toLocaleDateString()
                          : 'Date TBD'}
                        {event.eventTimeStart &&
                          ` • ${event.eventTimeStart}${
                            event.eventTimeEnd ? `–${event.eventTimeEnd}` : ''
                          }`}
                      </span>
                      <span className={styles.eventMetaSecondary}>
                        {event.customerName || 'No customer yet'}
                        {event.ratePackage && ` • ${event.ratePackage}`}
                      </span>
                    </div>
                    <div className={styles.eventCardAside}>
                      {event.estimatedGuestCount && (
                        <span className={styles.pill}>
                          {event.estimatedGuestCount} guests
                        </span>
                      )}
                      {event.paymentSummary && (
                        <span className={styles.pillMuted}>
                          {event.paymentSummary}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {activeEvent && (
                <aside className={styles.detailPanel}>
                  <div className={styles.detailHeader}>
                    <div>
                      <h3 className={styles.detailTitle}>
                        {activeEvent.eventType || 'Untitled Event'}
                      </h3>
                      <p className={styles.detailSubtitle}>
                        {activeEvent.customerName || 'No customer yet'}
                      </p>
                    </div>
                    <div className={styles.detailActions}>
                      <Link
                        href={`/bookings/${activeEvent.id}`}
                        className={`${styles.button} ${styles.ghostButton}`}
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className={`${styles.button} ${styles.ghostButton} ${styles.dangerGhost}`}
                        onClick={() => handleDelete(activeEvent.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <dl className={styles.detailGrid}>
                    <div>
                      <dt>Date of Event</dt>
                      <dd>
                        {activeEvent.eventDate
                          ? new Date(activeEvent.eventDate).toLocaleDateString()
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Time</dt>
                      <dd>
                        {activeEvent.eventTimeStart || activeEvent.eventTimeEnd
                          ? `${activeEvent.eventTimeStart || 'Start'}${
                              activeEvent.eventTimeEnd
                                ? ` – ${activeEvent.eventTimeEnd}`
                                : ''
                            }`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Payment Summary</dt>
                      <dd>{activeEvent.paymentSummary || '—'}</dd>
                    </div>
                    <div>
                      <dt>Date of Deposit</dt>
                      <dd>
                        {activeEvent.dateOfDeposit
                          ? new Date(activeEvent.dateOfDeposit).toLocaleDateString()
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Rate / Package</dt>
                      <dd>{activeEvent.ratePackage || '—'}</dd>
                    </div>
                    <div>
                      <dt>Level of Effort</dt>
                      <dd>{activeEvent.effortLevel || '—'}</dd>
                    </div>
                    <div>
                      <dt>Lead Source</dt>
                      <dd>{activeEvent.leadSource || '—'}</dd>
                    </div>
                    <div>
                      <dt>Heard About Us</dt>
                      <dd>{activeEvent.heardFrom || '—'}</dd>
                    </div>
                    <div>
                      <dt>Guest Count</dt>
                      <dd>{activeEvent.estimatedGuestCount || '—'}</dd>
                    </div>
                    <div>
                      <dt>Airbnb</dt>
                      <dd>{activeEvent.airbnb || '—'}</dd>
                    </div>
                    <div className={styles.detailFull}>
                      <dt>Setup &amp; Layout</dt>
                      <dd>{activeEvent.setupLayout || '—'}</dd>
                    </div>
                    <div className={styles.detailFull}>
                      <dt>Payment Details</dt>
                      <dd>{activeEvent.paymentDetails || '—'}</dd>
                    </div>
                    <div className={styles.detailFull}>
                      <dt>Vendor List</dt>
                      <dd>{activeEvent.vendorList || '—'}</dd>
                    </div>
                    <div>
                      <dt>Contract Link</dt>
                      <dd>
                        {activeEvent.contractLink ? (
                          <a
                            href={activeEvent.contractLink}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View Contract
                          </a>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Photo Folder</dt>
                      <dd>
                        {activeEvent.photoFolder ? (
                          <a
                            href={activeEvent.photoFolder}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open Folder
                          </a>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div className={styles.detailFull}>
                      <dt>Post-Event Notes</dt>
                      <dd>{activeEvent.postEventNotes || '—'}</dd>
                    </div>
                  </dl>
                </aside>
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
