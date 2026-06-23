/**
 * Sync Status Widget
 * Purpose: Display booking to CRM sync status and statistics
 * Phase 1: Data Accuracy - Component 1.1 Frontend
 * Location: CRM Dashboard
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface SyncStatus {
  sync_type: string;
  total_syncs: number;
  completed: number;
  failed: number;
  pending: number;
  total_records_processed: number;
  total_records_created: number;
  total_records_updated: number;
  last_sync_at: string | null;
}

interface SyncStatusWidgetProps {
  refreshInterval?: number; // milliseconds, default 5 minutes
}

const SyncStatusWidget: React.FC<SyncStatusWidgetProps> = ({ refreshInterval = 300000 }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch sync status
  const fetchSyncStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/sync/status');
      setSyncStatus(response.data.data);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch sync status');
      console.error('Error fetching sync status:', err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger manual sync
  const triggerSync = async () => {
    try {
      setIsSyncing(true);
      setError(null);
      await axios.post('/api/sync/trigger', { syncType: 'booking_to_lead' });

      // Wait a moment for sync to start, then refresh status
      setTimeout(() => {
        fetchSyncStatus();
        setIsSyncing(false);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to trigger sync');
      setIsSyncing(false);
      console.error('Error triggering sync:', err);
    }
  };

  // Auto-refresh sync status
  useEffect(() => {
    fetchSyncStatus(); // Fetch immediately on mount
    const interval = setInterval(fetchSyncStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Format timestamp
  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Determine status color
  const getStatusColor = () => {
    if (!syncStatus) return 'gray';
    if (syncStatus.failed > 0) return 'red';
    if (isSyncing) return 'blue';
    return 'green';
  };

  const statusColor = getStatusColor();
  const statusTextColor: Record<string, string> = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    gray: 'text-gray-600'
  };

  const statusBgColor: Record<string, string> = {
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    blue: 'bg-blue-50 border-blue-200',
    gray: 'bg-gray-50 border-gray-200'
  };

  return (
    <div className={`${statusBgColor[statusColor]} border rounded-lg p-6 shadow-sm`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${statusColor === 'green' ? 'bg-green-500' : statusColor === 'red' ? 'bg-red-500' : statusColor === 'blue' ? 'bg-blue-500' : 'bg-gray-500'}`}></div>
          <h3 className="text-lg font-semibold">Booking Sync Status</h3>
        </div>
        <button
          onClick={triggerSync}
          disabled={isSyncing || loading}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            isSyncing
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
          }`}
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && !syncStatus ? (
        <div className="text-center py-8">
          <div className="inline-block">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600 mt-2">Loading sync status...</p>
        </div>
      ) : syncStatus ? (
        <>
          {/* Last Sync Info */}
          <div className="mb-6 pb-4 border-b border-gray-300">
            <p className={`text-sm font-medium ${statusTextColor[statusColor]}`}>
              Last Sync: {formatTime(syncStatus.last_sync_at)}
              {lastUpdated && <span className="text-gray-500 ml-2">(Widget updated: {formatTime(lastUpdated.toISOString())})</span>}
            </p>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Syncs */}
            <div className="bg-white rounded p-4 border border-gray-200">
              <p className="text-gray-600 text-xs font-medium mb-1">Total Syncs</p>
              <p className="text-2xl font-bold text-gray-900">{syncStatus.total_syncs}</p>
            </div>

            {/* Successful Syncs */}
            <div className="bg-white rounded p-4 border border-green-200">
              <p className="text-gray-600 text-xs font-medium mb-1">Completed</p>
              <p className="text-2xl font-bold text-green-600">{syncStatus.completed}</p>
            </div>

            {/* Failed Syncs */}
            <div className={`bg-white rounded p-4 border ${syncStatus.failed > 0 ? 'border-red-200' : 'border-gray-200'}`}>
              <p className="text-gray-600 text-xs font-medium mb-1">Failed</p>
              <p className={`text-2xl font-bold ${syncStatus.failed > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {syncStatus.failed}
              </p>
            </div>

            {/* Pending Syncs */}
            <div className="bg-white rounded p-4 border border-gray-200">
              <p className="text-gray-600 text-xs font-medium mb-1">Pending</p>
              <p className="text-2xl font-bold text-blue-600">{syncStatus.pending}</p>
            </div>
          </div>

          {/* Records Statistics */}
          <div className="mt-6 pt-4 border-t border-gray-300">
            <p className="text-sm font-medium text-gray-700 mb-3">Records Processed</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Processed:</span>
                <span className="font-bold text-gray-900">{syncStatus.total_records_processed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">New Leads Created:</span>
                <span className="font-bold text-green-600">{syncStatus.total_records_created}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Existing Leads Updated:</span>
                <span className="font-bold text-blue-600">{syncStatus.total_records_updated}</span>
              </div>
            </div>
          </div>

          {/* Success Rate */}
          {syncStatus.total_syncs > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs font-medium text-blue-900">
                Success Rate: {Math.round((syncStatus.completed / syncStatus.total_syncs) * 100)}% ({syncStatus.completed}/{syncStatus.total_syncs})
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default SyncStatusWidget;
