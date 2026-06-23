/**
 * Interaction Timeline
 * Purpose: Display complete interaction history for a lead
 * Phase 1: Data Accuracy - Component 1.3 Frontend
 * Location: Lead Profile (sidebar or expandable section)
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Interaction {
  interaction_id: number;
  interaction_type: string;
  interaction_detail: string;
  interacted_by: string;
  interacted_at: string;
  from_stage?: string;
  to_stage?: string;
  booking_linked?: boolean;
}

interface InteractionTimelineProps {
  leadId: string;
  leadName: string;
}

const InteractionTimeline: React.FC<InteractionTimelineProps> = ({ leadId, leadName }) => {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logFormOpen, setLogFormOpen] = useState(false);
  const [newInteraction, setNewInteraction] = useState({
    interactionType: 'call',
    interactionDetail: ''
  });

  // Fetch interactions
  const fetchInteractions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/leads/${leadId}/interactions?limit=50`);
      setInteractions(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch interactions');
      console.error('Error fetching interactions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Log new interaction
  const handleLogInteraction = async () => {
    if (!newInteraction.interactionDetail.trim()) {
      alert('Please enter interaction details');
      return;
    }

    try {
      await axios.post('/api/interactions/log', {
        leadId,
        interactionType: newInteraction.interactionType,
        interactionDetail: newInteraction.interactionDetail
      });

      setNewInteraction({ interactionType: 'call', interactionDetail: '' });
      setLogFormOpen(false);
      fetchInteractions(); // Refresh list
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to log interaction');
      console.error('Error logging interaction:', err);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get icon for interaction type
  const getInteractionIcon = (type: string) => {
    const icons: Record<string, { emoji: string; label: string; color: string }> = {
      call: { emoji: '📞', label: 'Call', color: 'bg-blue-100 text-blue-700' },
      email: { emoji: '📧', label: 'Email', color: 'bg-purple-100 text-purple-700' },
      text: { emoji: '💬', label: 'Text', color: 'bg-green-100 text-green-700' },
      stage_move: { emoji: '↗️', label: 'Stage Change', color: 'bg-orange-100 text-orange-700' },
      form_submit: { emoji: '📋', label: 'Form Submitted', color: 'bg-indigo-100 text-indigo-700' },
      remark_added: { emoji: '📝', label: 'Remark', color: 'bg-gray-100 text-gray-700' },
      merge_duplicate: { emoji: '🔗', label: 'Lead Merged', color: 'bg-red-100 text-red-700' },
      manual_update: { emoji: '✏️', label: 'Manual Update', color: 'bg-yellow-100 text-yellow-700' },
      created: { emoji: '✨', label: 'Lead Created', color: 'bg-green-100 text-green-700' }
    };

    return icons[type] || { emoji: '•', label: 'Interaction', color: 'bg-gray-100 text-gray-700' };
  };

  // Load interactions on mount
  useEffect(() => {
    fetchInteractions();
  }, [leadId]);

  const interactionIcon = (type: string) => getInteractionIcon(type);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <h3 className="text-lg font-bold text-gray-900">
          Interaction History for {leadName}
        </h3>
        <button
          onClick={() => setLogFormOpen(!logFormOpen)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium text-sm"
        >
          + Log Interaction
        </button>
      </div>

      {/* Log Interaction Form */}
      {logFormOpen && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Log New Interaction</h4>

          <div className="space-y-3">
            {/* Interaction Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={newInteraction.interactionType}
                onChange={(e) =>
                  setNewInteraction({ ...newInteraction, interactionType: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="call">📞 Call</option>
                <option value="email">📧 Email</option>
                <option value="text">💬 Text/Message</option>
                <option value="stage_move">↗️ Stage Change</option>
                <option value="form_submit">📋 Form Submitted</option>
                <option value="remark_added">📝 Remark Added</option>
                <option value="manual_update">✏️ Manual Update</option>
              </select>
            </div>

            {/* Details */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Details
              </label>
              <textarea
                value={newInteraction.interactionDetail}
                onChange={(e) =>
                  setNewInteraction({ ...newInteraction, interactionDetail: e.target.value })
                }
                placeholder="What happened in this interaction?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setLogFormOpen(false);
                  setNewInteraction({ interactionType: 'call', interactionDetail: '' });
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleLogInteraction}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium text-sm"
              >
                Log Interaction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block w-6 h-6 border-3 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 mt-2 text-sm">Loading interactions...</p>
        </div>
      ) : interactions.length === 0 ? (
        <div className="text-center py-8 text-gray-600">
          <p>No interactions logged yet.</p>
          <p className="text-sm text-gray-500 mt-1">Click "Log Interaction" to get started.</p>
        </div>
      ) : (
        // Timeline
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 to-gray-300"></div>

          {/* Interactions */}
          <div className="space-y-6">
            {interactions.map((interaction, idx) => {
              const icon = interactionIcon(interaction.interaction_type);
              return (
                <div key={interaction.interaction_id} className="relative pl-16">
                  {/* Timeline Dot */}
                  <div className={`absolute left-0 w-12 h-12 rounded-full flex items-center justify-center text-lg ${icon.color}`}>
                    {icon.emoji}
                  </div>

                  {/* Content */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    {/* Type Badge and Time */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${icon.color}`}>
                        {icon.label}
                      </span>
                      <span className="text-xs text-gray-600">{formatTime(interaction.interacted_at)}</span>
                    </div>

                    {/* Detail Text */}
                    <p className="text-gray-900 text-sm mb-2">{interaction.interaction_detail}</p>

                    {/* Stage Change Info */}
                    {interaction.from_stage && interaction.to_stage && (
                      <div className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-300 inline-block">
                        {interaction.from_stage} → {interaction.to_stage}
                      </div>
                    )}

                    {/* Who Did It */}
                    <div className="mt-2 pt-2 border-t border-gray-300 text-xs text-gray-600">
                      By: <span className="font-medium">{interaction.interacted_by}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-300 text-xs text-gray-600">
        <p>Showing {interactions.length} interactions</p>
        {interactions.length > 0 && (
          <p className="mt-1">
            Last interaction: {formatTime(interactions[0].interacted_at)}
          </p>
        )}
      </div>
    </div>
  );
};

export default InteractionTimeline;

/**
 * INTEGRATION INSTRUCTIONS:
 *
 * 1. Add InteractionTimeline to Lead Profile:
 *    In LeadProfile.tsx or similar component, add:
 *
 *    import InteractionTimeline from './InteractionTimeline';
 *
 *    Then in the JSX:
 *    <InteractionTimeline leadId={lead.id} leadName={lead.name} />
 *
 * 2. Place it in a good location on the profile:
 *    Option A: Right sidebar (below existing notes/remarks)
 *    Option B: Full-width section below contact info
 *    Option C: Collapsible panel (timeline hidden by default)
 *
 * 3. Ensure the lead object has:
 *    - id (UUID string)
 *    - name (string)
 *
 * 4. Optional: Add keyboard shortcut for "Log Interaction"
 *    Ctrl+L or Cmd+L to focus the log form
 *
 * 5. Optional: Add filters for interaction types
 *    e.g., "Show only calls" or "Show only last 7 days"
 */
