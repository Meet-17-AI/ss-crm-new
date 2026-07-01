/**
 * Follow-up Remarks Component
 * Purpose: Interface for follow-up remarks with autosave
 * Phase 2: Workflow Efficiency - Component 2.1
 */

import React, { useState } from 'react';
import axios from 'axios';
import { useAutosave } from '../hooks/useAutosave';
import { Call, Message, Calendar, Folder, Danger, TickSquare } from 'react-iconly';

interface FollowupRemarksComponentProps {
  leadId: string;
  initialData?: any;
  onSaved?: () => void;
  onCancel?: () => void;
}

const FollowupRemarksComponent: React.FC<FollowupRemarksComponentProps> = ({
  leadId,
  initialData = {},
  onSaved,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    notes: initialData?.notes || '',
    nextAction: initialData?.nextAction || 'call',
    followupDate: initialData?.followupDate || ''
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use autosave hook
  const { saveStatus, lastSavedAt, handleChange } = useAutosave({
    leadId,
    formType: 'followup_remarks',
    interval: 30000,
    onError: (err) => setError(err.message)
  });

  // Handle field change
  const handleFieldChange = (field: string, value: string) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    handleChange(newData);
  };

  // Submit form
  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError(null);
      await axios.post(`/api/leads/${leadId}/forms/followup`, formData);
      onSaved?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save form');
      console.error('Error saving form:', err);
    } finally {
      setSaving(false);
    }
  };

  // Render save status
  const renderSaveStatus = () => {
    if (saveStatus === 'saving') {
      return (
        <span className="flex items-center gap-1">
          <Folder size="small" /> Saving...
        </span>
      );
    }
    if (saveStatus === 'saved' && lastSavedAt) {
      return (
        <span className="flex items-center gap-1 text-green-600">
          <TickSquare size="small" /> Saved at {lastSavedAt.toLocaleTimeString()}
        </span>
      );
    }
    if (saveStatus === 'error') {
      return (
        <span className="flex items-center gap-1 text-red-600">
          <Danger size="small" /> Save failed
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">Follow-up Notes</h3>
        <span className="text-xs font-medium">
          {renderSaveStatus()}
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-2 bg-red-100 border border-red-300 rounded text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-3">
        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Follow-up Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            placeholder="Record follow-up conversation, objections, next steps..."
            className="w-full px-2 py-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
          />
        </div>

        {/* Next Action */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Next Action
          </label>
          <select
            value={formData.nextAction}
            onChange={(e) => handleFieldChange('nextAction', e.target.value)}
            className="w-full px-2 py-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="text">Text Message</option>
            <option value="meeting">Schedule Meeting</option>
            <option value="send_link">Send Booking Link</option>
            <option value="wait">Wait for Response</option>
          </select>
        </div>

        {/* Follow-up Date */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Schedule Follow-up For
          </label>
          <input
            type="datetime-local"
            value={formData.followupDate}
            onChange={(e) => handleFieldChange('followupDate', e.target.value)}
            className="w-full px-2 py-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>



      {/* Save Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className={`flex-grow flex items-center justify-center gap-1 px-3 py-2 rounded text-sm font-medium text-white transition-all ${
            saving
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-teal-700 hover:bg-teal-800 active:bg-teal-900'
          }`}
        >
          {saving ? 'Saving...' : <><TickSquare size="small" /> Save Notes</>}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-2 bg-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>

      {/* Autosave Info */}
      <div className="text-xs text-gray-500 text-center">
        Automatically saving every 30 seconds
      </div>
    </div>
  );
};

export default FollowupRemarksComponent;
