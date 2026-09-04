import { NextResponse } from 'next/server'
import {
  renderContract,
  type BookingContractFields,
  type RenterContractFields,
} from '../../../lib/contract'
import { getServiceSupabase } from '../../../lib/supabase-server'

export const dynamic = 'force-dynamic'

/** Fields the renter must supply. Section 2 leaves a blank for each. */
const REQUIRED: Array<{ key: keyof RenterContractFields; label: string }> = [
  { key: 'renterName', label: 'Name' },
  { key: 'renterAddress', label: 'Address' },
  { key: 'renterCity', label: 'City' },
  { key: 'renterState', label: 'State' },
  { key: 'renterZip', label: 'Zip' },
  { key: 'renterCell', label: 'Cell phone' },
  { key: 'renterEmail', label: 'E-mail' },
]

const OPTIONAL: Array<keyof RenterContractFields> = [
  'renterPhone',
  'contactName',
  'onSiteParty',
  'onSiteCell',
]

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? ''
}

export async function POST(
  request: Request,
  { params }: { params: { token: string } },
) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (body.agreed !== true) {
    return NextResponse.json(
      { error: 'You must confirm that you have read the agreement.' },
      { status: 400 },
    )
  }

  const renter = {} as RenterContractFields
  const missing: string[] = []
  for (const { key, label } of REQUIRED) {
    const value = typeof body[key] === 'string' ? (body[key] as string).trim() : ''
    if (!value) missing.push(label)
    renter[key] = value
  }
  for (const key of OPTIONAL) {
    renter[key] = typeof body[key] === 'string' ? (body[key] as string).trim() : ''
  }
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Please fill in: ${missing.join(', ')}` },
      { status: 400 },
    )
  }

  const supabase = getServiceSupabase()

  const { data: linkRow, error: linkError } = await supabase
    .from('booking_links')
    .select('token, contract_version, booking_fields, voided_at')
    .eq('token', params.token)
    .maybeSingle()

  if (linkError) {
    console.error('Acceptance lookup failed:', linkError.message)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
  if (!linkRow || linkRow.voided_at) {
    return NextResponse.json(
      { error: 'This link is no longer valid. Please contact No. 2 Vance.' },
      { status: 404 },
    )
  }

  // Accepting twice shouldn't create a second record — the first acceptance is
  // the one that happened, and a double-submit must not overwrite its
  // timestamp or its text.
  const { data: existing } = await supabase
    .from('contract_acceptances')
    .select('accepted_at')
    .eq('token', params.token)
    .limit(1)
  if (existing && existing.length > 0) {
    return NextResponse.json({
      alreadyAccepted: true,
      acceptedAt: existing[0].accepted_at,
    })
  }

  let contractText: string
  try {
    contractText = renderContract(
      linkRow.booking_fields as BookingContractFields,
      renter,
      linkRow.contract_version as string,
    )
  } catch (err) {
    console.error('Contract render failed:', err)
    return NextResponse.json(
      { error: 'This agreement could not be prepared. Please contact us.' },
      { status: 500 },
    )
  }

  const acceptedAt = new Date().toISOString()
  const { error: insertError } = await supabase
    .from('contract_acceptances')
    .insert({
      token: params.token,
      accepted_at: acceptedAt,
      ip: clientIp(request),
      user_agent: request.headers.get('user-agent') ?? '',
      typed_name: renter.renterName,
      renter_fields: renter,
      // Stored in full rather than as a template reference: this is the text
      // they actually agreed to, and it has to survive later template edits.
      contract_text: contractText,
    })

  if (insertError) {
    console.error('Acceptance insert failed:', insertError.message)
    return NextResponse.json(
      { error: 'We could not record your acceptance. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ acceptedAt })
}
