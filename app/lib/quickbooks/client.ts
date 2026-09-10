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
    /** Intuit's own description of what was wrong, when they sent one. */
    readonly fault: string | null = null,
  ) {
    super(message)
    this.name = 'QuickBooksError'
  }
}

/**
 * Intuit's own description of a failure, pulled out of an error response body.
 *
 * Every validation failure is a 400, so the status says nothing about which
 * rule was broken — the Detail line is usually the entire answer ("Another
 * customer, vendor or employee is already using this name"). Dropping it left
 * the venue looking at an error that named no cause and suggested no fix.
 *
 * Returns null for a body that isn't a fault, so the caller keeps its own
 * wording rather than appending an empty colon.
 */
export function describeQuickBooksFault(body: string): string | null {
  const described = faultErrors(body)
    .map((error) => {
      const text = ['Message', 'Detail']
        .map((key) => (typeof error[key] === 'string' ? (error[key] as string).trim() : ''))
        .filter(Boolean)
        .join(' — ')
      const code = typeof error.code === 'string' ? error.code : ''
      if (!text) return code ? `QuickBooks error code ${code}` : ''
      return code ? `${text} (code ${code})` : text
    })
    .filter(Boolean)

  return described.length > 0 ? described.join('; ') : null
}

/**
 * The fault codes on an error body, for callers that need to branch on a
 * specific failure rather than just report it. Intuit answers every validation
 * problem with a 400, so the code is the only thing that distinguishes "this
 * name is taken" from "this field is too long".
 */
export function quickBooksFaultCodes(body: string): string[] {
  return faultErrors(body)
    .map((error) => (typeof error.code === 'string' ? error.code : ''))
    .filter(Boolean)
}

function faultErrors(body: string): Array<Record<string, unknown>> {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return []
  }
  const errors = (
    parsed as { Fault?: { Error?: Array<Record<string, unknown>> } } | null
  )?.Fault?.Error
  return Array.isArray(errors) ? errors : []
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
    // The fault and the tid both go in the message as well as in fields, so
    // they survive into logs — and alerts — that only capture error.message.
    const fault = describeQuickBooksFault(text)
    throw new QuickBooksError(
      `QuickBooks request failed (${response.status}) for ${path}` +
        (fault ? `: ${fault}` : '') +
        (tid ? ` [intuit_tid ${tid}]` : ''),
      response.status,
      text,
      tid,
      fault,
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
