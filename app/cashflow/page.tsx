'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import SiteHeader from '../components/SiteHeader'
import { EventRecord, loadEvents } from '../lib/events'
import { BookingLink, formatContractDate, loadAllLinks } from '../lib/links'
import {
  LOOKAHEAD_DAYS,
  MONTHLY_COSTS,
  PACE_BASELINE,
  PACE_TARGETS,
  PACE_YEAR,
  PANIC_TRIGGER,
  addDays,
  addMonths,
  bookedBy,
  buildCashItems,
  monthKey,
  monthLabel,
  monthlyBuckets,
  nextTarget,
  paceBookings,
  paceSeries,
  targetOn,
  todayVenueDate,
} from '../lib/cashflow'
import styles from './page.module.css'

/** Months shown before and after the current one on the cash chart. */
const MONTHS_BACK = 6
const MONTHS_AHEAD = 9

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
const moneyK = (n: number) => (Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : money(n))

/** Last day of a "YYYY-MM" month. */
function monthEnd(key: string): string {
  return addDays(`${addMonths(key, 1)}-01`, -1)
}

export default function CashFlowPage() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [links, setLinks] = useState<BookingLink[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([loadEvents(), loadAllLinks()]).then(([e, l]) => {
      setEvents(e)
      setLinks(l)
      setLoaded(true)
    })
  }, [])

  const today = useMemo(() => todayVenueDate(), [])
  const thisMonth = monthKey(today)

  const items = useMemo(() => buildCashItems(events, links, today), [events, links, today])

  const months = useMemo(
    () => monthlyBuckets(items, addMonths(thisMonth, -MONTHS_BACK), MONTHS_BACK + 1 + MONTHS_AHEAD),
    [items, thisMonth],
  )

  const metrics = useMemo(() => {
    const horizon = addDays(today, LOOKAHEAD_DAYS)
    const current = months.find((m) => m.key === thisMonth)
    const owed = items.filter((i) => i.state === 'scheduled' || i.state === 'overdue')
    return {
      collectedThisMonth: current ? current.received + current.estimated : 0,
      dueSoon: owed.filter((i) => i.date <= horizon).reduce((s, i) => s + i.amount, 0),
      overdue: owed.filter((i) => i.state === 'overdue').reduce((s, i) => s + i.amount, 0),
      overdueCount: owed.filter((i) => i.state === 'overdue').length,
    }
  }, [items, months, today, thisMonth])

  const comingDue = useMemo(() => {
    const horizon = addDays(today, LOOKAHEAD_DAYS)
    return items
      .filter((i) => (i.state === 'scheduled' || i.state === 'overdue') && i.date <= horizon)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [items, today])

  const recentPayments = useMemo(
    () =>
      items
        .filter((i) => i.state === 'received')
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 10),
    [items],
  )

  const pace = useMemo(() => {
    const bookings = paceBookings(events, links, PACE_YEAR)
    const series = paceSeries(bookings)
    const bookedNow = bookedBy(series, today)
    const target = nextTarget(today)
    const targetToday = targetOn(today) ?? 0

    // One point per month-end across the target window. Booked stops at today.
    const firstKey = `${PACE_YEAR - 1}-01`
    const lastKey = monthKey(PACE_TARGETS[PACE_TARGETS.length - 1].date)
    const chart: { label: string; booked: number | null; target: number | null }[] = []
    for (let key = firstKey; key <= lastKey; key = addMonths(key, 1)) {
      const end = monthEnd(key)
      chart.push({
        label: monthLabel(key),
        booked: key <= thisMonth ? bookedBy(series, end < today ? end : today) : null,
        // The line starts at the baseline, mid-month, rather than a month-end.
        target: key === monthKey(PACE_BASELINE.date) ? PACE_BASELINE.amount : targetOn(end),
      })
    }

    const checkpoints = PACE_TARGETS.map((t) => {
      const passed = t.date < today
      const booked = passed ? bookedBy(series, t.date) : bookedNow
      let status: 'met' | 'missed' | 'onPace' | 'behind'
      if (passed) status = booked >= t.amount ? 'met' : 'missed'
      else status = bookedNow >= targetToday ? 'onPace' : 'behind'
      return { ...t, booked, passed, status }
    })

    return {
      count: bookings.length,
      bookedNow,
      target,
      targetToday,
      chart,
      checkpoints,
      panic: bookedNow < PANIC_TRIGGER.amount,
    }
  }, [events, links, today, thisMonth])

  const hasEstimates = items.some((i) => i.state === 'estimated')

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <SiteHeader />

        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Cash Flow</h1>
          <p className={styles.pageNote}>
            Money by the day it arrives, not the day of the event.
          </p>
        </div>

        {!loaded ? (
          <div className={styles.emptyState}>Loading…</div>
        ) : (
          <>
            <section className={styles.metricsRow}>
              <div className={styles.metricCard} title="Deposits and balances that landed this month">
                <span className={styles.metricValue}>{money(metrics.collectedThisMonth)}</span>
                <span className={styles.metricLabel}>Collected this month</span>
              </div>
              <div className={styles.metricCard} title={`Monthly running costs, including Kim's base pay`}>
                <span className={styles.metricValue}>{money(MONTHLY_COSTS)}</span>
                <span className={styles.metricLabel}>Monthly costs</span>
              </div>
              <div className={styles.metricCard} title={`Balances and deposits due in the next ${LOOKAHEAD_DAYS} days`}>
                <span className={styles.metricValue}>{money(metrics.dueSoon)}</span>
                <span className={styles.metricLabel}>Due next {LOOKAHEAD_DAYS} days</span>
              </div>
              <div className={`${styles.metricCard} ${metrics.overdue > 0 ? styles.metricAlert : ''}`}>
                <span className={styles.metricValue}>{money(metrics.overdue)}</span>
                <span className={styles.metricLabel}>
                  Overdue{metrics.overdueCount > 0 ? ` (${metrics.overdueCount})` : ''}
                </span>
              </div>
              <div
                className={`${styles.metricCard} ${pace.bookedNow >= pace.targetToday ? styles.metricGood : styles.metricAlert}`}
                title={`Value of ${PACE_YEAR} events booked so far`}
              >
                <span className={styles.metricValue}>{money(pace.bookedNow)}</span>
                <span className={styles.metricLabel}>
                  {PACE_YEAR} booked · {money(pace.target.amount)} by {formatContractDate(pace.target.date)}
                </span>
              </div>
            </section>

            <section className={styles.chartCard}>
              <h2 className={styles.chartTitle}>Money in by month</h2>
              <div className={styles.chartTall}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={months} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#f7f1e3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={moneyK} width={52} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, border: '2px solid #17151a' }}
                      formatter={(value, name) => [money(Number(value)), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="received" stackId="in" fill="#00a8a8" name="Received" />
                    {hasEstimates && (
                      <Bar dataKey="estimated" stackId="in" fill="#d9f3f1" stroke="#00a8a8" name="Received (estimated)" />
                    )}
                    <Bar dataKey="scheduled" stackId="in" fill="#ffc921" name="Due" />
                    <Line
                      dataKey="costs"
                      stroke="#ff5a3c"
                      strokeDasharray="6 4"
                      strokeWidth={2}
                      dot={false}
                      name="Monthly costs"
                      type="stepAfter"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className={styles.chartNote}>
                Teal bars are money that came in; yellow is what renters still owe, in the month it&apos;s due.
                The dashed line is about {money(MONTHLY_COSTS)} a month to run the venue.
                {hasEstimates &&
                  ' Light teal is an estimate for older bookings made before contract links: deposit on the recorded deposit date, balance a week before the event.'}
              </p>
            </section>

            <section className={styles.chartCard}>
              <h2 className={styles.chartTitle}>
                {PACE_YEAR} booking pace · {pace.count} event{pace.count === 1 ? '' : 's'} booked
              </h2>
              <div className={styles.chartTall}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={pace.chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#f7f1e3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={1} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={moneyK} width={52} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, border: '2px solid #17151a' }}
                      formatter={(value, name) => [money(Number(value)), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line dataKey="target" stroke="#8e8794" strokeDasharray="5 4" dot={false} name="Target" connectNulls={false} />
                    <Line dataKey="booked" stroke="#17151a" strokeWidth={2.5} dot={false} name="Booked" connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Checkpoint</th>
                    <th className={styles.num}>Target</th>
                    <th className={styles.num}>Booked</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pace.checkpoints.map((c) => (
                    <tr key={c.date}>
                      <td>
                        {formatContractDate(c.date)}
                        {c.date === PANIC_TRIGGER.date && <span className={styles.subtle}> · fallback trigger at {money(PANIC_TRIGGER.amount)}</span>}
                      </td>
                      <td className={styles.num}>{money(c.amount)}</td>
                      <td className={styles.num}>{c.passed ? money(c.booked) : <span className={styles.subtle}>{money(c.booked)} so far</span>}</td>
                      <td>
                        <span className={`${styles.badge} ${styles[`badge_${c.status}`]}`}>
                          {{ met: 'Met', missed: 'Missed', onPace: 'On pace', behind: 'Behind pace' }[c.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={styles.chartNote}>
                Booked means the deposit is paid, counted at the full rental rate on the day it landed. The dashed line
                starts from the {money(PACE_BASELINE.amount)} booked when the 2027 plan set these proposed checkpoints, and today it sits at {money(pace.targetToday)}.
              </p>
            </section>

            <div className={styles.grid}>
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Coming due · next {LOOKAHEAD_DAYS} days</h2>
                {comingDue.length === 0 ? (
                  <p className={styles.emptyText}>Nothing due in the next {LOOKAHEAD_DAYS} days.</p>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Due</th>
                        <th>Renter</th>
                        <th className={styles.num}>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comingDue.map((i) => (
                        <tr key={`${i.eventId}-${i.kind}`}>
                          <td>{shortDate(i.date)}</td>
                          <td>
                            <Link href={`/bookings/${i.eventId}`} className={styles.rowLink}>
                              {i.customerName}
                            </Link>
                            <span className={styles.subtle}> · {i.eventType || 'Event'} {shortDate(i.eventDate)}</span>
                          </td>
                          <td className={styles.num}>{money(i.amount)}</td>
                          <td>
                            {i.state === 'overdue' ? (
                              <span className={`${styles.badge} ${styles.badge_missed}`}>Overdue</span>
                            ) : i.kind === 'balance' && i.viaLink && !i.invoiceRaised ? (
                              <span className={`${styles.badge} ${styles.badge_behind}`}>Raise invoice</span>
                            ) : i.kind === 'balance' && !i.viaLink ? (
                              <span className={`${styles.badge} ${styles.badge_neutral}`}>No link</span>
                            ) : (
                              <span className={`${styles.badge} ${styles.badge_onPace}`}>Invoiced</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Recent payments</h2>
                {recentPayments.length === 0 ? (
                  <p className={styles.emptyText}>
                    No payments recorded through QuickBooks yet. They appear here as soon as a renter pays a
                    deposit or balance invoice.
                  </p>
                ) : (
                  <table className={styles.table}>
                    <tbody>
                      {recentPayments.map((i) => (
                        <tr key={`${i.eventId}-${i.kind}`}>
                          <td>{shortDate(i.date)}</td>
                          <td>
                            <Link href={`/bookings/${i.eventId}`} className={styles.rowLink}>
                              {i.customerName}
                            </Link>
                            <span className={styles.subtle}> · {i.kind}</span>
                          </td>
                          <td className={styles.num}>{money(i.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

/** "2026-11-15" -> "Nov 15". */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[m - 1]} ${d}`
}
