import { useEffect, useRef, useState } from 'react'
import { GripVertical, LayoutList, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { formatScaled } from '../../lib/domain'

interface Props {
  name: string
  weight: string
  weightInvalid: boolean
  average: number | null
  max: number
  onGrab: (event: ReactPointerEvent<HTMLElement>) => void
  onTopic?: () => void
  onWeight: (text: string) => void
  onRename: (name: string) => void
  onDelete: () => void
}

/**
 * Header of one activity column: a handle to drag it to another place, its name (with a menu to see
 * everything about the topic, rename or delete it), the percentage it weighs and the live average.
 */
export function ColumnHeader({ name, weight, weightInvalid, average, max, onGrab, onTopic, onWeight, onRename, onDelete }: Props) {
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
      : <div className="col-title"><span className="col-grip" onPointerDown={onGrab} title="Arrastra para mover la columna" aria-hidden><GripVertical size={14} /></span><button type="button" className="col-name" onClick={() => setOpen(value => !value)} aria-haspopup="menu" aria-expanded={open} title="Opciones de la columna">
          <span>{name}</span><MoreHorizontal size={14} aria-hidden />
        </button></div>}

    <label className={`col-weight${weightInvalid ? ' is-invalid' : ''}`}>
      <input value={weight} inputMode="decimal" placeholder="—" aria-label={`Porcentaje de ${name}`} maxLength={6}
        onChange={event => onWeight(event.target.value)} onFocus={event => event.target.select()} />
      <span aria-hidden>%</span>
    </label>
    <small>{average != null ? `prom. ${formatScaled(average, max)}` : 'sin notas'}</small>

    {open && <div className="col-menu" role="menu">
      {onTopic && <button role="menuitem" onClick={() => { setOpen(false); onTopic() }}><LayoutList size={14} aria-hidden />Ver todo del tema</button>}
      <button role="menuitem" onClick={() => { setOpen(false); setText(name); setRenaming(true) }}><Pencil size={14} aria-hidden />Renombrar</button>
      <button role="menuitem" className="is-danger" onClick={() => { setOpen(false); onDelete() }}><Trash2 size={14} aria-hidden />Eliminar columna</button>
    </div>}
  </div>
}
