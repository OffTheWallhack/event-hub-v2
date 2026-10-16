import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Palette } from 'lucide-react'
import { supabase, type Profile, type Role } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { DriveBox } from '../components/DriveBox'
import { BackupBox } from '../components/BackupBox'
import { SyncBox } from '../components/SyncBox'
import { Badge, ErrorText, PageHeader, Section, Seg } from '../components/ui'

const ROLE_LABEL: Record<Role, string> = { pending: 'Čaká', driver: 'Vodič', admin: 'Admin' }
const ROLES = (['pending', 'driver', 'admin'] as Role[]).map((r) => [r, ROLE_LABEL[r]] as const)

export function Users() {
  const { profile: me } = useAuth()
  const [rows, setRows] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at')
    if (error) setError(error.message)
    else setRows(data as Profile[])
  }
  useEffect(() => { load() }, [])

  async function setRole(userId: string, role: Role) {
    setSaving(userId)
    const { error } = await supabase.from('profiles').update({ role }).eq('user_id', userId)
    setSaving(null)
    if (error) setError(error.message)
    else load()
  }

  const pending = rows.filter((r) => r.role === 'pending').length

  return (
    <div className="page">
      <PageHeader title="Nastavenia" />

      <Section
        title="Používatelia"
        sub="Vodič vidí eventy, techniku a kartóny, nič nemení. Financie vidí len admin."
        action={pending > 0 && <Badge tone="warn">{pending} čaká</Badge>}
      >
        <ErrorText>{error}</ErrorText>
        <ul className="list">
          {rows.map((r) => {
            const isMe = r.user_id === me?.user_id
            return (
              <li key={r.user_id} className="py-3 grid gap-2 sm:flex sm:items-center sm:gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{r.name ?? r.email}{isMe && <span className="muted font-normal"> · ty</span>}</p>
                  <p className="text-sm muted truncate">{r.email}</p>
                </div>
                {isMe ? (
                  <Badge className="justify-self-start">{ROLE_LABEL[r.role]}</Badge>
                ) : (
                  <Seg
                    className={'sm:w-64 ' + (saving === r.user_id ? 'opacity-50' : '')}
                    disabled={saving === r.user_id}
                    options={ROLES}
                    value={r.role}
                    onChange={(role) => setRole(r.user_id, role)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      </Section>

      <Link to="/vzhlad" className="card section flex items-center gap-3">
        <span className="w-9 h-9 rounded-[var(--ctl-r)] grid place-items-center bg-[var(--fill-2)]"><Palette className="w-5 h-5" aria-hidden /></span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold">Vzhľad a témy</span>
          <span className="block text-sm muted">Predvoľby, farby, písmo, pozadie</span>
        </span>
        <ChevronRight className="w-5 h-5 muted" aria-hidden />
      </Link>

      <SyncBox isAdmin onSynced={() => {}} />
      <DriveBox />
      <BackupBox />
    </div>
  )
}
