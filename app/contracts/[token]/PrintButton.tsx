'use client'

/**
 * Opens the browser's print dialog, where "Save as PDF" is the destination
 * that produces a file. The print stylesheet strips the app chrome, so what
 * comes out is the agreement and its signature block.
 */
export default function PrintButton({ className }: { className: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      Save as PDF
    </button>
  )
}
