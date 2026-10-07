import { Link, Outlet } from '@tanstack/react-router'
import { useAuth } from '../lib/auth'
import { ThemePicker } from './ThemePicker'
import { Reminders } from './Reminders'
import { BottomSlot } from './BottomBar'

const NAV: { to: string; label: string; icon: string; admin?: boolean }[] = [
  { to: '/', label: 'Domov', icon: '📅' },
  { to: '/todo', label: 'To-Do', icon: '✅' },
  { to: '/technika', label: 'Tech.', icon: '🎚️' },
  { to: '/kartony', label: 'Kartóny', icon: '🥤' },
  { to: '/garaz', label: 'Garáž', icon: '🔧' },
  { to: '/financie', label: 'Fin.', icon: '💶', admin: true },
  { to: '/export', label: 'Export', icon: '📤' },
  { to: '/nastavenia', label: 'Nastav.', icon: '⚙️', admin: true },
]

export function Layout() {
  const { profile, isAdmin, signOut } = useAuth()

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-20 border-b line glass">
        <div className="max-w-6xl mx-auto px-3 flex items-center gap-2 h-9">
          <Link to="/" className="display text-sm font-bold tracking-wide flex-1 muted uppercase">Event Hub</Link>
          <Link to="/info" className="text-[11px] px-2 py-0.5 rounded-lg border line shrink-0 muted" title="Info o verzii a stave">
            ⓘ v{__APP_VERSION__}
          </Link>
          <ThemePicker />
          <button onClick={signOut} className="text-xs muted shrink-0 px-1" title={profile?.email ?? ''}>
            Odhlásiť
          </button>
        </div>
        <nav className="max-w-6xl mx-auto px-1 pb-1.5">
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${NAV.filter((n) => !n.admin || isAdmin).length}, minmax(0, 1fr))` }}>
            {NAV.filter((n) => !n.admin || isAdmin).map((n) => (
              <li key={n.to}>
                <Link
                  to={n.to}
                  activeOptions={{ exact: n.to === '/' }}
                  className="flex flex-col items-center py-1.5 rounded-xl text-[11px] leading-tight font-medium muted"
                  activeProps={{ className: 'flex flex-col items-center py-1.5 rounded-xl text-[11px] leading-tight font-semibold bg-[var(--color-signal)] text-white!' }}
                >
                  <span className="text-[26px] leading-none">{n.icon}</span>
                  <span className="mt-1 max-w-full truncate px-0.5">{n.label}</span>
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
