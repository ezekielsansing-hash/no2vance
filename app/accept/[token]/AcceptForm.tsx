'use client'

import { useState } from 'react'
import { formatPhoneNumber } from '../../lib/phone'
import styles from './accept.module.css'

type Field = { key: string; label: string; required: boolean; type?: string }

const FIELDS: Field[] = [
  { key: 'renterName', label: 'Name / Company', required: true },
  { key: 'renterAddress', label: 'Address', required: true },
  { key: 'renterCity', label: 'City', required: true },
  { key: 'renterState', label: 'State', required: true },
  { key: 'renterZip', label: 'Zip', required: true },
  { key: 'renterCell', label: 'Cell phone', required: true, type: 'tel' },
  { key: 'renterEmail', label: 'E-mail', required: true, type: 'email' },
  { key: 'renterPhone', label: 'Other phone', required: false, type: 'tel' },
  { key: 'contactName', label: 'Contact name, if different', required: false },
  {
    key: 'onSiteParty',
    label: 'On-site responsible party, if different',
    required: false,
  },
  { key: 'onSiteCell', label: 'Their cell', required: false, type: 'tel' },
]

export default function AcceptForm({
  token,
  depositAmount,
  contractHtml,
}: {
  token: string
  depositAmount: string
  contractHtml: string
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const response = await fetch(`/api/accept/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, agreed }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      // Reload so the page renders from the stored acceptance record rather
      // than from local state — what's on screen should be what was saved.
      window.location.reload()
    } catch {
      setError('Could not reach the server. Please check your connection.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Your details</h2>
        <p className={styles.sectionNote}>
          These fill in Section 2 of the agreement below.
        </p>
        <div className={styles.fieldGrid}>
          {FIELDS.map((field) => (
            <label key={field.key} className={styles.field}>
              <span className={styles.label}>
                {field.label}
                {field.required && <span className={styles.required}>*</span>}
              </span>
              <input
                className={styles.input}
                type={field.type ?? 'text'}
                value={values[field.key] ?? ''}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    // Phone fields go straight into the signed contract, so
                    // format them the way the rest of the app does rather than
                    // storing whatever was typed.
                    [field.key]:
                      field.type === 'tel'
                        ? formatPhoneNumber(e.target.value)
                        : e.target.value,
                  }))
                }
              />
            </label>
          ))}
        </div>
      </section>

      <article
        className={styles.contract}
        dangerouslySetInnerHTML={{ __html: contractHtml }}
      />

      <section className={styles.acceptBox}>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            I have read this Agreement in full, including the Hold Harmless,
            Indemnification and Waiver Agreement, and I agree to be bound by it.
          </span>
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button
          type="submit"
          className={styles.submit}
          disabled={!agreed || submitting}
        >
          {submitting ? 'Recording…' : 'Accept agreement'}
        </button>

        <p className={styles.payNote}>
          A deposit of {depositAmount} is due to reserve your date. After you
          accept, payment details are in Section 3 above.
        </p>
      </section>
    </form>
  )
}
