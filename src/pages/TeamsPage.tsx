import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Plus, Shuffle, Trash2, UsersRound } from 'lucide-react'
import { request, type Project, type Team } from '../api'
import type { PageProps } from '../App'
import { Avatar, EmptyState, Spinner, useFeedback } from '../components/ui'
import { formatGrade, levelShort, plural, type Candidate } from '../lib/domain'
import { ProjectForm, storedSize } from './teams/ProjectForm'

type Draft = { name: string; members: Candidate[]; score: number; explanation: string }
const fallbackScore = { LOW: 2.4, MEDIUM: 3.5, HIGH: 4.5 } as const
const scoreOf = (student: Candidate) => student.hasGrades ? student.average : fallbackScore[student.level]

function balance(members: Candidate[]) {
  if (!members.length) return 0
  const diversity = new Set(members.map(member => member.level)).size / Math.min(3, members.length) * 100
  const scores = members.map(scoreOf)
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length
  const deviation = scores.reduce((s, v) => s + Math.abs(v - mean), 0) / scores.length
  return Math.round(diversity * 0.7 + Math.max(0, 100 - deviation * 25) * 0.3)
}

export default function TeamsPage({ workspace }: PageProps) {
  const { candidates, projects, teams } = workspace
  const { notify, confirm } = useFeedback()
  const [projectId, setProjectId] = useState<number | null>(null)
  const [size, setSize] = useState(storedSize)
  const [picked, setPicked] = useState<number[]>([])
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [working, setWorking] = useState(false)
  const [editing, setEditing] = useState<Project | null | undefined>(undefined)
  const project = projects.find(item => item.id === projectId) ?? null

  useEffect(() => { setPicked(candidates.map(student => student.id)) }, [candidates])
  useEffect(() => { if (!projectId && projects.length) setProjectId(projects[0].id) }, [projects, projectId])
  useEffect(() => { if (project?.teamSize) setSize(project.teamSize) }, [project?.id])

  const selected = candidates.filter(student => picked.includes(student.id))
  const projectTeams = useMemo(() => teams.filter(team => Number(team.project?.id) === Number(projectId)), [teams, projectId])

  const propose = async () => {
    if (selected.length < 2) return notify('Elige al menos dos estudiantes.', 'error')
    setWorking(true)
    const sorted = [...selected].sort((a, b) => scoreOf(b) - scoreOf(a))
    const groups = Array.from({ length: Math.ceil(sorted.length / size) }, (_, i) => ({ name: `Equipo ${i + 1}`, members: [] as Candidate[], total: 0 }))
    for (const student of sorted) {
      const target = groups.filter(group => group.members.length < size).sort((a, b) => a.total - b.total || a.members.length - b.members.length)[0]
      target.members.push(student); target.total += scoreOf(student)
    }
    const analyzed = await Promise.all(groups.map(async group => {
      try {
        const result = await request<{ score: number; explanation: string }>('/api/teams/analyze?strategy=balanced', {
          method: 'POST',
          body: JSON.stringify(group.members.map(member => ({ studentId: member.id, academicScore: scoreOf(member), skillScore: 50, availabilityScore: 50 }))) })
        return { name: group.name, members: group.members, score: balance(group.members), explanation: result.explanation }
      } catch { return { name: group.name, members: group.members, score: balance(group.members), explanation: 'Equilibrado por nivel académico.' } }
    }))
    setDrafts(analyzed)
    setWorking(false)
  }

  const save = async () => {
    if (!project) return notify('Elige o crea un proyecto para guardar los equipos.', 'error')
    setWorking(true)
    let saved = 0
    try {
      for (const draft of drafts) {
        const team = await request<Team>('/api/teams', { method: 'POST', body: JSON.stringify({ name: `${project.name} · ${draft.name}`, project: { id: project.id }, formationStrategy: 'balanced', score: draft.score, explanation: draft.explanation }) })
        for (const member of draft.members) {
          await request('/api/team-students', { method: 'POST', body: JSON.stringify({ id: { teamId: team.id, studentId: member.id }, team: { id: team.id }, student: { id: member.id } }) })
        }
        saved++
      }
      setDrafts([])
      notify(`Guardé ${plural(saved, 'equipo', 'equipos')} en ${project.name}.`)
    } catch (error) {
      notify(`Se guardaron ${saved} equipos antes de un error. ${error instanceof Error ? error.message : ''}`, 'error')
    } finally { setWorking(false); void workspace.loadShared() }
  }

  const removeProject = async (item: Project) => {
    const count = teams.filter(team => Number(team.project?.id) === item.id).length
    const ok = await confirm({ title: `¿Eliminar “${item.name}”?`, body: count ? `Tiene ${plural(count, 'equipo guardado', 'equipos guardados')}. Puede que debas borrarlos primero.` : 'Esta acción no se puede deshacer.', confirm: 'Eliminar proyecto', danger: true })
    if (!ok) return
    try { await request<void>(`/api/projects/${item.id}`, { method: 'DELETE' }); notify('Proyecto eliminado.'); setProjectId(null); void workspace.loadShared() }
    catch (error) { notify(error instanceof Error ? error.message : 'No se pudo eliminar.', 'error') }
  }

  return <section className="page">
    <header className="page-head">
      <div><h1>Equipos</h1><p>Propongo equipos que mezclan niveles para que todos aporten y aprendan. Tú decides antes de guardar.</p></div>
      <div className="page-actions"><button className="btn btn-secondary" onClick={() => setEditing(null)}><Plus size={16} aria-hidden />Nuevo proyecto</button></div>
    </header>

    {!candidates.length ? <div className="panel"><EmptyState icon={<UsersRound size={22} />} title="Primero carga estudiantes" text="Necesito la lista del curso para proponer equipos." action={<a className="btn btn-primary" href="#/estudiantes">Ir a estudiantes</a>} /></div> : <div className="builder">
      <div className="builder-form panel">
        <fieldset className="step"><legend><span className="step-n">1</span>Proyecto</legend>
          {projects.length ? <div className="step-row">
            <select className="grow" value={projectId ?? ''} onChange={event => setProjectId(Number(event.target.value))} aria-label="Proyecto">{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            {project && <><button className="icon-btn" onClick={() => setEditing(project)} aria-label="Editar proyecto"><Pencil size={16} /></button><button className="icon-btn icon-danger" onClick={() => void removeProject(project)} aria-label="Eliminar proyecto"><Trash2 size={16} /></button></>}
          </div> : <p className="step-hint">Crea un proyecto para guardar los equipos. <button className="link-btn" onClick={() => setEditing(null)}>Crear proyecto</button></p>}
          {project?.description && <p className="step-hint">{project.description}</p>}
        </fieldset>
        <fieldset className="step"><legend><span className="step-n">2</span>Personas por equipo</legend>
          <div className="size-picker" role="radiogroup" aria-label="Personas por equipo">{[2, 3, 4, 5, 6].map(value => <button key={value} type="button" role="radio" aria-checked={size === value} className={size === value ? 'is-on' : ''} onClick={() => { setSize(value); localStorage.setItem('fairteam.defaultTeamSize', String(value)) }}>{value}</button>)}</div>
          <p className="step-hint">{selected.length ? `${plural(Math.ceil(selected.length / size), 'equipo', 'equipos')} con ${selected.length} estudiantes. El último puede quedar más pequeño.` : 'Elige estudiantes abajo.'}</p>
        </fieldset>
        <fieldset className="step"><legend><span className="step-n">3</span>Quiénes participan <button type="button" className="link-btn" onClick={() => setPicked(picked.length === candidates.length ? [] : candidates.map(s => s.id))}>{picked.length === candidates.length ? 'Quitar todos' : 'Elegir todos'}</button></legend>
          <ul className="pick-list">{candidates.map(student => <li key={student.id}><label className="pick">
            <input type="checkbox" checked={picked.includes(student.id)} onChange={() => setPicked(current => current.includes(student.id) ? current.filter(id => id !== student.id) : [...current, student.id])} />
            <span className="check" aria-hidden>{picked.includes(student.id) && <Check size={12} strokeWidth={3} />}</span>
            <span className="pick-name">{student.name}</span>
            <span className={`dot dot-${student.hasGrades ? student.level.toLowerCase() : 'none'}`} title={student.hasGrades ? levelShort[student.level] : 'Sin notas'} />
          </label></li>)}</ul>
        </fieldset>
        <button className="btn btn-primary btn-large" onClick={() => void propose()} disabled={working || selected.length < 2}>{working && !drafts.length ? <Spinner /> : <Shuffle size={18} aria-hidden />}Proponer equipos</button>
      </div>

      <div className="builder-result">
        {drafts.length ? <div className="panel">
          <header className="panel-head"><h2>Propuesta</h2><span className="count">{drafts.length}</span><button className="btn btn-ghost btn-small push" onClick={() => void propose()}><Shuffle size={15} aria-hidden />Otra vez</button></header>
          <div className="teams">{drafts.map(draft => <article key={draft.name} className="team">
            <header><b>{draft.name}</b><span className="num">{draft.score}% equilibrio</span></header>
            {draft.explanation && <p className="team-why">{draft.explanation}</p>}
            <ul>{draft.members.map(member => <li key={member.id}><Avatar name={member.name} size={26} /><span>{member.name}</span><span className="num muted">{member.hasGrades ? formatGrade(member.average) : '—'}</span></li>)}</ul>
          </article>)}</div>
          <button className="btn btn-primary btn-large" onClick={() => void save()} disabled={working || !project}>{working ? <Spinner /> : <Check size={18} aria-hidden />}{project ? `Guardar en ${project.name}` : 'Elige un proyecto para guardar'}</button>
        </div> : <div className="panel preview"><EmptyState art="think" title="La propuesta aparecerá aquí" text="Reparto a los estudiantes para que cada equipo tenga una mezcla de niveles parecida." /></div>}

        {projectTeams.length > 0 && <div className="panel">
          <header className="panel-head"><h2>Guardados en {project?.name}</h2><span className="count">{projectTeams.length}</span></header>
          <ul className="saved-teams">{projectTeams.map(team => <li key={team.id}><b>{team.name}</b>{team.score != null && <span className="num muted">{Math.round(Number(team.score))}%</span>}</li>)}</ul>
        </div>}
      </div>
    </div>}

    {editing !== undefined && <ProjectForm project={editing} onClose={() => setEditing(undefined)} onSaved={created => { setEditing(undefined); if (created) setProjectId(created.id); void workspace.loadShared() }} />}
  </section>
}

