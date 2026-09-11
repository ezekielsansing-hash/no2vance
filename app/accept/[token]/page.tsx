import { type BookingContractFields } from '../../lib/contract'
import { SUPPORT_EMAIL } from '../../lib/legal'
import { renderContractHtml } from '../../lib/contract/markdown'
import { getServiceSupabase } from '../../lib/supabase-server'
import AcceptForm from './AcceptForm'
import styles from './accept.module.css'

export const dynamic = 'force-dynamic'

/**
 * "2027-05-22" -> "May 22, 2027". Hand-parsed: a plain date string read by
 * `new Date` is midnight UTC, which renders as the day before in Memphis —
 * and this one is a deadline, so being a day early is the wrong direction.
 */
function formatDueDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return value
  const [, year, month, day] = match
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const name = months[parseInt(month, 10) - 1]
  if (!name) return value
  return `${name} ${parseInt(day, 10)}, ${year}`
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.sheet}>
        {children}
        {/* This page collects personal information, so the policy covering it
            should be reachable from the page itself. */}
        <p className={styles.footer}>
          Questions about your booking or this agreement? Email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          <br />
          <a href="/privacy">Privacy Policy</a>
          {' · '}
          <a href="/terms">Terms of Use</a>
        </p>
      </div>
    </main>
  )
}

export default async function AcceptPage({
  params,
}: {
  params: { token: string }
}) {
  const supabase = getServiceSupabase()

  const { data: link } = await supabase
    .from('booking_links')
    // eslint-disable-next-line max-len -- supabase-js infers the row type from this literal; splitting it loses every field's type
    .select('token, contract_version, booking_fields, deposit_amount, voided_at, qbo_payment_link, paid_at, qbo_balance_payment_link, balance_amount, balance_due_on, balance_paid_at')
    .eq('token', params.token)
    .maybeSingle()

  if (!link || link.voided_at) {
    return (
      <Shell>
        <h1 className={styles.title}>Link not found</h1>
        <p className={styles.lede}>
          This agreement link is no longer valid. It may have been replaced by a
          newer one. Please contact No. 2 Vance and we&apos;ll send you a fresh
          link.
        </p>
      </Shell>
    )
  }

  const { data: acceptances } = await supabase
    .from('contract_acceptances')
    .select('accepted_at, contract_text, typed_name')
    .eq('token', params.token)
    .order('accepted_at', { ascending: false })
    .limit(1)
  const acceptance = (acceptances ?? [])[0]

  // What is actually outstanding. Both invoices can be open at the same time,
  // so these are three independent facts rather than one sequence.
  const depositPaid = !!link.paid_at
  const balancePaid = !!link.balance_paid_at
  const balanceLink = link.qbo_balance_payment_link as string | null
  const balanceOpen = !!balanceLink && !balancePaid

  const fields = link.booking_fields as BookingContractFields
  const version = link.contract_version as string

  const summary = [
    ['Event', fields.eventType],
    ['Date', fields.eventDates],
    ['Rental rate', fields.rentalRate],
    ['Deposit due', fields.depositAmount],
  ].filter(([, value]) => value)

  return (
    <Shell>
      <p className={styles.brand}>No. 2 Vance</p>
      <h1 className={styles.title}>Facility Rental Agreement</h1>

      <dl className={styles.summary}>
        {summary.map(([label, value]) => (
          <div key={label} className={styles.summaryItem}>
            <dt className={styles.summaryLabel}>{label}</dt>
            <dd className={styles.summaryValue}>{value}</dd>
          </div>
        ))}
      </dl>

      {acceptance ? (
        <>
          <div className={styles.acceptedBanner}>
            <p className={styles.acceptedTitle}>Agreement accepted</p>
            <p className={styles.acceptedMeta}>
              Accepted by {acceptance.typed_name as string} on{' '}
              {new Date(acceptance.accepted_at as string).toLocaleString(
                'en-US',
                { dateStyle: 'long', timeStyle: 'short' },
              )}
            </p>
          </div>
          {depositPaid && balancePaid ? (
            <div className={styles.paidBox}>
              <p className={styles.paidTitle}>Paid in full — thank you</p>
              <p className={styles.payBody}>
                Your deposit and balance are both received. Nothing further is
                owed for the rental itself.
              </p>
            </div>
          ) : depositPaid && balanceOpen ? (
            /* The balance invoice has gone out. The renter already has this
               link, so it becomes the place to pay rather than a new one. */
            <div className={styles.payBox}>
              <p className={styles.payTitle}>
                Balance due: {link.balance_amount as string}
              </p>
              <p className={styles.payBody}>
                Your deposit is received and your date is reserved. The
                remaining balance is{' '}
                {link.balance_due_on
                  ? `due by ${formatDueDate(link.balance_due_on as string)}.`
                  : 'due seven days before your event.'}
              </p>
              <a className={styles.payButton} href={balanceLink as string}>
                Pay balance
              </a>
            </div>
          ) : depositPaid ? (
            <div className={styles.paidBox}>
              <p className={styles.paidTitle}>Deposit received — your date is reserved</p>
              <p className={styles.payBody}>
                Paid{' '}
                {`${new Date(link.paid_at as string).toLocaleDateString('en-US', {
                  dateStyle: 'long',
                })}.`}{' '}
                Nothing further is needed right now; the balance is due seven
                days before your event.
              </p>
            </div>
          ) : (
            <div className={styles.payBox}>
              <p className={styles.payTitle}>
                {balanceOpen
                  ? `Due now: ${link.deposit_amount as string} deposit`
                  : `Deposit due: ${link.deposit_amount as string}`}
              </p>
              <p className={styles.payBody}>
                Your date is not reserved until the deposit is received.
              </p>
              {/* Both invoices open at once is a real case, not just a
                  mistake: a booking taken inside seven days of the event is
                  payable in full at signing. Intuit's payment page lists every
                  open invoice for the customer, so saying only "pay deposit"
                  here promises less than the button actually delivers. */}
              {balanceOpen && (
                <p className={styles.payBody}>
                  Your remaining balance of {link.balance_amount as string} is
                  also on the payment page,{' '}
                  {link.balance_due_on
                    ? `due by ${formatDueDate(link.balance_due_on as string)}.`
                    : 'due seven days before your event.'}{' '}
                  You can pay both together or just the deposit for now.
                </p>
              )}
              {link.qbo_payment_link ? (
                <a
                  className={styles.payButton}
                  href={link.qbo_payment_link as string}
                >
                  {balanceOpen ? 'Pay now' : 'Pay deposit'}
                </a>
              ) : (
                <p className={styles.payBody}>
                  Payment methods are listed in Section 3 below. If you have
                  already paid, no action is needed.
                </p>
              )}
            </div>
          )}
          {/* An accepted agreement shows the exact text that was agreed to,
              not a fresh render — the stored copy is the record, and
              re-rendering it could differ. */}
          <article
            className={styles.contract}
            dangerouslySetInnerHTML={{
              __html: renderContractHtml(acceptance.contract_text as string),
            }}
          />
        </>
      ) : (
        <AcceptForm
          token={params.token}
          depositAmount={link.deposit_amount as string}
          bookingFields={fields}
          contractVersion={version}
        />
      )}
    </Shell>
  )
}
