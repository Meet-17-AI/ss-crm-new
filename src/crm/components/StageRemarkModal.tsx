import React, { useState, useEffect, useRef } from 'react';
import './StageRemarkModal.css';

interface StageRemarkModalProps {
    isOpen: boolean;
    fromStage: string;
    toStage: string;
    leadName: string;
    onConfirm: (remark: string, followUpDate?: string, futureAction?: string) => void;
    onCancel: () => void;
}

const STAGE_LABELS: Record<string, string> = {
    'lead-inquire': 'Lead / Inquire',
    'followup-1': 'Follow Ups',
    'pretherapy-call': 'Pre-therapy Call',
    'booked-first-session': 'Booked First Session',
    'referred': 'Referred',
    'closed': 'Closed',
    'dropouts': 'Unresponsive',
    'leaks': 'Leaks',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function formatDisplay(dateStr: string) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return d + '/' + m + '/' + y;
}

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
}

interface MiniCalendarProps {
    value: string;
    min: string;
    onChange: (val: string) => void;
    onClose: () => void;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({ value, min, onChange, onClose }) => {
    const today = new Date();
    const initDate = value ? new Date(value + 'T00:00:00') : today;
    const [viewYear, setViewYear] = useState(initDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(initDate.getMonth());

    const minDate = min ? new Date(min + 'T00:00:00') : null;
    const selectedDate = value ? new Date(value + 'T00:00:00') : null;

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const handleDay = (day: number) => {
        const mm = String(viewMonth + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        const val = viewYear + '-' + mm + '-' + dd;
        onChange(val);
        onClose();
    };

    const isDisabled = (day: number) => {
        if (!minDate) return false;
        const d = new Date(viewYear, viewMonth, day);
        return d < minDate;
    };

    const isSelected = (day: number) => {
        if (!selectedDate) return false;
        return selectedDate.getFullYear() === viewYear &&
               selectedDate.getMonth() === viewMonth &&
               selectedDate.getDate() === day;
    };

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999,
            background: '#fff', border: '1.5px solid #d1d5db', borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '12px', width: '260px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <button type="button" onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#374151', padding: '2px 6px' }}>&#8249;</button>
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>{MONTHS[viewMonth]} {viewYear}</span>
                <button type="button" onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#374151', padding: '2px 6px' }}>&#8250;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
                {DAYS.map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#9ca3af', padding: '2px 0' }}>{d}</div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {cells.map((day, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                        {day ? (
                            <button
                                type="button"
                                disabled={isDisabled(day)}
                                onClick={() => handleDay(day)}
                                style={{
                                    width: '32px', height: '32px', borderRadius: '50%', border: 'none',
                                    cursor: isDisabled(day) ? 'not-allowed' : 'pointer',
                                    background: isSelected(day) ? '#21615D' : 'transparent',
                                    color: isDisabled(day) ? '#d1d5db' : isSelected(day) ? '#fff' : '#111827',
                                    fontWeight: isSelected(day) ? 700 : 400,
                                    fontSize: '13px',
                                }}
                                onMouseEnter={e => { if (!isDisabled(day) && !isSelected(day)) (e.target as HTMLButtonElement).style.background = '#f0fdf4'; }}
                                onMouseLeave={e => { if (!isSelected(day)) (e.target as HTMLButtonElement).style.background = 'transparent'; }}
                            >
                                {day}
                            </button>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
};

const StageRemarkModal: React.FC<StageRemarkModalProps> = ({
    isOpen, fromStage, toStage, leadName, onConfirm, onCancel,
}) => {
    const [remark, setRemark] = useState('');
    const [followUpDate, setFollowUpDate] = useState('');
    const [futureAction, setFutureAction] = useState('');
    const [calOpen, setCalOpen] = useState(false);
    const [showError, setShowError] = useState(false);
    const calRef = useRef<HTMLDivElement>(null);

    const isFollowUp = toStage === 'followup-1';
    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        if (isOpen) { setRemark(''); setFollowUpDate(''); setFutureAction(''); setCalOpen(false); setShowError(false); }
    }, [isOpen]);

    useEffect(() => {
        if (!calOpen) return;
        const handler = (e: MouseEvent) => {
            if (calRef.current && !calRef.current.contains(e.target as Node)) {
                setCalOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [calOpen]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (!remark.trim()) { setShowError(true); return; }
        onConfirm(remark.trim(), isFollowUp && followUpDate ? followUpDate : undefined, futureAction || undefined);
    };

    return (
        <div className="stage-remark-overlay" onClick={onCancel}>
            <div className="stage-remark-modal" onClick={e => e.stopPropagation()}>
                <div className="stage-remark-header">
                    <h3>{fromStage === toStage ? 'Update Follow-up — ' + leadName : 'Stage Update — ' + leadName}</h3>
                    <p>{fromStage === toStage ? 'Add a note for this follow-up attempt.' : 'Add a remark before confirming the stage change.'}</p>
                </div>

                {fromStage !== toStage && (
                    <div className="stage-arrow">
                        <span className="stage-badge from">{STAGE_LABELS[fromStage] || fromStage}</span>
                        <svg className="stage-arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                        </svg>
                        <span className="stage-badge to">{STAGE_LABELS[toStage] || toStage}</span>
                    </div>
                )}

                {(toStage === 'followup-1' || toStage === 'pretherapy-call') && (
                    <div style={{ marginBottom: '16px' }}>
                        <label className="stage-remark-label" style={{ display: 'block', marginBottom: '6px' }}>
                            Future Action <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '12px' }}>(optional)</span>
                        </label>
                        <select
                            value={futureAction}
                            onChange={e => setFutureAction(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 14px', border: '1.5px solid #d1d5db',
                                borderRadius: '8px', fontSize: '14px', background: '#fff', cursor: 'pointer',
                                color: futureAction ? '#111827' : '#9ca3af',
                            }}
                        >
                            <option value="">Select action...</option>
                            <option value="Call">Call</option>
                            <option value="Email">Email</option>
                            <option value="Text">Text</option>
                        </select>
                    </div>
                )}

                {isFollowUp && (
                    <div style={{ marginBottom: '16px', position: 'relative' }} ref={calRef}>
                        <label className="stage-remark-label" style={{ display: 'block', marginBottom: '6px' }}>
                            Follow-up Date <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '12px' }}>(optional)</span>
                        </label>
                        <button
                            type="button"
                            onClick={() => setCalOpen(o => !o)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 14px', border: '1.5px solid ' + (calOpen ? '#21615D' : '#d1d5db'),
                                borderRadius: '8px', fontSize: '14px', background: '#fff', cursor: 'pointer',
                                color: followUpDate ? '#111827' : '#9ca3af',
                            }}
                        >
                            <span>{followUpDate ? formatDisplay(followUpDate) : 'Select date'}</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                        </button>
                        {calOpen && (
                            <MiniCalendar
                                value={followUpDate}
                                min={today}
                                onChange={setFollowUpDate}
                                onClose={() => setCalOpen(false)}
                            />
                        )}
                    </div>
                )}

                <label className="stage-remark-label">
                    {fromStage === toStage ? 'Follow-up Notes' : 'Remark for "' + (STAGE_LABELS[toStage] || toStage) + '" stage'}
                    <span>*</span>
                </label>
                <textarea
                    className={'stage-remark-textarea' + (showError ? ' error' : '')}
                    placeholder={'What happened at the ' + (STAGE_LABELS[toStage] || toStage) + ' stage?'}
                    value={remark}
                    onChange={e => { setRemark(e.target.value); if (e.target.value.trim()) setShowError(false); }}
                    autoFocus={!isFollowUp}
                />
                {showError && <div className="stage-remark-error">A remark is required to proceed.</div>}

                <div className="stage-remark-footer">
                    <button className="btn-cancel" onClick={onCancel}>Cancel</button>
                    <button className="btn-confirm" onClick={handleConfirm}>
                        {fromStage === toStage ? 'Update Follow-up' : 'Confirm Move'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StageRemarkModal;
