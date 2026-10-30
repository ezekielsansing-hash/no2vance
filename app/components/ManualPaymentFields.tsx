import styles from '../new/page.module.css'
import { EventFormState, PAYMENT_METHODS } from '../lib/events'
import { formatCurrencyInput } from '../lib/money'

type Props = {
  form: EventFormState
  onChange: <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => void
}

/**
 * How the deposit was paid, and the balance if it was paid outside QuickBooks.
 * Shared by the new and edit booking forms. Picking a method is what tells
 * cash flow the money actually arrived.
 */
export default function ManualPaymentFields({ form, onChange }: Props) {
  return (
    <>
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span className={styles.label}>Deposit Paid By</span>
          <MethodSelect
            value={form.depositMethod}
            onChange={(value) => onChange('depositMethod', value)}
          />
          <span className={styles.hintText}>
            Only if paid outside QuickBooks
          </span>
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Balance</span>
          <div className={styles.checkRow}>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={form.noBalanceExpected}
                onChange={(e) => onChange('noBalanceExpected', e.target.checked)}
              />
              <span>No balance expected</span>
            </label>
          </div>
        </div>
      </div>

      {!form.noBalanceExpected && (
        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span className={styles.label}>Balance Paid</span>
            <input
              className={styles.input}
              placeholder="$500"
              value={form.balancePaidAmount}
              onChange={(e) =>
                onChange('balancePaidAmount', formatCurrencyInput(e.target.value))
              }
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Date Balance Paid</span>
            <input
              type="date"
              className={styles.input}
              value={form.balancePaidOn}
              onChange={(e) => onChange('balancePaidOn', e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Balance Paid By</span>
            <MethodSelect
              value={form.balanceMethod}
              onChange={(value) => onChange('balanceMethod', value)}
            />
          </label>
        </div>
      )}
    </>
  )
}

function MethodSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <select
      className={styles.input}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">—</option>
      {PAYMENT_METHODS.map((method) => (
        <option key={method} value={method}>
          {method}
        </option>
      ))}
    </select>
  )
}
