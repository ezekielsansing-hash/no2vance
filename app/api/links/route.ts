import { NextResponse } from 'next/server'
import { CONTRACT_VERSION } from '../../lib/contract'
import { bookingContractFields, generateToken } from '../../lib/links'
import { formatCurrency } from '../../lib/money'
import { createDepositInvoice, getInvoicePaymentLink } from '../../lib/quickbooks/invoice'
import { getServiceSupabase } from '../../lib/supabase-server'
import type { EventRecord } from '../../lib/events'

export const dynamic = 'force-dynamic'

/**
 * Creates a contract link for a booking, and a QuickBooks deposit invoice to
 * go with it.
 *
 * This moved server-side because invoicing needs the Intuit client secret. The
 * invoice is best-effort on purpose: if QuickBooks isn't connected, or Intuit
 * is down, the link is still created and the acceptance page still works. The
 * contract is the part that must not be blocked by a payment integration.
 */
export async function POST(request: Request) {
  let body: { eventId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!body.eventId) {
    return NextResponse.json({ error: 'eventId is required.' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const { data: row, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', body.eventId)
    .maybeSingle()

  if (eventError || !row) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
  }

  // Reuse the same mapping the rest of the app uses, so the invoice and the
  // contract can't disagree about the amount.
  const event = {
    id: row.id as string,
    eventType: (row.event_type as string) || '',
    eventDate: (row.event_date as string) || '',
    customerName: (row.customer_name as string) || '',
    customerContact: (row.customer_contact as string) || '',
    ratePackage: (row.rate_package as string) || '',
    depositAmount: (row.deposit_amount as string) || '',
    estimatedGuestCount: (row.estimated_guest_count as string) || '',
    eventTimeStart: (row.event_time_start as string) || '',
    eventTimeEnd: (row.event_time_end as string) || '',
    accessTime: (row.access_time as string) || '',
    exitTime: (row.exit_time as string) || '',
    additionalItems: (row.additional_items as string) || '',
    photographyOptOut: Boolean(row.photography_opt_out),
    requirements: (row.requirements as Record<string, unknown>) ?? {},
  } as unknown as EventRecord

  const fields = bookingContractFields(event)

  let invoice: {
    qbo_invoice_id?: string
    qbo_doc_number?: string
    qbo_payment_link?: string
  } = {}
  let invoiceWarning: string | undefined

  try {
    const customerId = row.customer_id as string | null
    let email: string | undefined
    if (customerId) {
      const { data: customer } = await supabase
        .from('customers')
        .select('email')
        .eq('id', customerId)
        .maybeSingle()
      email = (customer?.email as string) || undefined
    }

    const created = await createDepositInvoice({
      customerName: event.customerName,
      customerEmail: email,
      customerPhone: event.customerContact,
      depositAmount: event.depositAmount,
      eventType: event.eventType,
      eventDate: fields.eventDates,
    })
    invoice = {
      qbo_invoice_id: created.invoiceId,
      qbo_doc_number: created.docNumber,
      qbo_payment_link:
        (await getInvoicePaymentLink(created.invoiceId)) ?? undefined,
    }
  } catch (err) {
    // Not fatal — the link and the contract still work without an invoice.
    console.error('QuickBooks invoice creation failed:', err)
    invoiceWarning =
      err instanceof Error
        ? `Link created, but the QuickBooks invoice failed: ${err.message}`
        : 'Link created, but the QuickBooks invoice failed.'
  }

  const token = generateToken()
  const { error: insertError } = await supabase.from('booking_links').insert({
    token,
    event_id: event.id,
    contract_version: CONTRACT_VERSION,
    booking_fields: fields,
    deposit_amount: formatCurrency(event.depositAmount),
    ...invoice,
  })
  if (insertError) {
    return NextResponse.json(
      { error: `Could not create the link: ${insertError.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ token, warning: invoiceWarning })
}
