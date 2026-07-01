import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import MobileWarning from './components/MobileWarning'
import { WebSocketProvider } from './contexts/WebSocketContext'

interface CRMAppProps {
  user?: any
  onLogout?: () => void
}

function App({ user, onLogout }: CRMAppProps) {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024)
  const [currentPage, setCurrentPage] = useState('analytics')

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (!isDesktop) {
    return <MobileWarning />
  }

  return (
    <WebSocketProvider>
      <Dashboard currentPage={currentPage} setCurrentPage={setCurrentPage} currentUser={user} onLogout={onLogout} />
    </WebSocketProvider>
  )
}

export default App
