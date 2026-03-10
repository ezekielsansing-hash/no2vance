'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import styles from './page.module.css'
import { EventRecord, loadEvents, saveEvents } from './lib/events'

type ViewMode = 'list' | 'calendar'
type SortOrder = 'asc' | 'desc'

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

export default function Home() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [hidePast, setHidePast] = useState(true)

  useEffect(() => {
    const initial = loadEvents()
    setEvents(initial)
  }, [])

  const todayStr = useMemo(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const sortedEvents = useMemo(() => {
    let filtered = events
    if (hidePast) {
      filtered = events.filter((e) => !e.eventDate || e.eventDate >= todayStr)
    }
    return [...filtered].sort((a, b) => {
      const dateA = a.eventDate || ''
      const dateB = b.eventDate || ''
      if (!dateA && !dateB) return 0
      if (!dateA) return 1
      if (!dateB) return -1
      const cmp = dateA.localeCompare(dateB)
      return sortOrder === 'asc' ? cmp : -cmp
    })
  }, [events, sortOrder, hidePast, todayStr])

  const pastEventCount = useMemo(() => {
    return events.filter((e) => e.eventDate && e.eventDate < todayStr).length
  }, [events, todayStr])

  useEffect(() => {
    if (sortedEvents.length > 0 && !activeId) {
      setActiveId(sortedEvents[0].id)
    }
  }, [sortedEvents, activeId])

  const activeEvent = useMemo(
    () => events.find((e) => e.id === activeId) ?? null,
    [events, activeId],
  )

  const eventStats = useMemo(() => {
    const byYear: Record<string, number> = {}
    const byMonth: Record<string, number> = {}

    sortedEvents.forEach((event) => {
      if (event.eventDate) {
        const date = new Date(event.eventDate)
        const year = date.getFullYear().toString()
        const monthKey = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`

        byYear[year] = (byYear[year] || 0) + 1
        byMonth[monthKey] = (byMonth[monthKey] || 0) + 1
      }
    })

    const sortedYears = Object.keys(byYear).sort((a, b) => b.localeCompare(a))
    const sortedMonths = Object.keys(byMonth).sort((a, b) => b.localeCompare(a))

    const prospects = sortedEvents.filter((e) => e.status === 'prospect').length
    const confirmed = sortedEvents.filter((e) => e.status !== 'prospect').length
    const allProspects = events.filter((e) => e.status === 'prospect').length
    const allConfirmed = events.filter((e) => e.status !== 'prospect').length
    const converted = events.filter((e) => e.convertedAt).length
    const conversionRate = allProspects + converted > 0
      ? Math.round((converted / (allProspects + converted)) * 100)
      : 0

    return {
      total: sortedEvents.length,
      prospects,
      confirmed,
      conversionRate,
      byYear,
      byMonth,
      sortedYears,
      sortedMonths,
    }
  }, [sortedEvents, events])

  function handleDelete(id: string) {
    const event = events.find((e) => e.id === id)
    const name = event?.eventType || 'this event'
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return
    }
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

  function handleConvert(id: string) {
    setEvents((prev) => {
      const next = prev.map((e) =>
        e.id === id
          ? { ...e, status: 'confirmed' as const, convertedAt: new Date().toISOString() }
          : e
      )
      saveEvents(next)
      return next
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

  function formatMonthKey(key: string): string {
    const [year, month] = key.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <Image
              src="/logo.png"
              alt="No. 2 Vance Event Venue"
              width={400}
              height={180}
              className={styles.logo}
              priority
            />
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

        {sortedEvents.length > 0 && (
          <section className={styles.statsSection}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{eventStats.confirmed}</span>
              <span className={styles.statLabel}>Confirmed</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{eventStats.prospects}</span>
              <span className={styles.statLabel}>Prospects</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{eventStats.conversionRate}%</span>
              <span className={styles.statLabel}>Conversion</span>
            </div>
            <div className={styles.statGroup}>
              <span className={styles.statGroupLabel}>By Year</span>
              <div className={styles.statTags}>
                {eventStats.sortedYears.map((year) => (
                  <span key={year} className={styles.statTag}>
                    {year}: {eventStats.byYear[year]}
                  </span>
                ))}
              </div>
            </div>
            <div className={styles.statGroup}>
              <span className={styles.statGroupLabel}>By Month</span>
              <div className={styles.statTags}>
                {eventStats.sortedMonths.slice(0, 6).map((key) => (
                  <span key={key} className={styles.statTag}>
                    {formatMonthKey(key)}: {eventStats.byMonth[key]}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className={styles.listPanel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Saved Bookings</h2>
            {events.length > 0 && (
              <div className={styles.panelControls}>
                {pastEventCount > 0 && (
                  <button
                    type="button"
                    className={`${styles.filterBtn} ${hidePast ? styles.filterBtnActive : ''}`}
                    onClick={() => setHidePast((prev) => !prev)}
                  >
                    {hidePast ? `Show past (${pastEventCount})` : 'Hide past'}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.sortBtn}
                  onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                >
                  Date {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            )}
          </div>

          {events.length === 0 ? (
            <p className={styles.emptyState}>
              No bookings yet. Click &quot;New Booking&quot; to create your first event.
            </p>
          ) : (
            <div className={styles.listLayout}>
              {viewMode === 'list' ? (
                <div className={styles.eventList}>
                  {sortedEvents.map((event) => (
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
                            {event.customerName || 'No customer yet'}
                          </span>
                          <span className={`${styles.pill} ${
                            event.status === 'prospect' ? styles.pillProspect : styles.pillConfirmed
                          }`}>
                            {event.status === 'prospect' ? 'Prospect' : 'Confirmed'}
                          </span>
                          {event.effortLevel && (
                            <span className={`${styles.pill} ${styles.pillEffort}`}>
                              {event.effortLevel}
                            </span>
                          )}
                        </div>
                        <span className={styles.eventMetaPrimary}>
                          {event.eventType || 'Untitled Event'}
                          {event.eventDate &&
                            ` • ${new Date(event.eventDate).toLocaleDateString()}`}
                          {event.eventTimeStart &&
                            ` • ${event.eventTimeStart}${
                              event.eventTimeEnd ? `–${event.eventTimeEnd}` : ''
                            }`}
                        </span>
                        <span className={styles.eventMetaSecondary}>
                          {event.ratePackage || ''}
                        </span>
                      </div>
                      <div className={styles.eventCardAside}>
                        {event.estimatedGuestCount && (
                          <span className={styles.pill}>
                            {event.estimatedGuestCount} guests
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
                        {activeEvent.customerName || 'No customer yet'}
                      </h3>
                      <p className={styles.detailSubtitle}>
                        {activeEvent.eventType || 'Untitled Event'}
                      </p>
                    </div>
                    <div className={styles.detailActions}>
                      {activeEvent.status === 'prospect' && (
                        <button
                          type="button"
                          className={`${styles.button} ${styles.primaryButton}`}
                          onClick={() => handleConvert(activeEvent.id)}
                        >
                          Convert to Booking
                        </button>
                      )}
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
                      <dt>Contact</dt>
                      <dd>
                        {activeEvent.customerContact
                          ? formatPhoneNumber(activeEvent.customerContact)
                          : '—'}
                      </dd>
                    </div>
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
