import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import {
  CalendarDays, Car, Ellipsis, FileDown, Info, ListChecks, LogOut, Package, Palette, Settings, Speaker, Wallet, Wrench, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Reminders } from './Reminders'

export type NavItem = { to: string; label: string; icon: LucideIcon; admin?: boolean; tab?: boolean }

// tab = v spodnej lište na mobile; ostatné sú pod „Viac“. Na počítači je všetko v bočnom paneli.
export const NAV: NavItem[] = [
  { to: '/', label: 'Kalendár', icon: CalendarDays, tab: true },
  { to: '/todo', label: 'To-Do', icon: ListChecks, tab: true },
  { to: '/kartony', label: 'Kartóny', icon: Package, tab: true },
  { to: '/technika', label: 'Technika', icon: Speaker, tab: true },
  { to: '/financie', label: 'Financie', icon: Wallet, admin: true },
  { to: '/garaz', label: 'Garáž', icon: Wrench },
  { to: '/showroom', label: 'Showroom', icon: Car },
  { to: '/export', label: 'Export', icon: FileDown },
  { to: '/vzhlad', label: 'Vzhľad', icon: Palette },
  { to: '/nastavenia', label: 'Nastavenia', icon: Settings, admin: true },
  { to: '/info', label: 'Info', icon: Info },
]

const isActive = (to: string, path: string) => (to === '/' ? path === '/' || path.startsWith('/event/') : path === to || path.startsWith(to + '/'))

export function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const path = useRouterState({ select: (s) => s.location.pathname })
  const items = NAV.filter((n) => !n.admin || isAdmin)
  const tabs = items.filter((n) => n.tab)
  const moreOn = !tabs.some((t) => isActive(t.to, path))

  return (
    <div className="min-h-full">
      {/* pás pod hodinami iPhonu, aby obsah pri rolovaní nebol pod stavovým riadkom */}
      <div className="fixed top-0 inset-x-0 z-40 glass" style={{ height: 'env(safe-area-inset-top, 0px)' }} />

      {/* počítač: bočný panel */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-60 flex-col border-r line glass px-3 py-5">
        <Link to="/" className="px-3 mb-6 block">
          <span className="block text-lg font-bold tracking-tight display">Event Hub</span>
          <span className="block text-xs muted">Red Bull · Event Car</span>
        </Link>
        <nav className="grid gap-0.5">
          {items.map((n) => (
            <Link key={n.to} to={n.to} className={'side-link ' + (isActive(n.to, path) ? 'on' : '')}>
              <n.icon aria-hidden />{n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-3 pt-4 border-t line">
          <p className="text-xs muted truncate" title={profile?.email ?? ''}>{profile?.email}</p>
          <button onClick={signOut} className="mt-2 flex items-center gap-2 text-sm muted hover:text-[var(--fg)]">
            <LogOut className="w-4 h-4" aria-hidden />Odhlásiť
          </button>
        </div>
      </aside>

      <main className="md:pl-60">
        <div className="max-w-3xl mx-auto px-4 pt-4 md:pt-8" style={{ paddingBottom: 'calc(var(--nav-h) + var(--bottom-extra, 0px) + env(safe-area-inset-bottom, 0px) + 2rem)' }}>
          {isAdmin && <Reminders />}
          <Outlet />
        </div>
      </main>

      {/* spodok: lišta stránky (mesiac, ďalší event…) + na mobile hlavné menu */}
      <div className="bottom-wrap fixed inset-x-0 bottom-0 z-30 md:left-60 glass border-t line" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div id="bottom-slot" className="empty:hidden" />
        <nav className="tabbar md:hidden" aria-label="Hlavné menu">
          {tabs.map((n) => (
            <Link key={n.to} to={n.to} className={'tab ' + (isActive(n.to, path) ? 'on' : '')}>
              <n.icon aria-hidden /><span>{n.label}</span>
            </Link>
          ))}
          <Link to="/viac" className={'tab ' + (moreOn ? 'on' : '')}>
            <Ellipsis aria-hidden /><span>Viac</span>
          </Link>
        </nav>
      </div>
    </div>
  )
}
