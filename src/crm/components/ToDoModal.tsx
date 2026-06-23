import React, { useState, useEffect } from 'react';
import './StageRemarkModal.css'; // Reusing some modal styles
import { Loader2, ClipboardList, Maximize2 } from 'lucide-react';

interface ToDoItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  follow_up_1_date?: string;
  follow_up_1_notes?: string;
  next_step?: string;
}

interface ToDoData {
  consultationCalls: ToDoItem[];
  followups: ToDoItem[];
}

interface ToDoModalProps {
  onViewLead: (leadId: string) => void;
  isFullPage?: boolean;
  setCurrentPage?: (page: string) => void;
}

const ToDoModal: React.FC<ToDoModalProps> = ({ onViewLead, isFullPage = false, setCurrentPage }) => {
  const [data, setData] = useState<ToDoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/crm/todo')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch todo list:', err);
        setLoading(false);
      });
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not set';
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div 
      className={`bg-white rounded-xl shadow-sm border border-gray-100 ${isFullPage ? 'h-full flex flex-col' : 'mb-8 overflow-hidden flex flex-col'}`} 
      style={isFullPage ? { width: '100%', height: 'calc(100vh - 100px)', margin: 0, border: 'none' } : { maxHeight: 350 }}
    >
      {/* Header */}
      <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10">
        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
          <ClipboardList className="w-5 h-5 text-teal-600" /> To-Do List {isFullPage && <span className="text-sm font-normal text-gray-500 ml-2">(Full View)</span>}
        </h2>
        {isFullPage ? (
          <button 
            onClick={() => setCurrentPage?.('analytics')}
            className="flex items-center gap-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors"
          >
            ← Back to Analytics
          </button>
        ) : (
          <button 
            onClick={() => setCurrentPage?.('full-todo')}
            className="px-4 py-1.5 bg-teal-50 text-[#21615D] border border-[#21615D] hover:bg-teal-100 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
          >
            <Maximize2 className="w-3.5 h-3.5 text-[#21615D]" /> View Full List
          </button>
        )}
      </div>

      {/* Body with precise scrolling limits */}
      <div className="p-5 overflow-y-auto custom-scrollbar" style={{ flex: 1 }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
            <span className="ml-2 text-gray-500 font-medium">Loading tasks...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>

            {/* Container 1: Lead / Enquire */}
            <div style={{ flex: 1, minWidth: 320, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: isFullPage ? 'calc(100vh - 220px)' : 280 }}>
              {/* Sticky colored header */}
              <div style={{ padding: '12px 16px', background: '#21615D', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Lead / Enquire</span>
                <span style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 20, padding: '2px 10px' }}>{data?.consultationCalls.length ?? 0}</span>
              </div>
              {/* Sticky column headers */}
              {(data?.consultationCalls.length ?? 0) > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, flexShrink: 0 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151' }}>Name</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151' }}>Phone</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151' }}>Email</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151' }}></th>
                    </tr>
                  </thead>
                </table>
              )}
              {/* Scrollable body */}
              <div style={{ overflowY: 'auto', overflowX: 'auto', flex: 1 }} className="custom-scrollbar">
                {data?.consultationCalls.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', padding: '16px' }}>No leads pending</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <tbody>
                      {data?.consultationCalls.map((item, i) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                          <td style={{ padding: '10px 12px', color: '#4b5563' }}>{item.phone}</td>
                          <td style={{ padding: '10px 12px', color: '#6b7280' }}>{item.email || '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <button onClick={() => onViewLead(item.id)} style={{ fontSize: 11, padding: '4px 10px', background: '#fff', color: '#21615D', borderRadius: 6, border: '1px solid #21615D', cursor: 'pointer', fontWeight: 600 }}>
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Container 2: Follow Ups */}
            <div style={{ flex: 1, minWidth: 320, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: isFullPage ? 'calc(100vh - 220px)' : 280 }}>
              {/* Sticky colored header */}
              <div style={{ padding: '12px 16px', background: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>To Be Followed Up</span>
                <span style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 20, padding: '2px 10px' }}>{data?.followups.length ?? 0}</span>
              </div>
              {/* Sticky column headers */}
              {(data?.followups.length ?? 0) > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, flexShrink: 0 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151' }}>Name</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151' }}>Phone</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151' }}>Scheduled Date</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151' }}>Notes</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151' }}></th>
                    </tr>
                  </thead>
                </table>
              )}
              {/* Scrollable body */}
              <div style={{ overflowY: 'auto', overflowX: 'auto', flex: 1 }} className="custom-scrollbar">
                {data?.followups.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', padding: '16px' }}>No follow-ups pending</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <tbody>
                      {data?.followups.map((item, i) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                          <td style={{ padding: '10px 12px', color: '#4b5563' }}>{item.phone}</td>
                          <td style={{ padding: '10px 12px', color: '#4b5563' }}>{formatDate(item.follow_up_1_date)}</td>
                          <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: 200 }}>{item.follow_up_1_notes || '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <button onClick={() => onViewLead(item.id)} style={{ fontSize: 11, padding: '4px 10px', background: '#fff', color: '#21615D', borderRadius: 6, border: '1px solid #21615D', cursor: 'pointer', fontWeight: 600 }}>
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default ToDoModal;
