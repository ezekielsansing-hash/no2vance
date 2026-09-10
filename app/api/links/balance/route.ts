import { NextResponse } from 'next/server'
import type { BookingContractFields } from '../../../lib/contract'
import { balanceDueDate, balanceOwed } from '../../../lib/links'
import { formatCurrency } from '../../../lib/money'
import {
  createBalanceInvoice,
  getInvoicePaymentLink,
} from '../../../lib/quickbooks/invoice'
import { getServiceSupabase } from '../../../lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * Raise the balance invoice for an existing contract link.
 *
 * Unlike the deposit invoice in ../route.ts, a failure here is fatal and
 * returns an error: there is no contract to deliver alongside it, so a
 * best-effort attempt would just be a button that silently did nothing.
 *
 * Signed-in only, via middleware — this is a staff action, not a renter one.
 */
export async function POST(request: Request) {
  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!body.token) {
    return NextResponse.json({ error: 'token is required.' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const { data: link, error: linkError } = await supabase
    .from('booking_links')
    .select('*')
    .eq('token', body.token)
    .maybeSingle()

  if (linkError || !link || link.voided_at) {
    return NextResponse.json(
      { error: 'That contract link no longer exists.' },
      { status: 404 },
    )
  }

  // Creating it twice would put two live invoices for the same money in front
  // of the renter, so a second press is a no-op rather than an error.
  if (link.qbo_balance_invoice_id) {
    return NextResponse.json({
      docNumber: (link.qbo_balance_doc_number as string) || undefined,
      alreadyExisted: true,
    })
  }

  const fields = link.booking_fields as BookingContractFields
  const amount = balanceOwed(fields)
  if (amount <= 0) {
    // Negative means the frozen rate didn't parse to a real number — most
    // often a rate left as free text like "TBD", which reads as zero. Saying
    // "the deposit covers it" there would send someone looking for a payment
    // that was never made.
    return NextResponse.json(
      {
        error:
          amount === 0
            ? 'This agreement has no balance left to invoice — the deposit covers the full rental rate.'
            : `The agreed rental rate (${fields.rentalRate || 'blank'}) is less than the deposit ` +
              `(${fields.depositAmount || 'blank'}), so there is no balance to invoice. Check the ` +
              `rate on the booking, then send a fresh contract link.`,
      },
      { status: 400 },
    )
  }

  const { data: row } = await supabase
    .from('events')
    .select('event_date, event_type, customer_name, customer_contact, customer_id')
    .eq('id', link.event_id)
    .maybeSingle()
  if (!row) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
  }

  const dueDate = balanceDueDate((row.event_date as string) || '')
  if (!dueDate) {
    return NextResponse.json(
      { error: 'The booking needs a valid event date before the balance can be dated.' },
      { status: 400 },
    )
  }

  let email: string | undefined
  const customerId = row.customer_id as string | null
  if (customerId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('email')
      .eq('id', customerId)
      .maybeSingle()
    email = (customer?.email as string) || undefined
  }

  let created
  try {
    created = await createBalanceInvoice({
      customerName: (row.customer_name as string) || '',
      customerEmail: email,
      customerPhone: (row.customer_contact as string) || undefined,
      balanceAmount: String(amount),
      eventType: (row.event_type as string) || '',
      // The date the renter agreed to, not the booking's current one.
      eventDate: fields.eventDates,
      dueDate,
    })
  } catch (err) {
    console.error('QuickBooks balance invoice failed:', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `The balance invoice failed: ${err.message}`
            : 'The balance invoice failed.',
      },
      { status: 502 },
    )
  }

  const paymentLink = await getInvoicePaymentLink(created.invoiceId)

  const { error: updateError } = await supabase
    .from('booking_links')
    .update({
      qbo_balance_invoice_id: created.invoiceId,
      qbo_balance_doc_number: created.docNumber,
      qbo_balance_payment_link: paymentLink ?? null,
      balance_amount: formatCurrency(amount),
      balance_due_on: dueDate,
    })
    .eq('token', link.token)

  if (updateError) {
    // The invoice is real and the renter can be sent to it; only our record of
    // it failed. Name the invoice number so it can be found in QuickBooks
    // rather than raised a second time.
    return NextResponse.json(
      {
        error:
          `Invoice #${created.docNumber} was created in QuickBooks, but recording it here failed: ` +
          `${updateError.message}. Don't create it again — it already exists.`,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    docNumber: created.docNumber,
    alreadyExisted: false,
  })
}
