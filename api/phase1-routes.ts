/**
 * Phase 1 API Routes
 * Wire up all Phase 1 endpoints (Data Accuracy Fixes)
 * Date: June 22, 2026
 */

import express from 'express';
import {
  getSyncStatus,
  triggerSync,
  getSyncLogs,
  startAutoSync
} from './lead-sync';
import {
  getDuplicates,
  mergeLeads,
  undoMerge,
  startDuplicateDetection
} from './duplicate-detection';
import {
  logInteraction,
  getLeadInteractions,
  getInactiveLead24h,
  getInteractionStatus,
  updateLastInteraction,
  startInteractionStats
} from './interaction-tracking';

const router = express.Router();

// ============================================
// COMPONENT 1.1: Lead Sync Routes
// ============================================
router.get('/sync/status', getSyncStatus);
router.post('/sync/trigger', triggerSync);
router.get('/sync/logs', getSyncLogs);

// ============================================
// COMPONENT 1.2: Duplicate Detection Routes
// ============================================
router.get('/leads/duplicates', getDuplicates);
router.post('/leads/merge', mergeLeads);
router.post('/leads/undo-merge', undoMerge);

// ============================================
// COMPONENT 1.3: Interaction Tracking Routes
// ============================================
router.post('/interactions/log', logInteraction);
router.get('/leads/:id/interactions', getLeadInteractions);
router.get('/leads/inactive/24hours', getInactiveLead24h);
router.get('/leads/interaction-status', getInteractionStatus);
router.put('/leads/:id/last-interaction', updateLastInteraction);

// ============================================
// Initialize Background Jobs
// ============================================
export function initializePhase1Jobs() {
  console.log('🚀 Starting Phase 1 Background Jobs...');

  // Component 1.1: Auto-sync every 30 minutes
  startAutoSync();
  console.log('✅ Auto-sync job started (every 30 mins)');

  // Component 1.2: Duplicate detection every hour
  startDuplicateDetection();
  console.log('✅ Duplicate detection job started (every hour)');

  // Component 1.3: Interaction stats every 6 hours
  startInteractionStats();
  console.log('✅ Interaction stats job started (every 6 hours)');

  console.log('🎯 Phase 1 Background Jobs Initialized');
}

export default router;
