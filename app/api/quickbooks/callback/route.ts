import { NextResponse } from 'next/server'
import {
  consumeState,
  exchangeCodeForTokens,
} from '../../../lib/quickbooks/oauth'

export const dynamic = 'force-dynamic'

/**
 * Where Intuit sends the browser after the user approves. This runs in the
 * user's own session, so the middleware's sign-in requirement still applies.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const settings = (query: string) => NextResponse.redirect(new URL(`/settings?${query}`, url.origin))

  const error = url.searchParams.get('error')
  if (error) {
    // The user clicked Cancel, or Intuit refused. Not an app failure.
    return settings(`quickbooks_error=${encodeURIComponent(error)}`)
  }

  const code = url.searchParams.get('code')
  const realmId = url.searchParams.get('realmId')
  const state = url.searchParams.get('state')

  if (!code || !realmId || !state) {
    return settings('quickbooks_error=Incomplete+response+from+QuickBooks')
  }

  // Proves this callback belongs to a handshake we started, and that the state
  // hasn't already been spent.
  if (!(await consumeState(state))) {
    return settings('quickbooks_error=Authorization+expired.+Please+try+again')
  }

  try {
    await exchangeCodeForTokens(code, realmId)
  } catch (err) {
    console.error('QuickBooks token exchange failed:', err)
    return settings('quickbooks_error=Could+not+complete+the+connection')
  }

  return settings('quickbooks=connected')
}
