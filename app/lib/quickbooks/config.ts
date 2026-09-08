export type QuickBooksEnvironment = 'sandbox' | 'production'

export type QuickBooksConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
  environment: QuickBooksEnvironment
  /** Where the Accounting API lives for this environment. */
  apiBase: string
}

/** Accounting scope. Online invoice payment rides on the invoice itself. */
export const QUICKBOOKS_SCOPE = 'com.intuit.quickbooks.accounting'

/**
 * Reads the QuickBooks environment variables, failing loudly if any is
 * missing. Server-only — none of these are NEXT_PUBLIC_, so calling this in a
 * client component throws rather than silently using undefined credentials.
 */
export function getQuickBooksConfig(): QuickBooksConfig {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI
  const environment = process.env.QUICKBOOKS_ENVIRONMENT

  const missing = [
    !clientId && 'QUICKBOOKS_CLIENT_ID',
    !clientSecret && 'QUICKBOOKS_CLIENT_SECRET',
    !redirectUri && 'QUICKBOOKS_REDIRECT_URI',
    !environment && 'QUICKBOOKS_ENVIRONMENT',
  ].filter(Boolean)
  if (missing.length > 0) {
    throw new Error(
      `QuickBooks is not configured. Missing: ${missing.join(', ')}. See SETUP.md.`,
    )
  }
  if (environment !== 'sandbox' && environment !== 'production') {
    throw new Error(
      `QUICKBOOKS_ENVIRONMENT must be "sandbox" or "production", got "${environment}".`,
    )
  }

  return {
    clientId: clientId as string,
    clientSecret: clientSecret as string,
    redirectUri: redirectUri as string,
    environment,
    // Sandbox and production are different hosts entirely, so a misconfigured
    // environment fails on a wrong host rather than writing test invoices into
    // the real books.
    apiBase:
      environment === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com',
  }
}

/** True when the env vars are present, for rendering the settings UI. */
export function isQuickBooksConfigured(): boolean {
  return quickBooksConfigError() === null
}

/**
 * Why QuickBooks isn't configured, or null when it is.
 *
 * Settings used to render a generic "add the environment variables" message
 * for every failure, which is the least useful thing to say to someone who
 * believes they already added them — a variable set on the wrong Vercel
 * environment, a typo'd name, and an invalid QUICKBOOKS_ENVIRONMENT value all
 * looked identical. getQuickBooksConfig already names the problem precisely;
 * this stops throwing that away.
 */
export function quickBooksConfigError(): string | null {
  try {
    getQuickBooksConfig()
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'QuickBooks is not configured.'
  }
}
