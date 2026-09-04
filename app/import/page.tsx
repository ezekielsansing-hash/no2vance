'use client'

import { useCallback, useEffect, useState } from 'react'
import SiteHeader from '../components/SiteHeader'
import styles from './page.module.css'
import {
  BOOKING_STATUSES,
  BookingStatus,
  Customer,
  EventRecord,
  clearLegacyLocalData,
  deleteAllData,
  exportAllData,
  hasLegacyLocalData,
  insertCustomers,
  insertEvents,
  loadCustomers,
  loadEvents,
  migrateLocalDataToCloud,
} from '../lib/events'

type ImportType = 'bookings' | 'customers'

type ParsedRow = {
  data: Record<string, string>
  errors: string[]
  rowIndex: number
}

type ParseResult = {
  headers: string[]
  rows: ParsedRow[]
}

function parseCSV(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const parseRow = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseRow(lines[0])
  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i])
    const data: Record<string, string> = {}
    headers.forEach((header, idx) => {
      data[header] = values[idx] || ''
    })
    rows.push({ data, errors: [], rowIndex: i })
  }

  return { headers, rows }
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false
  const match = dateStr.match(/^\d{4}-\d{2}-\d{2}$/)
  if (!match) return false
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function validateBookingRow(row: ParsedRow): string[] {
  const errors: string[] = []
  const { data } = row

  if (!data.customerName?.trim()) {
    errors.push('Missing customerName')
  }
  if (!data.customerContact?.trim()) {
    errors.push('Missing customerContact')
  }
  if (!data.eventDate?.trim()) {
    errors.push('Missing eventDate')
  } else if (!isValidDate(data.eventDate.trim())) {
    errors.push('Invalid date format (use YYYY-MM-DD)')
  }
  if (data.status) {
    const status = data.status.toLowerCase().trim()
    if (!BOOKING_STATUSES.includes(status as BookingStatus)) {
      errors.push(
        'Invalid status (use ' + BOOKING_STATUSES.join(', ') + ')',
      )
    }
  }

  return errors
}

function validateCustomerRow(row: ParsedRow): string[] {
  const errors: string[] = []
  const { data } = row

  if (!data.name?.trim()) {
    errors.push('Missing name')
  }
  if (!data.contact?.trim()) {
    errors.push('Missing contact')
  }

  return errors
}

function escapeCSVField(value: string): string {
  if (!value) return ''
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function generateBookingsCSV(events: EventRecord[]): string {
  const headers = [
    'customerName',
    'customerContact',
    'eventDate',
    'status',
    'eventType',
    'eventTimeStart',
    'eventTimeEnd',
    'ratePackage',
    'depositAmount',
    'dateOfDeposit',
    'estimatedGuestCount',
    'leadSource',
    'heardFrom',
    'airbnb',
    'setupLayout',
    'vendorList',
    'contractLink',
    'photoFolder',
    'postEventNotes',
  ]

  const rows = events.map((event) =>
    headers.map((header) => escapeCSVField(event[header as keyof EventRecord]?.toString() || '')).join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}

function generateCustomersCSV(customers: Customer[]): string {
  const headers = ['name', 'contact', 'email', 'notes']

  const rows = customers.map((customer) =>
    headers.map((header) => escapeCSVField(customer[header as keyof Customer]?.toString() || '')).join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function ImportPage() {
  const [importType, setImportType] = useState<ImportType>('bookings')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [importStatus, setImportStatus] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [showMigrate, setShowMigrate] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migrateStatus, setMigrateStatus] = useState('')

  useEffect(() => {
    setShowMigrate(hasLegacyLocalData())
  }, [])

  const handleMigrate = async () => {
    setMigrating(true)
    setMigrateStatus('')
    try {
      const counts = await migrateLocalDataToCloud()
      setMigrateStatus(
        `Moved ${counts.events} bookings, ${counts.customers} customers, ` +
          `${counts.vendors} vendors, and ${counts.eventTypes} custom event types to the shared database.`,
      )
      clearLegacyLocalData()
      setShowMigrate(false)
    } catch (err) {
      setMigrateStatus(
        err instanceof Error
          ? `Migration failed: ${err.message}`
          : 'Migration failed',
      )
    } finally {
      setMigrating(false)
    }
  }

  const handleFile = useCallback(
    (file: File) => {
      setImportStatus(null)
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const result = parseCSV(text)

        // Validate rows
        result.rows.forEach((row) => {
          if (importType === 'bookings') {
            row.errors = validateBookingRow(row)
          } else {
            row.errors = validateCustomerRow(row)
          }
        })

        setParseResult(result)
      }
      reader.readAsText(file)
    },
    [importType]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file && file.name.endsWith('.csv')) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const validRows = parseResult?.rows.filter((r) => r.errors.length === 0) || []
  const errorRows = parseResult?.rows.filter((r) => r.errors.length > 0) || []

  const handleImport = useCallback(async () => {
    if (!parseResult || validRows.length === 0) return

    if (importType === 'customers') {
      const existingCustomers = await loadCustomers()
      const existingPhones = new Set(
        existingCustomers.map((c) => normalizePhone(c.contact))
      )

      const newCustomers: Customer[] = []
      let skipped = 0

      validRows.forEach((row) => {
        const phone = normalizePhone(row.data.contact)
        if (existingPhones.has(phone)) {
          skipped++
          return
        }
        existingPhones.add(phone)

        const customer: Customer = {
          id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: row.data.name.trim(),
          contact: row.data.contact.trim(),
          email: row.data.email?.trim() || undefined,
          notes: row.data.notes?.trim() || undefined,
          createdAt: new Date().toISOString(),
        }
        newCustomers.push(customer)
      })

      try {
        await insertCustomers(newCustomers)
      } catch (err) {
        setImportStatus({
          success: false,
          message: err instanceof Error ? err.message : 'Import failed',
        })
        return
      }

      const msg =
        skipped > 0
          ? `Imported ${newCustomers.length} customers. Skipped ${skipped} duplicates.`
          : `Imported ${newCustomers.length} customers.`
      setImportStatus({ success: true, message: msg })
      setParseResult(null)
    } else {
      // Bookings import
      const existingCustomers = await loadCustomers()

      // Match customers by name+phone combination (not just phone)
      const customerKey = (name: string, phone: string) =>
        `${name.toLowerCase().trim()}|${normalizePhone(phone)}`

      const customersByNamePhone = new Map(
        existingCustomers.map((c) => [customerKey(c.name, c.contact), c])
      )

      const newCustomers: Customer[] = []
      const newEvents: EventRecord[] = []

      validRows.forEach((row) => {
        const customerName = row.data.customerName.trim()
        const customerContact = row.data.customerContact.trim()
        const key = customerKey(customerName, customerContact)

        // Find or create customer - only match if BOTH name and phone match
        let customer = customersByNamePhone.get(key)
        if (!customer) {
          customer = {
            id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: customerName,
            contact: customerContact,
            createdAt: new Date().toISOString(),
          }
          customersByNamePhone.set(key, customer)
          newCustomers.push(customer)
        }

        const status = (row.data.status?.toLowerCase().trim() ||
          'prospect') as BookingStatus

        const event: EventRecord = {
          id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: new Date().toISOString(),
          status,
          eventType: row.data.eventType?.trim() || '',
          eventDate: row.data.eventDate.trim(),
          customerId: customer.id,
          customerName,
          customerContact,
          ratePackage: row.data.ratePackage?.trim() || '',
          leadSource: row.data.leadSource?.trim() || '',
          heardFrom: row.data.heardFrom?.trim() || '',
          dateOfDeposit: row.data.dateOfDeposit?.trim() || '',
          depositAmount: row.data.depositAmount?.trim() || '',
          contractLink: row.data.contractLink?.trim() || '',
          airbnb: row.data.airbnb?.trim() || '',
          estimatedGuestCount: row.data.estimatedGuestCount?.trim() || '',
          eventTimeStart: row.data.eventTimeStart?.trim() || '',
          eventTimeEnd: row.data.eventTimeEnd?.trim() || '',
          setupLayout: row.data.setupLayout?.trim() || '',
          effortLevel: '',
          vendorList: row.data.vendorList?.trim() || '',
          photoFolder: row.data.photoFolder?.trim() || '',
          postEventNotes: row.data.postEventNotes?.trim() || '',
          // Contract fields aren't part of the CSV format — they're filled in
          // on the booking before a contract link is generated.
          accessTime: '',
          exitTime: '',
          additionalItems: '',
          photographyOptOut: false,
          requirements: {},
        }

        newEvents.push(event)
      })

      try {
        await insertCustomers(newCustomers)
        await insertEvents(newEvents)
      } catch (err) {
        setImportStatus({
          success: false,
          message: err instanceof Error ? err.message : 'Import failed',
        })
        return
      }

      const customerMsg =
        newCustomers.length > 0
          ? ` Created ${newCustomers.length} new customers.`
          : ''
      setImportStatus({
        success: true,
        message: `Imported ${newEvents.length} bookings.${customerMsg}`,
      })
      setParseResult(null)
    }
  }, [parseResult, validRows, importType])

  const resetImport = () => {
    setParseResult(null)
    setImportStatus(null)
  }

  const handleExportBookings = async () => {
    const events = await loadEvents()
    if (events.length === 0) {
      alert('No bookings to export')
      return
    }
    const csv = generateBookingsCSV(events)
    const date = new Date().toISOString().slice(0, 10)
    downloadCSV(csv, `bookings-backup-${date}.csv`)
  }

  const handleExportCustomers = async () => {
    const customers = await loadCustomers()
    if (customers.length === 0) {
      alert('No customers to export')
      return
    }
    const csv = generateCustomersCSV(customers)
    const date = new Date().toISOString().slice(0, 10)
    downloadCSV(csv, `customers-backup-${date}.csv`)
  }

  const handleDownloadBackup = async () => {
    const backup = await exportAllData()
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `no2vance-backup-${backup.exportedAt.slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleClearAllData = async () => {
    const events = await loadEvents()
    const customers = await loadCustomers()

    if (events.length === 0 && customers.length === 0) {
      alert('No data to clear')
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete all data for EVERYONE who uses this site?\n\n` +
      `This will permanently remove from the shared database:\n` +
      `• ${events.length} booking(s)\n` +
      `• ${customers.length} customer(s)\n` +
      `• all saved vendors and custom event types\n\n` +
      `This action cannot be undone. Download a backup first.`
    )

    if (confirmed) {
      try {
        await deleteAllData()
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Clear failed')
        return
      }
      window.location.reload()
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <SiteHeader />

        {(showMigrate || migrateStatus) && (
          <section className={styles.migrateSection}>
            <h2 className={styles.pageTitle}>Move Local Data to the Cloud</h2>
            {showMigrate && (
              <>
                <p className={styles.exportDescription}>
                  This browser has data saved from before the site moved to a
                  shared database. Move it over so everyone can see it — this
                  only needs to happen once, from the browser that has the
                  data.
                </p>
                <button
                  type="button"
                  className={`${styles.button} ${styles.primaryButton}`}
                  onClick={handleMigrate}
                  disabled={migrating}
                >
                  {migrating ? 'Moving…' : 'Move Data to Cloud'}
                </button>
              </>
            )}
            {migrateStatus && (
              <p className={styles.exportDescription}>{migrateStatus}</p>
            )}
          </section>
        )}

        <section className={styles.importSection}>
          <h1 className={styles.pageTitle}>Import Data</h1>

          <div className={styles.typeToggle}>
            <button
              type="button"
              className={`${styles.typeBtn} ${
                importType === 'bookings' ? styles.typeBtnActive : ''
              }`}
              onClick={() => {
                setImportType('bookings')
                resetImport()
              }}
            >
              Bookings
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${
                importType === 'customers' ? styles.typeBtnActive : ''
              }`}
              onClick={() => {
                setImportType('customers')
                resetImport()
              }}
            >
              Customers
            </button>
          </div>

          {importStatus && (
            <div
              className={`${styles.statusMessage} ${
                importStatus.success ? styles.statusSuccess : styles.statusError
              }`}
            >
              {importStatus.message}
            </div>
          )}

          {!parseResult && (
            <div
              className={`${styles.dropzone} ${
                dragOver ? styles.dropzoneActive : ''
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <p>Drop CSV file here or click to browse</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className={styles.fileInput}
              />
              <p className={styles.hint}>
                {importType === 'bookings'
                  ? 'Required columns: customerName, customerContact, eventDate'
                  : 'Required columns: name, contact'}
              </p>
            </div>
          )}

          {!parseResult && (
            <div className={styles.columnsRef}>
              <h3 className={styles.columnsRefTitle}>Column Reference</h3>
              {importType === 'bookings' ? (
                <div className={styles.columnGroups}>
                  <div className={styles.columnGroup}>
                    <h4 className={styles.columnGroupTitle}>Required</h4>
                    <ul className={styles.columnList}>
                      <li><code>customerName</code> — Customer full name</li>
                      <li><code>customerContact</code> — Phone number</li>
                      <li><code>eventDate</code> — Date in YYYY-MM-DD format</li>
                    </ul>
                  </div>
                  <div className={styles.columnGroup}>
                    <h4 className={styles.columnGroupTitle}>Optional</h4>
                    <ul className={styles.columnList}>
                      <li><code>status</code> — prospect, pending, confirmed, or lost (defaults to prospect); <code>pending</code> means contract sent</li>
                      <li><code>eventType</code> — e.g. Wedding, Birthday, Corporate Event</li>
                      <li><code>eventTimeStart</code> — Start time (HH:MM)</li>
                      <li><code>eventTimeEnd</code> — End time (HH:MM)</li>
                      <li><code>ratePackage</code> — Price/package amount</li>
                      <li><code>depositAmount</code> — Deposit amount</li>
                      <li><code>dateOfDeposit</code> — Deposit date (YYYY-MM-DD)</li>
                      <li><code>estimatedGuestCount</code> — Number of guests</li>
                      <li><code>leadSource</code> — Where the lead came from</li>
                      <li><code>heardFrom</code> — How they heard about you</li>
                      <li><code>airbnb</code> — Airbnb details</li>
                      <li><code>setupLayout</code> — Setup and layout notes</li>
                      <li><code>vendorList</code> — List of vendors</li>
                      <li><code>contractLink</code> — URL to contract</li>
                      <li><code>photoFolder</code> — URL to photo folder</li>
                      <li><code>postEventNotes</code> — Notes after the event</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className={styles.columnGroups}>
                  <div className={styles.columnGroup}>
                    <h4 className={styles.columnGroupTitle}>Required</h4>
                    <ul className={styles.columnList}>
                      <li><code>name</code> — Customer full name</li>
                      <li><code>contact</code> — Phone number</li>
                    </ul>
                  </div>
                  <div className={styles.columnGroup}>
                    <h4 className={styles.columnGroupTitle}>Optional</h4>
                    <ul className={styles.columnList}>
                      <li><code>email</code> — Email address</li>
                      <li><code>notes</code> — Additional notes</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {parseResult && (
            <div className={styles.preview}>
              <div className={styles.previewHeader}>
                <h2 className={styles.previewTitle}>
                  Preview ({parseResult.rows.length} rows)
                </h2>
                <button
                  type="button"
                  className={styles.resetBtn}
                  onClick={resetImport}
                >
                  Choose Different File
                </button>
              </div>

              {errorRows.length > 0 && (
                <div className={styles.errorSummary}>
                  {errorRows.length} row{errorRows.length !== 1 ? 's have' : ' has'}{' '}
                  errors and will be skipped
                </div>
              )}

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.rowNumCol}>#</th>
                      {parseResult.headers.slice(0, 5).map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.rows.slice(0, 10).map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={row.errors.length > 0 ? styles.errorRow : ''}
                      >
                        <td className={styles.rowNumCol}>{row.rowIndex}</td>
                        {parseResult.headers.slice(0, 5).map((header) => (
                          <td key={header}>{row.data[header] || '—'}</td>
                        ))}
                        <td>
                          {row.errors.length > 0 ? (
                            <span className={styles.errorBadge} title={row.errors.join(', ')}>
                              {row.errors.length} error{row.errors.length !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className={styles.validBadge}>Valid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parseResult.rows.length > 10 && (
                <p className={styles.moreRows}>
                  ...and {parseResult.rows.length - 10} more rows
                </p>
              )}

              <div className={styles.importActions}>
                <button
                  type="button"
                  className={`${styles.button} ${styles.primaryButton}`}
                  onClick={handleImport}
                  disabled={validRows.length === 0}
                >
                  Import {validRows.length} Valid Row{validRows.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className={styles.exportSection}>
          <h2 className={styles.pageTitle}>Backup &amp; Export</h2>
          <p className={styles.exportDescription}>
            Download a full backup (everything: bookings, customers, vendors,
            event types) as a JSON file. Do this regularly — it&apos;s your
            recovery copy until automatic database backups are turned on.
          </p>
          <div className={styles.exportButtons}>
            <button
              type="button"
              className={`${styles.button} ${styles.primaryButton}`}
              onClick={handleDownloadBackup}
            >
              Download Full Backup (JSON)
            </button>
          </div>
          <p className={styles.exportDescription}>
            Or download CSV files, which can be re-imported using the import
            tool above.
          </p>
          <div className={styles.exportButtons}>
            <button
              type="button"
              className={`${styles.button} ${styles.exportButton}`}
              onClick={handleExportBookings}
            >
              Export Bookings CSV
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.exportButton}`}
              onClick={handleExportCustomers}
            >
              Export Customers CSV
            </button>
          </div>
        </section>

        <section className={styles.dangerSection}>
          <h2 className={styles.dangerTitle}>Danger Zone</h2>
          <p className={styles.dangerDescription}>
            Permanently delete all bookings and customers. This cannot be undone.
          </p>
          <button
            type="button"
            className={`${styles.button} ${styles.dangerButton}`}
            onClick={handleClearAllData}
          >
            Clear All Data
          </button>
        </section>
      </section>
    </main>
  )
}
