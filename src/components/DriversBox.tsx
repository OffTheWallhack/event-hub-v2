import { useEffect, useState } from 'react'
import { Section, ErrorText } from './ui'
import { supabase } from '../lib/supabase'

type Driver = { id: string; name: string; is_me: boolean; active: boolean }

/**
 * Zoznam vodičov: vypnutý vodič sa nezobrazuje na výber na eventoch, ale ostáva v databáze
 * (staré eventy, výplaty a exporty o ňom stále vedia). Na evente, kde už je pridaný, ostane viditeľný.
 */
export function DriversBox() {
  const [rows, setRows] = useState<Driver[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('drivers').select('id, name, is_me, active').order('name').then(({ data, error }) => {
      if (error) setError(error.message)
      else setRows(data as Driver[])
    })
  }, [])

  async function toggle(d: Driver) {
    const active = !d.active
    setError(null)
    setRows((l) => l.map((x) => (x.id === d.id ? { ...x, active } : x)))
    const { error } = await supabase.from('drivers').update({ active }).eq('id', d.id)
    if (error) {
      setError(error.message)
      setRows((l) => l.map((x) => (x.id === d.id ? { ...x, active: d.active } : x)))
    }
  }

  const hidden = rows.filter((r) => !r.active).length

  return (
    <Section title="Vodiči" sub={`Vypnutý vodič sa nebude ponúkať na evente, v dátach ostáva.${hidden ? ` Skrytých: ${hidden}.` : ''}`}>
      <ErrorText>{error}</ErrorText>
      <ul className="list">
        {rows.map((d) => (
          <li key={d.id} className="row">
            <span className={'flex-1 min-w-0 truncate font-medium ' + (d.active ? '' : 'muted line-through')}>
              {d.name}{d.is_me && <span className="muted font-normal"> · ja</span>}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={d.active}
              disabled={d.is_me}
              onClick={() => toggle(d)}
              className={'chip ' + (d.active ? 'on' : '')}
              title={d.is_me ? 'Seba skryť nemôžeš' : undefined}
            >
              {d.active ? 'V appke' : 'Skrytý'}
            </button>
          </li>
        ))}
      </ul>
    </Section>
  )
}
