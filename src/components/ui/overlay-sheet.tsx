'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

type OverlaySheetProps = {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  disableOutsideClose?: boolean
}

export default function OverlaySheet({
  open,
  onClose,
  title,
  description,
  children,
  disableOutsideClose = false,
}: OverlaySheetProps) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
        onClick={() => {
          if (!disableOutsideClose) onClose()
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title ?? '編集'}
        className="fixed right-0 top-0 z-[70] flex h-dvh w-full max-w-[720px] flex-col border-l bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b bg-white p-4">
          <h3 className="text-lg font-semibold text-slate-900">{title ?? '編集'}</h3>
          {description ? (
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
      </aside>
    </>,
    document.body,
  )
}
