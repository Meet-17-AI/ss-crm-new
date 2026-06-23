import { useState, useEffect, useRef, useCallback } from 'react'
import StageRemarkModal from './StageRemarkModal'
import PreTherapyCallFormModal, { type PreTherapyFormData } from './PreTherapyCallFormModal'
import TherapistAssignmentDropdown from './TherapistAssignmentDropdown'
import './PipelineContent.css'
import './MonthFilter.css'
import { Loader } from '../../../components/Loader'
import { Toast } from '../../../components/Toast'
import { SendBookingModal } from '../../../components/SendBookingModal'
import PretherapyFormComponent from '../../../components/PretherapyFormComponent'
import FollowupRemarksComponent from '../../../components/FollowupRemarksComponent'
import PretherapyIconComponent from '../../../components/PretherapyIconComponent'
import MonthFilter from './MonthFilter'

interface Lead {
  id: string
  name: string
  email: string
  phone: string
  source: string
  age?: string
  sales_agent_id: string | null
  assignedToSales: string
  assignedTherapist?: string
  created_by: string | null
  date: string
  pipeline_stage?: string
  stage_lead_inquire_at?: string
  stage_followup_1_at?: string
  stage_followup_2_at?: string
  stage_followup_3_at?: string
  consultation_outcome?: string
  tags?: string
  last_interaction_at?: string
  is_duplicate?: boolean
  pretherapy_completed?: boolean
  pretherapy_completed_at?: string
}

interface Stage {
  id: string
  title: string
  leads: Lead[]
}

interface PipelineContentProps {
  currentUser?: any
  setCurrentPage?: (page: string) => void
}

// Defines the fixed forward-only order
const STAGE_ORDER = [
  'lead-inquire',
  'pretherapy-call',
  'followup-1',
  'booked-first-session',
  'referred',
  'closed',
  'dropouts',
  'leaks',
]

const STAGE_LABELS: Record<string, string> = {
  'lead-inquire': 'Lead / Inquire',
  'pretherapy-call': 'Pre-therapy Call',
  'followup-1': 'Follow Ups',
  'booked-first-session': 'Booked First Session',
  'referred': 'Referred',
  'closed': 'Closed',
  'dropouts': 'Unresponsive',
  'leaks': 'Leaks',
}

const defaultStages: Stage[] = STAGE_ORDER.map(id => ({
  id,
  title: STAGE_LABELS[id],
  leads: [],
}))

const PipelineContent = ({ currentUser, setCurrentPage }: PipelineContentProps) => {
  const [leadManagers, setLeadManagers] = useState<{ id: number; name: string }[]>([])
  const [stages, setStages] = useState<Stage[]>(defaultStages)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [stageSearch, setStageSearch] = useState<Record<string, string>>({})
  const [selectedMonth, setSelectedMonth] = useState('All Time')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [prefilledClientData, setPrefilledClientData] = useState<{ name: string, phone: string, email: string } | undefined>()
  const [unresponsiveConfirmData, setUnresponsiveConfirmData] = useState<Lead | null>(null)

  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null)
  const [activeFormType, setActiveFormType] = useState<'pretherapy' | 'followup'>('pretherapy')
  const [expandedFormData, setExpandedFormData] = useState<any>(null)
  const [loadingExpandedForm, setLoadingExpandedForm] = useState(false)

  const handleExpandCard = async (leadId: string, formType: 'pretherapy' | 'followup') => {
    if (expandedLeadId === leadId && activeFormType === formType) {
      setExpandedLeadId(null)
      return
    }
    
    setExpandedLeadId(leadId)
    setActiveFormType(formType)
    setExpandedFormData(null)
    setLoadingExpandedForm(true)
    
    try {
      const response = await fetch(`/api/leads/${leadId}/forms`)
      if (response.ok) {
        const json = await response.json()
        setExpandedFormData(json.data)
      }
    } catch (err) {
      console.error('Error fetching expanded form data:', err)
    } finally {
      setLoadingExpandedForm(false)
    }
  }

  const isLeadInactive24h = (lead: Lead): boolean => {
    if (lead.pipeline_stage && !['lead-inquire', 'pretherapy-call', 'followup-1'].includes(lead.pipeline_stage)) {
      return false
    }
    const compareDateStr = lead.last_interaction_at || lead.date
    if (!compareDateStr) return false
    const compareTime = new Date(compareDateStr).getTime()
    const now = new Date().getTime()
    const diffHours = (now - compareTime) / (1000 * 60 * 60)
    return diffHours >= 24
  }

  // Pending drop — held until remark is confirmed
  const [pendingDrop, setPendingDrop] = useState<{
    lead: Lead
    fromStageId: string
    toStageId: string
  } | null>(null)

  const [draggedLead, setDraggedLead] = useState<{ lead: Lead; fromStageId: string } | null>(null)
  const [editingSalesAssignment, setEditingSalesAssignment] = useState<string | null>(null)
  const touchDragRef = useRef<{ lead: Lead; fromStageId: string } | null>(null)
  const [touchDragOverStage, setTouchDragOverStage] = useState<string | null>(null)
  const touchGhostRef = useRef<HTMLDivElement | null>(null)
  const kanbanRef = useRef<HTMLDivElement>(null)
  const scrollAnimRef = useRef<number | null>(null)

  const stopAutoScroll = useCallback(() => {
    if (scrollAnimRef.current !== null) {
      cancelAnimationFrame(scrollAnimRef.current)
      scrollAnimRef.current = null
    }
  }, [])

  const startAutoScroll = useCallback((direction: 'left' | 'right') => {
    stopAutoScroll()
    const scroll = () => {
      if (kanbanRef.current) {
        kanbanRef.current.scrollLeft += direction === 'right' ? 8 : -8
      }
      scrollAnimRef.current = requestAnimationFrame(scroll)
    }
    scrollAnimRef.current = requestAnimationFrame(scroll)
  }, [stopAutoScroll])

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setEditingSalesAssignment(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Fetch lead managers for dropdown
  useEffect(() => {
    fetch('/api/lead-managers')
      .then(r => r.json())
      .then(data => setLeadManagers(data))
      .catch(err => console.error('Failed to fetch lead managers:', err))
  }, [])

  // Fetch leads from DB
  useEffect(() => {
    const fetchPipelineLeads = async () => {
      try {
        const response = await fetch('/api/leads')
        if (response.ok) {
          const data = await response.json()
          const mappedLeads: Lead[] = data.map((d: any) => {
            // Pick the latest follow-up timestamp for the 'Follow ups' stage display
            let displayDate = d.created_at;
            if (d.pipeline_stage === 'followup-1') {
              displayDate = [d.stage_followup_3_at, d.stage_followup_2_at, d.stage_followup_1_at, d.created_at]
                .find(date => date != null) || d.created_at;
            } else {
                // Use stage-specific date if available
                const stageDateMap: Record<string, string> = {
                    'pretherapy-call': d.stage_pretherapy_call_at,
                    'booked-first-session': d.stage_booked_first_session_at,
                    'dropouts': d.stage_dropouts_at,
                    'leaks': d.stage_leaks_at
                };
                displayDate = stageDateMap[d.pipeline_stage] || d.created_at;
            }

            return {
              id: String(d.id),
              name: d.name,
              email: d.email || '',
              phone: d.phone,
              source: d.source,
              age: d.age ? String(d.age) : '',
              sales_agent_id: d.sales_agent_id != null ? String(d.sales_agent_id) : null,
              assignedToSales: d.sales_agent_name || (d.sales_agent_id != null ? String(d.sales_agent_id) : 'Unassigned'),
              assignedTherapist: d.therapist_name || d.therapist_id || 'Unassigned',
              created_by: d.created_by != null ? String(d.created_by) : null,
              date: displayDate,
              pipeline_stage: d.pipeline_stage,
              stage_followup_1_at: d.stage_followup_1_at,
              stage_followup_2_at: d.stage_followup_2_at,
              stage_followup_3_at: d.stage_followup_3_at,
              stage_lead_inquire_at: d.stage_lead_inquire_at,
              consultation_outcome: d.consultation_outcome,
              last_interaction_at: d.last_interaction_at,
              is_duplicate: d.is_duplicate,
              pretherapy_completed: d.pretherapy_completed,
              pretherapy_completed_at: d.pretherapy_completed_at,
            };
          })

          const newStages = defaultStages.map(stage => ({
            ...stage,
            leads: mappedLeads.filter(lead => lead.pipeline_stage === stage.id),
          }))
          setStages(newStages)        }
      } catch (error) {
        console.error('Failed to fetch pipeline leads', error)
      } finally {
        setLoading(false)
      }
    }
    fetchPipelineLeads()
  }, [])

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const calculateAging = (dateString: string): string => {
    const leadDate = new Date(dateString)
    const today = new Date()
    const diffTime = Math.abs(today.getTime() - leadDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return '1 day'
    return `${diffDays} days`
  }

  const canActOnLead = (lead: Lead): boolean => {
    if (!currentUser) return false
    const userId = String(currentUser.id)
    // Can act if you are the assigned manager OR if it's currently unassigned
    if (lead.sales_agent_id && String(lead.sales_agent_id) === userId) return true
    if (!lead.sales_agent_id || lead.sales_agent_id === 'null') return true
    return false
  }

  const isForwardMove = (fromId: string, toId: string): boolean => {
    return STAGE_ORDER.indexOf(toId) > STAGE_ORDER.indexOf(fromId)
  }

  const handleDragStart = (lead: Lead, stageId: string) => {
    if (canActOnLead(lead)) {
      setDraggedLead({ lead, fromStageId: stageId })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!kanbanRef.current) return
    const board = kanbanRef.current.getBoundingClientRect()
    const EDGE = 120 // px from edge to trigger scroll
    if (e.clientX < board.left + EDGE) {
      startAutoScroll('left')
    } else if (e.clientX > board.right - EDGE) {
      startAutoScroll('right')
    } else {
      stopAutoScroll()
    }
  }

  const handleDragEnd = () => {
    stopAutoScroll()
    setDraggedLead(null)
  }

  // ── Touch drag-and-drop (iPad / mobile) ──────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent, lead: Lead, stageId: string) => {
    if (!canActOnLead(lead)) return
    touchDragRef.current = { lead, fromStageId: stageId }

    // Create a ghost element that follows the finger
    const ghost = document.createElement('div')
    ghost.textContent = lead.name
    ghost.style.cssText = `
      position: fixed; z-index: 9999; pointer-events: none;
      background: #fff; border: 2px solid #0d9488; border-radius: 8px;
      padding: 8px 14px; font-size: 13px; font-weight: 600; color: #0d9488;
      box-shadow: 0 4px 16px rgba(0,0,0,0.18); opacity: 0.92;
    `
    document.body.appendChild(ghost)
    touchGhostRef.current = ghost

    const touch = e.touches[0]
    ghost.style.left = `${touch.clientX - 60}px`
    ghost.style.top = `${touch.clientY - 20}px`
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchDragRef.current) return
    e.preventDefault() // prevent page scroll while dragging

    const touch = e.touches[0]

    // Move ghost
    if (touchGhostRef.current) {
      touchGhostRef.current.style.left = `${touch.clientX - 60}px`
      touchGhostRef.current.style.top = `${touch.clientY - 20}px`
    }

    // Auto-scroll kanban board horizontally
    if (kanbanRef.current) {
      const board = kanbanRef.current.getBoundingClientRect()
      const EDGE = 80
      if (touch.clientX < board.left + EDGE) startAutoScroll('left')
      else if (touch.clientX > board.right - EDGE) startAutoScroll('right')
      else stopAutoScroll()
    }

    // Detect which column the finger is over
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const col = el?.closest('[data-stage-id]') as HTMLElement | null
    setTouchDragOverStage(col ? col.dataset.stageId || null : null)
  }

  const handleTouchEnd = () => {
    stopAutoScroll()
    if (touchGhostRef.current) {
      document.body.removeChild(touchGhostRef.current)
      touchGhostRef.current = null
    }

    const dragging = touchDragRef.current
    touchDragRef.current = null

    if (!dragging || !touchDragOverStage) {
      setTouchDragOverStage(null)
      return
    }

    const { lead, fromStageId } = dragging
    const toStageId = touchDragOverStage
    setTouchDragOverStage(null)

    if (fromStageId === toStageId) return

    setPendingDrop({ lead, fromStageId, toStageId })
  }
  // ─────────────────────────────────────────────────────────────────────────

  const handleDrop = (toStageId: string) => {
    stopAutoScroll()
    if (!draggedLead) return
    const { lead, fromStageId } = draggedLead
    setDraggedLead(null)

    if (fromStageId === toStageId) return

    // Open the remark modal; hold the move until confirmed
    setPendingDrop({ lead, fromStageId, toStageId })
  }

  const handleRemarkConfirm = async (remark: string, formData?: PreTherapyFormData, followUpDate?: string) => {
    if (!pendingDrop) return
    const { lead, fromStageId, toStageId } = pendingDrop

    let finalStageId = toStageId;
    const finalTags = lead.tags;

    if (toStageId === 'pretherapy-call' && formData?.consultation_outcome) {
      if (formData.consultation_outcome === 'Session booked') {
        finalStageId = 'booked-first-session';
      } else if (formData.consultation_outcome === 'To be Followed up') {
        finalStageId = 'followup-1';
      } else if (formData.consultation_outcome === 'Referred') {
        finalStageId = 'referred';
      } else if (formData.consultation_outcome === 'Closed - Reason') {
        finalStageId = 'closed';
      }
    }

    // Optimistic UI update
    const now = new Date().toISOString()
    setStages(prev =>
      prev.map(stage => {
        if (stage.id === fromStageId) return { ...stage, leads: stage.leads.filter(l => l.id !== lead.id) }
        if (stage.id === finalStageId) return {
          ...stage,
          leads: [...stage.leads, {
            ...lead,
            pipeline_stage: finalStageId,
            tags: finalTags,
            consultation_outcome: formData?.consultation_outcome || lead.consultation_outcome,
            date: now, // refresh date so month filter and sort work immediately
          }]
        }
        return stage
      })
    )

    // Persist to backend
    try {
      const response = await fetch(`/api/leads/${lead.id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_stage: toStageId, remark, ...(followUpDate ? { follow_up_date: followUpDate } : {}) }),
      })
      if (!response.ok) throw new Error('Failed to update stage')

      // If moving to pretherapy-call, also save the form data
      if (toStageId === 'pretherapy-call' && formData) {
        await fetch('/api/pretherapy-form', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: lead.id,
            submitted_by: currentUser?.id || null,
            ...formData,
          }),
        })
      }

      // Update card with real therapist_name returned from server
      const updated = await response.json()
      if (updated?.therapist_name) {
        setStages(prev =>
          prev.map(stage => {
            if (stage.id !== finalStageId) return stage
            return {
              ...stage,
              leads: stage.leads.map(l =>
                l.id === lead.id
                  ? { ...l, assignedTherapist: updated.therapist_name }
                  : l
              ),
            }
          })
        )
      }

      setToast({ message: 'Stage updated successfully', type: 'success' })
    } catch (err) {
      console.error('Failed to save stage change:', err)
      setToast({ message: 'Failed to update stage', type: 'error' })
    }

    setPendingDrop(null)
  }

  const handleRemarkCancel = () => {
    setPendingDrop(null)
  }

  const handleSalesAssignment = async (leadId: string, stageId: string, sales_agent_id: number | null, sales_agent_name: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sales_agent_id })
      })

      if (res.ok) {
        setStages(prev =>
          prev.map(stage => {
            if (stage.id !== stageId) return stage
            return {
              ...stage,
              leads: stage.leads.map(lead =>
                lead.id === leadId ? {
                  ...lead,
                  sales_agent_id: sales_agent_id ? String(sales_agent_id) : null,
                  assignedToSales: sales_agent_name
                } : lead
              ),
            }
          })
        )
        setToast({ message: 'Lead manager updated successfully', type: 'success' })
      } else {
        setToast({ message: 'Failed to update lead manager', type: 'error' })
      }
    } catch (error) {
      console.error('Error updating lead manager:', error)
      setToast({ message: 'Error updating lead manager', type: 'error' })
    } finally {
      setEditingSalesAssignment(null)
    }
  }

  const isPostPreTherapy = (stageId: string): boolean =>
    ['booked-first-session'].includes(stageId)

  const getLeadInquireCardStyle = (lead: Lead): React.CSSProperties => {
    if (!lead.stage_lead_inquire_at) return {}
    const days = Math.floor((new Date().getTime() - new Date(lead.stage_lead_inquire_at).getTime()) / (1000 * 60 * 60 * 24))
    return days <= 7
      ? { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }  // warm - soft green
      : { backgroundColor: '#fff5f5', borderColor: '#fecaca' }  // cold - soft red
  }

  return (
    <div className="pipeline-content relative min-h-full">
      {loading ? (
        <Loader />
      ) : (
        <>
          <header className="pipeline-header">
            <div>
              <h1>Pipeline</h1>
              <p className="pipeline-subtitle">Manage your leads through the therapy journey</p>
            </div>
            <MonthFilter selectedMonth={selectedMonth} onChange={setSelectedMonth} />
          </header>

          <div className="kanban-board" ref={kanbanRef} onDragOver={handleDragOver} onDragLeave={stopAutoScroll}>
            {stages.map(stage => (
              <div
                key={stage.id}
                className={`kanban-column${touchDragOverStage === stage.id ? ' touch-drag-over' : ''}`}
                data-stage-id={stage.id}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(stage.id)}
              >
                <div className="column-header">
                  <h3 className="column-title">{stage.title}</h3>
                  <span className="column-count">{(() => {
                    const filtered = stage.leads.filter(lead => {
                      if (selectedMonth && selectedMonth !== 'All Time') {
                        const [monthName, year] = selectedMonth.split(' ')
                        const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth()
                        const leadDate = new Date(lead.date)
                        if (leadDate.getMonth() !== monthIndex || leadDate.getFullYear() !== parseInt(year)) return false
                      }
                      const term = (stageSearch[stage.id] || '').toLowerCase()
                      if (!term) return true
                      return lead.name.toLowerCase().includes(term) || lead.phone.includes(term)
                    })
                    return filtered.length
                  })()}</span>
                </div>

                <div className="stage-search-container">
                  <div className="stage-search-wrapper">
                    <svg className="stage-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                      type="text"
                      placeholder="Search name/contact..."
                      className="stage-search-input"
                      value={stageSearch[stage.id] || ''}
                      onChange={(e) => setStageSearch({ ...stageSearch, [stage.id]: e.target.value })}
                    />
                  </div>
                </div>

                <div className="column-content">
                  {(() => {
                    const filteredLeads = stage.leads.filter(lead => {
                      const term = (stageSearch[stage.id] || '').toLowerCase()
                      // Month filter
                      if (selectedMonth && selectedMonth !== 'All Time') {
                        const [monthName, year] = selectedMonth.split(' ')
                        const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth()
                        const leadDate = new Date(lead.date)
                        if (leadDate.getMonth() !== monthIndex || leadDate.getFullYear() !== parseInt(year)) {
                          return false
                        }
                      }
                      if (!term) return true
                      return lead.name.toLowerCase().includes(term) || lead.phone.includes(term)
                    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    
                    if (stage.leads.length === 0) {
                      return <div className="empty-state"><p>No leads</p></div>
                    }
                    
                    if (filteredLeads.length === 0) {
                      return <div className="empty-state"><p>No results</p></div>
                    }

                    return filteredLeads.map(lead => {
                      const canAct = canActOnLead(lead)
                      return (
                        <div
                          key={lead.id}
                          className={`lead-card ${!canAct ? 'view-only' : ''} ${editingSalesAssignment === lead.id ? 'active-dropdown' : ''} ${stage.id === 'dropouts' ? 'unresponsive-card' : ''} ${lead.is_duplicate ? 'duplicate-card' : ''} ${isLeadInactive24h(lead) ? 'inactive-24h' : ''}`}
                          style={stage.id === 'lead-inquire' ? getLeadInquireCardStyle(lead) : {}}
                          draggable={canAct}
                          onDragStart={(e) => {
                            e.stopPropagation()
                            handleDragStart(lead, stage.id)
                          }}
                          onDragEnd={handleDragEnd}
                          onTouchStart={(e) => handleTouchStart(e, lead, stage.id)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                        >
                          {lead.is_duplicate && (
                            <div className="lead-tags-container" style={{ marginBottom: 6 }}>
                              <span className="lead-tag-badge flex items-center gap-1" style={{ 
                                background: '#fef2f2', 
                                color: '#ef4444', 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                fontSize: '10px',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                border: '1px solid #fee2e2',
                                width: 'fit-content'
                              }}>
                                Duplicate Lead
                              </span>
                            </div>
                          )}
                          {isLeadInactive24h(lead) && (
                            <div className="lead-tags-container" style={{ marginBottom: 6 }}>
                              <span className="lead-tag-badge flex items-center gap-1" style={{ 
                                background: '#fffbeb', 
                                color: '#d97706', 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                fontSize: '10px',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                border: '1px solid #fef3c7',
                                width: 'fit-content'
                              }}>
                                No Interaction &gt; 24h
                              </span>
                            </div>
                          )}
                        <div className="lead-card-header">
                          <h4
                            className="lead-name text-teal-700 hover:underline cursor-pointer"
                            onClick={() => setCurrentPage && setCurrentPage(`lead-profile:${lead.id}:pipeline`)}
                          >
                            {lead.name}
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="lead-source">{lead.source}</span>
                            {(stage.id === 'lead-inquire' || stage.id === 'pretherapy-call' || stage.id === 'followup-1') && canAct && (
                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingSalesAssignment(editingSalesAssignment === `menu-${lead.id}` ? null : `menu-${lead.id}`)
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, color: '#6b7280', lineHeight: 1 }}
                                  title="More actions"
                                >
                                  &#8942;
                                </button>
                                {editingSalesAssignment === `menu-${lead.id}` && (
                                  <div style={{
                                    position: 'absolute', top: '100%', right: 0, zIndex: 50,
                                    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 180, overflow: 'hidden'
                                  }}>
                                    {stage.id !== 'lead-inquire' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setEditingSalesAssignment(null)
                                          setPrefilledClientData({
                                            name: lead.name,
                                            phone: lead.phone,
                                            email: lead.email || ''
                                          })
                                          setIsModalOpen(true)
                                        }}
                                        style={{
                                          width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                                          textAlign: 'left', fontSize: 13, cursor: 'pointer', color: '#2563eb', fontWeight: 500
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                      >
                                        Send Booking Link
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setEditingSalesAssignment(null)
                                        setUnresponsiveConfirmData(lead)
                                      }}
                                      style={{
                                        width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                                        textAlign: 'left', fontSize: 13, cursor: 'pointer', color: '#dc2626', fontWeight: 500
                                      }}
                                      onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                    >
                                      Mark as Unresponsive
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                          {lead.tags && (
                            <div className="lead-tags-container" style={{ marginBottom: 10 }}>
                              <span className="lead-tag-badge" style={{ 
                                background: '#f1f5f9', 
                                color: '#475569', 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                fontSize: '10px',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                border: '1px solid #e2e8f0'
                              }}>
                                {lead.tags}
                              </span>
                            </div>
                          )}


                          {stage.id === 'pretherapy-call' && lead.consultation_outcome && (
                            <div 
                              className="consultation-outcome-badge"
                              style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                marginBottom: '10px',
                                width: 'fit-content',
                                background: (function() {
                                  const diff = new Date().getTime() - new Date(lead.date).getTime();
                                  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                  return days > 7 ? '#B91C1C' : '#0F766E';
                                })(),
                                color: 'white'
                              }}
                            >
                              {lead.consultation_outcome}
                            </div>
                          )}

                          <div className="lead-card-body">
                            <div className="lead-contact-row">
                              <div className="lead-info">
                                <svg className="lead-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="lead-contact-text">{lead.email || '—'}</span>
                              </div>
                              <div className="lead-info">
                                <svg className="lead-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                                </svg>
                                <span className="lead-contact-text">{lead.phone}</span>
                              </div>
                            </div>

                            {/* Pretherapy completed tag/icon inside followup stage */}
                            {stage.id === 'followup-1' && (
                              <div className="mb-1.5 mt-0.5">
                                <PretherapyIconComponent 
                                  completed={lead.pretherapy_completed} 
                                  completedAt={lead.pretherapy_completed_at}
                                  showLabel={true}
                                />
                              </div>
                            )}

                            {isPostPreTherapy(stage.id) && (
                              <div className="lead-assignment">
                                <div className="assignment-label">Therapist:</div>
                                <div className="assignment-value therapist">
                                  {lead.assignedTherapist && lead.assignedTherapist !== 'Unassigned' 
                                    ? lead.assignedTherapist 
                                    : 'Unassigned'}
                                </div>
                              </div>
                            )}

                            <div className="lead-footer">
                              <div className="lead-date">
                                <svg className="footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                  <line x1="16" y1="2" x2="16" y2="6" />
                                  <line x1="8" y1="2" x2="8" y2="6" />
                                  <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                {formatDate(lead.date)}
                              </div>
                              <div className="lead-aging">
                                <svg className="footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="12 6 12 12 16 14" />
                                </svg>
                                {calculateAging(lead.date)}
                              </div>
                            </div>

                            {/* Pre-therapy / Follow-up toggles */}
                            {canAct && (stage.id === 'pretherapy-call' || stage.id === 'followup-1') && (
                              <div className="flex gap-1.5 mt-2 bg-gray-50 p-1 rounded-md border border-gray-200" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExpandCard(lead.id, 'pretherapy');
                                  }}
                                  className={`flex-1 py-1 px-1.5 text-[10px] font-semibold rounded text-center transition-all ${
                                    expandedLeadId === lead.id && activeFormType === 'pretherapy'
                                      ? 'bg-teal-700 text-white shadow-sm'
                                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                  }`}
                                >
                                  Pre-therapy Form
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExpandCard(lead.id, 'followup');
                                  }}
                                  className={`flex-1 py-1 px-1.5 text-[10px] font-semibold rounded text-center transition-all ${
                                    expandedLeadId === lead.id && activeFormType === 'followup'
                                      ? 'bg-teal-700 text-white shadow-sm'
                                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                  }`}
                                >
                                  Follow-up Notes
                                </button>
                              </div>
                            )}

                            {/* Expandable form content */}
                            {expandedLeadId === lead.id && (
                              <div className="mt-3 pt-3 border-t border-gray-200" onClick={e => e.stopPropagation()}>
                                {loadingExpandedForm ? (
                                  <div className="text-center py-2">
                                    <div className="inline-block w-4 h-4 border-2 border-gray-300 border-t-teal-700 rounded-full animate-spin"></div>
                                    <p className="text-[10px] text-gray-500 mt-1">Loading...</p>
                                  </div>
                                ) : activeFormType === 'pretherapy' ? (
                                  <PretherapyFormComponent
                                    leadId={lead.id}
                                    initialData={expandedFormData?.pretherapy?.fields}
                                    onSaved={() => {
                                      setExpandedLeadId(null);
                                      setToast({ message: 'Pre-therapy form saved successfully', type: 'success' });
                                      window.location.reload();
                                    }}
                                    onCancel={() => setExpandedLeadId(null)}
                                  />
                                ) : (
                                  <FollowupRemarksComponent
                                    leadId={lead.id}
                                    initialData={expandedFormData?.followup?.fields}
                                    onSaved={() => {
                                      setExpandedLeadId(null);
                                      setToast({ message: 'Follow-up notes saved successfully', type: 'success' });
                                      window.location.reload();
                                    }}
                                    onCancel={() => setExpandedLeadId(null)}
                                  />
                                )}
                              </div>
                            )}

                            {!canAct && (
                              <div className="view-only-badge">View Only</div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            ))}
          </div>

          {pendingDrop?.toStageId === 'pretherapy-call' ? (
            <PreTherapyCallFormModal
              isOpen={pendingDrop !== null}
              fromStage={pendingDrop?.fromStageId ?? ''}
              leadId={pendingDrop?.lead.id ?? ''}
              leadName={pendingDrop?.lead.name ?? ''}
              initialAge={pendingDrop?.lead.age ?? ''}
              onConfirm={(remark, formData) => handleRemarkConfirm(remark, formData)}
              onCancel={handleRemarkCancel}
            />
          ) : (
            <StageRemarkModal
              isOpen={pendingDrop !== null}
              fromStage={pendingDrop?.fromStageId ?? ''}
              toStage={pendingDrop?.toStageId ?? ''}
              leadName={pendingDrop?.lead.name ?? ''}
              onConfirm={(remark, followUpDate) => handleRemarkConfirm(remark, undefined, followUpDate)}
              onCancel={handleRemarkCancel}
            />
          )}
          <SendBookingModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setPrefilledClientData(undefined);
            }}
            prefilledClient={prefilledClientData}
          />
          {unresponsiveConfirmData && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Action</h3>
                <p className="text-gray-600 mb-6 text-sm">
                  This will mark the lead as unresponsive. Are you sure?
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    onClick={() => setUnresponsiveConfirmData(null)}
                  >
                    No
                  </button>
                  <button
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                    onClick={async () => {
                      const leadToUpdate = unresponsiveConfirmData;
                      setUnresponsiveConfirmData(null);
                      try {
                        const res = await fetch(`/api/leads/${leadToUpdate.id}/stage`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            pipeline_stage: 'dropouts', 
                            remark: 'Marked unresponsive via toggle' 
                          })
                        });
                        if (res.ok) {
                          setStages(prev => prev.map(s => {
                            if (s.id === leadToUpdate.pipeline_stage || s.id === 'lead-inquire' || s.id === 'pretherapy-call' || s.id === 'followup-1') {
                              return { ...s, leads: s.leads.filter(l => l.id !== leadToUpdate.id) }
                            }
                            if (s.id === 'dropouts') {
                               return { ...s, leads: [...s.leads, { ...leadToUpdate, pipeline_stage: 'dropouts' }] }
                            }
                            return s;
                          }));
                          setToast({ message: 'Lead marked unresponsive', type: 'success' })
                        }
                      } catch (err) {
                        console.error('Failed to update stage:', err)
                        setToast({ message: 'Failed to update stage', type: 'error' })
                      }
                    }}
                  >
                    Yes
                  </button>
                </div>
              </div>
            </div>
          )}
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}
        </>
      )}
    </div>
  )
}

export default PipelineContent
