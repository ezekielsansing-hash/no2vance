import { NextResponse } from 'next/server'
import { getServiceSupabase } from '../../../lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * Forgets the stored tokens. Intuit still lists the app as connected on their
 * side until the user removes it there, but this app stops being able to act
 * on the account, which is what "disconnect" needs to mean here.
 */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin
  const { error } = await getServiceSupabase()
    .from('quickbooks_connection')
    .delete()
    .eq('id', 'default')
  if (error) {
    console.error('QuickBooks disconnect failed:', error.message)
    return NextResponse.redirect(
      new URL('/settings?quickbooks_error=Could+not+disconnect', origin),
      303,
    )
  }
  return NextResponse.redirect(
    new URL('/settings?quickbooks=disconnected', origin),
    303,
  )
}
