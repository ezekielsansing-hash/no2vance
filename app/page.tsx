'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import SiteHeader from './components/SiteHeader'
import styles from './page.module.css'
import {
  Customer,
  EventRecord,
  deleteEvent,
  hasLegacyLocalData,
  loadCustomers,
  loadEvents,
  updateEvent,
} from './lib/events'

type ViewMode = 'list' | 'calendar'
type TimeScope = 'upcoming' | 'past' | 'all'

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

function formatCurrency(value: string): string {
  if (!value) return ''
  if (value.startsWith('$')) return value
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return value
  const num = parseInt(digits, 10)
  return '$' + num.toLocaleString('en-US')
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  // Simple string formatting - no Date parsing to avoid timezone issues
  const [year, month, day] = dateStr.split('-')
  return `${parseInt(month)}/${parseInt(day)}/${year}`
}

function formatTime(timeStr: string): string {
  if (!timeStr) return ''
  const [hours, minutes] = timeStr.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`
}

export default function Home() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [scope, setScope] = useState<TimeScope>('upcoming')
  const [rangeOpen, setRangeOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(['prospect', 'confirmed']))

  const [showMigrateBanner, setShowMigrateBanner] = useState(false)

  useEffect(() => {
    loadEvents().then(setEvents)
    loadCustomers().then(setCustomers)
    setShowMigrateBanner(hasLegacyLocalData())
  }, [])

  function getCustomerName(event: EventRecord): string {
    if (event.customerId) {
      const customer = customers.find((c) => c.id === event.customerId)
      if (customer) return customer.name
    }
    return event.customerName || 'No customer yet'
  }

  function getCustomerContact(event: EventRecord): string {
    if (event.customerId) {
      const customer = customers.find((c) => c.id === event.customerId)
      if (customer) return customer.contact
    }
    return event.customerContact || ''
  }

  const todayStr = useMemo(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const rangeActive = Boolean(dateFrom || dateTo)

  const sortedEvents = useMemo(() => {
    let filtered = events

    // Status filter
    filtered = filtered.filter((e) => statusFilter.has(e.status))

    // A custom date range overrides the time scope
    if (rangeActive) {
      filtered = filtered.filter((e) => {
        if (!e.eventDate) return false
        const eventDate = e.eventDate.slice(0, 10)
        return (!dateFrom || eventDate >= dateFrom) &&
               (!dateTo || eventDate <= dateTo)
      })
    } else if (scope === 'upcoming') {
      filtered = filtered.filter((e) => !e.eventDate || e.eventDate >= todayStr)
    } else if (scope === 'past') {
      filtered = filtered.filter((e) => e.eventDate && e.eventDate < todayStr)
    }

    // Sort is decided by scope: upcoming/all soonest-first, past most-recent-first
    const desc = scope === 'past' && !rangeActive
    return [...filtered].sort((a, b) => {
      const dateA = a.eventDate || ''
      const dateB = b.eventDate || ''
      if (!dateA && !dateB) return 0
      if (!dateA) return 1
      if (!dateB) return -1
      const cmp = dateA.localeCompare(dateB)
      return desc ? -cmp : cmp
    })
  }, [events, scope, todayStr, dateFrom, dateTo, rangeActive, statusFilter])

  const scopeCounts = useMemo(() => {
    const byStatus = events.filter((e) => statusFilter.has(e.status))
    const past = byStatus.filter(
      (e) => e.eventDate && e.eventDate < todayStr,
    ).length
    return { past, upcoming: byStatus.length - past, all: byStatus.length }
  }, [events, todayStr, statusFilter])


  // Clear activeId if the selected event is no longer in the filtered list
  useEffect(() => {
    if (activeId && !sortedEvents.find((e) => e.id === activeId)) {
      setActiveId(null)
    }
  }, [sortedEvents, activeId])

  const activeEvent = useMemo(
    () => events.find((e) => e.id === activeId) ?? null,
    [events, activeId],
  )


  async function handleDelete(id: string) {
    const event = events.find((e) => e.id === id)
    const name = event?.eventType || 'this event'
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return
    }
    try {
      await deleteEvent(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
      return
    }
    const remaining = events.filter((e) => e.id !== id)
    setEvents(remaining)
    setActiveId((current) =>
      current === id ? remaining[0]?.id ?? null : current,
    )
  }

  function clearDateFilter() {
    setDateFrom('')
    setDateTo('')
    setRangeOpen(false)
  }

  async function handleConvert(id: string) {
    const event = events.find((e) => e.id === id)
    if (!event) return
    const updated: EventRecord = {
      ...event,
      status: 'confirmed',
      convertedAt: new Date().toISOString(),
    }
    try {
      await updateEvent(updated)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed')
      return
    }
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)))
  }

  async function handleMarkAsLost(id: string) {
    const event = events.find((e) => e.id === id)
    if (!event) return
    const updated: EventRecord = { ...event, status: 'lost' }
    try {
      await updateEvent(updated)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed')
      return
    }
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)))
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
        <SiteHeader />

        {showMigrateBanner && (
          <div className={styles.migrateBanner}>
            <span>
              This browser still has data saved locally that isn&apos;t in the
              shared database yet.
            </span>
            <Link href="/import" className={styles.migrateBannerLink}>
              Move it to the cloud →
            </Link>
          </div>
        )}


        <section className={styles.listPanel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderLeft}>
              <h2 className={styles.panelTitle}>Bookings</h2>
              {events.length > 0 && (
                <span className={styles.listCount}>{sortedEvents.length} shown</span>
              )}
            </div>
            <Link href="/new" className={`${styles.button} ${styles.primaryButton}`}>
              New Prospect/Booking
            </Link>
          </div>

          {events.length === 0 ? (
            <p className={styles.emptyState}>
              No bookings yet. Click &quot;New Prospect/Booking&quot; to create your first event.
            </p>
          ) : (
            <div className={styles.listLayout}>
              <div className={styles.listColumn}>
                <div className={styles.listFilters}>
                  <div className={styles.toolbarRow}>
                    <span className={styles.toolLabel}>View</span>
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
                    {viewMode === 'list' && (
                      <>
                        <span className={styles.toolLabel}>Show</span>
                        <div
                          className={`${styles.viewToggle} ${rangeActive ? styles.segDisabled : ''}`}
                          role="group"
                          aria-label="Time scope"
                        >
                          {(['upcoming', 'past', 'all'] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              className={`${styles.viewToggleBtn} ${scope === s ? styles.viewToggleBtnActive : ''}`}
                              onClick={() => setScope(s)}
                            >
                              {s === 'upcoming' ? 'Upcoming' : s === 'past' ? 'Past' : 'All'}
                              <span className={styles.segCount}>{scopeCounts[s]}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <div className={styles.toolbarRow}>
                    <span className={styles.toolLabel}>Status</span>
                    <div className={styles.statusFilterGroup}>
                      {(['prospect', 'confirmed', 'lost'] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`${styles.statusChip} ${
                            status === 'prospect' ? styles.chipProspect : status === 'confirmed' ? styles.chipConfirmed : styles.chipLost
                          } ${statusFilter.has(status) ? styles.statusChipOn : ''}`}
                          aria-pressed={statusFilter.has(status)}
                          onClick={() => {
                            setStatusFilter((prev) => {
                              const next = new Set(prev)
                              if (next.has(status)) {
                                next.delete(status)
                              } else {
                                next.add(status)
                              }
                              return next
                            })
                          }}
                        >
                          {status === 'prospect' ? 'Prospect' : status === 'confirmed' ? 'Confirmed' : 'Lost'}
                        </button>
                      ))}
                    </div>
                    {viewMode === 'list' &&
                      (rangeOpen || rangeActive ? (
                        <div className={styles.dateFilters}>
                          <input
                            type="date"
                            className={styles.dateFilter}
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            title="From date"
                          />
                          <span className={styles.dateRangeSeparator}>to</span>
                          <input
                            type="date"
                            className={styles.dateFilter}
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            title="To date"
                          />
                          <button
                            type="button"
                            className={styles.filterBtn}
                            onClick={clearDateFilter}
                            aria-label="Clear date range"
                          >
                            ✕ Clear
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={styles.filterBtn}
                          onClick={() => setRangeOpen(true)}
                        >
                          Date range…
                        </button>
                      ))}
                  </div>
                </div>
                {viewMode === 'list' ? (
                  <div className={styles.eventList}>
                  {sortedEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={`${styles.eventCard} ${
                        activeId === event.id ? styles.eventCardActive : ''
                      }`}
                      onClick={() => setActiveId(activeId === event.id ? null : event.id)}
                    >
                      <div className={styles.eventCardMain}>
                        <div className={styles.eventTitleRow}>
                          <span className={styles.eventType}>
                            {getCustomerName(event)}
                          </span>
                          <span className={`${styles.pill} ${
                            event.status === 'prospect'
                              ? styles.pillProspect
                              : event.status === 'lost'
                              ? styles.pillLost
                              : styles.pillConfirmed
                          }`}>
                            {event.status === 'prospect' ? 'Prospect' : event.status === 'lost' ? 'Lost' : 'Confirmed'}
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
                            ` • ${formatDate(event.eventDate)}`}
                          {event.eventTimeStart &&
                            ` • ${formatTime(event.eventTimeStart)}${
                              event.eventTimeEnd ? `–${formatTime(event.eventTimeEnd)}` : ''
                            }`}
                        </span>
                        <span className={styles.eventMetaSecondary}>
                          {formatCurrency(event.ratePackage) || ''}
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
                                onClick={() => setActiveId(activeId === event.id ? null : event.id)}
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
              </div>

              <div
                className={`${styles.detailColumn} ${
                  activeEvent ? styles.detailColumnOpen : ''
                }`}
              >
                {activeEvent ? (
                  <aside className={styles.detailPanel}>
                    <button
                      type="button"
                      className={styles.detailClose}
                      onClick={() => setActiveId(null)}
                    >
                      ← Back to list
                    </button>
                    <div className={styles.detailEventHeader}>
                      <div>
                        <h3 className={styles.detailTitle}>
                          {getCustomerName(activeEvent)}
                        </h3>
                      <p className={styles.detailSubtitle}>
                        {activeEvent.eventType || 'Untitled Event'}
                      </p>
                    </div>
                    <div className={styles.detailActions}>
                      {activeEvent.status === 'prospect' && (
                        <>
                          <button
                            type="button"
                            className={`${styles.button} ${styles.confirmButton}`}
                            onClick={() => handleConvert(activeEvent.id)}
                          >
                            Convert to Booking
                          </button>
                          <button
                            type="button"
                            className={`${styles.button} ${styles.lostButton}`}
                            onClick={() => handleMarkAsLost(activeEvent.id)}
                          >
                            Mark as Lost
                          </button>
                        </>
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
                        {getCustomerContact(activeEvent)
                          ? formatPhoneNumber(getCustomerContact(activeEvent))
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Date of Event</dt>
                      <dd>
                        {activeEvent.eventDate
                          ? formatDate(activeEvent.eventDate)
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Time</dt>
                      <dd>
                        {activeEvent.eventTimeStart || activeEvent.eventTimeEnd
                          ? `${activeEvent.eventTimeStart ? formatTime(activeEvent.eventTimeStart) : 'Start'}${
                              activeEvent.eventTimeEnd
                                ? ` – ${formatTime(activeEvent.eventTimeEnd)}`
                                : ''
                            }`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Rate / Package</dt>
                      <dd>{formatCurrency(activeEvent.ratePackage) || '—'}</dd>
                    </div>
                    <div>
                      <dt>Deposit Amount</dt>
                      <dd>{formatCurrency(activeEvent.depositAmount) || '—'}</dd>
                    </div>
                    <div>
                      <dt>Balance Due</dt>
                      <dd>
                        {(() => {
                          const rate = parseInt((activeEvent.ratePackage || '').replace(/[^\d]/g, '') || '0')
                          const deposit = parseInt((activeEvent.depositAmount || '').replace(/[^\d]/g, '') || '0')
                          const balance = rate - deposit
                          return balance > 0 ? `$${balance.toLocaleString()}` : '—'
                        })()}
                      </dd>
                    </div>
                    <div>
                      <dt>Date of Deposit</dt>
                      <dd>
                        {activeEvent.dateOfDeposit
                          ? formatDate(activeEvent.dateOfDeposit)
                          : '—'}
                      </dd>
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
                ) : (
                  <div className={styles.detailEmpty}>
                    <p>Select a booking to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
