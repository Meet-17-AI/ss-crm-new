import React, { useState, useEffect, useRef } from 'react'
import './LeadProfile.css'
import './MonthFilter.css'
import { Loader } from '../../../components/Loader'
import { Toast } from '../../../components/Toast'
import { SendBookingModal } from '../../../components/SendBookingModal'
import { MoreVertical, Edit3 } from 'lucide-react'
import PreTherapyCallFormModal, { PreTherapyFormData } from './PreTherapyCallFormModal'

interface Lead {
    id: string
    name: string
    phone: string
    email: string
    status: string
    pipeline_stage: string
    remark_lead_inquire?: string
    remark_contacted?: string
    remark_followup_1?: string
    remark_followup_2?: string
    remark_followup_3?: string
    remark_pretherapy_call?: string
    remark_booked_first_session?: string
    remark_dropouts?: string
    general_remarks?: string
    stage_lead_inquire_at?: string
    stage_contacted_at?: string
    stage_followup_1_at?: string
    stage_followup_2_at?: string
    stage_followup_3_at?: string
    stage_pretherapy_call_at?: string
    stage_booked_first_session_at?: string
    stage_dropouts_at?: string
    stage_referred_at?: string
    stage_closed_at?: string
    follow_up_1_date?: string
    tags?: string
    future_action?: string
    remark_referred?: string
    remark_closed?: string
    remark_unresponsive?: string
    created_at: string
    source?: string
    sales_agent_id?: number
    therapist_id?: number
    sales_agent_name?: string
    therapist_name?: string
    pre_therapy_notes?: string
    emergency_contact_name?: string
    emergency_contact_phone?: string
    emergency_contact_relation?: string
    therapy?: string
    remark_lead_manager?: string
    client_remark?: string
    age?: number
    city?: string
    preferred_mode_of_session?: string
    is_virtual?: boolean
}

interface LeadProfileProps {
    leadId: string
    onBack: () => void
    setCurrentPage?: (page: string) => void
    currentUser?: any
    source?: string
}

const STAGES = [
    { id: 'lead-inquire', label: 'Lead / Inquire', remarkKey: 'remark_lead_inquire', timestampKey: 'stage_lead_inquire_at' },
    { id: 'pretherapy-call', label: 'Pre-therapy Call', remarkKey: 'remark_pretherapy_call', timestampKey: 'stage_pretherapy_call_at' },
    { id: 'followup-1', label: 'Follow ups', remarkKey: 'remark_followup_1', timestampKey: 'stage_followup_1_at', scheduledDateKey: 'follow_up_1_date' },
    { id: 'booked-first-session', label: 'Booked First Session', remarkKey: 'remark_booked_first_session', timestampKey: 'stage_booked_first_session_at' },
    { id: 'referred', label: 'Referred', remarkKey: 'remark_referred', timestampKey: 'stage_referred_at' },
    { id: 'closed', label: 'Closed', remarkKey: 'remark_closed', timestampKey: 'stage_closed_at' },
    { id: 'dropouts', label: 'Unresponsive', remarkKey: 'remark_unresponsive', timestampKey: 'stage_dropouts_at' },
]

const SOURCE_OPTIONS = [
    'Chatbot',
    'Website',
    'Direct',
    'Social Media',
    'Other',
]

const THERAPY_OPTIONS = [
    'Individual Therapy',
    'Couples Therapy',
    'Adolescents Therapy',
]

const StageRemarkCard = ({ stage, lead, isGeneral = false, canAct = false }: { stage?: any, lead: Lead, isGeneral?: boolean, canAct?: boolean }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isEditingRemark, setIsEditingRemark] = useState(false)
    const [editRemarkText, setEditRemarkText] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    const remarkContent = (isGeneral ? lead.general_remarks : lead[stage.remarkKey as keyof Lead]) as string

    if (!remarkContent && !isEditingRemark) return null

    const isLengthy = remarkContent && remarkContent.length > 80
    const displayText = !isExpanded && isLengthy ? remarkContent.substring(0, 80) + '...' : remarkContent

    const timestamp = isGeneral ? null : (stage ? lead[stage.timestampKey as keyof Lead] : null)
    const scheduledDate = (!isGeneral && stage?.scheduledDateKey) ? lead[stage.scheduledDateKey as keyof Lead] as string : null

    const formattedDate = timestamp
        ? new Date(timestamp as string).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase() + ' IST'
        : ''

    const titleDate = timestamp
        ? new Date(timestamp as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : ''
    const label = isGeneral ? 'GENERAL REMARK' : (stage ? stage.label.toUpperCase() : '')

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        setEditRemarkText(remarkContent || '')
        setIsEditingRemark(true)
        setIsExpanded(true)
    }

    const handleSaveRemark = async (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsSaving(true)
        try {
            const fieldToUpdate = isGeneral ? 'general_remarks' : stage.remarkKey
            const res = await fetch(`/api/leads/${lead.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [fieldToUpdate]: editRemarkText })
            })
            if (res.ok) {
                if (isGeneral) lead.general_remarks = editRemarkText
                else (lead as any)[stage.remarkKey] = editRemarkText
                setIsEditingRemark(false)
            }
        } catch (error) {
            console.error('Failed to save remark:', error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className={`lp-remark-card-new ${isExpanded ? 'expanded' : ''}`}>
            <div className="lp-remark-card-header-new" onClick={() => !isEditingRemark && isLengthy && setIsExpanded(!isExpanded)} style={{ cursor: (!isEditingRemark && isLengthy) ? 'pointer' : 'default' }}>
                <div className="lp-remark-card-title-row-new">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="lp-remark-badge-new">{label}</div>
                        {titleDate && <div className="lp-remark-title-date-new">{titleDate}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {!isEditingRemark && canAct && (
                            <button className="lp-remark-edit-icon" onClick={handleEditClick} title="Edit Remark" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                        )}
                        {!isEditingRemark && isLengthy && (
                            <div className="lp-remark-expand-icon-new">
                                {isExpanded ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 15 12 9 18 15"></polyline></svg>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                {formattedDate && <div className="lp-remark-time-full-new">{formattedDate}</div>}
            </div>

            {(isExpanded || isEditingRemark) && <div className="lp-remark-divider-new"></div>}

            <div className="lp-remark-card-body-new" style={{ marginTop: (isExpanded || isEditingRemark) ? '0.75rem' : '1rem' }}>
                <div className="lp-remark-content-title-new">Remarks:</div>
                {isEditingRemark ? (
                    <div style={{ marginTop: '0.5rem' }}>
                        <textarea
                            className="lp-edit-textarea"
                            rows={3}
                            value={editRemarkText}
                            onChange={(e) => setEditRemarkText(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                            <button onClick={(e) => { e.stopPropagation(); setIsEditingRemark(false); }} disabled={isSaving} className="lp-remark-btn cancel">Cancel</button>
                            <button onClick={handleSaveRemark} disabled={isSaving} className="lp-remark-btn save">{isSaving ? 'Saving...' : 'Save'}</button>
                        </div>
                    </div>
                ) : (
                    <div className="lp-remark-text-content-new">{displayText}</div>
                )}
                {scheduledDate && !isEditingRemark && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#0f766e', fontWeight: 600 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        Follow-up scheduled: {new Date(scheduledDate.includes('T') ? scheduledDate : scheduledDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                )}
            </div>
        </div>
    )
}

const LeadProfile = ({ leadId, onBack, setCurrentPage, currentUser, source }: LeadProfileProps) => {
    const [lead, setLead] = useState<Lead | null>(null)
    const [loading, setLoading] = useState(true)
    const [isEditing, setIsEditing] = useState(false)
    const [pretherapyForm, setPretherapyForm] = useState<any>(null)
    const [showDropdown, setShowDropdown] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    
    // Form views
    const [showFormResponses, setShowFormResponses] = useState(false)
    const [isEditingForm, setIsEditingForm] = useState(false)

    const canActOnLead = (leadData: Lead | null): boolean => {
        if (!currentUser || !leadData) return false
        const userId = String(currentUser.id)
        // Can act if you are the assigned manager OR if it's currently unassigned
        if (leadData.sales_agent_id && String(leadData.sales_agent_id) === userId) return true
        if (!leadData.sales_agent_id || String(leadData.sales_agent_id) === 'null') return true
        return false
    }

    const canAct = canActOnLead(lead)

    const [editForm, setEditForm] = useState<Partial<Lead>>({})
    const [leadManagers, setLeadManagers] = useState<{ id: number, name: string }[]>([])
    const [therapists, setTherapists] = useState<{ id: number, name: string }[]>([])
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [prefilledClientData, setPrefilledClientData] = useState<{ name: string, phone: string, email: string } | undefined>()
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)

    // Custom dropdown states
    const [isSourceOpen, setIsSourceOpen] = useState(false)
    const [isManagerOpen, setIsManagerOpen] = useState(false)
    const [isTherapistOpen, setIsTherapistOpen] = useState(false)
    const [isTherapyOpen, setIsTherapyOpen] = useState(false)
    const [isModeOpen, setIsModeOpen] = useState(false)

    // Refs for outside click detection
    const sourceRef = useRef<HTMLDivElement>(null)
    const managerRef = useRef<HTMLDivElement>(null)
    const therapistRef = useRef<HTMLDivElement>(null)
    const therapyRef = useRef<HTMLDivElement>(null)
    const modeRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sourceRef.current && !sourceRef.current.contains(event.target as Node)) setIsSourceOpen(false)
            if (managerRef.current && !managerRef.current.contains(event.target as Node)) setIsManagerOpen(false)
            if (therapistRef.current && !therapistRef.current.contains(event.target as Node)) setIsTherapistOpen(false)
            if (therapyRef.current && !therapyRef.current.contains(event.target as Node)) setIsTherapyOpen(false)
            if (modeRef.current && !modeRef.current.contains(event.target as Node)) setIsModeOpen(false)
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowDropdown(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleConvertToLead = async () => {
        if (!lead) return;
        setToast({ message: 'Adding client to CRM...', type: 'success' });
        try {
            const res = await fetch('/api/leads/convert-virtual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: lead.name,
                    phone: lead.phone,
                    email: lead.email,
                    source: 'Booking System'
                })
            });
            if (res.ok) {
                const newLead = await res.json();
                setToast({ message: 'Client added to CRM successfully!', type: 'success' });
                
                // Update the global navigation state so the URL/page reflects the new real ID
                if (setCurrentPage) {
                    setCurrentPage(`lead-profile:${newLead.id}${source ? `:${source}` : ''}`);
                }

                // Fetch the real lead record to update local state immediately
                const realLeadRes = await fetch(`/api/leads/${newLead.id}`);
                if (realLeadRes.ok) {
                    const realLeadData = await realLeadRes.json();
                    setLead(realLeadData);
                }
            } else {
                setToast({ message: 'Failed to add to CRM.', type: 'error' });
            }
        } catch (error) {
            console.error('Conversion failed', error);
            setToast({ message: 'Error adding to CRM.', type: 'error' });
        }
    };

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                const [leadRes, managersRes, therapistsRes] = await Promise.all([
                    fetch(`/api/leads/${leadId}`),
                    fetch(`/api/lead-managers`),
                    fetch(`/api/therapists`)
                ])
                if (leadRes.ok) {
                    const data = await leadRes.json()
                    setLead(data)
                }
                if (managersRes.ok) {
                    setLeadManagers(await managersRes.json())
                }
                if (therapistsRes.ok) {
                    setTherapists(await therapistsRes.json())
                }
            } catch (error) {
                console.error('Failed to fetch data', error)
            } finally {
                setLoading(false)
            }
        }

        fetchAllData()
    }, [leadId])

    // Fetch pre-therapy form if applicable
    useEffect(() => {
        if (!lead) return
        const preTherapyStages = ['pretherapy-call', 'followup-1', 'booked-first-session', 'dropouts']
        if (preTherapyStages.includes(lead.pipeline_stage)) {
            fetch(`/api/pretherapy-form/${lead.id}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => setPretherapyForm(data))
                .catch(() => {})
        }
    }, [lead])

    const handleEditToggle = () => {
        if (!isEditing && lead) {
            setEditForm({
                name: lead.name || '',
                phone: lead.phone || '',
                email: lead.email || '',
                created_at: lead.created_at,
                source: lead.source || '',
                sales_agent_id: lead.sales_agent_id ? Number(lead.sales_agent_id) : null,
                therapist_id: lead.therapist_id ? Number(lead.therapist_id) : null,
                emergency_contact_name: lead.emergency_contact_name || '',
                emergency_contact_phone: lead.emergency_contact_phone || '',
                emergency_contact_relation: lead.emergency_contact_relation || '',
                therapy: lead.therapy || '',
                remark_lead_manager: lead.remark_lead_manager || '',
                age: lead.age ?? null,
                city: lead.city || '',
                preferred_mode_of_session: lead.preferred_mode_of_session || ''
            })
            setIsEditing(true)
        }
        setIsEditing(!isEditing)
    }

    const handleSave = async () => {
        if (!lead) return
        // Only include fields that actually changed
        const changes: Partial<Lead> = {}
        if (editForm.name !== (lead.name || '')) changes.name = editForm.name
        if (editForm.phone !== (lead.phone || '')) changes.phone = editForm.phone
        if (editForm.email !== (lead.email || '')) changes.email = editForm.email
        if (editForm.created_at !== lead.created_at) changes.created_at = editForm.created_at
        if (editForm.source !== (lead.source || '')) changes.source = editForm.source
        // Use loose equality for IDs to handle string/number mismatches
        if (editForm.sales_agent_id != lead.sales_agent_id) changes.sales_agent_id = editForm.sales_agent_id
        if (editForm.therapist_id != lead.therapist_id) changes.therapist_id = editForm.therapist_id
        if (editForm.emergency_contact_name !== (lead.emergency_contact_name || '')) changes.emergency_contact_name = editForm.emergency_contact_name
        if (editForm.emergency_contact_phone !== (lead.emergency_contact_phone || '')) changes.emergency_contact_phone = editForm.emergency_contact_phone
        if (editForm.emergency_contact_relation !== (lead.emergency_contact_relation || '')) changes.emergency_contact_relation = editForm.emergency_contact_relation
        if (editForm.therapy !== (lead.therapy || '')) changes.therapy = editForm.therapy
        if (editForm.remark_lead_manager !== (lead.remark_lead_manager || '')) changes.remark_lead_manager = editForm.remark_lead_manager
        if (editForm.age != lead.age) changes.age = editForm.age
        if (editForm.city !== (lead.city || '')) changes.city = editForm.city
        if (editForm.preferred_mode_of_session !== (lead.preferred_mode_of_session || '')) changes.preferred_mode_of_session = editForm.preferred_mode_of_session

        // Final safety: remove any undefined keys and check if anything remains
        Object.keys(changes).forEach(key => (changes[key as keyof Lead] === undefined) && delete changes[key as keyof Lead])

        if (Object.keys(changes).length === 0) {
            setToast({ message: 'No changes detected to save.', type: 'error' })
            setIsEditing(false)
            return
        }

        const body = JSON.stringify({
            ...changes,
            _audit_user: { id: currentUser?.id, name: currentUser?.full_name || currentUser?.username }
        })

        setToast({ message: 'Saving changes...', type: 'success' })

        try {
            const res = await fetch(`/api/leads/${leadId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body
            })
            if (res.ok) {
                setIsEditing(false)
                const updatedRes = await fetch(`/api/leads/${leadId}`)
                if (updatedRes.ok) setLead(await updatedRes.json())
                setToast({ message: 'Lead updated successfully!', type: 'success' })
            } else {
                setToast({ message: 'Failed to update lead.', type: 'error' })
            }
        } catch (error) {
            console.error('Failed to save lead info', error)
            setToast({ message: 'Error saving lead info.', type: 'error' })
        }
    }

    const handleEditFormSubmit = async (remark: string, formData: PreTherapyFormData) => {
        setToast({ message: 'Saving form...', type: 'success' })
        try {
            const endpoint = pretherapyForm ? `/api/pretherapy-form/${leadId}` : `/api/pretherapy-form`
            const method = pretherapyForm ? 'PATCH' : 'POST'
            
            const payload = pretherapyForm 
                ? formData 
                : { ...formData, lead_id: leadId, submitted_by: currentUser?.id || lead?.sales_agent_id }

            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            if (res.ok) {
                const formRes = await fetch(`/api/pretherapy-form/${leadId}`)
                if (formRes.ok) setPretherapyForm(await formRes.json())
                setToast({ message: 'Form saved successfully!', type: 'success' })
            } else {
                setToast({ message: 'Failed to save form.', type: 'error' })
            }
        } catch (error) {
            console.error('Failed to save form', error)
            setToast({ message: 'Error saving form.', type: 'error' })
        }
        setIsEditingForm(false)
    }

    const handleDeleteLead = async () => {
        setDeleting(true)
        try {
            const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
            if (res.ok) {
                setToast({ message: 'Lead deleted successfully!', type: 'success' })
                setTimeout(() => {
                    onBack() // Go back to leads list
                }, 1500)
            } else {
                setToast({ message: 'Failed to delete lead.', type: 'error' })
            }
        } catch (error) {
            console.error('Failed to delete lead:', error)
            setToast({ message: 'Error deleting lead.', type: 'error' })
        } finally {
            setDeleting(false)
            setShowDeleteConfirm(false)
        }
    }

    const formatDateObj = (dateString?: string) => {
        if (!dateString) return ''
        const date = new Date(dateString)
        // Format for datetime-local input
        return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
    }

    const displayDate = (dateString?: string) => {
        if (!dateString) return 'N/A'
        return new Date(dateString).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()
    }

    if (loading) {
        return (
            <div className="lead-profile-container relative min-h-full">
                <Loader />
            </div>
        )
    }

    if (!lead) {
        return (
            <div className="lead-profile-container error">
                <div>Lead not found.</div>
                <button onClick={onBack} className="back-btn-simple">Go Back</button>
            </div>
        )
    }

    return (
        <div className="lead-profile-container">
            <div className="lead-profile-left">
                <div className="lp-header-row">
                    <button className="lp-back-btn" onClick={onBack}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5" />
                            <path d="M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {isEditing ? (
                            <input
                                type="text"
                                className="lp-edit-input"
                                value={editForm.name || ''}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                placeholder="Lead name"
                                style={{ fontSize: '1.25rem', fontWeight: 700, minWidth: 200 }}
                            />
                        ) : (
                            <h1 className="lp-name">{lead.name}</h1>
                        )}
                        {lead.is_virtual && (
                            <span className="lp-virtual-badge" style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid #fde68a' }}>
                                Temporary Profile
                            </span>
                        )}
                    </div>
                    <span className="lp-status-badge active">
                        {lead.is_virtual ? 'NOT IN CRM' : (STAGES.find(s => s.id === lead.pipeline_stage)?.label || (lead.pipeline_stage ? lead.pipeline_stage.toUpperCase() : 'NEW'))}
                    </span>
                    <div className="lp-header-actions" ref={dropdownRef}>
                        {lead.is_virtual && (
                            <button 
                                className="lp-convert-btn" 
                                onClick={handleConvertToLead}
                                style={{ background: '#0f766e', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#0d9488'}
                                onMouseOut={(e) => e.currentTarget.style.background = '#0f766e'}
                            >
                                Add to CRM Pipeline
                            </button>
                        )}
                        {canAct && !isEditing && !lead.is_virtual && (
                            <div className="lp-more-dropdown-container">
                                <button 
                                    className="lp-more-btn"
                                    onClick={() => setShowDropdown(!showDropdown)}
                                    title="More Actions"
                                >
                                    <MoreVertical size={20} />
                                </button>
                                
                                {showDropdown && (
                                    <div className="lp-dropdown-menu">
                                        <button
                                            className="lp-dropdown-item"
                                            onClick={() => {
                                                setPrefilledClientData({
                                                    name: lead.name,
                                                    phone: lead.phone,
                                                    email: lead.email || ''
                                                })
                                                setIsModalOpen(true)
                                                setShowDropdown(false)
                                            }}
                                        >
                                            Send booking link
                                        </button>
                                        <button 
                                            className="lp-dropdown-item" 
                                            onClick={() => {
                                                handleEditToggle()
                                                setShowDropdown(false)
                                            }}
                                        >
                                            Edit Lead Info
                                        </button>
                                        <button 
                                            className="lp-dropdown-item" 
                                            onClick={() => {
                                                setShowDeleteConfirm(true)
                                                setShowDropdown(false)
                                            }}
                                            style={{ color: '#dc2626' }}
                                        >
                                            Delete Lead
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        {!canAct && (
                            <div className="view-only-badge" style={{ position: 'static', margin: 0 }}>View Only</div>
                        )}
                        {canAct && isEditing && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="lp-edit-btn save" onClick={handleSave}>Save</button>
                                <button className="lp-edit-btn cancel" onClick={() => setIsEditing(false)}>Cancel</button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lp-section">
                    <h3 className="lp-section-title">Contact Info:</h3>
                    <div className="lp-contact-item">
                        <svg className="lp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                        </svg>
                        {isEditing ? (
                            <input type="tel" className="lp-edit-input" value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Phone number" />
                        ) : (
                            <span className="lp-contact-text">{lead.phone || 'N/A'}</span>
                        )}
                    </div>
                    <div className="lp-contact-item">
                        <svg className="lp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                        </svg>
                        {isEditing ? (
                            <input type="email" className="lp-edit-input" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Email address" />
                        ) : (
                            <span className="lp-contact-text">{lead.email || 'N/A'}</span>
                        )}
                    </div>
                </div>

                <div className="lp-section">
                    <h3 className="lp-section-title">Lead Info:</h3>
                    <div className="lp-details-grid">
                        <div className="lp-detail-item">
                            <span className="lp-detail-label">Date Created</span>
                            {isEditing ? (
                                <input type="datetime-local" className="lp-edit-input" value={formatDateObj(editForm.created_at)} onChange={(e) => setEditForm({ ...editForm, created_at: new Date(e.target.value).toISOString() })} />
                            ) : (
                                <span className="lp-detail-value">{displayDate(lead.created_at)}</span>
                            )}
                        </div>
                        <div className="lp-detail-item">
                            <span className="lp-detail-label">Source</span>
                            {isEditing ? (
                                <div className="custom-dropdown w-full" ref={sourceRef}>
                                    <button
                                        type="button"
                                        className="dropdown-trigger w-full"
                                        onClick={() => setIsSourceOpen(!isSourceOpen)}
                                    >
                                        <span>{editForm.source || 'Select Source'}</span>
                                        <svg className={`dropdown-arrow ${isSourceOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                    {isSourceOpen && (
                                        <div className="dropdown-menu w-full">
                                            <div className="dropdown-item" onClick={() => { setEditForm({ ...editForm, source: '' }); setIsSourceOpen(false); }}>-- Select Source --</div>
                                            {SOURCE_OPTIONS.map(opt => (
                                                <div
                                                    key={opt}
                                                    className={`dropdown-item ${editForm.source === opt ? 'selected' : ''}`}
                                                    onClick={() => { setEditForm({ ...editForm, source: opt }); setIsSourceOpen(false); }}
                                                >
                                                    {opt}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <span className="lp-detail-value" style={{ textTransform: 'capitalize' }}>{lead.source || 'N/A'}</span>
                            )}
                        </div>
                        <div className="lp-detail-item">
                            <span className="lp-detail-label">Lead Manager</span>
                            {isEditing ? (
                                <div className="custom-dropdown w-full" ref={managerRef}>
                                    <button
                                        type="button"
                                        className="dropdown-trigger w-full"
                                        onClick={() => setIsManagerOpen(!isManagerOpen)}
                                    >
                                        <span>{leadManagers.find(m => m.id === editForm.sales_agent_id)?.name || 'Unassigned'}</span>
                                        <svg className={`dropdown-arrow ${isManagerOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                    {isManagerOpen && (
                                        <div className="dropdown-menu w-full">
                                            <div className="dropdown-item" onClick={() => { setEditForm({ ...editForm, sales_agent_id: null }); setIsManagerOpen(false); }}>Unassigned</div>
                                            {leadManagers.map(m => (
                                                <div
                                                    key={m.id}
                                                    className={`dropdown-item ${editForm.sales_agent_id === m.id ? 'selected' : ''}`}
                                                    onClick={() => { setEditForm({ ...editForm, sales_agent_id: m.id }); setIsManagerOpen(false); }}
                                                >
                                                    {m.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <span className="lp-detail-value">{lead.sales_agent_name || 'Unassigned'}</span>
                            )}
                        </div>
                        <div className="lp-detail-item">
                            <span className="lp-detail-label">Assigned Therapist</span>
                            {isEditing ? (
                                <div className="custom-dropdown w-full" ref={therapistRef}>
                                    <button
                                        type="button"
                                        className="dropdown-trigger w-full"
                                        onClick={() => setIsTherapistOpen(!isTherapistOpen)}
                                    >
                                        <span>{therapists.find(t => t.id === editForm.therapist_id)?.name || 'Unassigned'}</span>
                                        <svg className={`dropdown-arrow ${isTherapistOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                    {isTherapistOpen && (
                                        <div className="dropdown-menu w-full">
                                            <div className="dropdown-item" onClick={() => { setEditForm({ ...editForm, therapist_id: null }); setIsTherapistOpen(false); }}>Unassigned</div>
                                            {therapists.map(t => (
                                                <div
                                                    key={t.id}
                                                    className={`dropdown-item ${editForm.therapist_id === t.id ? 'selected' : ''}`}
                                                    onClick={() => { setEditForm({ ...editForm, therapist_id: t.id }); setIsTherapistOpen(false); }}
                                                >
                                                    {t.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <span className="lp-detail-value">{lead.therapist_name || 'Unassigned'}</span>
                            )}
                        </div>
                        <div className="lp-detail-item">
                            <span className="lp-detail-label">Therapy</span>
                            {isEditing ? (
                                <div className="custom-dropdown w-full" ref={therapyRef}>
                                    <button
                                        type="button"
                                        className="dropdown-trigger w-full"
                                        onClick={() => setIsTherapyOpen(!isTherapyOpen)}
                                    >
                                        <span>{editForm.therapy || 'Select Therapy'}</span>
                                        <svg className={`dropdown-arrow ${isTherapyOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                    {isTherapyOpen && (
                                        <div className="dropdown-menu w-full">
                                            <div className="dropdown-item" onClick={() => { setEditForm({ ...editForm, therapy: '' }); setIsTherapyOpen(false); }}>-- Select Therapy --</div>
                                            {THERAPY_OPTIONS.map(opt => (
                                                <div
                                                    key={opt}
                                                    className={`dropdown-item ${editForm.therapy === opt ? 'selected' : ''}`}
                                                    onClick={() => { setEditForm({ ...editForm, therapy: opt }); setIsTherapyOpen(false); }}
                                                >
                                                    {opt}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <span className="lp-detail-value" style={{ textTransform: 'capitalize' }}>{lead.therapy || 'N/A'}</span>
                            )}
                        </div>
                        <div className="lp-detail-item">
                            <span className="lp-detail-label">Age</span>
                            {isEditing ? (
                                <input type="number" className="lp-edit-input" value={editForm.age || ''} onChange={(e) => setEditForm({ ...editForm, age: e.target.value ? parseInt(e.target.value) : undefined })} />
                            ) : (
                                <span className="lp-detail-value">{lead.age || 'N/A'}</span>
                            )}
                        </div>
                        <div className="lp-detail-item">
                            <span className="lp-detail-label">City</span>
                            {isEditing ? (
                                <input type="text" className="lp-edit-input" value={editForm.city || ''} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                            ) : (
                                <span className="lp-detail-value">{lead.city || 'N/A'}</span>
                            )}
                        </div>
                        <div className="lp-detail-item">
                            <span className="lp-detail-label">Preferred Mode</span>
                            {isEditing ? (
                                <div className="custom-dropdown w-full" ref={modeRef}>
                                    <button
                                        type="button"
                                        className="dropdown-trigger w-full"
                                        onClick={() => setIsModeOpen(!isModeOpen)}
                                    >
                                        <span>{editForm.preferred_mode_of_session || 'Select Mode'}</span>
                                        <svg className={`dropdown-arrow ${isModeOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                    {isModeOpen && (
                                        <div className="dropdown-menu w-full">
                                            <div className="dropdown-item" onClick={() => { setEditForm({ ...editForm, preferred_mode_of_session: '' }); setIsModeOpen(false); }}>-- Select Mode --</div>
                                            <div className={`dropdown-item ${editForm.preferred_mode_of_session === 'Online' ? 'selected' : ''}`} onClick={() => { setEditForm({ ...editForm, preferred_mode_of_session: 'Online' }); setIsModeOpen(false); }}>Online</div>
                                            <div className={`dropdown-item ${editForm.preferred_mode_of_session === 'In-person' ? 'selected' : ''}`} onClick={() => { setEditForm({ ...editForm, preferred_mode_of_session: 'In-person' }); setIsModeOpen(false); }}>In-person</div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <span className="lp-detail-value">{lead.preferred_mode_of_session || 'N/A'}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lp-section">
                    <h3 className="lp-section-title">Emergency Contact:</h3>
                    {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div>
                                <label className="lp-detail-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Name</label>
                                <input type="text" className="lp-edit-input" value={editForm.emergency_contact_name || ''} onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })} placeholder="Contact name" />
                            </div>
                            <div>
                                <label className="lp-detail-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Phone</label>
                                <input type="tel" className="lp-edit-input" value={editForm.emergency_contact_phone || ''} onChange={(e) => setEditForm({ ...editForm, emergency_contact_phone: e.target.value })} placeholder="Contact phone" />
                            </div>
                            <div>
                                <label className="lp-detail-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Relation</label>
                                <input type="text" className="lp-edit-input" value={editForm.emergency_contact_relation || ''} onChange={(e) => setEditForm({ ...editForm, emergency_contact_relation: e.target.value })} placeholder="e.g. Parent, Spouse" />
                            </div>
                        </div>
                    ) : (lead.emergency_contact_name || lead.emergency_contact_phone) ? (
                        <div className="lp-card-box">
                            {lead.emergency_contact_name && <div><strong>{lead.emergency_contact_name}</strong>{lead.emergency_contact_relation ? ` (${lead.emergency_contact_relation})` : ''}</div>}
                            {lead.emergency_contact_phone && <div style={{ color: '#64748b', marginTop: '0.25rem' }}>{lead.emergency_contact_phone}</div>}
                        </div>
                    ) : (
                        <div className="lp-card-box lp-empty-text">Not provided</div>
                    )}
                </div>

                <div className="lp-section">
                    <h3 className="lp-section-title">Pre-therapy Call Form Responses:</h3>
                    {pretherapyForm ? (
                        <div className="lp-card-box" style={{ position: 'relative' }}>
                            {canAct && (
                                <button
                                    onClick={() => setIsEditingForm(true)}
                                    style={{
                                        position: 'absolute', top: 12, right: 12, padding: '4px 8px', background: '#f8fafc',
                                        color: '#475569', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer',
                                        fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4
                                    }}
                                    title="Edit Form"
                                >
                                    <Edit3 size={11} className="text-gray-500" /> Edit
                                </button>
                            )}
                            <div style={{ fontSize: 13, lineHeight: 1.8, paddingRight: 50 }}>
                                {[
                                    { label: 'A. Age', value: pretherapyForm.age },
                                    { label: 'B. Language', value: [Array.isArray(pretherapyForm.language) ? pretherapyForm.language.join(', ') : pretherapyForm.language, pretherapyForm.language_other].filter(Boolean).join(': ') },
                                    { label: 'C. Location', value: [pretherapyForm.location, pretherapyForm.location_manual].filter(Boolean).join(' — ') },
                                    { label: 'D. Mode of Session', value: Array.isArray(pretherapyForm.mode_of_session) ? pretherapyForm.mode_of_session.join(', ') : pretherapyForm.mode_of_session },
                                    { label: 'E. Previous Therapy', value: pretherapyForm.previous_therapy },
                                    { label: 'F. Concerns', value: [Array.isArray(pretherapyForm.concerns) ? pretherapyForm.concerns.join(', ') : pretherapyForm.concerns, pretherapyForm.concerns_other].filter(Boolean).join(': ') },
                                    { label: 'G. Clinical Concerns Observed', value: pretherapyForm.clinical_concerns_observed },
                                    { label: 'H. Clinical Checklist', value: Array.isArray(pretherapyForm.clinical_concerns) ? pretherapyForm.clinical_concerns.join(', ') : pretherapyForm.clinical_concerns },
                                    { label: 'I. Psychiatric Treatment', value: pretherapyForm.psychiatric_treatment },
                                    { label: 'J. Suicidal Thoughts', value: pretherapyForm.suicidal_thoughts },
                                    { label: 'K. Scope Explained', value: pretherapyForm.scope_explained },
                                    { label: 'L. Preferred Price', value: pretherapyForm.preferred_price === 'Other' ? pretherapyForm.preferred_price_other : (pretherapyForm.preferred_price ? `₹${pretherapyForm.preferred_price}` : null) },
                                    { label: 'M. Readiness', value: [Array.isArray(pretherapyForm.readiness) ? pretherapyForm.readiness.join(', ') : pretherapyForm.readiness, pretherapyForm.readiness_other].filter(Boolean).join(': ') },
                                    { label: 'N. Consented to Follow-up', value: pretherapyForm.consented_followup },
                                    { label: 'O. Client\'s Questions', value: pretherapyForm.client_questions },
                                    { label: 'P. Source', value: pretherapyForm.source === 'Other (Mention)' ? pretherapyForm.source_other : pretherapyForm.source },
                                    { label: 'Q. Consultation Outcome', value: pretherapyForm.consultation_outcome },
                                ].filter(item => item.value).map(item => (
                                    <div key={item.label} style={{ display: 'flex', gap: 8, paddingBottom: 4, borderBottom: '1px solid #f8fafc', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, color: '#475569', minWidth: 170, flexShrink: 0 }}>{item.label}:</span>
                                        <span style={{ color: '#1e293b' }}>{item.value}</span>
                                    </div>
                                ))}
                                <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
                                    Submitted: {new Date(pretherapyForm.submitted_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="lp-card-box lp-empty-text">Not provided</div>
                    )}
                </div>

                <div className="lp-section">
                    <h3 className="lp-section-title">Client's Remarks:</h3>
                    <div className={`lp-card-box ${!lead.client_remark ? 'lp-empty-text' : ''}`}>
                        {lead.client_remark || 'No remarks available'}
                    </div>
                </div>

                <div className="lp-section">
                    <h3 className="lp-section-title">Lead Manager Remarks:</h3>
                    {isEditing ? (
                        <textarea
                            className="lp-edit-textarea"
                            rows={4}
                            value={editForm.remark_lead_manager || ''}
                            onChange={(e) => setEditForm({ ...editForm, remark_lead_manager: e.target.value })}
                            placeholder="Enter Lead Manager remarks..."
                        />
                    ) : (
                        <div className={`lp-card-box ${!lead.remark_lead_manager ? 'lp-empty-text' : ''}`}>
                            {lead.remark_lead_manager || 'No lead manager remarks available'}
                        </div>
                    )}
                </div>
            </div>

            <div className="lead-profile-right">
                <h2 className="lp-right-title">Stage Remarks</h2>
                <div className="lp-remarks-list">
                    {lead.general_remarks && <StageRemarkCard lead={lead} isGeneral={true} canAct={canAct} />}

                    {STAGES.map((stage) => {
                        if (stage.id === 'followup-1') {
                            // Render all 3 follow-up slots if they exist
                            return (
                                <React.Fragment key="followups-group">
                                    <StageRemarkCard stage={stage} lead={lead} canAct={canAct} />
                                    <StageRemarkCard 
                                        stage={{ ...stage, remarkKey: 'remark_followup_2', timestampKey: 'stage_followup_2_at', label: 'Follow up 2' }} 
                                        lead={lead} 
                                        canAct={canAct} 
                                    />
                                    <StageRemarkCard 
                                        stage={{ ...stage, remarkKey: 'remark_followup_3', timestampKey: 'stage_followup_3_at', label: 'Follow up 3' }} 
                                        lead={lead} 
                                        canAct={canAct} 
                                    />
                                </React.Fragment>
                            );
                        }
                        return <StageRemarkCard key={stage.id} stage={stage} lead={lead} canAct={canAct} />
                    })}

                    {!STAGES.some(s => lead[s.remarkKey as keyof Lead]) && !lead.general_remarks && (
                        <div className="lp-no-remarks">No stage remarks have been recorded yet.</div>
                    )}
                </div>
            </div>
            
            <PreTherapyCallFormModal
                isOpen={isEditingForm}
                leadName={lead.name}
                leadId={lead.id}
                fromStage={lead.pipeline_stage}
                initialAge={lead.age?.toString()}
                isEditMode={true}
                initialData={pretherapyForm}
                onConfirm={handleEditFormSubmit}
                onCancel={() => setIsEditingForm(false)}
            />

            <SendBookingModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setPrefilledClientData(undefined);
                }}
                prefilledClient={prefilledClientData}
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
                                    Delete Lead?
                                </h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    Are you sure you want to delete "{lead?.name}"? This action cannot be undone.
                                </p>
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
                                onClick={handleDeleteLead}
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

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    )
}

export default LeadProfile
