import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ClickSpark } from './components/ClickSpark'
import './index.css'

// HashRouter, not BrowserRouter: the packaged app is served from file://,
// where path-based routing 404s on reload.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ClickSpark sparkColor="#0891b2" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
        <App />
      </ClickSpark>
    </HashRouter>
  </StrictMode>,
)
