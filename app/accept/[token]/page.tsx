import {
  renderContract,
  type BookingContractFields,
  type RenterContractFields,
} from '../../lib/contract'
import { renderContractHtml } from '../../lib/contract/markdown'
import { getServiceSupabase } from '../../lib/supabase-server'
import AcceptForm from './AcceptForm'
import styles from './accept.module.css'

export const dynamic = 'force-dynamic'

/**
 * While the agreement is being read, the renter's own blanks show as rules,
 * the way they do on the paper form. Their real answers are substituted in
 * when they accept, and that filled version is what gets stored.
 */
const BLANK: RenterContractFields = {
  renterName: '__________',
  renterAddress: '__________',
  renterCity: '__________',
  renterState: '____',
  renterZip: '______',
  renterPhone: '__________',
  renterCell: '__________',
  contactName: '__________',
  renterEmail: '__________',
  onSiteParty: '__________',
  onSiteCell: '__________',
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.sheet}>
        {children}
        {/* This page collects personal information, so the policy covering it
            should be reachable from the page itself. */}
        <p className={styles.footer}>
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
    .select('token, contract_version, booking_fields, deposit_amount, voided_at')
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

  const fields = link.booking_fields as BookingContractFields
  const version = link.contract_version as string

  // An accepted agreement shows the exact text that was agreed to, not a fresh
  // render — the stored copy is the record, and re-rendering could differ.
  const contractHtml = renderContractHtml(
    acceptance
      ? (acceptance.contract_text as string)
      : renderContract(fields, BLANK, version),
  )

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
          <div className={styles.payBox}>
            <p className={styles.payTitle}>
              Deposit due: {link.deposit_amount as string}
            </p>
            <p className={styles.payBody}>
              Your date is not reserved until the deposit is received. Payment
              details are in Section 3 below. If you have already paid, no
              action is needed.
            </p>
          </div>
          <article
            className={styles.contract}
            dangerouslySetInnerHTML={{ __html: contractHtml }}
          />
        </>
      ) : (
        <AcceptForm
          token={params.token}
          depositAmount={link.deposit_amount as string}
          contractHtml={contractHtml}
        />
      )}
    </Shell>
  )
}
