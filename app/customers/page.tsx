'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import styles from './page.module.css'
import {
  Customer,
  EventRecord,
  loadCustomers,
  loadEvents,
  migrateExistingBookingsToCustomers,
  saveCustomers,
} from '../lib/events'

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
  const [year, month, day] = dateStr.split('-')
  return `${parseInt(month)}/${parseInt(day)}/${year}`
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [events, setEvents] = useState<EventRecord[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    // Run migration on first load
    migrateExistingBookingsToCustomers()
    setCustomers(loadCustomers())
    setEvents(loadEvents())
  }, [])

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers
    const searchLower = search.toLowerCase()
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.contact.includes(search) ||
        (c.email && c.email.toLowerCase().includes(searchLower))
    )
  }, [customers, search])

  // Clear activeId if the selected customer is no longer in the filtered list
  useEffect(() => {
    if (activeId && !filteredCustomers.find((c) => c.id === activeId)) {
      setActiveId(null)
    }
  }, [filteredCustomers, activeId])

  const activeCustomer = useMemo(
    () => customers.find((c) => c.id === activeId) ?? null,
    [customers, activeId]
  )

  const customerBookings = useMemo(() => {
    if (!activeCustomer) return []
    return events
      .filter((e) => e.customerId === activeCustomer.id)
      .sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || ''))
  }, [events, activeCustomer])

  const customerStatsData = useMemo(() => {
    if (!activeCustomer) return { totalBookings: 0, totalRevenue: 0, lastBooking: '' }
    const bookings = customerBookings
    const totalRevenue = bookings.reduce((sum, b) => {
      const amount = parseInt((b.ratePackage || '').replace(/[^\d]/g, '') || '0')
      return sum + amount
    }, 0)
    const lastBooking = bookings[0]?.eventDate || ''
    return {
      totalBookings: bookings.length,
      totalRevenue,
      lastBooking,
    }
  }, [activeCustomer, customerBookings])

  const globalStats = useMemo(() => {
    const total = customers.length
    const withMultipleBookings = customers.filter((c) => {
      const count = events.filter((e) => e.customerId === c.id).length
      return count > 1
    }).length
    const totalBookings = events.filter((e) => e.customerId).length
    const avgBookings = total > 0 ? (totalBookings / total).toFixed(1) : '0'
    return { total, withMultipleBookings, avgBookings }
  }, [customers, events])

  function handleDelete(id: string) {
    const customer = customers.find((c) => c.id === id)
    if (!customer) return
    if (!window.confirm(`Are you sure you want to delete "${customer.name}"?`)) {
      return
    }
    setCustomers((prev) => {
      const next = prev.filter((c) => c.id !== id)
      saveCustomers(next)
      return next
    })
    setActiveId((current) => {
      if (current !== id) return current
      const remaining = customers.filter((c) => c.id !== id)
      return remaining[0]?.id ?? null
    })
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
            <div className={styles.navLinks}>
              <Link href="/" className={styles.navLink}>
                Bookings
              </Link>
              <Link href="/customers" className={`${styles.navLink} ${styles.navLinkActive}`}>
                Customers
              </Link>
            </div>
            <Link href="/customers/new" className={`${styles.button} ${styles.primaryButton}`}>
              New Customer
            </Link>
          </div>
        </header>

        {customers.length > 0 && (
          <section className={styles.statsSection}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{globalStats.total}</span>
              <span className={styles.statLabel}>Customers</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{globalStats.withMultipleBookings}</span>
              <span className={styles.statLabel}>Repeat</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{globalStats.avgBookings}</span>
              <span className={styles.statLabel}>Avg Bookings</span>
            </div>
          </section>
        )}

        <section className={styles.listPanel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Customers</h2>
            {customers.length > 0 && (
              <div className={styles.panelControls}>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search customers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
          </div>

          {customers.length === 0 ? (
            <p className={styles.emptyState}>
              No customers yet. Click &quot;New Customer&quot; to add your first customer, or create a booking to auto-generate customer records.
            </p>
          ) : (
            <div className={styles.listLayout}>
              <div className={styles.customerList}>
                {filteredCustomers.map((customer) => {
                  const bookingCount = events.filter((e) => e.customerId === customer.id).length
                  return (
                    <button
                      key={customer.id}
                      type="button"
                      className={`${styles.customerCard} ${
                        activeId === customer.id ? styles.customerCardActive : ''
                      }`}
                      onClick={() => setActiveId(activeId === customer.id ? null : customer.id)}
                    >
                      <span className={styles.customerName}>{customer.name}</span>
                      <span className={styles.customerContact}>
                        {formatPhoneNumber(customer.contact)}
                      </span>
                      <span className={styles.customerMeta}>
                        {bookingCount} booking{bookingCount !== 1 ? 's' : ''}
                      </span>
                    </button>
                  )
                })}
              </div>

              {activeCustomer ? (
                <aside className={styles.detailPanel}>
                  <div className={styles.detailHeader}>
                    <div>
                      <h3 className={styles.detailTitle}>{activeCustomer.name}</h3>
                      <p className={styles.detailSubtitle}>
                        {formatPhoneNumber(activeCustomer.contact)}
                      </p>
                    </div>
                    <div className={styles.detailActions}>
                      <Link
                        href={`/customers/${activeCustomer.id}`}
                        className={`${styles.button} ${styles.ghostButton}`}
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className={`${styles.button} ${styles.ghostButton}`}
                        style={{ color: '#dc2626', borderColor: '#dc2626' }}
                        onClick={() => handleDelete(activeCustomer.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {activeCustomer.email && (
                    <div className={styles.detailSection}>
                      <span className={styles.detailLabel}>Email</span>
                      <span className={styles.detailValue}>{activeCustomer.email}</span>
                    </div>
                  )}

                  {activeCustomer.notes && (
                    <div className={styles.detailSection}>
                      <span className={styles.detailLabel}>Notes</span>
                      <p className={styles.detailNotes}>{activeCustomer.notes}</p>
                    </div>
                  )}

                  <div className={styles.customerStats}>
                    <div className={styles.customerStat}>
                      <span className={styles.customerStatValue}>
                        {customerStatsData.totalBookings}
                      </span>
                      <span className={styles.customerStatLabel}>Bookings</span>
                    </div>
                    <div className={styles.customerStat}>
                      <span className={styles.customerStatValue}>
                        {customerStatsData.totalRevenue > 0
                          ? `$${customerStatsData.totalRevenue.toLocaleString()}`
                          : '—'}
                      </span>
                      <span className={styles.customerStatLabel}>Total Revenue</span>
                    </div>
                    <div className={styles.customerStat}>
                      <span className={styles.customerStatValue}>
                        {customerStatsData.lastBooking
                          ? formatDate(customerStatsData.lastBooking)
                          : '—'}
                      </span>
                      <span className={styles.customerStatLabel}>Last Booking</span>
                    </div>
                  </div>

                  {customerBookings.length > 0 && (
                    <div className={styles.detailSection}>
                      <span className={styles.detailLabel}>Booking History</span>
                      <div className={styles.bookingHistory}>
                        {customerBookings.map((booking) => (
                          <Link
                            key={booking.id}
                            href={`/bookings/${booking.id}`}
                            className={styles.bookingItem}
                          >
                            <div>
                              <span className={styles.bookingType}>
                                {booking.eventType || 'Untitled Event'}
                              </span>
                              <span className={styles.bookingDate}>
                                {' '}
                                &bull; {formatDate(booking.eventDate)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              {booking.ratePackage && (
                                <span className={styles.bookingAmount}>
                                  {formatCurrency(booking.ratePackage)}
                                </span>
                              )}
                              <span
                                className={`${styles.pill} ${
                                  booking.status === 'prospect'
                                    ? styles.pillProspect
                                    : booking.status === 'lost'
                                    ? styles.pillLost
                                    : styles.pillConfirmed
                                }`}
                              >
                                {booking.status === 'prospect' ? 'Prospect' : booking.status === 'lost' ? 'Lost' : 'Confirmed'}
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </aside>
              ) : (
                <div className={styles.detailEmpty}>
                  <p>Select a customer to view details</p>
                </div>
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
