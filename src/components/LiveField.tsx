import { useEffect, useRef, useState } from 'react'

/**
 * Pole, ktoré sa ukladá samo: text sa uloží krátko po tom, čo prestaneš písať, a hneď pri opustení poľa.
 * Hodnotu zvonku (value) prijme späť vždy, keď pole nie je práve v úprave.
 */
export function LiveField({ value, onSave, multiline, rows = 3, delay = 700, type = 'text', inputMode, placeholder, className = '', disabled, min }: {
  value: string
  onSave: (v: string) => void
  multiline?: boolean
  rows?: number
  delay?: number
  type?: string
  inputMode?: 'numeric' | 'url' | 'text' | 'decimal'
  placeholder?: string
  className?: string
  disabled?: boolean
  min?: number
}) {
  const [v, setV] = useState(value)
  const focused = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const known = useRef(value) // posledná hodnota, o ktorej vieme, že je uložená
  const latest = useRef(value)
  const save = useRef(onSave)
  save.current = onSave

  useEffect(() => {
    if (!focused.current) { setV(value); known.current = value; latest.current = value }
  }, [value])

  const flush = () => {
    window.clearTimeout(timer.current)
    if (latest.current !== known.current) { known.current = latest.current; save.current(latest.current) }
  }
  // pri odchode zo stránky sa rozpísané ešte uloží
  useEffect(() => () => { window.clearTimeout(timer.current); if (latest.current !== known.current) save.current(latest.current) }, [])

  const change = (next: string) => {
    setV(next); latest.current = next
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, delay)
  }
  const common = {
    value: v,
    disabled,
    placeholder,
    className: 'input ' + className,
    onChange: (e: { target: { value: string } }) => change(e.target.value),
    onFocus: () => { focused.current = true },
    onBlur: () => { focused.current = false; flush() },
  }
  return multiline
    ? <textarea rows={rows} {...common} />
    : <input type={type} inputMode={inputMode} min={min} {...common} />
}
