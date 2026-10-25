import React from 'react'
import ReactDOM from 'react-dom/client'
import AuthGate from './AuthGate'
import './styles.css'
import './refined-theme.css'
import './redesign.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>,
)
