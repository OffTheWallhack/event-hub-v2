import { Link } from '@tanstack/react-router'
import { ChevronRight, LogOut } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { NAV } from '../components/Layout'
import { PageHeader } from '../components/ui'

/** Mobil: všetko, čo sa nezmestilo do spodného menu, plus účet. */
export function More() {
  const { profile, isAdmin, signOut } = useAuth()
  const items = NAV.filter((n) => !n.tab && (!n.admin || isAdmin))
  return (
    <div className="page">
      <PageHeader title="Viac" />
      <nav className="card list" aria-label="Ďalšie stránky">
        {items.map((n) => (
          <Link key={n.to} to={n.to} className="flex items-center gap-3 px-4 h-14">
            <span className="w-9 h-9 rounded-[var(--ctl-r)] grid place-items-center bg-[var(--fill-2)]">
              <n.icon className="w-5 h-5" aria-hidden />
            </span>
            <span className="flex-1 font-medium">{n.label}</span>
            <ChevronRight className="w-5 h-5 muted" aria-hidden />
          </Link>
        ))}
      </nav>

      <div className="card section flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{profile?.name ?? profile?.email}</p>
          <p className="text-sm muted truncate">{profile?.email} · {isAdmin ? 'admin' : 'vodič'}</p>
        </div>
        <button onClick={signOut} className="btn btn-sm"><LogOut aria-hidden />Odhlásiť</button>
      </div>
      <p className="text-xs muted text-center">Event Hub v{__APP_VERSION__}</p>
    </div>
  )
}
