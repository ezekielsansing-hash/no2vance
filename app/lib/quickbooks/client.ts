import { getQuickBooksConfig } from './config'
import { getAccessToken } from './oauth'

export class QuickBooksError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
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

  const text = await response.text()
  if (!response.ok) {
    throw new QuickBooksError(
      `QuickBooks request failed (${response.status}) for ${path}`,
      response.status,
      text,
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
