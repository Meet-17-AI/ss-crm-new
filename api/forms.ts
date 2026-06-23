/**
 * Forms API - Toggle System
 * Purpose: Handle pre-therapy form and follow-up remarks separately
 * Phase 2: Workflow Efficiency - Component 2.1
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
// 1. GET /api/leads/:id/forms
// Purpose: Get both pre-therapy and follow-up forms
// ============================================
export async function getForms(req: any, res: any) {
  try {
    const { id: leadId } = req.params;

    // Get pre-therapy form data
    const pretherapyResult = await pool.query(
      `SELECT field_name, field_value FROM form_field_values
       WHERE lead_id = $1 AND form_type = 'pretherapy_form'`,
      [leadId]
    );

    // Get follow-up form data
    const followupResult = await pool.query(
      `SELECT field_name, field_value FROM form_field_values
       WHERE lead_id = $1 AND form_type = 'followup_remarks'`,
      [leadId]
    );

    // Convert arrays to objects
    const pretherapyForm = Object.fromEntries(
      pretherapyResult.rows.map(r => [r.field_name, r.field_value])
    );

    const followupForm = Object.fromEntries(
      followupResult.rows.map(r => [r.field_name, r.field_value])
    );

    // Get submission history
    const submissionsResult = await pool.query(
      `SELECT form_type, submitted_at, submitted_by FROM form_submissions
       WHERE lead_id = $1
       ORDER BY submitted_at DESC`,
      [leadId]
    );

    res.json({
      success: true,
      data: {
        pretherapy: {
          fields: pretherapyForm,
          submittedAt: submissionsResult.rows.find(s => s.form_type === 'pretherapy_form')?.submitted_at,
          submittedBy: submissionsResult.rows.find(s => s.form_type === 'pretherapy_form')?.submitted_by
        },
        followup: {
          fields: followupForm,
          submittedAt: submissionsResult.rows.find(s => s.form_type === 'followup_remarks')?.submitted_at,
          submittedBy: submissionsResult.rows.find(s => s.form_type === 'followup_remarks')?.submitted_by
        },
        submissions: submissionsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch forms',
      message: error.message
    });
  }
}

// ============================================
// 2. POST /api/leads/:id/forms/pretherapy
// Purpose: Save pre-therapy form
// ============================================
export async function savePretherapyForm(req: any, res: any) {
  const client = await pool.connect();

  try {
    const { id: leadId } = req.params;
    const formData = req.body; // { field1: value1, field2: value2, ... }
    const savedBy = req.user?.username || 'system';

    await client.query('BEGIN');

    // Save each field
    for (const [fieldName, fieldValue] of Object.entries(formData)) {
      await client.query(
        `INSERT INTO form_field_values (lead_id, form_type, field_name, field_value, updated_at)
         VALUES ($1, 'pretherapy_form', $2, $3, NOW())
         ON CONFLICT (lead_id, form_type, field_name) DO UPDATE SET
           field_value = $3,
           updated_at = NOW()`,
        [leadId, fieldName, fieldValue]
      );
    }

    // Record submission
    await client.query(
      `INSERT INTO form_submissions (lead_id, form_type, submitted_by, submission_data)
       VALUES ($1, 'pretherapy_form', $2, $3)`,
      [leadId, savedBy, JSON.stringify(formData)]
    );

    // Update lead to mark pre-therapy as completed and save notes/recommendations
    await client.query(
      `UPDATE leads
       SET pretherapy_completed = TRUE,
           pretherapy_completed_at = NOW(),
           pre_therapy_notes = $1,
           remark_pretherapy_call = $1,
           pretherapy_done = TRUE,
           therapy = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [formData.clinicalNotes, formData.therapyRecommendation, leadId]
    );

    // Log interaction
    await client.query(
      `INSERT INTO interaction_log (lead_id, interaction_type, interaction_detail, interacted_by)
       VALUES ($1, 'form_submit', 'Pre-therapy form submitted', $2)`,
      [leadId, savedBy]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Pre-therapy form saved successfully',
      data: {
        formType: 'pretherapy_form',
        submittedAt: new Date().toISOString(),
        submittedBy: savedBy
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving pre-therapy form:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save pre-therapy form',
      message: error.message
    });
  } finally {
    client.release();
  }
}

// ============================================
// 3. POST /api/leads/:id/forms/followup
// Purpose: Save follow-up remarks
// ============================================
export async function saveFollowupForm(req: any, res: any) {
  const client = await pool.connect();

  try {
    const { id: leadId } = req.params;
    const formData = req.body; // { notes, nextAction, followupDate, ... }
    const savedBy = req.user?.username || 'system';

    await client.query('BEGIN');

    // Save each field
    for (const [fieldName, fieldValue] of Object.entries(formData)) {
      await client.query(
        `INSERT INTO form_field_values (lead_id, form_type, field_name, field_value, updated_at)
         VALUES ($1, 'followup_remarks', $2, $3, NOW())
         ON CONFLICT (lead_id, form_type, field_name) DO UPDATE SET
           field_value = $3,
           updated_at = NOW()`,
        [leadId, fieldName, fieldValue]
      );
    }

    // Record submission
    await client.query(
      `INSERT INTO form_submissions (lead_id, form_type, submitted_by, submission_data)
       VALUES ($1, 'followup_remarks', $2, $3)`,
      [leadId, savedBy, JSON.stringify(formData)]
    );

    // Update lead follow-up notes and date
    await client.query(
      `UPDATE leads
       SET follow_up_1_date = $1,
           follow_up_1_notes = $2,
           remark_followup_1 = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [formData.followupDate ? new Date(formData.followupDate) : null, formData.notes, leadId]
    );

    // Log interaction
    await client.query(
      `INSERT INTO interaction_log (lead_id, interaction_type, interaction_detail, interacted_by)
       VALUES ($1, 'remark_added', 'Follow-up notes updated', $2)`,
      [leadId, savedBy]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Follow-up form saved successfully',
      data: {
        formType: 'followup_remarks',
        submittedAt: new Date().toISOString(),
        submittedBy: savedBy
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving follow-up form:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save follow-up form',
      message: error.message
    });
  } finally {
    client.release();
  }
}

// ============================================
// 4. GET /api/leads/:id/pretherapy-status
// Purpose: Check if pre-therapy is completed
// ============================================
export async function getPretherapyStatus(req: any, res: any) {
  try {
    const { id: leadId } = req.params;

    const result = await pool.query(
      `SELECT pretherapy_completed, pretherapy_completed_at FROM leads WHERE id = $1`,
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
        completed: lead.pretherapy_completed,
        completedAt: lead.pretherapy_completed_at,
        status: lead.pretherapy_completed ? 'completed' : 'pending'
      }
    });
  } catch (error) {
    console.error('Error fetching pre-therapy status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pre-therapy status',
      message: error.message
    });
  }
}

// ============================================
// 5. GET /api/leads/pretherapy-pending
// Purpose: Get all leads with pending pre-therapy
// ============================================
export async function getLeadsWithPendingPretherapy(req: any, res: any) {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT l.id, l.name, l.email, l.phone, l.pipeline_stage, l.created_at,
              l.pretherapy_completed, l.pretherapy_completed_at
       FROM leads l
       WHERE l.pretherapy_completed = FALSE
       AND l.is_duplicate = FALSE
       AND l.pipeline_stage IN ('pre-therapy-call', 'followup-1', 'followup-2', 'followup-3')
       ORDER BY l.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching leads with pending pre-therapy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leads',
      message: error.message
    });
  }
}

export default {
  getForms,
  savePretherapyForm,
  saveFollowupForm,
  getPretherapyStatus,
  getLeadsWithPendingPretherapy
};
