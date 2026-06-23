/**
 * Duplicate Detection Panel
 * Purpose: Find and merge duplicate leads
 * Phase 1: Data Accuracy - Component 1.2 Frontend
 * Location: CRM Dashboard or separate modal
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Duplicate {
  alert_id?: number;
  lead_id_1: string;
  name_1: string;
  email_1: string;
  phone_1: string;
  created_at_1: string;
  lead_id_2: string;
  name_2: string;
  email_2: string;
  phone_2: string;
  created_at_2: string;
  match_type: string;
  match_score: number;
  status?: string;
}

interface DuplicateDetectionPanelProps {
  onClose?: () => void;
}

const DuplicateDetectionPanel: React.FC<DuplicateDetectionPanelProps> = ({ onClose }) => {
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState<string | null>(null);
  const [selectedDuplicate, setSelectedDuplicate] = useState<Duplicate | null>(null);
  const [mergeNotes, setMergeNotes] = useState('');
  const [primaryLeadId, setPrimaryLeadId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch duplicates
  const fetchDuplicates = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/leads/duplicates?status=pending&limit=50');
      setDuplicates(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch duplicates');
      console.error('Error fetching duplicates:', err);
    } finally {
      setLoading(false);
    }
  };

  // Merge duplicates
  const handleMerge = async (duplicate: Duplicate, keepLeadId: string) => {
    const otherLeadId = keepLeadId === duplicate.lead_id_1 ? duplicate.lead_id_2 : duplicate.lead_id_1;

    try {
      setMerging(keepLeadId);
      setError(null);
      await axios.post('/api/leads/merge', {
        primaryLeadId: keepLeadId,
        secondaryLeadId: otherLeadId,
        mergeNotes: mergeNotes || 'Duplicate merged'
      });

      setSuccessMessage(`Successfully merged ${duplicate.name_2} into ${duplicate.name_1}`);
      setTimeout(() => {
        setSuccessMessage(null);
        setSelectedDuplicate(null);
        setMergeNotes('');
        fetchDuplicates(); // Refresh list
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to merge leads');
      console.error('Error merging leads:', err);
    } finally {
      setMerging(null);
    }
  };

  // Dismiss duplicate (for now, just remove from view)
  const handleDismiss = (duplicate: Duplicate) => {
    setDuplicates(duplicates.filter(d =>
      !(d.lead_id_1 === duplicate.lead_id_1 && d.lead_id_2 === duplicate.lead_id_2)
    ));
  };

  // Load duplicates on mount
  useEffect(() => {
    fetchDuplicates();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Duplicate Leads</h2>
          <p className="text-sm text-gray-600 mt-1">Found {duplicates.length} potential duplicates</p>
        </div>
        <button
          onClick={() => {
            setSelectedDuplicate(null);
            fetchDuplicates();
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium"
        >
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded text-green-700 text-sm">
          ✓ {successMessage}
        </div>
      )}

      {/* Loading State */}
      {loading && !selectedDuplicate ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 mt-3">Loading duplicates...</p>
        </div>
      ) : duplicates.length === 0 && !selectedDuplicate ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">✓</div>
          <p className="text-gray-600 font-medium">No duplicates found</p>
          <p className="text-gray-500 text-sm mt-1">All leads are unique!</p>
        </div>
      ) : selectedDuplicate ? (
        // Merge Confirmation View
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Lead 1 (Option A) */}
            <div
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                primaryLeadId === selectedDuplicate.lead_id_1
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => setPrimaryLeadId(selectedDuplicate.lead_id_1)}
            >
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="radio"
                  checked={primaryLeadId === selectedDuplicate.lead_id_1}
                  onChange={() => setPrimaryLeadId(selectedDuplicate.lead_id_1)}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="font-bold text-gray-900">Keep This Lead</span>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-gray-600">Name:</p>
                  <p className="font-medium text-gray-900">{selectedDuplicate.name_1}</p>
                </div>
                <div>
                  <p className="text-gray-600">Email:</p>
                  <p className="font-medium text-gray-900">{selectedDuplicate.email_1}</p>
                </div>
                <div>
                  <p className="text-gray-600">Phone:</p>
                  <p className="font-medium text-gray-900">{selectedDuplicate.phone_1}</p>
                </div>
                <div>
                  <p className="text-gray-600">Created:</p>
                  <p className="font-medium text-gray-900">
                    {new Date(selectedDuplicate.created_at_1).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Lead 2 (Option B) */}
            <div
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                primaryLeadId === selectedDuplicate.lead_id_2
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => setPrimaryLeadId(selectedDuplicate.lead_id_2)}
            >
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="radio"
                  checked={primaryLeadId === selectedDuplicate.lead_id_2}
                  onChange={() => setPrimaryLeadId(selectedDuplicate.lead_id_2)}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="font-bold text-gray-900">Keep This Lead</span>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-gray-600">Name:</p>
                  <p className="font-medium text-gray-900">{selectedDuplicate.name_2}</p>
                </div>
                <div>
                  <p className="text-gray-600">Email:</p>
                  <p className="font-medium text-gray-900">{selectedDuplicate.email_2}</p>
                </div>
                <div>
                  <p className="text-gray-600">Phone:</p>
                  <p className="font-medium text-gray-900">{selectedDuplicate.phone_2}</p>
                </div>
                <div>
                  <p className="text-gray-600">Created:</p>
                  <p className="font-medium text-gray-900">
                    {new Date(selectedDuplicate.created_at_2).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Match Info */}
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm text-blue-900">
              <strong>Match Type:</strong> {selectedDuplicate.match_type.toUpperCase()} (
              {Math.round(selectedDuplicate.match_score * 100)}% confidence)
            </p>
          </div>

          {/* Merge Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Merge Notes (Optional)
            </label>
            <textarea
              value={mergeNotes}
              onChange={(e) => setMergeNotes(e.target.value)}
              placeholder="Why are these leads duplicates?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setSelectedDuplicate(null);
                setPrimaryLeadId(null);
                setMergeNotes('');
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (primaryLeadId) {
                  handleMerge(selectedDuplicate, primaryLeadId);
                }
              }}
              disabled={!primaryLeadId || merging !== null}
              className={`px-6 py-2 rounded font-medium text-white transition-all ${
                !primaryLeadId || merging !== null
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 active:bg-green-700'
              }`}
            >
              {merging ? 'Merging...' : 'Merge Leads'}
            </button>
          </div>
        </div>
      ) : (
        // Duplicates List View
        <div className="space-y-3">
          {duplicates.map((duplicate, idx) => (
            <div
              key={idx}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Lead 1 */}
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Lead 1</p>
                      <p className="font-bold text-gray-900">{duplicate.name_1}</p>
                      <p className="text-sm text-gray-600">{duplicate.email_1}</p>
                      <p className="text-sm text-gray-600">{duplicate.phone_1}</p>
                    </div>

                    {/* Lead 2 */}
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Lead 2</p>
                      <p className="font-bold text-gray-900">{duplicate.name_2}</p>
                      <p className="text-sm text-gray-600">{duplicate.email_2}</p>
                      <p className="text-sm text-gray-600">{duplicate.phone_2}</p>
                    </div>
                  </div>

                  {/* Match Badge */}
                  <div className="mt-3">
                    <span className="inline-block bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded">
                      {duplicate.match_type.toUpperCase()} - {Math.round(duplicate.match_score * 100)}%
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => {
                      setSelectedDuplicate(duplicate);
                      setPrimaryLeadId(duplicate.lead_id_1);
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium text-sm"
                  >
                    Merge
                  </button>
                  <button
                    onClick={() => handleDismiss(duplicate)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 font-medium text-sm"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DuplicateDetectionPanel;
