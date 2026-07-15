import React, { useState } from 'react';
import { X, Download, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import MonthFilter from './MonthFilter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()}`;
  };
  
  const [exportMonth, setExportMonth] = useState(getCurrentMonth());
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const STAGES = [
    { id: 'lead-inquire', label: 'Lead / Inquire' },
    { id: 'pretherapy-call', label: 'Pre-therapy Call' },
    { id: 'followup-1', label: 'Follow Ups' },
    { id: 'booked-first-session', label: 'Booked First Session' },
    { id: 'referred', label: 'Referred' },
    { id: 'closed', label: 'Closed' },
    { id: 'dropouts', label: 'Dropouts' }
  ];

  const STAGE_LABEL: Record<string, string> = Object.fromEntries(
    STAGES.map(s => [s.id, s.label])
  );

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    return `${day}-${month}-${year} ${formattedTime}`;
  };

  const getMonthYearString = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.toLocaleString('en-US', { month: 'long' })} ${date.getFullYear()}`;
  };

  const calculateAging = (createdDate: string): string => {
    if (!createdDate) return '';
    const created = new Date(createdDate);
    const today = new Date();
    const diffDays = Math.floor(Math.abs(today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day';
    return `${diffDays} days`;
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);

      const queryParams = new URLSearchParams();
      const isAllTime = !exportMonth || exportMonth === 'All Time';
      if (!isAllTime) {
        queryParams.append('statsMonth', exportMonth);
      }

      // Fetch Leads Data
      const leadsResponse = await fetch('/api/leads');
      if (!leadsResponse.ok) {
        throw new Error('Failed to fetch leads data');
      }
      const rawLeads = await leadsResponse.json();

      let filterMonthIndex = null;
      if (!isAllTime) {
        const [monthName, year] = exportMonth.split(' ');
        filterMonthIndex = {
          month: new Date(`${monthName} 1, ${year}`).getMonth(),
          year: parseInt(year, 10)
        };
      }

      const filteredLeads = rawLeads.filter((d: any) => {
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
        
        if (filterMonthIndex && displayDate) {
          const leadDate = new Date(displayDate);
          if (leadDate.getMonth() !== filterMonthIndex.month || leadDate.getFullYear() !== filterMonthIndex.year) {
            return false;
          }
        }
        return true;
      });

      const wb = XLSX.utils.book_new();

      // Leads Data
      const leadsHeaders = [];
      if (isAllTime) leadsHeaders.push('Month');
      leadsHeaders.push('Lead Name', 'Phone', 'Email', 'Source', 'Assigned Therapist', 'Stage', 'Aging', 'Lead Created At');

      const leadsExportRows = filteredLeads.map((d: any) => {
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

        const row = [];
        if (isAllTime) row.push(getMonthYearString(displayDate));
        
        row.push(
          d.name,
          d.phone,
          d.email || '',
          d.source,
          d.therapist_name || d.therapist_id || 'Unassigned',
          STAGE_LABEL[d.pipeline_stage || 'lead-inquire'] || (d.pipeline_stage || 'lead-inquire'),
          calculateAging(displayDate),
          formatDateTime(displayDate)
        );
        return row;
      });

      const wsLeads = XLSX.utils.aoa_to_sheet([leadsHeaders, ...leadsExportRows]);
      XLSX.utils.book_append_sheet(wb, wsLeads, 'Leads Data');

      XLSX.writeFile(wb, `Export_${isAllTime ? 'All_Time' : exportMonth.replace(' ', '_')}.xlsx`);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError('An error occurred while exporting data.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Export Leads Data</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
            <div className="w-full">
              <MonthFilter selectedMonth={exportMonth} onChange={setExportMonth} />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Exports the detailed leads data for the selected month.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={isExporting}
          >
            Cancel
          </button>
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isExporting ? 'Exporting...' : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
