/**
 * Auto-Progression API
 * Purpose: Automatic lead stage progression when booking confirmed
 * Phase 2: Workflow Efficiency - Component 2.3
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
// 1. POST /api/webhooks/booking-confirmed
// Purpose: Webhook from booking system - auto-progress lead
// ============================================
export async function handleBookingConfirmedWebhook(req: any, res: any) {
  const client = await pool.connect();

  try {
    const {
      booking_id,
      invitee_email,
      invitee_phone,
      invitee_name,
      therapist_id,
      booking_start_at,
      is_first_session
    } = req.body;

    // Validate webhook payload
    if (!booking_id || !is_first_session) {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook payload',
        message: 'booking_id and is_first_session are required'
      });
    }

    await client.query('BEGIN');

    // Find matching lead by email or phone
    let leadResult = await client.query(
      `SELECT id, name, sales_agent_id FROM leads
       WHERE (email = $1 OR phone = $2)
       AND is_duplicate = FALSE
       AND pipeline_stage != 'booked-first-session'
       ORDER BY created_at DESC
       LIMIT 1`,
      [invitee_email, invitee_phone]
    );

    let leadId: string;

    if (leadResult.rows.length === 0) {
      // Create new lead from booking
      const newLeadResult = await client.query(
        `INSERT INTO leads (
          name, email, phone, created_at, updated_at,
          booking_id, sync_status, source, pipeline_stage, status
        ) VALUES ($1, $2, $3, NOW(), NOW(), $4, 'synced', 'booking_system', 'booked-first-session', 'Booked')
        RETURNING id`,
        [invitee_name, invitee_email, invitee_phone, booking_id]
      );
      leadId = newLeadResult.rows[0].id;
    } else {
      leadId = leadResult.rows[0].id;
    }

    // Map therapist_id from webhook payload to users.id
    let mappedTherapistId = null;
    if (therapist_id) {
      const therapistUserResult = await client.query(
        `SELECT id FROM users WHERE therapist_id = $1 AND role = 'therapist' LIMIT 1`,
        [therapist_id.toString()]
      );
      if (therapistUserResult.rows.length > 0) {
        mappedTherapistId = therapistUserResult.rows[0].id;
      }
    }

    // Move lead to "Booked First Session" if not already there
    const updateResult = await client.query(
      `UPDATE leads
       SET pipeline_stage = 'booked-first-session',
           stage_booked_first_session_at = NOW(),
           therapist_id = $1,
           booking_id = $2,
           updated_at = NOW()
       WHERE id = $3
       AND pipeline_stage != 'booked-first-session'
       RETURNING id, pipeline_stage`,
      [mappedTherapistId, booking_id, leadId]
    );

    // Log interaction
    await client.query(
      `INSERT INTO interaction_log (
        lead_id, interaction_type, interaction_detail, interacted_by
      ) VALUES ($1, 'stage_move', 'Auto-progressed to Booked First Session from webhook', 'webhook')`,
      [leadId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Lead auto-progressed to Booked First Session',
      data: {
        leadId,
        bookingId: booking_id,
        newStage: 'booked-first-session',
        therapistAssigned: therapist_id,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error handling booking webhook:', error);

    // Log webhook error
    await pool.query(
      `INSERT INTO webhook_errors (endpoint, payload, error_message, created_at)
       VALUES ($1, $2, $3, NOW())`,
      ['/api/webhooks/booking-confirmed', JSON.stringify(req.body), error.message]
    ).catch(err => console.error('Error logging webhook error:', err));

    res.status(500).json({
      success: false,
      error: 'Failed to process booking webhook',
      message: error.message
    });
  } finally {
    client.release();
  }
}

// ============================================
// 2. GET /api/leads/:id/auto-progression-status
// Purpose: Check if auto-progression is enabled
// ============================================
export async function getAutoProgressionStatus(req: any, res: any) {
  try {
    const { id: leadId } = req.params;

    const result = await pool.query(
      `SELECT auto_progression_enabled, pipeline_stage, booking_id FROM leads WHERE id = $1`,
      [leadId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    const lead = result.rows[0];

    res.json({
      success: true,
      data: {
        enabled: lead.auto_progression_enabled,
        currentStage: lead.pipeline_stage,
        hasBooking: !!lead.booking_id
      }
    });
  } catch (error) {
    console.error('Error fetching auto-progression status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch auto-progression status',
      message: error.message
    });
  }
}

// ============================================
// 3. PUT /api/leads/:id/auto-progression/toggle
// Purpose: Enable/disable auto-progression for a lead
// ============================================
export async function toggleAutoProgression(req: any, res: any) {
  try {
    const { id: leadId } = req.params;
    const { enabled } = req.body;

    const result = await pool.query(
      `UPDATE leads
       SET auto_progression_enabled = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING auto_progression_enabled, pipeline_stage`,
      [enabled, leadId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    res.json({
      success: true,
      message: `Auto-progression ${enabled ? 'enabled' : 'disabled'}`,
      data: {
        autoProgressionEnabled: result.rows[0].auto_progression_enabled
      }
    });
  } catch (error) {
    console.error('Error toggling auto-progression:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle auto-progression',
      message: error.message
    });
  }
}

// ============================================
// 4. GET /api/leads/auto-progressed-today
// Purpose: Get leads that were auto-progressed today
// ============================================
export async function getAutoProgressedLeads(req: any, res: any) {
  try {
    const { days = 7, limit = 50 } = req.query;

    const result = await pool.query(
      `SELECT l.id, l.name, l.email, l.phone, l.pipeline_stage,
              l.stage_booked_first_session_at, l.therapist_id, l.therapist_name
       FROM leads l
       WHERE l.pipeline_stage = 'booked-first-session'
       AND l.stage_booked_first_session_at >= NOW() - INTERVAL '1 day' * $1
       AND l.auto_progression_enabled = TRUE
       ORDER BY l.stage_booked_first_session_at DESC
       LIMIT $2`,
      [days, limit]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      period: `${days} days`
    });
  } catch (error) {
    console.error('Error fetching auto-progressed leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch auto-progressed leads',
      message: error.message
    });
  }
}

// ============================================
// Helper: Webhook Error Logging Table
// ============================================
export const createWebhookErrorTable = `
CREATE TABLE IF NOT EXISTS webhook_errors (
  error_id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255),
  payload JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_errors_created_at ON webhook_errors(created_at);
`;

export default {
  handleBookingConfirmedWebhook,
  getAutoProgressionStatus,
  toggleAutoProgression,
  getAutoProgressedLeads
};
