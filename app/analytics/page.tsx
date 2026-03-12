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
} from '../lib/events'

export default function AnalyticsPage() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  useEffect(() => {
    setEvents(loadEvents())
    setCustomers(loadCustomers())
  }, [])

  const todayStr = useMemo(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const stats = useMemo(() => {
    const byYear: Record<string, number> = {}
    const byMonth: Record<string, number> = {}
    const revenueByYear: Record<string, number> = {}
    const revenueByMonth: Record<string, number> = {}

    events.forEach((event) => {
      if (event.eventDate) {
        const [year, month] = event.eventDate.split('-').map(Number)
        const yearStr = year.toString()
        const monthKey = `${yearStr}-${String(month).padStart(2, '0')}`

        byYear[yearStr] = (byYear[yearStr] || 0) + 1
        byMonth[monthKey] = (byMonth[monthKey] || 0) + 1

        if (event.status === 'confirmed') {
          const rate = parseInt((event.ratePackage || '').replace(/[^\d]/g, '') || '0')
          revenueByYear[yearStr] = (revenueByYear[yearStr] || 0) + rate
          revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + rate
        }
      }
    })

    const sortedYears = Object.keys(byYear).sort((a, b) => b.localeCompare(a))
    const sortedMonths = Object.keys(byMonth).sort((a, b) => a.localeCompare(b))

    const prospects = events.filter((e) => e.status === 'prospect').length
    const confirmed = events.filter((e) => e.status === 'confirmed').length
    const lost = events.filter((e) => e.status === 'lost').length

    const resolved = confirmed + lost
    const conversionRate = resolved > 0 ? Math.round((confirmed / resolved) * 100) : 0

    const lostEvents = events.filter((e) => e.status === 'lost')
    const totalLostRevenue = lostEvents.reduce((sum, e) => {
      const amount = parseInt((e.ratePackage || '').replace(/[^\d]/g, '') || '0')
      return sum + amount
    }, 0)

    const pastConfirmed = events.filter(
      (e) => e.status === 'confirmed' && e.eventDate && e.eventDate < todayStr
    )
    const futureConfirmed = events.filter(
      (e) => e.status === 'confirmed' && e.eventDate && e.eventDate >= todayStr
    )

    const revenueCollected = pastConfirmed.reduce((sum, e) => {
      const amount = parseInt((e.ratePackage || '').replace(/[^\d]/g, '') || '0')
      return sum + amount
    }, 0) + futureConfirmed.reduce((sum, e) => {
      const deposit = parseInt((e.depositAmount || '').replace(/[^\d]/g, '') || '0')
      return sum + deposit
    }, 0)

    const amountDue = futureConfirmed.reduce((sum, e) => {
      const rate = parseInt((e.ratePackage || '').replace(/[^\d]/g, '') || '0')
      const deposit = parseInt((e.depositAmount || '').replace(/[^\d]/g, '') || '0')
      return sum + (rate - deposit)
    }, 0)

    const totalRevenue = events
      .filter((e) => e.status === 'confirmed')
      .reduce((sum, e) => {
        const amount = parseInt((e.ratePackage || '').replace(/[^\d]/g, '') || '0')
        return sum + amount
      }, 0)

    const avgBookingValue = confirmed > 0 ? Math.round(totalRevenue / confirmed) : 0

    // Lead sources breakdown
    const leadSources: Record<string, number> = {}
    events.forEach((e) => {
      const source = e.leadSource?.trim() || 'Unknown'
      leadSources[source] = (leadSources[source] || 0) + 1
    })
    const sortedLeadSources = Object.entries(leadSources)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    // Event types breakdown
    const eventTypes: Record<string, number> = {}
    events.forEach((e) => {
      const type = e.eventType?.trim() || 'Unspecified'
      eventTypes[type] = (eventTypes[type] || 0) + 1
    })
    const sortedEventTypes = Object.entries(eventTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    return {
      total: events.length,
      prospects,
      confirmed,
      lost,
      conversionRate,
      totalLostRevenue,
      revenueCollected,
      amountDue,
      totalRevenue,
      avgBookingValue,
      customerCount: customers.length,
      byYear,
      byMonth,
      revenueByYear,
      revenueByMonth,
      sortedYears,
      sortedMonths,
      sortedLeadSources,
      sortedEventTypes,
    }
  }, [events, customers, todayStr])

  function formatMonthKey(key: string): string {
    const [year, month] = key.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  if (events.length === 0) {
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
                <Link href="/customers" className={styles.navLink}>
                  Customers
                </Link>
                <Link href="/analytics" className={`${styles.navLink} ${styles.navLinkActive}`}>
                  Analytics
                </Link>
                <Link href="/import" className={styles.navLink}>
                  Import
                </Link>
              </div>
            </div>
          </header>
          <div className={styles.emptyState}>
            No booking data yet. Add some bookings to see analytics.
          </div>
        </section>
      </main>
    )
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
              <Link href="/customers" className={styles.navLink}>
                Customers
              </Link>
              <Link href="/analytics" className={`${styles.navLink} ${styles.navLinkActive}`}>
                Analytics
              </Link>
              <Link href="/import" className={styles.navLink}>
                Import
              </Link>
            </div>
          </div>
        </header>

        <h1 className={styles.pageTitle}>Analytics</h1>

        <div className={styles.grid}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Overview</h2>
            <div className={styles.statGrid}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{stats.total}</span>
                <span className={styles.statLabel}>Total Bookings</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{stats.customerCount}</span>
                <span className={styles.statLabel}>Customers</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{stats.conversionRate}%</span>
                <span className={styles.statLabel}>Conversion Rate</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>${stats.avgBookingValue.toLocaleString()}</span>
                <span className={styles.statLabel}>Avg Booking Value</span>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Pipeline</h2>
            <div className={styles.statGrid}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{stats.confirmed}</span>
                <span className={styles.statLabel}>Confirmed</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{stats.prospects}</span>
                <span className={styles.statLabel}>Prospects</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{stats.lost}</span>
                <span className={styles.statLabel}>Lost</span>
              </div>
              {stats.totalLostRevenue > 0 && (
                <div className={styles.stat}>
                  <span className={styles.statValue}>${stats.totalLostRevenue.toLocaleString()}</span>
                  <span className={styles.statLabel}>Lost Revenue</span>
                </div>
              )}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Revenue</h2>
            <div className={styles.statGrid}>
              <div className={styles.stat}>
                <span className={styles.statValue}>${stats.totalRevenue.toLocaleString()}</span>
                <span className={styles.statLabel}>Total Confirmed</span>
              </div>
              <div
                className={styles.stat}
                title="Full rate from past confirmed bookings + deposits from future confirmed bookings"
              >
                <span className={styles.statValue}>${stats.revenueCollected.toLocaleString()}</span>
                <span className={styles.statLabel}>Collected</span>
              </div>
              <div
                className={styles.stat}
                title="Outstanding balance (rate minus deposit) for future confirmed bookings"
              >
                <span className={styles.statValue}>${stats.amountDue.toLocaleString()}</span>
                <span className={styles.statLabel}>Due</span>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>By Year</h2>
            <div className={styles.breakdown}>
              {stats.sortedYears.map((year) => (
                <div key={year} className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>{year}</span>
                  <span className={styles.breakdownValue}>
                    {stats.byYear[year]} bookings
                    {stats.revenueByYear[year] > 0 && (
                      <span className={styles.breakdownSub}>
                        ${stats.revenueByYear[year].toLocaleString()}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>By Month</h2>
            <div className={styles.breakdown}>
              {stats.sortedMonths.map((key) => (
                <div key={key} className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>{formatMonthKey(key)}</span>
                  <span className={styles.breakdownValue}>
                    {stats.byMonth[key]} bookings
                    {stats.revenueByMonth[key] > 0 && (
                      <span className={styles.breakdownSub}>
                        ${stats.revenueByMonth[key].toLocaleString()}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Event Types</h2>
            <div className={styles.breakdown}>
              {stats.sortedEventTypes.map(([type, count]) => (
                <div key={type} className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>{type}</span>
                  <span className={styles.breakdownValue}>{count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Lead Sources</h2>
            <div className={styles.breakdown}>
              {stats.sortedLeadSources.map(([source, count]) => (
                <div key={source} className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>{source}</span>
                  <span className={styles.breakdownValue}>{count}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
