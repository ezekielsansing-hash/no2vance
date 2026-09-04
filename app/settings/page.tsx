import SiteHeader from '../components/SiteHeader'
import { SUPPORT_EMAIL } from '../lib/legal'
import { isQuickBooksConfigured } from '../lib/quickbooks/config'
import { getConnectionStatus } from '../lib/quickbooks/oauth'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' })
}

function daysUntil(value: string): number {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { quickbooks?: string; quickbooks_error?: string }
}) {
  const configured = isQuickBooksConfigured()
  const status = configured
    ? await getConnectionStatus()
    : ({ state: 'disconnected' } as const)

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <h1 className={styles.title}>Settings</h1>

        {searchParams.quickbooks === 'connected' && (
          <p className={`${styles.banner} ${styles.bannerGood}`}>
            QuickBooks connected.
          </p>
        )}
        {searchParams.quickbooks === 'disconnected' && (
          <p className={styles.banner}>QuickBooks disconnected.</p>
        )}
        {searchParams.quickbooks_error && (
          <p className={`${styles.banner} ${styles.bannerBad}`}>
            {searchParams.quickbooks_error}
          </p>
        )}

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>QuickBooks</h2>

          {!configured ? (
            <p className={styles.body}>
              Not configured. Add the QuickBooks environment variables described
              in <code>.env.example</code>, then restart the app.
            </p>
          ) : status.state === 'disconnected' ? (
            <>
              <p className={styles.body}>
                Not connected. Connecting lets the app create deposit invoices
                and record payments against bookings.
              </p>
              <a className={styles.button} href="/api/quickbooks/connect">
                Connect QuickBooks
              </a>
            </>
          ) : (
            <>
              <dl className={styles.details}>
                <div>
                  <dt className={styles.label}>Status</dt>
                  <dd className={styles.value}>
                    {status.state === 'connected'
                      ? 'Connected'
                      : status.state === 'expiring'
                      ? `Expires in ${daysUntil(status.refreshExpiresAt)} days — reconnect soon`
                      : 'Expired — reconnect to keep invoicing'}
                  </dd>
                </div>
                <div>
                  <dt className={styles.label}>Environment</dt>
                  <dd className={styles.value}>{status.environment}</dd>
                </div>
                <div>
                  <dt className={styles.label}>Company (realm)</dt>
                  <dd className={styles.value}>{status.realmId}</dd>
                </div>
                <div>
                  <dt className={styles.label}>Connected</dt>
                  <dd className={styles.value}>{formatDate(status.connectedAt)}</dd>
                </div>
              </dl>

              {status.state !== 'connected' && (
                <p className={styles.warning}>
                  QuickBooks requires re-authorizing periodically. Until you
                  reconnect, invoices cannot be created.
                </p>
              )}

              <div className={styles.actions}>
                <a className={styles.button} href="/api/quickbooks/connect">
                  {status.state === 'connected' ? 'Reconnect' : 'Reconnect now'}
                </a>
                <form action="/api/quickbooks/disconnect" method="post">
                  <button type="submit" className={styles.buttonGhost}>
                    Disconnect
                  </button>
                </form>
              </div>
            </>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Support</h2>
          <p className={styles.body}>
            Something not working, or a question about a booking or contract?
            Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
          <p className={styles.body}>
            <a href="/terms">Terms of Use</a> · <a href="/privacy">Privacy Policy</a>
          </p>
        </section>
      </main>
    </div>
  )
}
