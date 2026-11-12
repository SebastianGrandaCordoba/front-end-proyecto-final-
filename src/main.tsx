import React from 'react'
import ReactDOM from 'react-dom/client'
import AuthGate from './AuthGate'
import '@fontsource-variable/besley'
import '@fontsource-variable/figtree'
import './styles.css'
import { applyTheme, watchSystemTheme } from './lib/theme'

applyTheme()
watchSystemTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>,
)
