import Sidebar from './Sidebar'
import DashboardContent from './DashboardContent'
import PipelineContent from './PipelineContent'
import LeadsContent from './LeadsContent'
import LeadProfile from './LeadProfile'
import PreTherapyBookings from './PreTherapyBookings'
import { AdminEditProfile } from '../../../components/AdminEditProfile'
import { ChangePassword } from '../../../components/ChangePassword'
import { CRMAuditLogs } from './CRMAuditLogs'
import ToDoModal from './ToDoModal'
import { Toast } from '../../../components/Toast'
import { useSocket } from '../contexts/WebSocketContext'
import { useState, useEffect } from 'react'

interface DashboardProps {
  currentPage: string
  setCurrentPage: (page: string) => void
  currentUser: any
  onLogout?: () => void
}

const Dashboard = ({ currentPage, setCurrentPage, currentUser, onLogout }: DashboardProps) => {
  const { socket } = useSocket()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null)

  useEffect(() => {
    if (!socket) return

    const handleLeadUpdated = () => {
      setToast({ message: 'A lead was updated in real-time.', type: 'info' })
    }

    const handleLeadCreated = () => {
      setToast({ message: 'New lead received!', type: 'success' })
    }

    socket.on('lead_updated', handleLeadUpdated)
    socket.on('lead_created', handleLeadCreated)

    return () => {
      socket.off('lead_updated', handleLeadUpdated)
      socket.off('lead_created', handleLeadCreated)
    }
  }, [socket])

  return (
    <div className="flex h-screen bg-gray-50">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type as 'success' | 'error'}
          onClose={() => setToast(null)}
        />
      )}
      <div className="w-64 flex-shrink-0">
        <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} currentUser={currentUser} onLogout={onLogout} />
      </div>
      <div className={`flex-1 ${currentPage === 'pipeline' ? 'overflow-hidden flex flex-col' : 'overflow-auto'}`}>
        {currentPage === 'analytics' && <DashboardContent currentUser={currentUser} setCurrentPage={setCurrentPage} />}
        {currentPage === 'pipeline' && <PipelineContent currentUser={currentUser} setCurrentPage={setCurrentPage} />}
        {currentPage === 'leads' && <LeadsContent setCurrentPage={setCurrentPage} />}
        {currentPage.startsWith('lead-profile:') && (
          <LeadProfile
            leadId={currentPage.split(':')[1]}
            onBack={() => setCurrentPage(currentPage.split(':')[2] || 'leads')}
            setCurrentPage={setCurrentPage}
            currentUser={currentUser}
            source={currentPage.split(':')[2] || 'leads'}
          />
        )}
        {currentPage === 'pretherapy' && <PreTherapyBookings currentUser={currentUser} setCurrentPage={setCurrentPage} />}
        {currentPage === 'audit-logs' && <CRMAuditLogs />}
        {currentPage === 'full-todo' && (
          <ToDoModal 
            isFullPage={true} 
            setCurrentPage={setCurrentPage}
            onViewLead={(leadId) => setCurrentPage(`lead-profile:${leadId}:full-todo`)}
          />
        )}
        {currentPage === 'settings' && (
          <AdminEditProfile user={currentUser} onBack={() => setCurrentPage('analytics')} />
        )}
        {currentPage === 'changePassword' && (
          <ChangePassword user={currentUser} onBack={() => setCurrentPage('analytics')} />
        )}
      </div>
    </div>
  )
}

export default Dashboard
