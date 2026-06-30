import React, { useState } from 'react';
import { X, Download, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportType, setExportType] = useState('both');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);

      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);
      if (exportType) queryParams.append('exportType', exportType);

      const response = await fetch(`/api/crm/export?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch export data');
      }

      const data = await response.json();
      const wb = XLSX.utils.book_new();

      if (data.leads && data.leads.length > 0) {
        const leadHeaders = [
          'Name', 'Phone', 'Email', 'City', 'Age', 'Source', 
          'Pipeline Stage', 'Created At', 'Sales Agent', 
          'Therapist', 'Consultation Outcome'
        ];
        const leadRows = data.leads.map((l: any) => [
          l.name || '',
          l.phone || '',
          l.email || '',
          l.city || '',
          l.age || '',
          l.source || '',
          l.pipeline_stage || '',
          l.created_at ? new Date(l.created_at).toLocaleString() : '',
          l.sales_agent_name || '',
          l.therapist_name || '',
          l.consultation_outcome || ''
        ]);
        const wsLeads = XLSX.utils.aoa_to_sheet([leadHeaders, ...leadRows]);
        XLSX.utils.book_append_sheet(wb, wsLeads, 'Leads');
      }

      if (data.bookings && data.bookings.length > 0) {
        const bookingHeaders = [
          'Invitee Name', 'Invitee Phone', 'Invitee Email', 
          'Host Name', 'Resource Name', 'Status', 'Mode',
          'Invitee Time', 'Created At', 'Start At'
        ];
        const bookingRows = data.bookings.map((b: any) => [
          b.invitee_name || '',
          b.invitee_phone || '',
          b.invitee_email || '',
          b.booking_host_name || '',
          b.booking_resource_name || '',
          b.booking_status || '',
          b.booking_mode || '',
          b.booking_invitee_time || '',
          b.invitee_created_at ? new Date(b.invitee_created_at).toLocaleString() : '',
          b.booking_start_at ? new Date(b.booking_start_at).toLocaleString() : ''
        ]);
        const wsBookings = XLSX.utils.aoa_to_sheet([bookingHeaders, ...bookingRows]);
        XLSX.utils.book_append_sheet(wb, wsBookings, 'Pre-Therapy Bookings');
      }

      if ((!data.leads || data.leads.length === 0) && (!data.bookings || data.bookings.length === 0)) {
        setError('No data found for the selected date range.');
        setIsExporting(false);
        return;
      }

      XLSX.writeFile(wb, `CRM_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Export to Excel</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date (Optional)</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date (Optional)</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What to Export</label>
            <select 
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-all"
            >
              <option value="both">Both Leads & Pre-therapy Bookings</option>
              <option value="leads">Leads Only</option>
              <option value="pretherapy">Pre-therapy Bookings Only</option>
            </select>
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
