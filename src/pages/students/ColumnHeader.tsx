import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { formatScaled } from '../../lib/domain'

interface Props {
  name: string
  weight: string
  weightInvalid: boolean
  average: number | null
  max: number
  first: boolean
  last: boolean
  onWeight: (text: string) => void
  onRename: (name: string) => void
  onMove: (step: -1 | 1) => void
  onDelete: () => void
}

/**
 * Header of one activity column: its name (with a small menu to rename, move or delete it),
 * the percentage it weighs in the corte and the live average of the column.
 */
export function ColumnHeader({ name, weight, weightInvalid, average, max, first, last, onWeight, onRename, onMove, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [text, setText] = useState(name)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape) }
  }, [open])

  const finishRename = () => {
    setRenaming(false)
    const clean = text.trim().replace(/\s+/g, ' ')
    if (clean && clean !== name) onRename(clean)
    else setText(name)
  }

  return <div className="col-head" ref={box}>
    {renaming
      ? <input className="col-rename" value={text} autoFocus maxLength={100} aria-label="Nuevo nombre de la columna"
          onChange={event => setText(event.target.value)} onBlur={finishRename}
          onKeyDown={event => { if (event.key === 'Enter') finishRename(); if (event.key === 'Escape') { setText(name); setRenaming(false) } }} />
      : <button type="button" className="col-name" onClick={() => setOpen(value => !value)} aria-haspopup="menu" aria-expanded={open} title="Opciones de la columna">
          <span>{name}</span><MoreHorizontal size={14} aria-hidden />
        </button>}

    <label className={`col-weight${weightInvalid ? ' is-invalid' : ''}`}>
      <input value={weight} inputMode="decimal" placeholder="—" aria-label={`Porcentaje de ${name}`} maxLength={6}
        onChange={event => onWeight(event.target.value)} onFocus={event => event.target.select()} />
      <span aria-hidden>%</span>
    </label>
    <small>{average != null ? `prom. ${formatScaled(average, max)}` : 'sin notas'}</small>

    {open && <div className="col-menu" role="menu">
      <button role="menuitem" onClick={() => { setOpen(false); setText(name); setRenaming(true) }}><Pencil size={14} aria-hidden />Renombrar</button>
      <button role="menuitem" disabled={first} onClick={() => { setOpen(false); onMove(-1) }}><ArrowLeft size={14} aria-hidden />Mover a la izquierda</button>
      <button role="menuitem" disabled={last} onClick={() => { setOpen(false); onMove(1) }}><ArrowRight size={14} aria-hidden />Mover a la derecha</button>
      <button role="menuitem" className="is-danger" onClick={() => { setOpen(false); onDelete() }}><Trash2 size={14} aria-hidden />Eliminar columna</button>
    </div>}
  </div>
}
