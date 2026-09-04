import { getServiceSupabase } from '../supabase-server'
import {
  INTUIT_AUTH_URL,
  INTUIT_TOKEN_URL,
  QUICKBOOKS_SCOPE,
  getQuickBooksConfig,
} from './config'

export type QuickBooksConnection = {
  realmId: string
  accessToken: string
  refreshToken: string
  accessExpiresAt: string
  refreshExpiresAt: string
  environment: string
  connectedAt: string
}

/** Refresh this far ahead of expiry so a slow request can't race the deadline. */
const ACCESS_REFRESH_MARGIN_MS = 5 * 60 * 1000

/** Warn this far ahead of the refresh token lapsing, so it can be re-authorized. */
const REFRESH_WARN_MARGIN_MS = 14 * 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Authorization handshake
// ---------------------------------------------------------------------------

/**
 * Build the Intuit consent URL and record its CSRF state.
 *
 * The state is stored server-side rather than in a cookie so the callback can
 * prove the request came from a handshake we started, and can only be spent
 * once.
 */
export async function beginAuthorization(): Promise<string> {
  const config = getQuickBooksConfig()
  const state = crypto.randomUUID()

  const { error } = await getServiceSupabase()
    .from('quickbooks_oauth_state')
    .insert({ state })
  if (error) throw new Error(`Could not start authorization: ${error.message}`)

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    scope: QUICKBOOKS_SCOPE,
    redirect_uri: config.redirectUri,
    state,
  })
  return `${INTUIT_AUTH_URL}?${params.toString()}`
}

/** Spend a state value. Returns false if it's unknown, already used, or stale. */
export async function consumeState(state: string): Promise<boolean> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('quickbooks_oauth_state')
    .select('state, created_at')
    .eq('state', state)
    .maybeSingle()
  if (error || !data) return false

  await supabase.from('quickbooks_oauth_state').delete().eq('state', state)

  const age = Date.now() - new Date(data.created_at as string).getTime()
  return age < 60 * 60 * 1000
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  x_refresh_token_expires_in: number
}

async function requestTokens(body: URLSearchParams): Promise<TokenResponse> {
  const config = getQuickBooksConfig()
  const basic = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString('base64')

  const response = await fetch(INTUIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
    cache: 'no-store',
  })

  const text = await response.text()
  if (!response.ok) {
    // Intuit's error bodies can carry the request context; the tokens
    // themselves are never in an error response, so this is safe to log.
    throw new Error(`Intuit token request failed (${response.status}): ${text}`)
  }
  return JSON.parse(text) as TokenResponse
}

function toRow(realmId: string, tokens: TokenResponse) {
  const now = Date.now()
  return {
    id: 'default',
    realm_id: realmId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    access_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
    refresh_expires_at: new Date(
      now + tokens.x_refresh_token_expires_in * 1000,
    ).toISOString(),
    environment: getQuickBooksConfig().environment,
    updated_at: new Date().toISOString(),
  }
}

/** Exchange the authorization code for tokens and store the connection. */
export async function exchangeCodeForTokens(
  code: string,
  realmId: string,
): Promise<void> {
  const config = getQuickBooksConfig()
  const tokens = await requestTokens(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }),
  )
  const { error } = await getServiceSupabase()
    .from('quickbooks_connection')
    .upsert({ ...toRow(realmId, tokens), connected_at: new Date().toISOString() })
  if (error) throw new Error(`Could not save the connection: ${error.message}`)
}

export async function loadConnection(): Promise<QuickBooksConnection | null> {
  const { data, error } = await getServiceSupabase()
    .from('quickbooks_connection')
    .select('*')
    .eq('id', 'default')
    .maybeSingle()
  if (error || !data) return null
  return {
    realmId: data.realm_id as string,
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    accessExpiresAt: data.access_expires_at as string,
    refreshExpiresAt: data.refresh_expires_at as string,
    environment: data.environment as string,
    connectedAt: data.connected_at as string,
  }
}

/**
 * A usable access token, refreshing first if it's close to expiring.
 *
 * Throws with a plain-language message when the connection is missing or the
 * refresh token has lapsed — those need a human to reconnect, and the failure
 * should say so rather than surfacing as a 401 from an invoice call.
 */
export async function getAccessToken(): Promise<{
  accessToken: string
  realmId: string
}> {
  const connection = await loadConnection()
  if (!connection) {
    throw new Error('QuickBooks is not connected. Connect it in Settings.')
  }

  const config = getQuickBooksConfig()
  if (connection.environment !== config.environment) {
    throw new Error(
      `QuickBooks was connected in "${connection.environment}" but the app is ` +
        `configured for "${config.environment}". Reconnect before continuing.`,
    )
  }

  if (new Date(connection.refreshExpiresAt).getTime() <= Date.now()) {
    throw new Error(
      'The QuickBooks connection has expired. Reconnect it in Settings.',
    )
  }

  const accessExpiry = new Date(connection.accessExpiresAt).getTime()
  if (accessExpiry - ACCESS_REFRESH_MARGIN_MS > Date.now()) {
    return { accessToken: connection.accessToken, realmId: connection.realmId }
  }

  const tokens = await requestTokens(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
    }),
  )
  const { error } = await getServiceSupabase()
    .from('quickbooks_connection')
    .update(toRow(connection.realmId, tokens))
    .eq('id', 'default')
  if (error) throw new Error(`Could not refresh the connection: ${error.message}`)

  return { accessToken: tokens.access_token, realmId: connection.realmId }
}

/** Connection health for the settings screen. */
export type ConnectionStatus =
  | { state: 'disconnected' }
  | {
      state: 'connected' | 'expiring' | 'expired'
      realmId: string
      environment: string
      connectedAt: string
      refreshExpiresAt: string
    }

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const connection = await loadConnection()
  if (!connection) return { state: 'disconnected' }

  const remaining =
    new Date(connection.refreshExpiresAt).getTime() - Date.now()
  const state =
    remaining <= 0
      ? 'expired'
      : remaining < REFRESH_WARN_MARGIN_MS
      ? 'expiring'
      : 'connected'

  return {
    state,
    realmId: connection.realmId,
    environment: connection.environment,
    connectedAt: connection.connectedAt,
    refreshExpiresAt: connection.refreshExpiresAt,
  }
}
