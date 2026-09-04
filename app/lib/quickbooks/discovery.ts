import type { QuickBooksEnvironment } from './config'

/**
 * Intuit publishes its OAuth endpoints in a discovery document so they can
 * change without breaking integrations. We read it rather than hardcoding.
 *
 * The values below are only a fallback for when the document can't be fetched
 * — a network blip during discovery shouldn't take down authorization. They
 * match what the document returned when this was written; if Intuit moves an
 * endpoint, the live document wins.
 */
const FALLBACK: Endpoints = {
  authorizationEndpoint: 'https://appcenter.intuit.com/connect/oauth2',
  tokenEndpoint: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  revocationEndpoint: 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke',
}

export type Endpoints = {
  authorizationEndpoint: string
  tokenEndpoint: string
  revocationEndpoint: string
}

const DISCOVERY_URL: Record<QuickBooksEnvironment, string> = {
  sandbox:
    'https://developer.api.intuit.com/.well-known/openid_sandbox_configuration',
  production:
    'https://developer.api.intuit.com/.well-known/openid_configuration',
}

const CACHE_TTL_MS = 60 * 60 * 1000

const cache = new Map<
  QuickBooksEnvironment,
  { endpoints: Endpoints; fetchedAt: number }
>()

export async function getEndpoints(
  environment: QuickBooksEnvironment,
): Promise<Endpoints> {
  const cached = cache.get(environment)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.endpoints
  }

  try {
    const response = await fetch(DISCOVERY_URL[environment], {
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const doc = (await response.json()) as Record<string, string>

    const endpoints: Endpoints = {
      authorizationEndpoint:
        doc.authorization_endpoint || FALLBACK.authorizationEndpoint,
      tokenEndpoint: doc.token_endpoint || FALLBACK.tokenEndpoint,
      revocationEndpoint:
        doc.revocation_endpoint || FALLBACK.revocationEndpoint,
    }
    cache.set(environment, { endpoints, fetchedAt: Date.now() })
    return endpoints
  } catch (err) {
    console.error(
      `Could not read the Intuit discovery document for ${environment}; ` +
        'falling back to known endpoints.',
      err,
    )
    // Serve a stale cached copy over the fallback if we have one.
    return cached?.endpoints ?? FALLBACK
  }
}
