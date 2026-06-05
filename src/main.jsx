import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// StrictMode intentionally omitted: it double-invokes effects in dev,
// which would fire the OAuth code exchange twice (second call fails) and
// register two Web Playback SDK devices.
createRoot(document.getElementById('root')).render(<App />)
