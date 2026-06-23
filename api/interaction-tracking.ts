/**
 * Interaction Tracking API
 * Purpose: Track and monitor lead interactions, 24-hour activity
 * Phase 1: Data Accuracy Implementation - Component 1.3
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
// 1. POST /api/interactions/log
// Purpose: Log an interaction for a lead
// ============================================
export async function logInteraction(req: any, res: any) {
  try {
    const {
      leadId,
      interactionType, // 'stage_move', 'call', 'email', 'text', 'form_submit', 'remark_added'
      interactionDetail,
      fromStage,
      toStage
    } = req.body;

    const interactedBy = req.user?.username || 'system';

    if (!leadId || !interactionType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'leadId and interactionType are required'
      });
    }

    const result = await pool.query(
      `INSERT INTO interaction_log (
        lead_id, interaction_type, interaction_detail,
        interacted_by, from_stage, to_stage, interacted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING interaction_id, interacted_at`,
      [leadId, interactionType, interactionDetail, interactedBy, fromStage, toStage]
    );

    const interaction = result.rows[0];

    // Log to audit trail
    await pool.query(
      `INSERT INTO audit_logs (
        action_type, action_description, therapist_id,
        therapist_name, client_name, ip_address, timestamp
      )
       SELECT 'interaction_' || $1, $2, $3, $4, name, $5, get_ist_timestamp()
       FROM leads WHERE id = $6`,
      [interactionType, interactionDetail, req.user?.id || 0, interactedBy, req.ip || 'unknown', leadId]
    );

    res.json({
      success: true,
      data: interaction,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging interaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log interaction',
      message: error.message
    });
  }
}

// ============================================
// 2. GET /api/leads/:id/interactions
// Purpose: Get all interactions for a lead
// ============================================
export async function getLeadInteractions(req: any, res: any) {
  try {
    const { id: leadId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT
        interaction_id,
        interaction_type,
        interaction_detail,
        interacted_by,
        interacted_at,
        from_stage,
        to_stage,
        booking_linked
       FROM interaction_log
       WHERE lead_id = $1
       ORDER BY interacted_at DESC
       LIMIT $2 OFFSET $3`,
      [leadId, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching interactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch interactions',
      message: error.message
    });
  }
}

// ============================================
// 3. GET /api/leads/inactive/24hours
// Purpose: Get leads not contacted in 24 hours
// ============================================
export async function getInactiveLead24h(req: any, res: any) {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT
        l.id,
        l.name,
        l.email,
        l.phone,
        l.pipeline_stage,
        l.created_at,
        l.last_interaction_at,
        l.last_interaction_type,
        CASE
          WHEN l.last_interaction_at IS NULL THEN
            EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 3600
          ELSE
            EXTRACT(EPOCH FROM (NOW() - l.last_interaction_at)) / 3600
        END as hours_inactive,
        ls.assigned_therapist,
        ls.sales_agent_id
       FROM leads l
       LEFT JOIN lead_summary ls ON l.id = ls.lead_id
       WHERE (
         l.last_interaction_at IS NULL AND NOW() - l.created_at > INTERVAL '24 hours'
         OR
         l.last_interaction_at IS NOT NULL AND NOW() - l.last_interaction_at > INTERVAL '24 hours'
       )
       AND l.is_duplicate = FALSE
       AND l.pipeline_stage != 'closed'
       AND l.pipeline_stage != 'booked-first-session'
       ORDER BY hours_inactive DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      urgency: 'HIGH - These leads need immediate contact',
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching inactive leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inactive leads',
      message: error.message
    });
  }
}

// ============================================
// 4. GET /api/leads/interaction-status
// Purpose: Get interaction status for all leads (with color coding)
// ============================================
export async function getInteractionStatus(req: any, res: any) {
  try {
    const { pipelineStage, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT
        l.id,
        l.name,
        l.email,
        l.phone,
        l.pipeline_stage,
        l.last_interaction_at,
        l.last_interaction_type,
        CASE
          WHEN l.last_interaction_at IS NULL THEN
            EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 3600
          ELSE
            EXTRACT(EPOCH FROM (NOW() - l.last_interaction_at)) / 3600
        END as hours_inactive,
        CASE
          WHEN l.last_interaction_at IS NULL THEN
            EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 3600 < 24
          ELSE
            EXTRACT(EPOCH FROM (NOW() - l.last_interaction_at)) / 3600 < 24
        END as contacted_within_24h,
        CASE
          WHEN (l.last_interaction_at IS NULL AND NOW() - l.created_at < INTERVAL '24 hours') OR
               (l.last_interaction_at IS NOT NULL AND NOW() - l.last_interaction_at < INTERVAL '24 hours')
          THEN 'green'
          WHEN (l.last_interaction_at IS NULL AND NOW() - l.created_at < INTERVAL '72 hours') OR
               (l.last_interaction_at IS NOT NULL AND NOW() - l.last_interaction_at < INTERVAL '72 hours')
          THEN 'yellow'
          ELSE 'red'
        END as status_color
       FROM leads l
       WHERE l.is_duplicate = FALSE
    `;

    const params: any[] = [];

    if (pipelineStage) {
      query += ` AND l.pipeline_stage = $${params.length + 1}`;
      params.push(pipelineStage);
    }

    query += ` ORDER BY hours_inactive DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Group by status color
    const byStatus = {
      green: result.rows.filter(r => r.status_color === 'green'),
      yellow: result.rows.filter(r => r.status_color === 'yellow'),
      red: result.rows.filter(r => r.status_color === 'red')
    };

    res.json({
      success: true,
      data: result.rows,
      summary: {
        green: byStatus.green.length,
        yellow: byStatus.yellow.length,
        red: byStatus.red.length,
        total: result.rows.length
      },
      byStatus,
      legend: {
        green: 'Contacted within 24 hours',
        yellow: 'No contact in 1-3 days',
        red: 'No contact in 3+ days - URGENT'
      }
    });
  } catch (error) {
    console.error('Error getting interaction status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get interaction status',
      message: error.message
    });
  }
}

// ============================================
// 5. PUT /api/leads/:id/last-interaction
// Purpose: Manually update last interaction time
// ============================================
export async function updateLastInteraction(req: any, res: any) {
  try {
    const { id: leadId } = req.params;
    const { interactionType, interactionDetail } = req.body;

    const updatedBy = req.user?.username || 'system';

    // Log interaction
    await pool.query(
      `INSERT INTO interaction_log (lead_id, interaction_type, interaction_detail, interacted_by, interacted_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [leadId, interactionType || 'manual_update', interactionDetail || 'Manual update', updatedBy]
    );

    // Update lead
    const result = await pool.query(
      `UPDATE leads
       SET last_interaction_at = NOW(), last_interaction_type = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, last_interaction_at, last_interaction_type`,
      [interactionType || 'manual_update', leadId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Last interaction updated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating last interaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update last interaction',
      message: error.message
    });
  }
}

// ============================================
// 6. Background Job: Calculate interaction stats
// ============================================
export function startInteractionStats() {
  console.log('Starting interaction stats job (every 6 hours)...');

  setInterval(async () => {
    try {
      const client = await pool.connect();

      // Update leads that haven't been interacted with
      await client.query(
        `UPDATE leads
         SET last_interaction_at = created_at,
             last_interaction_type = 'created'
         WHERE last_interaction_at IS NULL`
      );

      // Count leads by status
      const stats = await client.query(
        `SELECT
          COUNT(CASE WHEN (NOW() - COALESCE(last_interaction_at, created_at)) < INTERVAL '24 hours' THEN 1 END) as contacted_24h,
          COUNT(CASE WHEN (NOW() - COALESCE(last_interaction_at, created_at)) >= INTERVAL '24 hours' AND (NOW() - COALESCE(last_interaction_at, created_at)) < INTERVAL '72 hours' THEN 1 END) as contacted_3days,
          COUNT(CASE WHEN (NOW() - COALESCE(last_interaction_at, created_at)) >= INTERVAL '72 hours' THEN 1 END) as not_contacted_3days,
          COUNT(*) as total
         FROM leads
         WHERE is_duplicate = FALSE
         AND pipeline_stage != 'closed'
         AND pipeline_stage != 'booked-first-session'`
      );

      console.log(`Interaction stats: ${JSON.stringify(stats.rows[0])}`);

      client.release();
    } catch (error) {
      console.error('Interaction stats error:', error);
    }
  }, 6 * 60 * 60 * 1000); // Every 6 hours
}

export default {
  logInteraction,
  getLeadInteractions,
  getInactiveLead24h,
  getInteractionStatus,
  updateLastInteraction,
  startInteractionStats
};
