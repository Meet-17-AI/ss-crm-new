/**
 * Pre-Therapy Icon Component
 * Purpose: Visual indicator for pre-therapy completion status
 * Phase 2: Workflow Efficiency - Component 2.4
 */

import React, { useState } from 'react';
import { TickSquare, Danger } from 'react-iconly';

interface PretherapyIconComponentProps {
  completed?: boolean;
  completedAt?: string;
  onClick?: () => void;
  showLabel?: boolean;
}

const PretherapyIconComponent: React.FC<PretherapyIconComponentProps> = ({
  completed = false,
  completedAt,
  onClick,
  showLabel = true
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (completed) {
    return (
      <div
        className="relative inline-flex items-center gap-2 cursor-help"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={onClick}
      >
        {/* Green checkmark */}
        <div className="inline-flex items-center justify-center w-6 h-6 bg-green-100 rounded-full text-green-600">
          <TickSquare size="small" set="bold" />
        </div>

        {showLabel && <span className="text-xs font-medium text-green-600">Pre-therapy Done</span>}

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
            Form submitted on {formatDate(completedAt)}
            <div className="absolute top-full left-2 w-2 h-2 bg-gray-900 transform rotate-45"></div>
          </div>
        )}
      </div>
    );
  }

  // Not completed
  return (
    <div
      className="relative inline-flex items-center gap-2 cursor-help"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onClick}
    >
      {/* Orange warning */}
      <div className="inline-flex items-center justify-center w-6 h-6 bg-orange-100 rounded-full text-orange-600">
        <Danger size="small" set="bold" />
      </div>

      {showLabel && <span className="text-xs font-medium text-orange-600">Pre-therapy Pending</span>}

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
          Pre-therapy form not yet submitted
          <div className="absolute top-full left-2 w-2 h-2 bg-gray-900 transform rotate-45"></div>
        </div>
      )}
    </div>
  );
};

export default PretherapyIconComponent;

