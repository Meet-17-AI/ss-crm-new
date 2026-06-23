/**
 * Pipeline Card with Interaction Status
 * Purpose: Display lead on pipeline with color-coded 24-hour interaction tracking
 * Phase 1: Data Accuracy - Component 1.3 Frontend
 * Location: Pipeline view (replaces existing PipelineCard)
 *
 * Color Coding:
 * - Green: Contacted within 24 hours
 * - Yellow: No contact in 1-3 days
 * - Red: No contact in 3+ days (URGENT)
 */

import React, { useState } from 'react';
import { Lead } from '../types'; // Adjust based on your types

interface PipelineCardProps {
  lead: Lead & {
    last_interaction_at?: string;
    last_interaction_type?: string;
    hours_inactive?: number;
  };
  onDragStart?: (e: React.DragEvent, lead: Lead) => void;
  onClick?: (lead: Lead) => void;
  onAddRemark?: (lead: Lead) => void;
  onSendBookingLink?: (lead: Lead) => void;
}

const PipelineCardWithInteractionStatus: React.FC<PipelineCardProps> = ({
  lead,
  onDragStart,
  onClick,
  onAddRemark,
  onSendBookingLink
}) => {
  const [showMenu, setShowMenu] = useState(false);

  // Calculate interaction status
  const getInteractionStatus = () => {
    const hoursInactive = lead.hours_inactive || 0;

    if (hoursInactive < 24) {
      return {
        status: 'green',
        label: 'Contacted today',
        urgency: 'low'
      };
    } else if (hoursInactive < 72) {
      return {
        status: 'yellow',
        label: `${Math.floor(hoursInactive / 24)} days inactive`,
        urgency: 'medium'
      };
    } else {
      return {
        status: 'red',
        label: `${Math.floor(hoursInactive / 24)} days - URGENT`,
        urgency: 'high'
      };
    }
  };

  // Format last interaction time
  const formatLastInteraction = () => {
    if (!lead.last_interaction_at) {
      const createdDate = new Date(lead.created_at);
      const now = new Date();
      const diffHours = Math.round((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60));
      return `${diffHours}h inactive (since creation)`;
    }

    const interactionDate = new Date(lead.last_interaction_at);
    const now = new Date();
    const diffMs = now.getTime() - interactionDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs / (1000 * 60)) % 60);

    if (diffHours < 1) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const interactionStatus = getInteractionStatus();

  // Color styling based on interaction status
  const colorClasses: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200 border-l-4 border-l-green-500',
      text: 'text-green-600',
      badge: 'bg-green-100 text-green-800'
    },
    yellow: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200 border-l-4 border-l-yellow-500',
      text: 'text-yellow-600',
      badge: 'bg-yellow-100 text-yellow-800'
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200 border-l-4 border-l-red-500',
      text: 'text-red-600',
      badge: 'bg-red-100 text-red-800'
    }
  };

  const colors = colorClasses[interactionStatus.status];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={() => onClick?.(lead)}
      className={`${colors.bg} ${colors.border} rounded-lg p-4 cursor-move hover:shadow-md transition-all`}
    >
      {/* Top Section: Name and Status */}
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

          {/* Dropdown Menu */}
          {showMenu && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-40">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSendBookingLink?.(lead);
                  setShowMenu(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Send Booking Link
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddRemark?.(lead);
                  setShowMenu(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Add Remark
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border-t"
              >
                Mark Unresponsive
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Phone and Contact Info */}
      <div className="mb-3 text-xs text-gray-600 space-y-0.5">
        <p>📱 {lead.phone}</p>
        {lead.source && <p>📌 {lead.source}</p>}
      </div>

      {/* Interaction Status Badge */}
      <div className="mb-3">
        <div
          className={`inline-block px-2 py-1 rounded text-xs font-medium ${colors.badge}`}
        >
          {interactionStatus.label}
        </div>
      </div>

      {/* Last Interaction Time */}
      <div className={`text-xs font-medium ${colors.text} mb-3`}>
        Last Contact: {formatLastInteraction()}
      </div>

      {/* Bottom Section: Assigned Manager and Therapist */}
      <div className="pt-3 border-t border-gray-300 space-y-1 text-xs">
        {lead.sales_agent_id && (
          <p className="text-gray-600">
            <span className="font-medium">Manager:</span> {lead.sales_agent_name || 'Unassigned'}
          </p>
        )}
        {lead.therapist_id && (
          <p className="text-gray-600">
            <span className="font-medium">Therapist:</span> {lead.therapist_name || 'Pending'}
          </p>
        )}
      </div>

      {/* Urgency Indicator (Red card shows small icon) */}
      {interactionStatus.urgency === 'high' && (
        <div className="mt-3 text-center">
          <span className="text-red-600 font-bold text-sm">⚠ NEEDS IMMEDIATE ACTION</span>
        </div>
      )}
    </div>
  );
};

export default PipelineCardWithInteractionStatus;

/**
 * INTEGRATION INSTRUCTIONS:
 *
 * 1. Replace existing PipelineCard import in PipelineContent.tsx:
 *    OLD: import PipelineCard from './PipelineCard'
 *    NEW: import PipelineCardWithInteractionStatus from './PipelineCardWithInteractionStatus'
 *
 * 2. Update the component usage in render:
 *    OLD: <PipelineCard lead={lead} ... />
 *    NEW: <PipelineCardWithInteractionStatus lead={lead} ... />
 *
 * 3. Ensure lead objects passed include these new fields:
 *    - last_interaction_at (ISO timestamp or null)
 *    - last_interaction_type (string or null)
 *    - hours_inactive (number, calculated on backend)
 *
 * 4. Add sorting/filtering options to Pipeline view:
 *    - Sort by "Last Contact" (oldest first shows red cards first)
 *    - Filter by "Not Contacted 24h" (shows only yellow/red cards)
 *
 * 5. Optional: Add a quick stats bar at top of pipeline:
 *    - Green: X leads contacted today
 *    - Yellow: X leads inactive 1-3 days
 *    - Red: X leads inactive 3+ days (needs attention)
 */
