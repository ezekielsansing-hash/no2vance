import type { Metadata } from 'next'
import LegalPage from '../lib/legal/LegalPage'
import { TERMS_MARKDOWN } from '../lib/legal'

export const metadata: Metadata = { title: 'Terms of Use — No. 2 Vance' }

export default function TermsPage() {
  return <LegalPage markdown={TERMS_MARKDOWN} />
}
