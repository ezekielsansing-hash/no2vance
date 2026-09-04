import { renderContractHtml } from '../contract/markdown'
import styles from './legal.module.css'

/**
 * Shared shell for the public legal pages. Reuses the contract Markdown
 * renderer, which escapes everything before formatting.
 */
export default function LegalPage({ markdown }: { markdown: string }) {
  return (
    <main className={styles.page}>
      <div className={styles.sheet}>
        <p className={styles.brand}>No. 2 Vance</p>
        <article
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: renderContractHtml(markdown) }}
        />
      </div>
    </main>
  )
}
