import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Miesto v Layoute pre spodnú pevnú lištu. Každá stránka do nej vloží svoj obsah cez <BottomBar>. */
export function BottomSlot() {
  return (
    <div
      id="bottom-slot"
      className="fixed left-0 right-0 bottom-0 z-30 border-t line glass empty:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    />
  )
}

export function BottomBar({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => { setEl(document.getElementById('bottom-slot')) }, [])
  return el ? createPortal(<div className="max-w-6xl mx-auto px-3 py-2">{children}</div>, el) : null
}
