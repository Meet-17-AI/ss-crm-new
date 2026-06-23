/**
 * Pre-Therapy Form Component
 * Purpose: Interface for pre-therapy form with autosave
 * Phase 2: Workflow Efficiency - Component 2.1
 */

import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { useAutosave } from '../hooks/useAutosave';
import { Call, Message, Folder, Danger, TickSquare } from 'react-iconly';

interface PretherapyFormComponentProps {
  leadId: string;
  initialData?: any;
  onSaved?: () => void;
  onCancel?: () => void;
}

const PretherapyFormComponent: React.FC<PretherapyFormComponentProps> = ({
  leadId,
  initialData = {},
  onSaved,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    consultationOutcome: initialData?.consultationOutcome || '',
    clinicalNotes: initialData?.clinicalNotes || '',
    therapyRecommendation: initialData?.therapyRecommendation || '',
    additionalObservations: initialData?.additionalObservations || ''
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use autosave hook
  const { saveStatus, lastSavedAt, handleChange, manualSave } = useAutosave({
    leadId,
    formType: 'pretherapy_form',
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
      await axios.post(`/api/leads/${leadId}/forms/pretherapy`, formData);
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
        <h3 className="font-bold text-gray-900">Pre-Therapy Form</h3>
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
        {/* Consultation Outcome */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Consultation Outcome
          </label>
          <select
            value={formData.consultationOutcome}
            onChange={(e) => handleFieldChange('consultationOutcome', e.target.value)}
            className="w-full px-2 py-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select outcome...</option>
            <option value="positive">Positive - Ready for therapy</option>
            <option value="neutral">Neutral - Needs discussion</option>
            <option value="concerns">Has concerns - Follow up needed</option>
            <option value="not_ready">Not ready - Not suitable</option>
          </select>
        </div>

        {/* Clinical Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Clinical Observations
          </label>
          <textarea
            value={formData.clinicalNotes}
            onChange={(e) => handleFieldChange('clinicalNotes', e.target.value)}
            placeholder="Record clinical observations from pre-therapy call..."
            className="w-full px-2 py-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>

        {/* Therapy Recommendation */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Recommended Therapy Type
          </label>
          <select
            value={formData.therapyRecommendation}
            onChange={(e) => handleFieldChange('therapyRecommendation', e.target.value)}
            className="w-full px-2 py-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select therapy type...</option>
            <option value="individual">Individual Therapy</option>
            <option value="couples">Couples Therapy</option>
            <option value="adolescent">Adolescent Therapy</option>
            <option value="group">Group Therapy</option>
          </select>
        </div>

        {/* Additional Observations */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Additional Observations
          </label>
          <textarea
            value={formData.additionalObservations}
            onChange={(e) => handleFieldChange('additionalObservations', e.target.value)}
            placeholder="Any additional notes..."
            className="w-full px-2 py-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-300">
        <button
          onClick={async () => {
            const res = await axios.post(`/api/leads/${leadId}/interactions/log`, {
              interactionType: 'call',
              interactionDetail: 'Scheduled pre-therapy call'
            });
            if (res.data.success) handleSubmit();
          }}
          className="flex items-center justify-center gap-1 px-2 py-2 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600"
        >
          <Call size="small" /> Call
        </button>
        <button
          onClick={async () => {
            const res = await axios.post(`/api/leads/${leadId}/interactions/log`, {
              interactionType: 'email',
              interactionDetail: 'Sent pre-therapy information'
            });
            if (res.data.success) handleSubmit();
          }}
          className="flex items-center justify-center gap-1 px-2 py-2 bg-purple-500 text-white rounded text-xs font-medium hover:bg-purple-600"
        >
          <Message size="small" /> Email
        </button>
        <button
          onClick={async () => {
            const res = await axios.post(`/api/leads/${leadId}/interactions/log`, {
              interactionType: 'text',
              interactionDetail: 'Sent text message'
            });
            if (res.data.success) handleSubmit();
          }}
          className="flex items-center justify-center gap-1 px-2 py-2 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600"
        >
          <Message size="small" /> Text
        </button>
      </div>

      {/* Save Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className={`flex-grow flex items-center justify-center gap-1 px-3 py-2 rounded text-sm font-medium text-white transition-all ${
            saving
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 active:bg-green-700'
          }`}
        >
          {saving ? 'Saving...' : <><TickSquare size="small" /> Save Form</>}
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

export default PretherapyFormComponent;
