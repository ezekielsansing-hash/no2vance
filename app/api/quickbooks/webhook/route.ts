import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { getInvoiceBalance } from '../../../lib/quickbooks/invoice'
import { quickBooksRequest } from '../../../lib/quickbooks/client'
import { getServiceSupabase } from '../../../lib/supabase-server'

export const dynamic = 'force-dynamic'

type Entity = { name: string; id: string; operation: string }
type Notification = {
  realmId: string
  dataChangeEvent: { entities: Entity[] }
}

/**
 * Intuit signs each webhook with an HMAC of the raw body. An unsigned or
 * mis-signed request is rejected — otherwise anyone who found this URL could
 * mark bookings as paid.
 */
function verifySignature(rawBody: string, signature: string | null): boolean {
  const token = process.env.QUICKBOOKS_WEBHOOK_TOKEN
  if (!token || !signature) return false
  const expected = createHmac('sha256', token).update(rawBody).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  // Length check first: timingSafeEqual throws on a length mismatch.
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Invoice ids touched by a payment, so a Payment event maps back to bookings. */
async function invoiceIdsForPayment(paymentId: string): Promise<string[]> {
  try {
    const result = await quickBooksRequest<{
      Payment: { Line?: Array<{ LinkedTxn?: Array<{ TxnId: string; TxnType: string }> }> }
    }>(`payment/${encodeURIComponent(paymentId)}`)
    const ids = new Set<string>()
    for (const line of result.Payment.Line ?? []) {
      for (const txn of line.LinkedTxn ?? []) {
        if (txn.TxnType === 'Invoice') ids.add(txn.TxnId)
      }
    }
    return Array.from(ids)
  } catch (err) {
    console.error('Could not read payment', paymentId, err)
    return []
  }
}

/**
 * Record a payment against whichever of a link's two invoices it belongs to.
 *
 * A link carries the deposit invoice and, later, the balance invoice. They are
 * separate columns precisely so this can tell them apart: the deposit is what
 * confirms a booking, and a balance landing months afterwards must not
 * re-confirm it or restamp the deposit date.
 *
 * The amount outstanding is re-read from QuickBooks rather than trusted from
 * the webhook payload: the notification says something changed, not what the
 * total is, and a partial payment must not settle anything.
 */
async function settleInvoice(invoiceId: string): Promise<void> {
  const supabase = getServiceSupabase()

  const { data: depositLink } = await supabase
    .from('booking_links')
    .select('token, event_id, paid_at')
    .eq('qbo_invoice_id', invoiceId)
    .maybeSingle()
  if (depositLink) return settleDeposit(depositLink, invoiceId)

  const { data: balanceLink } = await supabase
    .from('booking_links')
    .select('token, balance_paid_at')
    .eq('qbo_balance_invoice_id', invoiceId)
    .maybeSingle()
  if (balanceLink) return settleBalance(balanceLink, invoiceId)
}

async function settleDeposit(
  link: { token: unknown; event_id: unknown; paid_at: unknown },
  invoiceId: string,
): Promise<void> {
  if (link.paid_at) return // already handled; webhooks can repeat

  const { balance } = await getInvoiceBalance(invoiceId)
  if (balance > 0) return

  const supabase = getServiceSupabase()
  const paidAt = new Date().toISOString()
  await supabase
    .from('booking_links')
    .update({ paid_at: paidAt })
    .eq('token', link.token)

  // Payment is what confirms a booking — not sending the invoice. Keeps the
  // revenue figures in Analytics meaning money that actually arrived.
  const { data: event } = await supabase
    .from('events')
    .select('status, converted_at, date_of_deposit')
    .eq('id', link.event_id)
    .maybeSingle()

  await supabase
    .from('events')
    .update({
      status: 'confirmed',
      converted_at: (event?.converted_at as string) || paidAt,
      date_of_deposit:
        (event?.date_of_deposit as string) || paidAt.slice(0, 10),
    })
    .eq('id', link.event_id)
}

/**
 * The balance landing changes no status: the booking was already confirmed
 * when the deposit arrived, and confirming it twice would move nothing except
 * the timestamps Analytics reads. All that's recorded is that it's paid.
 */
async function settleBalance(
  link: { token: unknown; balance_paid_at: unknown },
  invoiceId: string,
): Promise<void> {
  if (link.balance_paid_at) return

  const { balance } = await getInvoiceBalance(invoiceId)
  if (balance > 0) return

  await getServiceSupabase()
    .from('booking_links')
    .update({ balance_paid_at: new Date().toISOString() })
    .eq('token', link.token)
}

export async function POST(request: Request) {
  const rawBody = await request.text()

  if (!verifySignature(rawBody, request.headers.get('intuit-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: { eventNotifications?: Notification[] }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const invoiceIds = new Set<string>()
  for (const notification of payload.eventNotifications ?? []) {
    for (const entity of notification.dataChangeEvent?.entities ?? []) {
      if (entity.name === 'Invoice') {
        invoiceIds.add(entity.id)
      } else if (entity.name === 'Payment') {
        for (const id of await invoiceIdsForPayment(entity.id)) {
          invoiceIds.add(id)
        }
      }
    }
  }

  for (const id of invoiceIds) {
    try {
      await settleInvoice(id)
    } catch (err) {
      // One bad invoice shouldn't make Intuit retry the whole batch.
      console.error('Could not settle invoice', id, err)
    }
  }

  // Always 200 once the signature checks out, so Intuit stops retrying.
  return NextResponse.json({ received: true })
}
