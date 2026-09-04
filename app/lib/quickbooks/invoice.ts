import { parseAmount } from '../money'
import {
  escapeQueryValue,
  quickBooksQuery,
  quickBooksRequest,
} from './client'

type QboRef = { value: string; name?: string }

type QboCustomer = {
  Id: string
  DisplayName: string
  PrimaryEmailAddr?: { Address: string }
}

type QboInvoice = {
  Id: string
  DocNumber?: string
  Balance: number
  TotalAmt: number
  InvoiceLink?: string
}

/**
 * Find a customer by display name, or create one.
 *
 * Matching on display name rather than email because most of the venue's
 * customers have no email on file — the booking record has always carried a
 * phone number and often nothing else.
 */
export async function findOrCreateCustomer(params: {
  name: string
  email?: string
  phone?: string
}): Promise<QboCustomer> {
  const name = params.name.trim()
  if (!name) throw new Error('A customer name is required to invoice.')

  const found = await quickBooksQuery<{
    QueryResponse: { Customer?: QboCustomer[] }
  }>(`select * from Customer where DisplayName = '${escapeQueryValue(name)}'`)

  const existing = found.QueryResponse.Customer?.[0]
  if (existing) return existing

  const created = await quickBooksRequest<{ Customer: QboCustomer }>(
    'customer',
    {
      method: 'POST',
      body: {
        DisplayName: name,
        ...(params.email
          ? { PrimaryEmailAddr: { Address: params.email } }
          : {}),
        ...(params.phone
          ? { PrimaryPhone: { FreeFormNumber: params.phone } }
          : {}),
      },
    },
  )
  return created.Customer
}

/** The income account new line items are booked against. */
async function findIncomeAccountRef(): Promise<QboRef> {
  const result = await quickBooksQuery<{
    QueryResponse: { Account?: Array<{ Id: string; Name: string }> }
  }>(
    "select * from Account where AccountType = 'Income' and Active = true maxresults 1",
  )
  const account = result.QueryResponse.Account?.[0]
  if (!account) {
    throw new Error(
      'No active income account found in QuickBooks. Add one before invoicing.',
    )
  }
  return { value: account.Id, name: account.Name }
}

/**
 * The service item deposits are billed as. Created once and reused, so the
 * venue's books show a single "Facility Rental Deposit" line rather than a new
 * item per booking.
 */
const DEPOSIT_ITEM_NAME = 'Facility Rental Deposit'

export async function findOrCreateDepositItem(): Promise<QboRef> {
  const found = await quickBooksQuery<{
    QueryResponse: { Item?: Array<{ Id: string; Name: string }> }
  }>(
    `select * from Item where Name = '${escapeQueryValue(DEPOSIT_ITEM_NAME)}'`,
  )
  const existing = found.QueryResponse.Item?.[0]
  if (existing) return { value: existing.Id, name: existing.Name }

  const created = await quickBooksRequest<{
    Item: { Id: string; Name: string }
  }>('item', {
    method: 'POST',
    body: {
      Name: DEPOSIT_ITEM_NAME,
      Type: 'Service',
      IncomeAccountRef: await findIncomeAccountRef(),
    },
  })
  return { value: created.Item.Id, name: created.Item.Name }
}

export type DepositInvoice = {
  invoiceId: string
  docNumber: string
  total: number
  balance: number
}

/**
 * Create the deposit invoice for a booking.
 *
 * Online card and bank payment are both enabled — ACH costs roughly a third
 * of what a card does on a deposit this size, so both are offered rather than
 * cards alone.
 */
export async function createDepositInvoice(params: {
  customerName: string
  customerEmail?: string
  customerPhone?: string
  depositAmount: string
  eventType: string
  eventDate: string
}): Promise<DepositInvoice> {
  const amount = parseAmount(params.depositAmount)
  if (amount <= 0) {
    throw new Error('The deposit amount must be greater than zero to invoice.')
  }

  const customer = await findOrCreateCustomer({
    name: params.customerName,
    email: params.customerEmail,
    phone: params.customerPhone,
  })
  const itemRef = await findOrCreateDepositItem()

  const description = [
    'Deposit to reserve',
    params.eventType || 'your event',
    params.eventDate ? `on ${params.eventDate}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const created = await quickBooksRequest<{ Invoice: QboInvoice }>('invoice', {
    method: 'POST',
    body: {
      CustomerRef: { value: customer.Id },
      ...(customer.PrimaryEmailAddr
        ? { BillEmail: { Address: customer.PrimaryEmailAddr.Address } }
        : {}),
      AllowOnlineCreditCardPayment: true,
      AllowOnlineACHPayment: true,
      Line: [
        {
          DetailType: 'SalesItemLineDetail',
          Amount: amount,
          Description: description,
          SalesItemLineDetail: {
            ItemRef: itemRef,
            Qty: 1,
            UnitPrice: amount,
          },
        },
      ],
    },
  })

  const invoice = created.Invoice
  return {
    invoiceId: invoice.Id,
    docNumber: invoice.DocNumber ?? '',
    total: invoice.TotalAmt,
    balance: invoice.Balance,
  }
}

/**
 * The customer-facing payment link for an invoice.
 *
 * Read back from QuickBooks rather than constructed, because the shareable
 * link is issued by Intuit and there is no stable URL shape to build by hand.
 */
export async function getInvoicePaymentLink(
  invoiceId: string,
): Promise<string | null> {
  const result = await quickBooksRequest<{ Invoice: QboInvoice }>(
    `invoice/${encodeURIComponent(invoiceId)}?include=invoiceLink`,
  )
  return result.Invoice.InvoiceLink ?? null
}

/** Current balance, used to tell whether a deposit has actually been paid. */
export async function getInvoiceBalance(
  invoiceId: string,
): Promise<{ balance: number; total: number }> {
  const result = await quickBooksRequest<{ Invoice: QboInvoice }>(
    `invoice/${encodeURIComponent(invoiceId)}`,
  )
  return { balance: result.Invoice.Balance, total: result.Invoice.TotalAmt }
}
