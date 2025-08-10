import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Force dark theme for cyberpunk experience
document.documentElement.classList.add('dark')

document.title = 'Bakhtak Music — Futuristic Online Audio Effects & Visualizer'

createRoot(document.getElementById("root")!).render(<App />);
