import { Component, type ReactNode } from 'react'
import Owl from './Owl'

/** Keeps a rendering error in one screen from blanking the whole app. */
export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) { return { error } }

  componentDidUpdate(previous: { resetKey?: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  componentDidCatch(error: Error) { console.error('FairTeam screen error', error) }

  render() {
    if (!this.state.error) return this.props.children
    return <section className="page"><div className="empty empty-page">
      <Owl pose="think" size={140} />
      <strong>Algo salió mal en esta pantalla</strong>
      <p>Tus datos están a salvo. Recarga la página o vuelve al inicio.</p>
      <div className="empty-action"><button className="btn btn-primary" onClick={() => window.location.reload()}>Recargar</button> <a className="btn btn-ghost" href="#/inicio">Ir al inicio</a></div>
    </div></section>
  }
}
