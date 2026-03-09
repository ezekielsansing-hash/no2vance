'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import styles from './page.module.css'
import { EventRecord, loadEvents, saveEvents } from './lib/events'

type ViewMode = 'list' | 'calendar'

export default function Home() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [calendarDate, setCalendarDate] = useState(() => new Date())

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

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const days: { date: Date; isCurrentMonth: boolean }[] = []

    // Days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      })
    }

    // Days in current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      })
    }

    // Fill remaining cells to complete 6 weeks (42 days)
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      })
    }

    return days
  }, [calendarDate])

  const eventsByDate = useMemo(() => {
    const map: Record<string, EventRecord[]> = {}
    events.forEach((event) => {
      if (event.eventDate) {
        const dateKey = event.eventDate.split('T')[0]
        if (!map[dateKey]) map[dateKey] = []
        map[dateKey].push(event)
      }
    })
    return map
  }, [events])

  function formatDateKey(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function isToday(date: Date): boolean {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  function navigateMonth(delta: number) {
    setCalendarDate((prev) => {
      const next = new Date(prev)
      next.setMonth(next.getMonth() + delta)
      return next
    })
  }

  const monthYearLabel = calendarDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

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
          <div className={styles.headerActions}>
            <div className={styles.viewToggle}>
              <button
                type="button"
                className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleBtnActive : ''}`}
                onClick={() => setViewMode('list')}
              >
                List
              </button>
              <button
                type="button"
                className={`${styles.viewToggleBtn} ${viewMode === 'calendar' ? styles.viewToggleBtnActive : ''}`}
                onClick={() => setViewMode('calendar')}
              >
                Calendar
              </button>
            </div>
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
              {viewMode === 'list' ? (
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
              ) : (
                <div className={styles.calendar}>
                  <div className={styles.calendarHeader}>
                    <button
                      type="button"
                      className={styles.calendarNavBtn}
                      onClick={() => navigateMonth(-1)}
                    >
                      &larr;
                    </button>
                    <span className={styles.calendarMonth}>{monthYearLabel}</span>
                    <button
                      type="button"
                      className={styles.calendarNavBtn}
                      onClick={() => navigateMonth(1)}
                    >
                      &rarr;
                    </button>
                  </div>
                  <div className={styles.calendarGrid}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className={styles.calendarDayHeader}>
                        {day}
                      </div>
                    ))}
                    {calendarDays.map(({ date, isCurrentMonth }, idx) => {
                      const dateKey = formatDateKey(date)
                      const dayEvents = eventsByDate[dateKey] || []
                      return (
                        <div
                          key={idx}
                          className={`${styles.calendarDay} ${
                            !isCurrentMonth ? styles.calendarDayOutside : ''
                          } ${isToday(date) ? styles.calendarDayToday : ''}`}
                        >
                          <span className={styles.calendarDayNumber}>{date.getDate()}</span>
                          <div className={styles.calendarEvents}>
                            {dayEvents.map((event) => (
                              <button
                                key={event.id}
                                type="button"
                                className={`${styles.calendarEvent} ${
                                  activeId === event.id ? styles.calendarEventActive : ''
                                }`}
                                onClick={() => setActiveId(event.id)}
                                title={event.eventType || 'Untitled Event'}
                              >
                                {event.eventType || 'Untitled'}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

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
