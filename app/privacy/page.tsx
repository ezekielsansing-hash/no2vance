import type { Metadata } from 'next'
import LegalPage from '../lib/legal/LegalPage'
import { PRIVACY_MARKDOWN } from '../lib/legal'

export const metadata: Metadata = { title: 'Privacy Policy — No. 2 Vance' }

export default function PrivacyPage() {
  return <LegalPage markdown={PRIVACY_MARKDOWN} />
}
