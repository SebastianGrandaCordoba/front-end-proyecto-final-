import { useState } from 'react'
import Owl, { type OwlPose } from './Owl'
import { Modal } from './ui'

const steps: { pose: OwlPose; title: string; text: string }[] = [
  { pose: 'wave', title: 'Hola, soy el Búho', text: 'Te acompaño en cada curso: te digo quién necesita apoyo, en qué tema y qué hacer primero.' },
  { pose: 'read', title: 'Empieza por tus datos', text: 'Crea un curso e importa la lista y las notas desde Excel. Con eso ya puedo ayudarte.' },
  { pose: 'think', title: 'Pregúntame lo que quieras', text: 'Ábreme con Ctrl + K o con el botón Búho. Puedes escribirme o hablarme: “¿quién viene bajando?”.' },
  { pose: 'celebrate', title: 'Llega a clase con todo listo', text: 'Creo talleres y quizzes con tu material, y tú los revisas antes de usarlos.' },
]

/** Four-step welcome shown once per teacher account. */
export default function Welcome({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const step = steps[index]
  const last = index === steps.length - 1
  return <Modal title={step.title} onClose={onClose} size="small">
    <div className="welcome">
      <Owl pose={step.pose} size={150} />
      <p>{step.text}</p>
      <div className="welcome-dots" aria-label={`Paso ${index + 1} de ${steps.length}`}>{steps.map((_, i) => <i key={i} className={i === index ? 'is-on' : ''} />)}</div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Saltar</button>
        <button className="btn btn-primary" onClick={() => last ? onClose() : setIndex(index + 1)}>{last ? 'Empezar' : 'Siguiente'}</button>
      </div>
    </div>
  </Modal>
}
