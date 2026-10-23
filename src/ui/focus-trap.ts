import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.getAttribute('aria-hidden') === 'true') return false
    return element.getClientRects().length > 0
  })
}

/**
 * Keeps keyboard focus inside a temporary overlay and returns it to the trigger
 * when that overlay unmounts.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, initialFocusRef?: RefObject<HTMLElement | null>): void {
  const previousFocusRef = useRef<HTMLElement | null>(null)
  if (previousFocusRef.current === null && document.activeElement instanceof HTMLElement) {
    previousFocusRef.current = document.activeElement
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const focusFrame = window.requestAnimationFrame(() => {
      const initial = initialFocusRef?.current
      const first = initial && !initial.hasAttribute('disabled') ? initial : getFocusableElements(container)[0]
      first?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const focusable = getFocusableElements(container)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      container.removeEventListener('keydown', handleKeyDown)
      const previousFocus = previousFocusRef.current
      if (previousFocus?.isConnected) {
        window.requestAnimationFrame(() => previousFocus.focus())
      }
    }
  }, [containerRef, initialFocusRef])
}
