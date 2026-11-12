import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

/** What the grade book draws while a column is being dragged. */
export type ColumnDragView = {
  id: number
  /** Card that follows the pointer. */
  ghost: { left: number; top: number; width: number; height: number }
  /** Vertical line where the column will land; null while it would stay where it is. */
  line: { left: number; top: number; height: number } | null
}

const START_DISTANCE = 4
const EDGE = 48

/**
 * Reorders grade book columns by dragging their handle (mouse, pen or touch), like a spreadsheet: the column
 * stays in place (dimmed), a card follows the pointer and a line shows where it will land. The order changes
 * once, on drop, and every moved column glides to its new place (FLIP). Near the edges the table scrolls.
 */
export function useColumnDrag(table: RefObject<HTMLTableElement | null>, ids: number[], move: (from: number, to: number) => void) {
  const [view, setView] = useState<ColumnDragView | null>(null)
  const positions = useRef(new Map<number, number>())

  // After a drop: slide each moved column from where it was to where it is now.
  useLayoutEffect(() => {
    const root = table.current
    if (!root || !positions.current.size) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    root.querySelectorAll<HTMLElement>('thead th[data-colid]').forEach(th => {
      const id = Number(th.dataset.colid)
      const before = positions.current.get(id)
      const delta = before == null ? 0 : before - th.getBoundingClientRect().left
      if (!delta || reduce) return
      root.querySelectorAll<HTMLElement>(`[data-colid="${id}"]`).forEach(cell => {
        cell.style.transition = 'none'
        cell.style.transform = `translateX(${delta}px)`
        requestAnimationFrame(() => requestAnimationFrame(() => {
          cell.style.transition = 'transform 240ms cubic-bezier(.2,.8,.2,1)'
          cell.style.transform = ''
          const clear = () => { cell.style.transition = ''; cell.removeEventListener('transitionend', clear) }
          cell.addEventListener('transitionend', clear)
        }))
      })
    })
    positions.current.clear()
  }, [ids.join(','), table]) // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = useCallback((id: number) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const root = table.current
    const header = root?.querySelector<HTMLElement>(`thead th[data-colid="${id}"]`)
    if (!root || !header) return
    event.preventDefault()
    const scroller = root.closest<HTMLElement>('.sheet-scroll')
    const startX = event.clientX
    const startY = event.clientY
    const box = header.getBoundingClientRect()
    const grabOffset = startX - box.left
    let active = false
    let target = -1
    let frame = 0
    let pointerX = startX

    const others = () => [...root.querySelectorAll<HTMLElement>('thead th[data-colid]')].filter(th => Number(th.dataset.colid) !== id)

    const update = () => {
      const headers = others()
      const from = ids.indexOf(id)
      // Landing index among the other columns: how many of their middles lie left of the pointer.
      target = headers.filter(th => { const r = th.getBoundingClientRect(); return r.left + r.width / 2 < pointerX }).length
      const tableBox = root.getBoundingClientRect()
      const scrollBox = scroller?.getBoundingClientRect() ?? tableBox
      const top = Math.max(tableBox.top, scrollBox.top)
      const height = Math.min(tableBox.bottom, scrollBox.bottom) - top
      let line: ColumnDragView['line'] = null
      if (target !== from && headers.length) {
        const edge = target === 0 ? headers[0].getBoundingClientRect().left : headers[target - 1].getBoundingClientRect().right
        line = { left: edge - 1.5, top, height }
      }
      const width = Math.min(box.width, 240)
      const left = Math.max(scrollBox.left, Math.min(pointerX - Math.min(grabOffset, width - 16), scrollBox.right - width))
      setView({ id, ghost: { left, top: box.top, width, height: box.height }, line })
    }

    // Near either side of the visible area the table scrolls so far columns can be reached.
    const autoScroll = () => {
      if (!active || !scroller) return
      const r = scroller.getBoundingClientRect()
      const speed = pointerX > r.right - EDGE ? 14 : pointerX < r.left + EDGE + 220 ? -14 : 0
      if (speed && scroller.scrollWidth > scroller.clientWidth) { scroller.scrollLeft += speed; update() }
      frame = requestAnimationFrame(autoScroll)
    }

    const onMove = (e: PointerEvent) => {
      pointerX = e.clientX
      if (!active) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < START_DISTANCE) return
        active = true
        frame = requestAnimationFrame(autoScroll)
      }
      update()
    }
    const finish = (drop: boolean) => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey)
      setView(null)
      const from = ids.indexOf(id)
      if (!drop || !active || target < 0 || target === from) return
      positions.current.clear()
      root.querySelectorAll<HTMLElement>('thead th[data-colid]').forEach(th => positions.current.set(Number(th.dataset.colid), th.getBoundingClientRect().left))
      move(from, target)
    }
    const onUp = () => finish(true)
    const onCancel = () => finish(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(false) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
  }, [ids, move, table])

  return { dragging: view?.id ?? null, view, onPointerDown }
}
