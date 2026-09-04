/**
 * Public legal pages. Intuit requires a EULA and privacy policy URL before
 * issuing production keys, and the privacy policy is a real commitment because
 * the contract acceptance page collects personal information from customers.
 *
 * These describe what the app actually does. If the app's data handling
 * changes — a new third party, a new field collected — change it here too.
 */

export const LEGAL_UPDATED = 'September 4, 2026'

/**
 * TODO(zeke): replace with the address you want privacy requests sent to.
 * A monitored business address is better than a personal one, since this is
 * published publicly.
 */
export const LEGAL_CONTACT_EMAIL = 'no2vance@gmail.com'

/**
 * Shown as the support contact in the app and on the customer acceptance page.
 * Same address as the legal contact today; kept as its own constant so the two
 * can diverge without editing the policy text.
 */
export const SUPPORT_EMAIL = LEGAL_CONTACT_EMAIL

export const LEGAL_ENTITY = 'H. & S. Printing Co., Inc. dba No. 2 Vance'
export const LEGAL_MAILING_ADDRESS = 'P.O. Box 2045, Memphis, TN 38101'

export const TERMS_MARKDOWN = `# Terms of Use

Last updated: ${LEGAL_UPDATED}

These terms govern use of the booking application operated by ${LEGAL_ENTITY} ("we," "us," or "our") at book.no2vance.com (the "Service").

## Who may use the Service

The Service is a private business tool. Accounts are created by us and issued only to our own staff; there is no public sign-up. If you were not given an account by us, you are not authorized to access the signed-in portions of the Service.

Separately, we send customers a private link to review and accept a facility rental agreement. Opening that link does not require an account. Anyone holding such a link may use it for the purpose of reviewing and accepting their own agreement, and for no other purpose.

## Acceptable use

You agree not to attempt to access data belonging to anyone else, to interfere with or disrupt the Service, to probe or test its security, or to use it in violation of any applicable law.

## The rental agreement is a separate contract

If you accept a facility rental agreement through the Service, that agreement is a contract between you and ${LEGAL_ENTITY}, governed by its own terms. Nothing in these Terms of Use modifies it. Where the two conflict as to your rental, the rental agreement controls.

## Availability and accuracy

The Service is provided as-is and as-available. We do not warrant that it will be uninterrupted or error-free. We may change, suspend, or discontinue it at any time.

## Limitation of liability

To the fullest extent permitted by law, we are not liable for indirect, incidental, consequential, special, or punitive damages arising out of your use of the Service. This does not limit any obligation we owe you under a facility rental agreement you have entered into with us.

## Governing law

These terms are governed by the laws of the State of Tennessee.

## Contact

${LEGAL_ENTITY}
${LEGAL_MAILING_ADDRESS}
${LEGAL_CONTACT_EMAIL}
`

export const PRIVACY_MARKDOWN = `# Privacy Policy

Last updated: ${LEGAL_UPDATED}

This policy explains what personal information ${LEGAL_ENTITY} ("we," "us," or "our") collects through the booking application at book.no2vance.com (the "Service"), why we collect it, and who else handles it.

## What we collect

**From people who book or inquire about the venue.** When you contact us about an event, we record your name, phone number, and where relevant your email address, along with the details of the event you are asking about.

**From people who accept a rental agreement.** When you accept a facility rental agreement through a link we send you, we collect the information the agreement itself asks for: your name or company name, mailing address, phone numbers, email address, and, if different from you, the name and phone number of your on-site responsible party.

**Automatically, at the moment you accept.** We record the date and time of your acceptance, the IP address the acceptance came from, and your browser's user-agent string. We keep these because they are the evidence that the agreement was accepted, and by whom. We also store a complete copy of the agreement text exactly as it was presented to you.

**From our own staff.** Staff accounts consist of an email address and a password, managed by our authentication provider. We never see staff passwords.

We do not use advertising trackers, we do not build profiles for marketing, and we do not sell personal information.

## Why we collect it

To respond to booking inquiries, to prepare and perform rental agreements, to invoice and collect payment, and to keep the business records we are required or reasonably expected to keep. We do not use your information for anything unrelated to your event.

## Who else handles it

We use a small number of service providers, each of which processes information on our behalf:

- **Supabase** — hosts the database where booking, customer, and agreement records are stored.
- **Vercel** — hosts and serves the application itself.
- **Intuit (QuickBooks)** — when we invoice you, we send Intuit the information needed to issue that invoice: your name, email address, and the amount owed. Payments are processed by Intuit, not by us. We never receive or store your full card number or bank account details.

We do not otherwise share your personal information, except where we are required to by law or where it is necessary to establish or defend a legal claim.

## Payment information

We do not collect card numbers, security codes, or bank account numbers through this Service, and no page of it asks for them. If you pay an invoice, you do so on Intuit's payment pages under Intuit's own terms and privacy policy.

## How long we keep it

Booking records and accepted agreements are business and legal records, and we keep them for as long as we may need them for tax, accounting, or legal purposes. Inquiries that never become bookings are kept only as long as they are useful for follow-up.

## Security

Access to the database requires authentication, and the records are not publicly readable. Agreement links contain a long random token and are not listed or indexed anywhere — but anyone holding your link can view the agreement it points to, so treat it as private.

## Your choices

You may ask us what personal information we hold about you, ask us to correct it, or ask us to delete it. We will honor deletion requests except where we need to retain a record for tax, accounting, or legal reasons — an accepted rental agreement, in particular, is a record we generally must keep.

Depending on where you live, you may have additional rights under your local law. Contact us and we will tell you how we can help.

## Children

The Service is not directed to children and we do not knowingly collect personal information from anyone under 13.

## Changes

If we change this policy we will update the date at the top of this page.

## Contact

${LEGAL_ENTITY}
${LEGAL_MAILING_ADDRESS}
${LEGAL_CONTACT_EMAIL}
`
