import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let admin: SupabaseClient | undefined

/**
 * Server-only Supabase client using the service role key, which bypasses RLS.
 *
 * This exists for exactly one reason: the contract acceptance page is opened by
 * customers who are not signed in, and every RLS policy in this app grants
 * access only to `authenticated`. Rather than loosening those policies to let
 * anonymous visitors read bookings, the public page reads through the server
 * with this client and returns only the one booking the token names.
 *
 * Never import this from a client component. The key is not prefixed
 * NEXT_PUBLIC_, so it is simply absent in the browser and this throws.
 */
export function getServiceSupabase(): SupabaseClient {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must be set for ' +
          'the contract acceptance pages. See SETUP.md.',
      )
    }
    admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        // Next.js patches global fetch and caches GET responses. supabase-js
        // goes through fetch, so without this the acceptance lookup keeps
        // returning the empty result from the first page view — a customer
        // accepts, the page reloads, and still shows the form as if nothing
        // happened. Every query here must hit the database.
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: 'no-store' }),
      },
    })
  }
  return admin
}
