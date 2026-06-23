/**
 * useAutosave Hook
 * Purpose: React hook for auto-save functionality
 * Phase 2: Workflow Efficiency - Component 2.2
 * Usage: const { saveStatus, handleChange, manualSave } = useAutosave({ leadId, formType })
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

interface UseAutosaveOptions {
  leadId: string;
  formType: string;
  interval?: number; // milliseconds (default: 30000 = 30 secs)
  onSave?: (savedAt: Date) => void;
  onError?: (error: Error) => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutosaveReturn {
  draftData: any;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  showDraftRecovery: boolean;
  handleChange: (data: any) => void;
  manualSave: (data: any) => Promise<void>;
  recoverDraft: () => Promise<any>;
  discardDraft: () => Promise<void>;
}

export function useAutosave(options: UseAutosaveOptions): UseAutosaveReturn {
  const {
    leadId,
    formType,
    interval = 30000,
    onSave,
    onError
  } = options;

  const [draftData, setDraftData] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showDraftRecovery, setShowDraftRecovery] = useState(false);

  const contentRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Fetch existing draft on mount
  useEffect(() => {
    const fetchDraft = async () => {
      try {
        const response = await axios.get(`/api/leads/${leadId}/draft/${formType}`);
        if (response.data.data && isMountedRef.current) {
          setShowDraftRecovery(true);
          setDraftData(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching draft:', error);
      }
    };

    fetchDraft();

    return () => {
      isMountedRef.current = false;
    };
  }, [leadId, formType]);

  // Auto-save function
  const saveAutomatic = useCallback(
    async (data: any) => {
      if (!isMountedRef.current) return;

      try {
        setSaveStatus('saving');
        const response = await axios.post(`/api/leads/${leadId}/autosave`, {
          formType,
          draftData: data
        });

        if (isMountedRef.current) {
          setSaveStatus('saved');
          const savedDate = new Date(response.data.data.savedAt);
          setLastSavedAt(savedDate);
          onSave?.(savedDate);

          // Reset to 'idle' after 2 seconds
          setTimeout(() => {
            if (isMountedRef.current) setSaveStatus('idle');
          }, 2000);
        }
      } catch (error) {
        if (isMountedRef.current) {
          setSaveStatus('error');
          onError?.(error as Error);
          console.error('Autosave error:', error);
        }
      }
    },
    [leadId, formType, onSave, onError]
  );

  // Debounced save
  const handleChange = useCallback(
    (data: any) => {
      contentRef.current = data;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        saveAutomatic(data);
      }, interval);
    },
    [interval, saveAutomatic]
  );

  // Manual save
  const manualSave = useCallback(
    async (data: any) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      await saveAutomatic(data);
    },
    [saveAutomatic]
  );

  // Recover draft
  const recoverDraft = useCallback(async () => {
    try {
      const response = await axios.post(`/api/leads/${leadId}/draft/${formType}/recover`);
      if (isMountedRef.current) {
        setShowDraftRecovery(false);
      }
      return response.data.data.draftData;
    } catch (error) {
      console.error('Error recovering draft:', error);
      return null;
    }
  }, [leadId, formType]);

  // Discard draft
  const discardDraft = useCallback(async () => {
    try {
      await axios.post(`/api/leads/${leadId}/draft/${formType}/discard`);
      if (isMountedRef.current) {
        setShowDraftRecovery(false);
      }
    } catch (error) {
      console.error('Error discarding draft:', error);
    }
  }, [leadId, formType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    draftData,
    saveStatus,
    lastSavedAt,
    showDraftRecovery,
    handleChange,
    manualSave,
    recoverDraft,
    discardDraft
  };
}

export default useAutosave;
