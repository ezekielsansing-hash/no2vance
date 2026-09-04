'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import styles from './SiteHeader.module.css'
import { getSupabase } from '../lib/supabase'

const NAV_ITEMS = [
  { href: '/', label: 'Bookings' },
  { href: '/customers', label: 'Customers' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/vendors', label: 'Vendors' },
  { href: '/import', label: 'Import' },
  { href: '/settings', label: 'Settings' },
]

export default function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await getSupabase().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <Image
          src="/logo.png"
          alt="No. 2 Vance Event Venue"
          width={400}
          height={180}
          className={styles.logo}
          priority
        />
      </div>
      <nav className={styles.navLinks} aria-label="Main">
        {NAV_ITEMS.map(({ href, label }) => {
          const active =
            href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}
            >
              {label}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={handleSignOut}
          className={styles.signOutButton}
        >
          Sign out
        </button>
      </nav>
    </header>
  )
}
