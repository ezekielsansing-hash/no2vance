'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import styles from './page.module.css'
import {
  Customer,
  EventRecord,
  loadCustomers,
  loadEvents,
} from '../lib/events'

const COLORS = ['#1a1a1a', '#666', '#999', '#ccc', '#059669', '#d97706', '#dc2626']
const STATUS_COLORS: Record<string, string> = {
  confirmed: '#059669',
  prospect: '#d97706',
  lost: '#dc2626',
}

export default function AnalyticsPage() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(
    new Set(['prospect', 'confirmed', 'lost'])
  )

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

  // Filter events by date range and status
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (!statusFilter.has(e.status)) return false
      if (dateFrom && e.eventDate && e.eventDate < dateFrom) return false
      if (dateTo && e.eventDate && e.eventDate > dateTo) return false
      return true
    })
  }, [events, dateFrom, dateTo, statusFilter])

  const stats = useMemo(() => {
    const byYear: Record<string, number> = {}
    const byMonth: Record<string, number> = {}
    const revenueByYear: Record<string, number> = {}
    const revenueByMonth: Record<string, number> = {}

    filteredEvents.forEach((event) => {
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

    const sortedYears = Object.keys(byYear).sort((a, b) => a.localeCompare(b))
    const sortedMonths = Object.keys(byMonth).sort((a, b) => a.localeCompare(b))

    const prospects = filteredEvents.filter((e) => e.status === 'prospect').length
    const confirmed = filteredEvents.filter((e) => e.status === 'confirmed').length
    const lost = filteredEvents.filter((e) => e.status === 'lost').length

    const resolved = confirmed + lost
    const conversionRate = resolved > 0 ? Math.round((confirmed / resolved) * 100) : 0

    const lostRevenue = filteredEvents
      .filter((e) => e.status === 'lost')
      .reduce((sum, e) => {
        const amount = parseInt((e.ratePackage || '').replace(/[^\d]/g, '') || '0')
        return sum + amount
      }, 0)

    const pastConfirmed = filteredEvents.filter(
      (e) => e.status === 'confirmed' && e.eventDate && e.eventDate < todayStr
    )
    const futureConfirmed = filteredEvents.filter(
      (e) => e.status === 'confirmed' && e.eventDate && e.eventDate >= todayStr
    )

    const revenueCollected =
      pastConfirmed.reduce((sum, e) => {
        const amount = parseInt((e.ratePackage || '').replace(/[^\d]/g, '') || '0')
        return sum + amount
      }, 0) +
      futureConfirmed.reduce((sum, e) => {
        const deposit = parseInt((e.depositAmount || '').replace(/[^\d]/g, '') || '0')
        return sum + deposit
      }, 0)

    const amountDue = futureConfirmed.reduce((sum, e) => {
      const rate = parseInt((e.ratePackage || '').replace(/[^\d]/g, '') || '0')
      const deposit = parseInt((e.depositAmount || '').replace(/[^\d]/g, '') || '0')
      return sum + (rate - deposit)
    }, 0)

    const totalRevenue = filteredEvents
      .filter((e) => e.status === 'confirmed')
      .reduce((sum, e) => {
        const amount = parseInt((e.ratePackage || '').replace(/[^\d]/g, '') || '0')
        return sum + amount
      }, 0)

    const avgBookingValue = confirmed > 0 ? Math.round(totalRevenue / confirmed) : 0

    // Lead sources breakdown
    const leadSources: Record<string, number> = {}
    filteredEvents.forEach((e) => {
      const source = e.leadSource?.trim() || 'Unknown'
      leadSources[source] = (leadSources[source] || 0) + 1
    })
    const sortedLeadSources = Object.entries(leadSources)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)

    // Event types breakdown
    const eventTypes: Record<string, number> = {}
    filteredEvents.forEach((e) => {
      const type = e.eventType?.trim() || 'Unspecified'
      eventTypes[type] = (eventTypes[type] || 0) + 1
    })
    const sortedEventTypes = Object.entries(eventTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)

    // Chart data
    const monthlyData = sortedMonths.map((key) => ({
      month: formatMonthKeyShort(key),
      bookings: byMonth[key] || 0,
      revenue: revenueByMonth[key] || 0,
    }))

    const statusData = [
      { name: 'Confirmed', value: confirmed, color: STATUS_COLORS.confirmed },
      { name: 'Prospect', value: prospects, color: STATUS_COLORS.prospect },
      { name: 'Lost', value: lost, color: STATUS_COLORS.lost },
    ].filter((d) => d.value > 0)

    const eventTypeData = sortedEventTypes.map(([name, value], i) => ({
      name: name.length > 15 ? name.slice(0, 15) + '...' : name,
      value,
      color: COLORS[i % COLORS.length],
    }))

    const leadSourceData = sortedLeadSources.map(([name, value], i) => ({
      name: name.length > 15 ? name.slice(0, 15) + '...' : name,
      value,
      color: COLORS[i % COLORS.length],
    }))

    return {
      total: filteredEvents.length,
      prospects,
      confirmed,
      lost,
      conversionRate,
      lostRevenue,
      revenueCollected,
      amountDue,
      totalRevenue,
      avgBookingValue,
      byYear,
      byMonth,
      revenueByYear,
      revenueByMonth,
      sortedYears,
      sortedMonths,
      monthlyData,
      statusData,
      eventTypeData,
      leadSourceData,
    }
  }, [filteredEvents, todayStr])

  // Customer analytics
  const customerStats = useMemo(() => {
    const customerBookingCounts: Record<string, number> = {}
    const customerRevenue: Record<string, number> = {}

    filteredEvents.forEach((e) => {
      if (e.customerId) {
        customerBookingCounts[e.customerId] = (customerBookingCounts[e.customerId] || 0) + 1
        if (e.status === 'confirmed') {
          const rate = parseInt((e.ratePackage || '').replace(/[^\d]/g, '') || '0')
          customerRevenue[e.customerId] = (customerRevenue[e.customerId] || 0) + rate
        }
      }
    })

    const customersWithBookings = Object.keys(customerBookingCounts).length
    const repeatCustomers = Object.values(customerBookingCounts).filter((c) => c > 1).length
    const repeatRate =
      customersWithBookings > 0 ? Math.round((repeatCustomers / customersWithBookings) * 100) : 0

    // Top customers by revenue
    const topByRevenue = Object.entries(customerRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, revenue]) => {
        const customer = customers.find((c) => c.id === id)
        return {
          name: customer?.name || 'Unknown',
          revenue,
          bookings: customerBookingCounts[id] || 0,
        }
      })

    // Top customers by booking count
    const topByBookings = Object.entries(customerBookingCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const customer = customers.find((c) => c.id === id)
        return {
          name: customer?.name || 'Unknown',
          bookings: count,
          revenue: customerRevenue[id] || 0,
        }
      })

    return {
      totalCustomers: customers.length,
      customersWithBookings,
      repeatCustomers,
      repeatRate,
      topByRevenue,
      topByBookings,
    }
  }, [filteredEvents, customers])

  function formatMonthKeyShort(key: string): string {
    const [year, month] = key.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }

  function clearFilters() {
    setDateFrom('')
    setDateTo('')
    setStatusFilter(new Set(['prospect', 'confirmed', 'lost']))
  }

  const hasFilters = dateFrom || dateTo || statusFilter.size < 3

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
              <Link href="/vendors" className={styles.navLink}>
                Vendors
              </Link>
              <Link href="/import" className={styles.navLink}>
                Import
              </Link>
            </div>
          </div>
        </header>

        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Analytics</h1>
          <div className={styles.filters}>
            <div className={styles.dateFilters}>
              <input
                type="date"
                className={styles.dateInput}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                title="From date"
              />
              <span className={styles.dateSeparator}>to</span>
              <input
                type="date"
                className={styles.dateInput}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                title="To date"
              />
            </div>
            <div className={styles.statusFilters}>
              {(['prospect', 'confirmed', 'lost'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`${styles.statusBtn} ${
                    statusFilter.has(status) ? styles.statusBtnActive : ''
                  } ${statusFilter.has(status) ? styles[`statusBtn${status.charAt(0).toUpperCase() + status.slice(1)}`] : ''}`}
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
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
            {hasFilters && (
              <button type="button" className={styles.clearBtn} onClick={clearFilters}>
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className={styles.emptyState}>
            No bookings match the current filters.
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <section className={styles.metricsRow}>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>{stats.total}</span>
                <span className={styles.metricLabel}>Bookings</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>{stats.confirmed}</span>
                <span className={styles.metricLabel}>Confirmed</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>{stats.conversionRate}%</span>
                <span className={styles.metricLabel}>Conversion</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>${stats.totalRevenue.toLocaleString()}</span>
                <span className={styles.metricLabel}>Total Revenue</span>
              </div>
              <div
                className={styles.metricCard}
                title="Full rate from past confirmed + deposits from future confirmed"
              >
                <span className={styles.metricValue}>
                  ${stats.revenueCollected.toLocaleString()}
                </span>
                <span className={styles.metricLabel}>Collected</span>
              </div>
              <div
                className={styles.metricCard}
                title="Outstanding balance for future confirmed bookings"
              >
                <span className={styles.metricValue}>${stats.amountDue.toLocaleString()}</span>
                <span className={styles.metricLabel}>Due</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>${stats.avgBookingValue.toLocaleString()}</span>
                <span className={styles.metricLabel}>Avg Value</span>
              </div>
            </section>

            {/* Charts Row */}
            <div className={styles.chartsGrid}>
              {/* Bookings by Month */}
              <section className={styles.chartCard}>
                <h2 className={styles.chartTitle}>Bookings by Month</h2>
                <div className={styles.chartContainer}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={stats.monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, border: '1px solid #ddd' }}
                      />
                      <Bar dataKey="bookings" fill="#1a1a1a" radius={[2, 2, 0, 0]} name="Bookings" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Revenue by Month */}
              <section className={styles.chartCard}>
                <h2 className={styles.chartTitle}>Revenue by Month</h2>
                <div className={styles.chartContainer}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={stats.monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, border: '1px solid #ddd' }}
                        formatter={(value) => `$${Number(value).toLocaleString()}`}
                      />
                      <Bar dataKey="revenue" fill="#059669" radius={[2, 2, 0, 0]} name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Status Breakdown */}
              <section className={styles.chartCard}>
                <h2 className={styles.chartTitle}>Status Breakdown</h2>
                <div className={styles.chartContainer}>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={stats.statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {stats.statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ fontSize: 12, border: '1px solid #ddd' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Event Types */}
              <section className={styles.chartCard}>
                <h2 className={styles.chartTitle}>Event Types</h2>
                <div className={styles.chartContainer}>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={stats.eventTypeData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        paddingAngle={1}
                        dataKey="value"
                      >
                        {stats.eventTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ fontSize: 12, border: '1px solid #ddd' }}
                      />
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        wrapperStyle={{ fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>

            {/* Second Row */}
            <div className={styles.grid}>
              {/* Lead Sources */}
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Lead Sources</h2>
                <div className={styles.barList}>
                  {stats.leadSourceData.map((item) => (
                    <div key={item.name} className={styles.barItem}>
                      <div className={styles.barLabel}>
                        <span>{item.name}</span>
                        <span className={styles.barValue}>{item.value}</span>
                      </div>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{
                            width: `${(item.value / Math.max(...stats.leadSourceData.map((d) => d.value))) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Customer Insights */}
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Customer Insights</h2>
                <div className={styles.insightGrid}>
                  <div className={styles.insight}>
                    <span className={styles.insightValue}>{customerStats.totalCustomers}</span>
                    <span className={styles.insightLabel}>Total Customers</span>
                  </div>
                  <div className={styles.insight}>
                    <span className={styles.insightValue}>{customerStats.customersWithBookings}</span>
                    <span className={styles.insightLabel}>With Bookings</span>
                  </div>
                  <div className={styles.insight}>
                    <span className={styles.insightValue}>{customerStats.repeatCustomers}</span>
                    <span className={styles.insightLabel}>Repeat Customers</span>
                  </div>
                  <div className={styles.insight}>
                    <span className={styles.insightValue}>{customerStats.repeatRate}%</span>
                    <span className={styles.insightLabel}>Repeat Rate</span>
                  </div>
                </div>
              </section>

              {/* Top Customers by Revenue */}
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Top Customers by Revenue</h2>
                <div className={styles.rankList}>
                  {customerStats.topByRevenue.map((item, i) => (
                    <div key={item.name} className={styles.rankItem}>
                      <span className={styles.rankNum}>{i + 1}</span>
                      <span className={styles.rankName}>{item.name}</span>
                      <span className={styles.rankValue}>${item.revenue.toLocaleString()}</span>
                    </div>
                  ))}
                  {customerStats.topByRevenue.length === 0 && (
                    <p className={styles.emptyText}>No revenue data yet</p>
                  )}
                </div>
              </section>

              {/* Top Customers by Bookings */}
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Top Customers by Bookings</h2>
                <div className={styles.rankList}>
                  {customerStats.topByBookings.map((item, i) => (
                    <div key={item.name} className={styles.rankItem}>
                      <span className={styles.rankNum}>{i + 1}</span>
                      <span className={styles.rankName}>{item.name}</span>
                      <span className={styles.rankValue}>{item.bookings} bookings</span>
                    </div>
                  ))}
                  {customerStats.topByBookings.length === 0 && (
                    <p className={styles.emptyText}>No booking data yet</p>
                  )}
                </div>
              </section>
            </div>

            {/* Lost Revenue */}
            {stats.lostRevenue > 0 && (
              <section className={styles.lostCard}>
                <div className={styles.lostContent}>
                  <div>
                    <h2 className={styles.lostTitle}>Lost Opportunities</h2>
                    <p className={styles.lostDescription}>
                      {stats.lost} lost booking{stats.lost !== 1 ? 's' : ''} representing potential
                      revenue
                    </p>
                  </div>
                  <div className={styles.lostValue}>${stats.lostRevenue.toLocaleString()}</div>
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  )
}
