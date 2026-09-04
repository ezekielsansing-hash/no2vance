import { NextResponse } from 'next/server'
import { beginAuthorization } from '../../../lib/quickbooks/oauth'

export const dynamic = 'force-dynamic'

/**
 * Starts the QuickBooks handshake. Reachable only by a signed-in user — the
 * middleware protects everything except the customer acceptance routes.
 */
export async function GET() {
  try {
    return NextResponse.redirect(await beginAuthorization())
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start authorization'
    return NextResponse.redirect(
      new URL(
        `/settings?quickbooks_error=${encodeURIComponent(message)}`,
        process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
      ),
    )
  }
}
