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

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);

      const queryParams = new URLSearchParams();
      if (exportMonth && exportMonth !== 'All Time') {
        queryParams.append('statsMonth', exportMonth);
      }

      const response = await fetch(`/api/analytics?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch KPI analytics data');
      }

      const data = await response.json();
      const wb = XLSX.utils.book_new();

      const kpiHeaders = ['Metric', 'Count'];
      const kpiRows = [
        ['Leads', data.totalLeads || 0],
        ['Pre-therapy Booked', data.pretherapyBooked || 0],
        ['Booked First Session', data.allTimeBookedCount || 0],
        ['Unresponsive', data.dropouts || 0],
        ['Closed', data.closed || 0],
        ['Referred', data.referred || 0]
      ];

      const wsKpi = XLSX.utils.aoa_to_sheet([kpiHeaders, ...kpiRows]);
      
      // Auto-size columns
      wsKpi['!cols'] = [
        { wch: 25 },
        { wch: 10 }
      ];

      XLSX.utils.book_append_sheet(wb, wsKpi, 'KPI Summary');

      XLSX.writeFile(wb, `KPI_Summary_${exportMonth.replace(' ', '_')}.xlsx`);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError('An error occurred while exporting KPI data.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Export KPI Summary</h2>
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
              Exports the total counts of all KPIs for the selected month.
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
