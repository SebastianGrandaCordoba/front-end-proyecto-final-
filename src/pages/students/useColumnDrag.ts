import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

/**
 * Reorders grade book columns by dragging their header (mouse, pen or touch). While dragging, the other
 * columns slide out of the way with a FLIP animation: positions are measured before React re-renders and
 * the cells are moved back and released, so they glide to their new place instead of jumping.
 */
export function useColumnDrag(table: RefObject<HTMLTableElement | null>, ids: number[], move: (from: number, to: number) => void) {
  const [dragging, setDragging] = useState<number | null>(null)
  const positions = useRef(new Map<number, number>())
  const state = useRef<{ id: number; pointerX: number; startX: number; offset: number } | null>(null)

  const measure = useCallback(() => {
    positions.current.clear()
    table.current?.querySelectorAll<HTMLElement>('thead th[data-colid]').forEach(th => {
      positions.current.set(Number(th.dataset.colid), th.getBoundingClientRect().left)
    })
  }, [table])

  // After every reorder: slide each moved column from its old place to the new one.
  useLayoutEffect(() => {
    const root = table.current
    if (!root || !positions.current.size) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    root.querySelectorAll<HTMLElement>('thead th[data-colid]').forEach(th => {
      const id = Number(th.dataset.colid)
      const before = positions.current.get(id)
      if (before == null) return
      const delta = before - th.getBoundingClientRect().left
      if (!delta || reduce || id === state.current?.id) return
      root.querySelectorAll<HTMLElement>(`[data-colid="${id}"]`).forEach(cell => {
        cell.style.transition = 'none'
        cell.style.transform = `translateX(${delta}px)`
        requestAnimationFrame(() => {
          cell.style.transition = 'transform 220ms cubic-bezier(.2,.8,.2,1)'
          cell.style.transform = ''
        })
      })
    })
    positions.current.clear()
  }, [ids.join(','), table]) // eslint-disable-line react-hooks/exhaustive-deps

  const follow = useCallback((x: number) => {
    const drag = state.current
    const root = table.current
    if (!drag || !root) return
    const offset = x - drag.startX
    drag.offset = offset
    root.querySelectorAll<HTMLElement>(`[data-colid="${drag.id}"]`).forEach(cell => { cell.style.transition = 'none'; cell.style.transform = `translateX(${offset}px)` })
    const headers = [...root.querySelectorAll<HTMLElement>('thead th[data-colid]')]
    const from = headers.findIndex(th => Number(th.dataset.colid) === drag.id)
    // The dragged header moves with the pointer, so compare against the others: crossing the middle of a
    // neighbour takes its place.
    let target = from
    headers.forEach((th, i) => {
      if (i === from) return
      const box = th.getBoundingClientRect()
      const middle = box.left + box.width / 2
      if (i > from && x > middle) target = Math.max(target, i)
      if (i < from && x < middle) target = target > from ? target : Math.min(target, i)
    })
    if (target === from) return
    const naturalBefore = headers[from].getBoundingClientRect().left - drag.offset
    measure()
    move(from, target)
    // Keep the dragged column under the pointer: its resting place moved, so its offset must shrink.
    requestAnimationFrame(() => {
      const moved = root.querySelector<HTMLElement>(`thead th[data-colid="${drag.id}"]`)
      if (moved) drag.startX += moved.getBoundingClientRect().left - drag.offset - naturalBefore
      follow(drag.pointerX)
    })
  }, [measure, move, table])

  const onPointerDown = useCallback((id: number) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    state.current = { id, pointerX: event.clientX, startX: event.clientX, offset: 0 }
    setDragging(id)
    const onMove = (e: PointerEvent) => { if (state.current) { state.current.pointerX = e.clientX; follow(e.clientX) } }
    const onUp = () => {
      const root = table.current
      const drag = state.current
      if (root && drag) {
        root.querySelectorAll<HTMLElement>(`[data-colid="${drag.id}"]`).forEach(cell => {
          cell.style.transition = 'transform 180ms cubic-bezier(.2,.8,.2,1)'
          cell.style.transform = ''
        })
      }
      state.current = null
      setDragging(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [follow, table])

  return { dragging, onPointerDown }
}
