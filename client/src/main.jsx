import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Remove StrictMode wrapper so components mount only once
createRoot(document.getElementById('root')).render(
  <App />
)
