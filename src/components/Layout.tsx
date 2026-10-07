import { Link, Outlet } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { applyTheme, getTheme, type Theme } from '../lib/theme'
import { Reminders } from './Reminders'

const NAV: { to: string; label: string; admin?: boolean }[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/todo', label: 'To-Do' },
  { to: '/technika', label: 'Technika' },
  { to: '/kartony', label: 'Kartóny' },
  { to: '/garaz', label: 'Garáž' },
  { to: '/financie', label: 'Financie', admin: true },
  { to: '/export', label: 'Export' },
  { to: '/nastavenia', label: 'Nastavenia', admin: true },
]

export function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const [theme, setTheme] = useState<Theme>(getTheme())

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-20 border-b line" style={{ background: 'var(--bg)' }}>
        <div className="max-w-6xl mx-auto px-3 flex items-center gap-3 h-14">
          <Link to="/" className="display text-2xl font-bold tracking-tight shrink-0">
            Event Hub
          </Link>
          <nav className="flex-1 overflow-x-auto">
            <ul className="flex gap-1 whitespace-nowrap">
              {NAV.filter((n) => !n.admin || isAdmin).map((n) => (
                <li key={n.to}>
                  <Link
                    to={n.to}
                    activeOptions={{ exact: n.to === '/' }}
                    className="block px-3 py-1.5 rounded-lg text-sm font-medium muted hover:opacity-100"
                    activeProps={{ className: 'block px-3 py-1.5 rounded-lg text-sm font-semibold bg-[var(--color-signal)] text-white!' }}
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <button onClick={toggleTheme} className="text-sm px-2 py-1 rounded-lg border line shrink-0" aria-label="Denný/nočný režim">
            {theme === 'dark' ? '☀︎' : '☾'}
          </button>
          <button onClick={signOut} className="text-sm muted shrink-0" title={profile?.email ?? ''}>
            Odhlásiť
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 py-5">
        {isAdmin && <Reminders />}
        <Outlet />
      </main>
    </div>
  )
}
