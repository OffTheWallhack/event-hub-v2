import { Link, Outlet } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { applyTheme, getTheme, type Theme } from '../lib/theme'
import { Reminders } from './Reminders'
import { BottomSlot } from './BottomBar'

const NAV: { to: string; label: string; icon: string; admin?: boolean }[] = [
  { to: '/', label: 'Domov', icon: '📅' },
  { to: '/todo', label: 'To-Do', icon: '✅' },
  { to: '/technika', label: 'Technika', icon: '🎚️' },
  { to: '/kartony', label: 'Kartóny', icon: '🥤' },
  { to: '/garaz', label: 'Garáž', icon: '🔧' },
  { to: '/financie', label: 'Financie', icon: '💶', admin: true },
  { to: '/export', label: 'Export', icon: '📤' },
  { to: '/nastavenia', label: 'Nastav.', icon: '⚙️', admin: true },
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
        <div className="max-w-6xl mx-auto px-3 flex items-center gap-3 h-11">
          <Link to="/" className="display text-2xl font-bold tracking-tight flex-1">
            Event Hub
          </Link>
          <Link to="/info" className="text-xs px-2 py-1 rounded-lg border line shrink-0 muted" title="Info o verzii a stave">
            ⓘ v{__APP_VERSION__}
          </Link>
          <button onClick={toggleTheme} className="text-sm px-2 py-1 rounded-lg border line shrink-0" aria-label="Denný/nočný režim">
            {theme === 'dark' ? '☀︎' : '☾'}
          </button>
          <button onClick={signOut} className="text-sm muted shrink-0" title={profile?.email ?? ''}>
            Odhlásiť
          </button>
        </div>
        <nav className="max-w-6xl mx-auto px-1 pb-1">
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${NAV.filter((n) => !n.admin || isAdmin).length}, minmax(0, 1fr))` }}>
            {NAV.filter((n) => !n.admin || isAdmin).map((n) => (
              <li key={n.to}>
                <Link
                  to={n.to}
                  activeOptions={{ exact: n.to === '/' }}
                  className="flex flex-col items-center py-1 rounded-lg text-[10px] leading-tight font-medium muted"
                  activeProps={{ className: 'flex flex-col items-center py-1 rounded-lg text-[10px] leading-tight font-semibold bg-[var(--color-signal)] text-white!' }}
                >
                  <span className="text-lg leading-none">{n.icon}</span>
                  <span className="mt-0.5 max-w-full truncate px-0.5">{n.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 pt-4 pb-32">
        {isAdmin && <Reminders />}
        <Outlet />
      </main>
      <BottomSlot />
    </div>
  )
}
