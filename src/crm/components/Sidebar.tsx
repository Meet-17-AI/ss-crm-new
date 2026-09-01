import { BarChart3, Columns3, Users, ClipboardCheck } from 'lucide-react'
import { Logo } from '../../../components/Logo'
import { DashboardSwitcher } from '../../../components/DashboardSwitcher'

interface SidebarProps {
  currentPage: string
  setCurrentPage: (page: string) => void
}

// The account menu used to live at the foot of this sidebar; it is now in the
// global Header. What remains down there is the dashboard switcher.
const Sidebar = ({ currentPage, setCurrentPage }: SidebarProps) => {
  return (
    <div className="w-64 bg-white border-r flex flex-col h-screen overflow-hidden">
      <div className="p-6 flex justify-center">
        <Logo size="small" />
      </div>

      <nav className="flex-1 px-4">

        <div
          className={`rounded-lg px-4 py-3 mb-2 flex items-center gap-3 cursor-pointer ${
            currentPage === 'analytics' ? 'text-teal-700' : 'text-gray-700 hover:bg-gray-100'
          }`}
          style={{ backgroundColor: currentPage === 'analytics' ? '#2D75795C' : 'transparent' }}
          onClick={() => setCurrentPage('analytics')}
        >
          <BarChart3 className="w-5 h-5 flex-shrink-0" />
          <span className={currentPage === 'analytics' ? 'text-teal-700' : 'text-gray-700'}>Analytics</span>
        </div>
        <div
          className={`rounded-lg px-4 py-3 mb-2 flex items-center gap-3 cursor-pointer ${
            currentPage === 'pipeline' ? 'text-teal-700' : 'text-gray-700 hover:bg-gray-100'
          }`}
          style={{ backgroundColor: currentPage === 'pipeline' ? '#2D75795C' : 'transparent' }}
          onClick={() => setCurrentPage('pipeline')}
        >
          <Columns3 className="w-5 h-5 flex-shrink-0" />
          <span className={currentPage === 'pipeline' ? 'text-teal-700' : 'text-gray-700'}>Pipeline</span>
        </div>
        <div
          className={`rounded-lg px-4 py-3 mb-2 flex items-center gap-3 cursor-pointer ${
            currentPage === 'leads' ? 'text-teal-700' : 'text-gray-700 hover:bg-gray-100'
          }`}
          style={{ backgroundColor: currentPage === 'leads' ? '#2D75795C' : 'transparent' }}
          onClick={() => setCurrentPage('leads')}
        >
          <Users className="w-5 h-5 flex-shrink-0" />
          <span className={currentPage === 'leads' ? 'text-teal-700' : 'text-gray-700'}>Leads</span>
        </div>
        <div
          className={`rounded-lg px-4 py-3 mb-2 flex items-center gap-3 cursor-pointer ${
            currentPage === 'pretherapy' ? 'text-teal-700' : 'text-gray-700 hover:bg-gray-100'
          }`}
          style={{ backgroundColor: currentPage === 'pretherapy' ? '#2D75795C' : 'transparent' }}
          onClick={() => setCurrentPage('pretherapy')}
        >
          <ClipboardCheck className="w-5 h-5 flex-shrink-0" />
          <span className={currentPage === 'pretherapy' ? 'text-teal-700' : 'text-gray-700'}>Pre-therapy Bookings</span>
        </div>
        <div
          className={`rounded-lg px-4 py-3 mb-2 flex items-center gap-3 cursor-pointer ${
            currentPage === 'audit-logs' ? 'text-teal-700' : 'text-gray-700 hover:bg-gray-100'
          }`}
          style={{ backgroundColor: currentPage === 'audit-logs' ? '#2D75795C' : 'transparent' }}
          onClick={() => setCurrentPage('audit-logs')}
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span className={currentPage === 'audit-logs' ? 'text-teal-700' : 'text-gray-700'}>Audit Logs</span>
        </div>
      </nav>

      {/* Renders nothing unless this user holds a dashboard beyond the CRM, in
          which case the whole footer collapses with it. */}
      <div className="border-t p-4 empty:hidden">
        <DashboardSwitcher />
      </div>
    </div>
  )
}

export default Sidebar
