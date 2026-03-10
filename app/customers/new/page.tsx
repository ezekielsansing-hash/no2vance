'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import styles from '../../new/page.module.css'
import { Customer, loadCustomers, saveCustomers } from '../../lib/events'

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

export default function NewCustomerPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function isValidPhone(value: string): boolean {
    const digits = value.replace(/\D/g, '')
    return digits.length >= 10 && digits.length <= 15
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {}
    if (!name.trim()) nextErrors.name = 'Required'
    if (!contact.trim()) {
      nextErrors.contact = 'Required'
    } else if (!isValidPhone(contact)) {
      nextErrors.contact = 'Enter a valid phone number'
    }
    if (email && !email.includes('@')) {
      nextErrors.email = 'Enter a valid email'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const now = new Date()
    const customer: Customer = {
      id: `cust-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      contact: contact.trim(),
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: now.toISOString(),
    }

    const existing = loadCustomers()
    saveCustomers([customer, ...existing])
    router.push('/customers')
  }

  function handleReset() {
    setName('')
    setContact('')
    setEmail('')
    setNotes('')
    setErrors({})
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>New Customer</h1>
            <p className={styles.subtitle}>
              Add a new customer. They can then be selected when creating bookings.
            </p>
          </div>
          <div>
            <Link href="/customers" className={`${styles.button} ${styles.ghostButton}`}>
              View All Customers
            </Link>
          </div>
        </header>

        <section className={styles.formPanel}>
          <h2 className={styles.panelTitle}>Customer Details</h2>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.section}>
              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.label}>
                    Name<span className={styles.required}>*</span>
                  </span>
                  <input
                    className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                    placeholder="First Last"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setErrors((prev) => ({ ...prev, name: '' }))
                    }}
                  />
                  {errors.name && <span className={styles.errorText}>{errors.name}</span>}
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>
                    Phone<span className={styles.required}>*</span>
                  </span>
                  <input
                    type="tel"
                    className={`${styles.input} ${errors.contact ? styles.inputError : ''}`}
                    placeholder="(555) 123-4567"
                    value={contact}
                    onChange={(e) => {
                      setContact(formatPhoneNumber(e.target.value))
                      setErrors((prev) => ({ ...prev, contact: '' }))
                    }}
                  />
                  {errors.contact && <span className={styles.errorText}>{errors.contact}</span>}
                </label>
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.label}>Email</span>
                  <input
                    type="email"
                    className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setErrors((prev) => ({ ...prev, email: '' }))
                    }}
                  />
                  {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                </label>
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.field} style={{ gridColumn: '1 / -1' }}>
                  <span className={styles.label}>Notes</span>
                  <textarea
                    className={`${styles.input} ${styles.textarea}`}
                    placeholder="VIP, preferences, special requests..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <footer className={styles.formFooter}>
              <div className={styles.footerLeft}>
                <button
                  type="submit"
                  className={`${styles.button} ${styles.primaryButton}`}
                >
                  Save Customer
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className={`${styles.button} ${styles.ghostButton}`}
                >
                  Clear Form
                </button>
              </div>
              <p className={styles.footerHint}>
                Once saved, this customer will appear in your customer list.
              </p>
            </footer>
          </form>
        </section>
      </section>
    </main>
  )
}
