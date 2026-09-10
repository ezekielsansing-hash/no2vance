import { SUPPORT_EMAIL } from '../legal'
import { parseAmount } from '../money'
import { isValidPhone } from '../phone'
import {
  QuickBooksError,
  escapeQueryValue,
  quickBooksFaultCodes,
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

/** Intuit's "Duplicate Name Exists Error". */
const DUPLICATE_NAME_CODE = '6240'

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

  // The imported 2021 bookings carry placeholders like "no contact on file"
  // in the contact field, which is fine on screen and nonsense in a phone
  // field on a real customer record.
  const phone = params.phone && isValidPhone(params.phone) ? params.phone : undefined

  try {
    const created = await quickBooksRequest<{ Customer: QboCustomer }>(
      'customer',
      {
        method: 'POST',
        body: {
          DisplayName: name,
          ...(params.email
            ? { PrimaryEmailAddr: { Address: params.email } }
            : {}),
          ...(phone ? { PrimaryPhone: { FreeFormNumber: phone } } : {}),
        },
      },
    )
    return created.Customer
  } catch (err) {
    if (
      err instanceof QuickBooksError &&
      quickBooksFaultCodes(err.body).includes(DUPLICATE_NAME_CODE)
    ) {
      throw new Error(await describeNameCollision(name))
    }
    throw err
  }
}

/**
 * Explain a duplicate-name failure in terms of the record that caused it.
 *
 * QuickBooks keeps customers, vendors, and employees in one namespace: a name
 * used by any of the three is unavailable to the other two. The lookup above
 * only sees active customers, so a renter can collide with a record we never
 * searched, and Intuit's own message ("Another customer, vendor or employee is
 * already using this name") names neither which one nor what to do about it.
 *
 * Resolving the clash means renaming somebody in the venue's books, which is
 * their decision — inventing a display name here would quietly write a second
 * spelling of a real person into the real company file. So this finds the
 * record in the way and says so.
 */
async function describeNameCollision(name: string): Promise<string> {
  const escaped = escapeQueryValue(name)
  const lookup = async (entity: 'Customer' | 'Vendor' | 'Employee') => {
    const result = await quickBooksQuery<{
      QueryResponse: Record<string, Array<{ Id: string; Active?: boolean }>>
    }>(
      `select * from ${entity} where Active in (true, false) and DisplayName = '${escaped}'`,
    )
    return result.QueryResponse[entity]?.[0]
  }

  const [customer, vendor, employee] = await Promise.all([
    lookup('Customer'),
    lookup('Vendor'),
    lookup('Employee'),
  ])

  const suffix =
    ` Rename one of them in QuickBooks — or change the name on this booking,` +
    ` for example "${name} (renter)" — and create the link again.`

  if (customer) {
    return customer.Active === false
      ? `QuickBooks already has a customer named "${name}", but they are marked inactive, ` +
          `so the invoice can't be raised against them. Make them active again in QuickBooks ` +
          `and create the link again.`
      : `QuickBooks already has a customer named "${name}" that this lookup couldn't match. ` +
          `Check for a second spelling of the name in QuickBooks.`
  }
  if (employee) {
    return (
      `QuickBooks already uses the name "${name}" for an employee, and customers, vendors, ` +
      `and employees all share one list of names, so it can't also be a customer.` +
      suffix
    )
  }
  if (vendor) {
    return (
      `QuickBooks already uses the name "${name}" for a vendor, and customers, vendors, ` +
      `and employees all share one list of names, so it can't also be a customer.` +
      suffix
    )
  }
  return (
    `QuickBooks says the name "${name}" is already taken by another customer, vendor, ` +
    `or employee, but it doesn't appear under that exact spelling. Search for it in ` +
    `QuickBooks — the existing record may differ in punctuation or spacing.`
  )
}

/**
 * The income account new line items are booked against.
 *
 * Named rather than taken as whichever active Income account comes back first:
 * that ordering is Intuit's, and on these books it returns "Billable Expense
 * Income", so deposits would have been filed against the wrong account without
 * anything failing. Wrong-but-silent is the worst outcome here — it surfaces
 * at tax time rather than at the point of sale.
 */
const INCOME_ACCOUNT_NAME = 'Event Income'

async function findIncomeAccountRef(): Promise<QboRef> {
  const result = await quickBooksQuery<{
    QueryResponse: { Account?: Array<{ Id: string; Name: string }> }
  }>(
    `select * from Account where AccountType = 'Income' and Active = true and Name = '${escapeQueryValue(
      INCOME_ACCOUNT_NAME,
    )}'`,
  )
  const account = result.QueryResponse.Account?.[0]
  if (!account) {
    throw new Error(
      `No active income account named "${INCOME_ACCOUNT_NAME}" was found in QuickBooks. ` +
        `Add one, or point INCOME_ACCOUNT_NAME at the account deposits should be booked to.`,
    )
  }
  return { value: account.Id, name: account.Name }
}

/**
 * The service items rentals are billed as. Created once each and reused, so
 * the venue's books show two steady lines rather than a new item per booking.
 *
 * Deposit and balance are separate items on purpose: they're the two halves
 * Section 3 defines, they land at different times, and keeping them apart
 * means the P&L can answer "how much is reserved but not yet fully paid"
 * without reading descriptions.
 */
const DEPOSIT_ITEM_NAME = 'Facility Rental Deposit'
const BALANCE_ITEM_NAME = 'Facility Rental Balance'

export async function findOrCreateDepositItem(): Promise<QboRef> {
  return findOrCreateServiceItem(DEPOSIT_ITEM_NAME)
}

export async function findOrCreateBalanceItem(): Promise<QboRef> {
  return findOrCreateServiceItem(BALANCE_ITEM_NAME)
}

async function findOrCreateServiceItem(name: string): Promise<QboRef> {
  const found = await quickBooksQuery<{
    QueryResponse: { Item?: Array<{ Id: string; Name: string }> }
  }>(`select * from Item where Name = '${escapeQueryValue(name)}'`)
  const existing = found.QueryResponse.Item?.[0]
  if (existing) return { value: existing.Id, name: existing.Name }

  const created = await quickBooksRequest<{
    Item: { Id: string; Name: string }
  }>('item', {
    method: 'POST',
    body: {
      Name: name,
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
 * Raise an invoice for one line against a customer.
 *
 * Online card and bank payment are both enabled — ACH costs roughly a third
 * of what a card does on an amount this size, so both are offered rather than
 * cards alone.
 */
async function createInvoice(params: {
  customer: QboCustomer
  itemRef: QboRef
  amount: number
  description: string
  /** ISO date. Omitted on the deposit, which is due on receipt. */
  dueDate?: string
}): Promise<DepositInvoice> {
  const created = await quickBooksRequest<{ Invoice: QboInvoice }>('invoice', {
    method: 'POST',
    body: {
      CustomerRef: { value: params.customer.Id },
      // A BillEmail is what makes Intuit mint the shareable payment link, and
      // that link is the whole point of the acceptance page's Pay button. An
      // invoice without one comes back with no InvoiceLink at all, so a renter
      // with no email on file would be shown a contract and no way to pay it —
      // and most of this venue's customers have no email on file.
      //
      // Falling back to the venue's own address rather than skipping the field
      // matches what the books already do: invoices raised in QuickBooks for
      // emailless customers carry no2vance@gmail.com for exactly this reason.
      // Setting it does not send anything; that needs a separate send call.
      BillEmail: {
        Address: params.customer.PrimaryEmailAddr?.Address ?? SUPPORT_EMAIL,
      },
      ...(params.dueDate ? { DueDate: params.dueDate } : {}),
      AllowOnlineCreditCardPayment: true,
      AllowOnlineACHPayment: true,
      Line: [
        {
          DetailType: 'SalesItemLineDetail',
          Amount: params.amount,
          Description: params.description,
          SalesItemLineDetail: {
            ItemRef: params.itemRef,
            Qty: 1,
            UnitPrice: params.amount,
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

/** Create the deposit invoice for a booking. Due on receipt: it reserves the date. */
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

  return createInvoice({
    customer,
    itemRef: await findOrCreateDepositItem(),
    amount,
    description: [
      'Deposit to reserve',
      params.eventType || 'your event',
      params.eventDate ? `on ${params.eventDate}` : '',
    ]
      .filter(Boolean)
      .join(' '),
  })
}

/**
 * Create the balance invoice — the second half of Section 3.
 *
 * Unlike the deposit this one carries a real due date, because the term that
 * matters is a deadline: the balance is due no later than seven days before
 * the event, and an unpaid balance past that date lets the venue release the
 * date and keep the deposit. An invoice with no due date can't say that.
 */
export async function createBalanceInvoice(params: {
  customerName: string
  customerEmail?: string
  customerPhone?: string
  balanceAmount: string
  eventType: string
  eventDate: string
  /** ISO date, seven days before the event. */
  dueDate: string
}): Promise<DepositInvoice> {
  const amount = parseAmount(params.balanceAmount)
  if (amount <= 0) {
    throw new Error('The balance must be greater than zero to invoice.')
  }

  const customer = await findOrCreateCustomer({
    name: params.customerName,
    email: params.customerEmail,
    phone: params.customerPhone,
  })

  return createInvoice({
    customer,
    itemRef: await findOrCreateBalanceItem(),
    amount,
    dueDate: params.dueDate,
    description: [
      'Remaining balance for',
      params.eventType || 'your event',
      params.eventDate ? `on ${params.eventDate}` : '',
    ]
      .filter(Boolean)
      .join(' '),
  })
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
