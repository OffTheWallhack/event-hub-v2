import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Lišta stránky nad spodným menu (prepínanie mesiaca, ďalší event…). Vloží sa do #bottom-slot v Layoute.
 * Kým je zobrazená, Layout pridá dole miesto (--bottom-extra), aby nezakrývala obsah.
 */
export function BottomBar({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setEl(document.getElementById('bottom-slot'))
    document.documentElement.style.setProperty('--bottom-extra', '64px')
    return () => { document.documentElement.style.removeProperty('--bottom-extra') }
  }, [])
  return el ? createPortal(<div className="max-w-3xl mx-auto px-4 py-2.5 md:py-3">{children}</div>, el) : null
}
