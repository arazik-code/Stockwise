import './i18n'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import App from './App'
import './index.css'
import { initTheme } from './store/themeStore'
import { runPerfProbe } from './design/perfProbe'

// Re-assert stored appearance preferences and start watching the OS theme.
// The blocking script in index.html has already painted the right background;
// this keeps the store and the DOM in agreement from here on.
initTheme()

// Measure this machine's blur cost and pick a graphics tier. Deferred past
// first paint so it never delays the login screen, and it respects an explicit
// user choice from Settings.
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(() => void runPerfProbe(), { timeout: 3000 })
} else {
  setTimeout(() => void runPerfProbe(), 1200)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
      reducedMotion="user" degrades every Framer animation automatically when
      the OS asks for it. This is layer 1 of 3 - the others are the CSS block
      in components.css and the Settings toggle. See the direction rule in
      themeStore.setMotion: the app may only ever reduce, never restore.
    */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>
)
