/**
 * Pipeline Card with Toggle System
 * Purpose: Switch between Pre-therapy Form and Follow-up Remarks
 * Phase 2: Workflow Efficiency - Component 2.1
 * Location: Pipeline view
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PretherapyFormComponent from './PretherapyFormComponent';
import FollowupRemarksComponent from './FollowupRemarksComponent';
import PretherapyIconComponent from './PretherapyIconComponent';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  pipeline_stage: string;
  source?: string;
  sales_agent_name?: string;
  therapist_name?: string;
  last_interaction_at?: string;
  hours_inactive?: number;
  pretherapy_completed?: boolean;
}

interface PipelineCardWithToggleProps {
  lead: Lead;
  onDragStart?: (e: React.DragEvent, lead: Lead) => void;
  onClick?: (lead: Lead) => void;
  onFormSaved?: (lead: Lead) => void;
}

type FormType = 'pretherapy' | 'followup';

const PipelineCardWithToggle: React.FC<PipelineCardWithToggleProps> = ({
  lead,
  onDragStart,
  onClick,
  onFormSaved
}) => {
  const [activeForm, setActiveForm] = useState<FormType>('pretherapy');
  const [showMenu, setShowMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Fetch form data on mount
  useEffect(() => {
    fetchFormData();
  }, [lead.id]);

  const fetchFormData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/leads/${lead.id}/forms`);
      setFormData(response.data.data);
    } catch (error) {
      console.error('Error fetching form data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format interaction time
  const formatInteractionTime = () => {
    if (!lead.last_interaction_at) return 'No interaction yet';
    const diff = Math.round((new Date().getTime() - new Date(lead.last_interaction_at).getTime()) / (1000 * 60 * 60));
    if (diff < 1) return 'Just now';
    if (diff < 24) return `${diff}h ago`;
    return `${Math.floor(diff / 24)}d ago`;
  };

  // Get color based on hours inactive
  const getInteractionColor = () => {
    const hours = lead.hours_inactive || 0;
    if (hours < 24) return 'green';
    if (hours < 72) return 'yellow';
    return 'red';
  };

  const colorClass = {
    green: 'border-l-green-500 bg-green-50',
    yellow: 'border-l-yellow-500 bg-yellow-50',
    red: 'border-l-red-500 bg-red-50'
  }[getInteractionColor()];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`border-2 border-l-4 rounded-lg p-4 hover:shadow-lg transition-all cursor-move ${colorClass}`}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-gray-900 truncate">{lead.name}</h4>
          <p className="text-xs text-gray-600">{lead.email}</p>
        </div>

        {/* Menu Button */}
        <div className="relative ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            ⋮
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-40">
              <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Send Booking Link
              </button>
              <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Mark Unresponsive
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contact Info */}
      <div className="text-xs text-gray-600 space-y-0.5 mb-3">
        <p>📱 {lead.phone}</p>
        {lead.source && <p>📌 {lead.source}</p>}
      </div>

      {/* Pre-therapy Status Icon */}
      <div className="mb-3">
        <PretherapyIconComponent completed={lead.pretherapy_completed} />
      </div>

      {/* Last Interaction */}
      <div className="text-xs font-medium text-gray-700 mb-3">
        Last Contact: {formatInteractionTime()}
      </div>

      {/* Toggle Buttons */}
      <div className="flex gap-2 mb-4 p-2 bg-white bg-opacity-60 rounded-lg">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveForm('pretherapy');
            setIsExpanded(true);
          }}
          className={`flex-1 py-2 px-2 text-xs font-medium rounded transition-all ${
            activeForm === 'pretherapy'
              ? 'bg-blue-500 text-white shadow'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📋 Pre-therapy
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveForm('followup');
            setIsExpanded(true);
          }}
          className={`flex-1 py-2 px-2 text-xs font-medium rounded transition-all ${
            activeForm === 'followup'
              ? 'bg-blue-500 text-white shadow'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          ↗️ Follow-up
        </button>
      </div>

      {/* Form Content (Collapsed by Default) */}
      {!isExpanded ? (
        <div className="text-center py-2 text-xs text-gray-500">
          Click toggle button to edit
        </div>
      ) : (
        <div className="mt-4 pt-4 border-t border-gray-300">
          {loading ? (
            <div className="text-center py-4">
              <div className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-xs text-gray-600 mt-2">Loading form...</p>
            </div>
          ) : activeForm === 'pretherapy' ? (
            <PretherapyFormComponent
              leadId={lead.id}
              initialData={formData?.pretherapy?.fields}
              onSaved={() => {
                onFormSaved?.(lead);
                setIsExpanded(false);
                fetchFormData();
              }}
              onCancel={() => setIsExpanded(false)}
            />
          ) : (
            <FollowupRemarksComponent
              leadId={lead.id}
              initialData={formData?.followup?.fields}
              onSaved={() => {
                onFormSaved?.(lead);
                setIsExpanded(false);
                fetchFormData();
              }}
              onCancel={() => setIsExpanded(false)}
            />
          )}
        </div>
      )}

      {/* Footer: Manager & Therapist */}
      {!isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-300 space-y-1 text-xs text-gray-600">
          {lead.sales_agent_name && <p>👤 {lead.sales_agent_name}</p>}
          {lead.therapist_name && <p>🏥 {lead.therapist_name}</p>}
        </div>
      )}
    </div>
  );
};

export default PipelineCardWithToggle;
