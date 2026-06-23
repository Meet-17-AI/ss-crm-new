/**
 * Autosave API
 * Purpose: Auto-save form drafts to prevent data loss
 * Phase 2: Workflow Efficiency - Component 2.2
 * Date: June 22, 2026
 */

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST || '72.60.103.151',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'safestories_db',
  user: process.env.DB_USER || 'fluidadmin',
  password: process.env.DB_PASSWORD || 'admin123'
});

// ============================================
// 1. POST /api/leads/:id/autosave
// Purpose: Auto-save form draft (called every 30 secs)
// ============================================
export async function autosaveDraft(req: any, res: any) {
  try {
    const { id: leadId } = req.params;
    const { formType, draftData } = req.body;
    const savedBy = req.user?.username || 'system';

    if (!formType || !draftData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'formType and draftData are required'
      });
    }

    // Save to form_draft_storage
    const draftResult = await pool.query(
      `INSERT INTO form_draft_storage (lead_id, form_type, draft_data, autosaved_by, last_autosave_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (lead_id, form_type) DO UPDATE SET
         draft_data = $3,
         last_autosave_at = NOW(),
         autosaved_by = $4
       RETURNING draft_id, last_autosave_at`,
      [leadId, formType, JSON.stringify(draftData), savedBy]
    );

    // Track autosave activity
    await pool.query(
      `INSERT INTO autosave_activity (lead_id, form_type, last_save_at, save_count, last_keystroke_at)
       VALUES ($1, $2, NOW(), 1, NOW())
       ON CONFLICT (lead_id, form_type) DO UPDATE SET
         save_count = save_count + 1,
         last_save_at = NOW(),
         last_keystroke_at = NOW()`,
      [leadId, formType]
    );

    const saved = draftResult.rows[0];

    res.json({
      success: true,
      data: {
        draftId: saved.draft_id,
        savedAt: saved.last_autosave_at,
        formattedTime: new Date(saved.last_autosave_at).toLocaleTimeString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error auto-saving draft:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to auto-save draft',
      message: error.message
    });
  }
}

// ============================================
// 2. GET /api/leads/:id/draft/:formType
// Purpose: Get saved draft for recovery
// ============================================
export async function getDraft(req: any, res: any) {
  try {
    const { id: leadId, formType } = req.params;

    const result = await pool.query(
      `SELECT draft_id, draft_data, last_autosave_at, autosaved_by
       FROM form_draft_storage
       WHERE lead_id = $1 AND form_type = $2`,
      [leadId, formType]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No draft found'
      });
    }

    const draft = result.rows[0];

    res.json({
      success: true,
      data: {
        draftId: draft.draft_id,
        formType,
        draftData: draft.draft_data,
        savedAt: draft.last_autosave_at,
        savedBy: draft.autosaved_by,
        formattedTime: new Date(draft.last_autosave_at).toLocaleTimeString()
      }
    });
  } catch (error) {
    console.error('Error fetching draft:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch draft',
      message: error.message
    });
  }
}

// ============================================
// 3. POST /api/leads/:id/draft/:formType/recover
// Purpose: Recover draft and restore it
// ============================================
export async function recoverDraft(req: any, res: any) {
  try {
    const { id: leadId, formType } = req.params;
    const recoveredBy = req.user?.username || 'system';

    // Get draft
    const draftResult = await pool.query(
      `SELECT draft_data, last_autosave_at FROM form_draft_storage
       WHERE lead_id = $1 AND form_type = $2`,
      [leadId, formType]
    );

    if (draftResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Draft not found'
      });
    }

    const draft = draftResult.rows[0];

    // Log recovery action
    await pool.query(
      `INSERT INTO interaction_log (lead_id, interaction_type, interaction_detail, interacted_by)
       VALUES ($1, 'draft_recovered', $2 || ' draft recovered by ' || $3, $3)`,
      [leadId, formType, recoveredBy]
    );

    res.json({
      success: true,
      message: 'Draft recovered successfully',
      data: {
        draftData: draft.draft_data,
        recoveredAt: new Date().toISOString(),
        originalSaveTime: draft.last_autosave_at
      }
    });
  } catch (error) {
    console.error('Error recovering draft:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to recover draft',
      message: error.message
    });
  }
}

// ============================================
// 4. POST /api/leads/:id/draft/:formType/discard
// Purpose: Discard draft
// ============================================
export async function discardDraft(req: any, res: any) {
  try {
    const { id: leadId, formType } = req.params;

    await pool.query(
      `DELETE FROM form_draft_storage
       WHERE lead_id = $1 AND form_type = $2`,
      [leadId, formType]
    );

    res.json({
      success: true,
      message: 'Draft discarded successfully'
    });
  } catch (error) {
    console.error('Error discarding draft:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to discard draft',
      message: error.message
    });
  }
}

// ============================================
// 5. GET /api/leads/:id/autosave-stats
// Purpose: Get autosave activity stats
// ============================================
export async function getAutosaveStats(req: any, res: any) {
  try {
    const { id: leadId } = req.params;

    const result = await pool.query(
      `SELECT form_type, save_count, last_save_at, last_keystroke_at
       FROM autosave_activity
       WHERE lead_id = $1
       ORDER BY last_save_at DESC`,
      [leadId]
    );

    res.json({
      success: true,
      data: result.rows,
      totalForms: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching autosave stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch autosave stats',
      message: error.message
    });
  }
}

// ============================================
// 6. React Hook: useAutosave
// Purpose: Handle autosave in React components
// ============================================
export const useAutosaveHook = `
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

interface UseAutosaveOptions {
  leadId: string;
  formType: string;
  interval?: number; // milliseconds (default: 30000 = 30 secs)
  onSave?: (savedAt: Date) => void;
  onError?: (error: Error) => void;
}

export function useAutosave(options: UseAutosaveOptions) {
  const {
    leadId,
    formType,
    interval = 30000,
    onSave,
    onError
  } = options;

  const [draftData, setDraftData] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showDraftRecovery, setShowDraftRecovery] = useState(false);
  const contentRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch existing draft on mount
  useEffect(() => {
    const fetchDraft = async () => {
      try {
        const response = await axios.get(\`/api/leads/\${leadId}/draft/\${formType}\`);
        if (response.data.data) {
          setShowDraftRecovery(true);
          setDraftData(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching draft:', error);
      }
    };

    fetchDraft();
  }, [leadId, formType]);

  // Auto-save function
  const saveAutomatic = useCallback(async (data: any) => {
    try {
      setSaveStatus('saving');
      const response = await axios.post(\`/api/leads/\${leadId}/autosave\`, {
        formType,
        draftData: data
      });

      setSaveStatus('saved');
      setLastSavedAt(new Date(response.data.data.savedAt));
      onSave?.(new Date(response.data.data.savedAt));

      // Reset to 'idle' after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      onError?.(error as Error);
      console.error('Autosave error:', error);
    }
  }, [leadId, formType, onSave, onError]);

  // Debounced save
  const handleChange = useCallback((data: any) => {
    contentRef.current = data;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveAutomatic(data);
    }, interval);
  }, [interval, saveAutomatic]);

  // Manual save
  const manualSave = useCallback(async (data: any) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    await saveAutomatic(data);
  }, [saveAutomatic]);

  // Recover draft
  const recoverDraft = useCallback(async () => {
    try {
      const response = await axios.post(\`/api/leads/\${leadId}/draft/\${formType}/recover\`);
      setShowDraftRecovery(false);
      return response.data.data.draftData;
    } catch (error) {
      console.error('Error recovering draft:', error);
    }
  }, [leadId, formType]);

  // Discard draft
  const discardDraft = useCallback(async () => {
    try {
      await axios.post(\`/api/leads/\${leadId}/draft/\${formType}/discard\`);
      setShowDraftRecovery(false);
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
`;

export default {
  autosaveDraft,
  getDraft,
  recoverDraft,
  discardDraft,
  getAutosaveStats
};
