import { getQuickBooksConfig } from './config'
import { getAccessToken } from './oauth'

export class QuickBooksError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
    /**
     * Intuit's transaction id for the request, from the intuit_tid response
     * header. It's the handle their support team uses to find a specific
     * failed call in their own logs, so it belongs in every error we raise.
     */
    readonly tid: string | null = null,
  ) {
    super(message)
    this.name = 'QuickBooksError'
  }
}

/**
 * Authenticated request against the Accounting API.
 *
 * Always resolves the token through getAccessToken, which refreshes it when
 * it's close to expiring — so callers never deal with a 401 caused by ordinary
 * token age, only with a connection that genuinely needs re-authorizing.
 */
export async function quickBooksRequest<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { accessToken, realmId } = await getAccessToken()
  const { apiBase } = getQuickBooksConfig()

  const url = `${apiBase}/v3/company/${realmId}/${path}${
    path.includes('?') ? '&' : '?'
  }minorversion=75`

  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })

  const tid = response.headers.get('intuit_tid')
  const text = await response.text()
  if (!response.ok) {
    // The tid goes in the message as well as the field, so it survives into
    // logs that only capture error.message.
    throw new QuickBooksError(
      `QuickBooks request failed (${response.status}) for ${path}` +
        (tid ? ` [intuit_tid ${tid}]` : ''),
      response.status,
      text,
      tid,
    )
  }
  return JSON.parse(text) as T
}

/** Run a QuickBooks SQL-like query. Values must be escaped by the caller. */
export async function quickBooksQuery<T>(query: string): Promise<T> {
  return quickBooksRequest<T>(`query?query=${encodeURIComponent(query)}`)
}

/** QuickBooks query strings are single-quoted; the only escape is doubling. */
export function escapeQueryValue(value: string): string {
  return value.replace(/'/g, "''")
}
