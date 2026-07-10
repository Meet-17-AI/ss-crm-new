import { useState, useEffect, useMemo } from 'react'
import { Search, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import AddLeadModal from './AddLeadModal'
import MonthFilter from './MonthFilter'
import { useSocket } from '../contexts/WebSocketContext'
import './LeadsContent.css'
import './MonthFilter.css'
import { Loader } from '../../../components/Loader'

interface Lead {
  id: string
  name: string
  phone: string
  email: string
  source: string
  leadManager: string
  assignedTherapist: string
  status: string
  stage: string
  remarks: string
  createdDate: string
}

const STAGES = [
  { id: 'all', label: 'All Leads' },
  { id: 'lead-inquire', label: 'Lead / Inquire' },
  { id: 'pretherapy-call', label: 'Pre-therapy Call' },
  { id: 'followup-1', label: 'Follow Ups' },
  { id: 'booked-first-session', label: 'Booked First Session' },
  { id: 'referred', label: 'Referred' },
  { id: 'closed', label: 'Closed' },
  { id: 'dropouts', label: 'Dropouts' }
]

const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  STAGES.filter(s => s.id !== 'all').map(s => [s.id, s.label])
)

interface LeadsContentProps {
  setCurrentPage?: (page: string) => void
}

const LeadsContent = ({ setCurrentPage }: LeadsContentProps) => {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('All Time')
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const { socket } = useSocket()

  useEffect(() => {
    if (!socket) return

    const handleLeadUpdated = () => {
      console.log('🔄 WebSocket: Lead updated, refreshing leads...')
      setRefreshTrigger(prev => prev + 1)
    }

    socket.on('lead_updated', handleLeadUpdated)
    socket.on('lead_created', handleLeadUpdated)

    return () => {
      socket.off('lead_updated', handleLeadUpdated)
      socket.off('lead_created', handleLeadUpdated)
    }
  }, [socket])

  const fetchLeads = async () => {
    try {
      const response = await fetch('/api/leads')
      if (response.ok) {
        const data = await response.json()
        const mappedLeads = data.map((d: any) => {
          // Pick the latest follow-up timestamp for the 'Follow ups' stage display
          let displayDate = d.created_at;
          if (d.pipeline_stage === 'followup-1') {
            displayDate = [d.stage_followup_3_at, d.stage_followup_2_at, d.stage_followup_1_at, d.created_at].find(date => date != null) || d.created_at;
          } else {
            const stageDateMap: Record<string, string> = {
              'pretherapy-call': d.stage_pretherapy_call_at,
              'booked-first-session': d.stage_booked_first_session_at,
              'dropouts': d.stage_dropouts_at
            };
            displayDate = stageDateMap[d.pipeline_stage] || d.created_at;
          }

          return {
            id: d.id,
            name: d.name,
            phone: d.phone,
            email: d.email || '',
            source: d.source,
            leadManager: d.sales_agent_name || d.sales_agent_id || 'Unassigned',
            assignedTherapist: d.therapist_name || d.therapist_id || 'Unassigned',
            status: d.status,
            stage: d.pipeline_stage || 'lead-inquire',
            remarks: d.general_remarks || '',
            createdDate: displayDate
          };
        })
        setLeads(mappedLeads)
      }
    } catch (error) {
      console.error('Failed to fetch leads', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [refreshTrigger])

  const filterMonthIndex = useMemo(() => {
    if (!selectedMonth || selectedMonth === 'All Time') return null;
    const [monthName, year] = selectedMonth.split(' ');
    return {
      month: new Date(`${monthName} 1, ${year}`).getMonth(),
      year: parseInt(year, 10)
    };
  }, [selectedMonth]);

  const filteredLeads = leads
    .filter(l => activeTab === 'all' || l.stage === activeTab)
    .filter(l => {
      if (filterMonthIndex) {
        const leadDate = new Date(l.createdDate)
        if (leadDate.getMonth() !== filterMonthIndex.month || leadDate.getFullYear() !== filterMonthIndex.year) return false
      }
      return true
    })
    .filter(l => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        l.name.toLowerCase().includes(query) ||
        l.phone.toLowerCase().includes(query) ||
        l.email.toLowerCase().includes(query)
      )
    })

  const calculateAging = (createdDate: string): string => {
    const created = new Date(createdDate)
    const today = new Date()
    const diffDays = Math.floor(Math.abs(today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return '1 day'
    return `${diffDays} days`
  }

  const getAgingColor = (createdDate: string): string => {
    const created = new Date(createdDate)
    const today = new Date()
    const diffDays = Math.floor(Math.abs(today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 10) return '#21615D' // Green
    if (diffDays <= 15) return '#F4A936' // Yellow
    return '#B91C1C' // Red
  }

  const getStatusClass = (status: string) => {
    const statusMap: Record<string, string> = {
      'New': 'status-new',
      'Contacted': 'status-contacted',
      'Pre-Therapy Call': 'status-pretherapy',
      'Booked': 'status-booked',
      'Converted': 'status-converted',
      'Lost': 'status-lost'
    }
    return statusMap[status] || 'status-default'
  }

  const countForTab = (tabId: string) => {
    const base = tabId === 'all' ? leads : leads.filter(l => l.stage === tabId)
    if (!filterMonthIndex) return base.length
    return base.filter(l => {
      const d = new Date(l.createdDate)
      return d.getMonth() === filterMonthIndex.month && d.getFullYear() === filterMonthIndex.year
    }).length
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const formattedTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    return `${day}-${month}-${year} ${formattedTime}`;
  };

  const getMonthYearString = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleString('en-US', { month: 'long' })} ${date.getFullYear()}`;
  };

  const exportToCSV = () => {
    const isAllTime = !selectedMonth || selectedMonth === 'All Time';
    const headers = [];
    if (isAllTime) {
      headers.push('Month');
    }
    headers.push('Lead Name', 'Phone', 'Email', 'Source', 'Lead Manager', 'Assigned Therapist', 'Stage', 'Aging', 'Lead Created At');
    
    const rows = filteredLeads.map(lead => {
      const row = [];
      if (isAllTime) {
        row.push(getMonthYearString(lead.createdDate));
      }
      row.push(
        lead.name,
        lead.phone,
        lead.email,
        lead.source,
        lead.leadManager,
        lead.assignedTherapist,
        STAGE_LABEL[lead.stage] || lead.stage,
        calculateAging(lead.createdDate),
        formatDateTime(lead.createdDate)
      );
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Leads')
    XLSX.writeFile(wb, `crm_leads_${isAllTime ? 'All_Time' : selectedMonth.replace(' ', '_')}.xlsx`)
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)))
    } else {
      setSelectedLeads(new Set())
    }
  }

  const handleSelectLead = (leadId: string) => {
    const newSelected = new Set(selectedLeads)
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId)
    } else {
      newSelected.add(leadId)
    }
    setSelectedLeads(newSelected)
  }

  const handleDeleteSelected = async () => {
    setDeleting(true)
    try {
      const deletePromises = Array.from(selectedLeads).map(leadId =>
        fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
      )
      await Promise.all(deletePromises)
      
      // Refresh leads list
      await fetchLeads()
      setSelectedLeads(new Set())
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error('Failed to delete leads:', error)
      alert('Failed to delete some leads. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="leads-content relative min-h-full">
      {loading ? (
        <Loader />
      ) : (
        <>
      <header className="leads-header">
        <div>
          <h1>Leads</h1>
          <p className="leads-subtitle">Manage your inquiries and leads</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <MonthFilter selectedMonth={selectedMonth} onChange={setSelectedMonth} />
          
          {/* Add New Lead Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-teal-700 text-white px-4 py-3 rounded-lg hover:bg-teal-800 transition-colors flex items-center gap-2"
            style={{ fontWeight: 500, fontSize: 14 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add New Lead
          </button>
        </div>
      </header>

      <div className="relative mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search leads by name, phone or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        
        {selectedLeads.size > 0 ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 whitespace-nowrap text-sm font-medium"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Delete ({selectedLeads.size})
          </button>
        ) : (
          <button
            onClick={exportToCSV}
            className="bg-teal-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-teal-800 whitespace-nowrap text-sm"
          >
            <Download size={16} />
            Export Excel
          </button>
        )}
      </div>

      {/* Stage Tabs */}
      <div className="stage-tabs">
        {STAGES.map(tab => (
          <button
            key={tab.id}
            className={`stage-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            <span className="tab-count">{countForTab(tab.id)}</span>
          </button>
        ))}
      </div>

      <div className="leads-table-container">
        <table className="leads-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={filteredLeads.length > 0 && selectedLeads.size === filteredLeads.length}
                  onChange={handleSelectAll}
                  style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#0f766e' }}
                />
              </th>
              <th>Lead Name</th>
              <th>Contact Info</th>
              <th>Source</th>
              <th>Lead Manager</th>
              <th>Stage</th>
              <th>Aging</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                  No leads in this stage
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className="lead-table-row"
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedLeads.has(lead.id)}
                      onChange={() => handleSelectLead(lead.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#0f766e' }}
                    />
                  </td>
                  <td className="lead-name">
                    <span 
                      onClick={() => setCurrentPage && setCurrentPage(`lead-profile:${lead.id}:leads`)}
                      className="text-teal-700 hover:underline cursor-pointer font-medium"
                    >
                      {lead.name}
                    </span>
                  </td>
                  <td className="contact-info">
                    <div className="contact-phone">{lead.phone}</div>
                    <div className="contact-email">{lead.email}</div>
                  </td>
                  <td>{lead.source}</td>
                  <td>{lead.leadManager}</td>
                  <td>
                    <span className="stage-pill">
                      {STAGE_LABEL[lead.stage] || lead.stage}
                    </span>
                  </td>
                  <td className="aging">
                    <span style={{ 
                      color: getAgingColor(lead.createdDate),
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: `${getAgingColor(lead.createdDate)}15` // 15% opacity background
                    }}>
                      {calculateAging(lead.createdDate)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddLeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={fetchLeads}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Delete {selectedLeads.size} Lead{selectedLeads.size > 1 ? 's' : ''}?
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to delete {selectedLeads.size === 1 ? 'this lead' : `these ${selectedLeads.size} leads`}? This action cannot be undone.
                </p>
                {selectedLeads.size <= 5 && (
                  <div className="bg-gray-50 rounded p-3 mb-4">
                    <p className="text-xs font-medium text-gray-700 mb-2">Leads to be deleted:</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {Array.from(selectedLeads).map(id => {
                        const lead = leads.find(l => l.id === id)
                        return lead ? <li key={id}>• {lead.name} ({lead.phone})</li> : null
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}

export default LeadsContent
