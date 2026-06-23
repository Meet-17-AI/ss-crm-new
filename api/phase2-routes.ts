/**
 * Phase 2 API Routes
 * Wire up all Phase 2 endpoints (Workflow Efficiency)
 * Date: June 23, 2026
 */

import express from 'express';
import {
  getForms,
  savePretherapyForm,
  saveFollowupForm,
  getPretherapyStatus,
  getLeadsWithPendingPretherapy
} from './forms';
import {
  autosaveDraft,
  getDraft,
  recoverDraft,
  discardDraft,
  getAutosaveStats
} from './autosave';
import {
  handleBookingConfirmedWebhook,
  getAutoProgressionStatus,
  toggleAutoProgression,
  getAutoProgressedLeads
} from './auto-progression';

const router = express.Router();

// ============================================
// COMPONENT 2.1: Forms & Toggle System Routes
// ============================================
router.get('/leads/:id/forms', getForms);
router.post('/leads/:id/forms/pretherapy', savePretherapyForm);
router.post('/leads/:id/forms/followup', saveFollowupForm);
router.get('/leads/:id/pretherapy-status', getPretherapyStatus);
router.get('/leads/pretherapy-pending', getLeadsWithPendingPretherapy);

// ============================================
// COMPONENT 2.2: Autosave System Routes
// ============================================
router.post('/leads/:id/autosave', autosaveDraft);
router.get('/leads/:id/draft/:formType', getDraft);
router.post('/leads/:id/draft/:formType/recover', recoverDraft);
router.post('/leads/:id/draft/:formType/discard', discardDraft);
router.get('/leads/:id/autosave-stats', getAutosaveStats);

// ============================================
// COMPONENT 2.3: Auto-progression Routes
// ============================================
router.post('/webhooks/booking-confirmed', handleBookingConfirmedWebhook);
router.get('/leads/:id/auto-progression-status', getAutoProgressionStatus);
router.put('/leads/:id/auto-progression/toggle', toggleAutoProgression);
router.get('/leads/auto-progressed-today', getAutoProgressedLeads);

export default router;
