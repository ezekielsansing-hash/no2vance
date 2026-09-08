import Link from 'next/link'
import { renderContractHtml } from '../../lib/contract/markdown'
import { getSessionSupabase } from '../../lib/supabase-server'
import PrintButton from './PrintButton'
import styles from './contract.module.css'

export const dynamic = 'force-dynamic'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.sheet}>{children}</div>
    </main>
  )
}

/**
 * Staff-only record of an accepted agreement.
 *
 * Everything here comes from the stored acceptance — `contract_text` is the
 * agreement exactly as it was rendered to the renter, so this page never
 * re-renders from the template. A template fix or a later booking edit must
 * not change what a signed contract says.
 */
export default async function ContractRecordPage({
  params,
}: {
  params: { token: string }
}) {
  const supabase = getSessionSupabase()

  const { data: acceptances } = await supabase
    .from('contract_acceptances')
    .select('accepted_at, contract_text, typed_name, ip, user_agent')
    .eq('token', params.token)
    .order('accepted_at', { ascending: false })
    .limit(1)
  const acceptance = (acceptances ?? [])[0]

  if (!acceptance) {
    return (
      <Shell>
        <p className={styles.brand}>No. 2 Vance</p>
        <h1 className={styles.title}>No signed contract yet</h1>
        <p className={styles.lede}>
          This link hasn&apos;t been accepted, so there is no signed agreement to
          show. The renter&apos;s copy — the version they see and accept — is at{' '}
          <Link href={`/accept/${params.token}`}>/accept/{params.token}</Link>.
        </p>
        <p className={styles.lede}>
          <Link className={styles.backLink} href="/">
            ← Back to bookings
          </Link>
        </p>
      </Shell>
    )
  }

  const acceptedAt = new Date(acceptance.accepted_at as string)

  // The IP and user agent are part of the evidence record, not decoration:
  // together with the timestamp they are what makes the acceptance defensible.
  const details: [string, string][] = [
    ['Accepted by', acceptance.typed_name as string],
    [
      'Date and time',
      acceptedAt.toLocaleString('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
      }),
    ],
    ['IP address', (acceptance.ip as string) || '—'],
    ['Browser', (acceptance.user_agent as string) || '—'],
  ]

  return (
    <Shell>
      <div className={styles.toolbar}>
        <Link className={styles.backLink} href="/">
          ← Back to bookings
        </Link>
        <PrintButton className={styles.printButton} />
      </div>

      <p className={styles.brand}>No. 2 Vance</p>
      <h1 className={styles.title}>Signed Facility Rental Agreement</h1>

      <section className={styles.signature}>
        <p className={styles.signatureTitle}>Acceptance record</p>
        <dl className={styles.signatureGrid}>
          {details.map(([label, value]) => (
            <div key={label}>
              <dt className={styles.signatureLabel}>{label}</dt>
              <dd className={styles.signatureValue}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <article
        className={styles.contract}
        dangerouslySetInnerHTML={{
          __html: renderContractHtml(acceptance.contract_text as string),
        }}
      />
    </Shell>
  )
}
