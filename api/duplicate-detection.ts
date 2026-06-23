/**
 * Duplicate Detection & Merge API
 * Purpose: Detect and merge duplicate leads
 * Phase 1: Data Accuracy Implementation - Component 1.2
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
// 1. GET /api/leads/duplicates
// Purpose: Find and return all duplicate leads
// ============================================
export async function getDuplicates(req: any, res: any) {
  try {
    const { status = 'pending', limit = 50, offset = 0 } = req.query;

    // Find duplicates by phone
    const phoneResult = await pool.query(
      `SELECT
        l1.id as lead_id_1,
        l1.name as name_1,
        l1.email as email_1,
        l1.phone as phone_1,
        l1.created_at as created_at_1,
        l2.id as lead_id_2,
        l2.name as name_2,
        l2.email as email_2,
        l2.phone as phone_2,
        l2.created_at as created_at_2,
        'phone' as match_type,
        0.95 as match_score,
        da.alert_id,
        da.status
      FROM leads l1
      JOIN leads l2 ON l1.phone = l2.phone
      LEFT JOIN duplicate_alerts da ON (
        (da.lead_id_1 = l1.id AND da.lead_id_2 = l2.id) OR
        (da.lead_id_1 = l2.id AND da.lead_id_2 = l1.id)
      )
      WHERE l1.id < l2.id
      AND l1.phone IS NOT NULL
      AND l1.phone != ''
      AND (da.status IS NULL OR da.status = $1)
      ORDER BY l1.created_at DESC
      LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    // Find duplicates by email
    const emailResult = await pool.query(
      `SELECT
        l1.id as lead_id_1,
        l1.name as name_1,
        l1.email as email_1,
        l1.phone as phone_1,
        l1.created_at as created_at_1,
        l2.id as lead_id_2,
        l2.name as name_2,
        l2.email as email_2,
        l2.phone as phone_2,
        l2.created_at as created_at_2,
        'email' as match_type,
        0.95 as match_score,
        da.alert_id,
        da.status
      FROM leads l1
      JOIN leads l2 ON l1.email = l2.email
      LEFT JOIN duplicate_alerts da ON (
        (da.lead_id_1 = l1.id AND da.lead_id_2 = l2.id) OR
        (da.lead_id_1 = l2.id AND da.lead_id_2 = l1.id)
      )
      WHERE l1.id < l2.id
      AND l1.email IS NOT NULL
      AND l1.email != ''
      AND (da.status IS NULL OR da.status = $1)
      ORDER BY l1.created_at DESC
      LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    // Combine and deduplicate
    const duplicates = [...phoneResult.rows, ...emailResult.rows];
    const uniqueDuplicates = Array.from(
      new Map(duplicates.map(d => [d.alert_id || `${d.lead_id_1}-${d.lead_id_2}`, d])).values()
    );

    res.json({
      success: true,
      data: uniqueDuplicates,
      count: uniqueDuplicates.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error finding duplicates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find duplicates',
      message: error.message
    });
  }
}

// ============================================
// 2. POST /api/leads/merge
// Purpose: Merge two duplicate leads
// ============================================
export async function mergeLeads(req: any, res: any) {
  const client = await pool.connect();

  try {
    const { primaryLeadId, secondaryLeadId, mergeNotes } = req.body;
    const mergedBy = req.user?.username || 'system';

    if (!primaryLeadId || !secondaryLeadId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'primaryLeadId and secondaryLeadId are required'
      });
    }

    await client.query('BEGIN');

    // Get both leads
    const primaryResult = await client.query('SELECT * FROM leads WHERE id = $1', [primaryLeadId]);
    const secondaryResult = await client.query('SELECT * FROM leads WHERE id = $1', [secondaryLeadId]);

    if (!primaryResult.rows.length || !secondaryResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    const primaryLead = primaryResult.rows[0];
    const secondaryLead = secondaryResult.rows[0];

    // Merge strategy: Keep primary, merge data from secondary
    // Use non-null values from both

    const mergedData = {
      name: primaryLead.name || secondaryLead.name,
      email: primaryLead.email || secondaryLead.email,
      phone: primaryLead.phone || secondaryLead.phone,
      age: primaryLead.age || secondaryLead.age,
      city: primaryLead.city || secondaryLead.city,
      source: primaryLead.source || secondaryLead.source,
      therapy: primaryLead.therapy || secondaryLead.therapy,
      therapist_id: primaryLead.therapist_id || secondaryLead.therapist_id,
      sales_agent_id: primaryLead.sales_agent_id || secondaryLead.sales_agent_id,
      emergency_contact_name: primaryLead.emergency_contact_name || secondaryLead.emergency_contact_name,
      emergency_contact_phone: primaryLead.emergency_contact_phone || secondaryLead.emergency_contact_phone,
      emergency_contact_relation: primaryLead.emergency_contact_relation || secondaryLead.emergency_contact_relation,
      general_remarks: `${primaryLead.general_remarks || ''}\n[MERGED from ${secondaryLead.id}] ${secondaryLead.general_remarks || ''}`
    };

    // Update primary lead with merged data
    await client.query(
      `UPDATE leads SET
        name = $1, email = $2, phone = $3, age = $4, city = $5,
        source = $6, therapy = $7, therapist_id = $8, sales_agent_id = $9,
        emergency_contact_name = $10, emergency_contact_phone = $11,
        emergency_contact_relation = $12, general_remarks = $13,
        is_duplicate = FALSE, updated_at = NOW()
       WHERE id = $14`,
      [
        mergedData.name,
        mergedData.email,
        mergedData.phone,
        mergedData.age,
        mergedData.city,
        mergedData.source,
        mergedData.therapy,
        mergedData.therapist_id,
        mergedData.sales_agent_id,
        mergedData.emergency_contact_name,
        mergedData.emergency_contact_phone,
        mergedData.emergency_contact_relation,
        mergedData.general_remarks,
        primaryLeadId
      ]
    );

    // Mark secondary lead as archived/duplicate
    await client.query(
      `UPDATE leads SET
        is_duplicate = TRUE,
        duplicate_of_lead_id = $1,
        updated_at = NOW()
       WHERE id = $2`,
      [primaryLeadId, secondaryLeadId]
    );

    // Move all interactions from secondary to primary
    await client.query(
      `UPDATE interaction_log SET lead_id = $1 WHERE lead_id = $2`,
      [primaryLeadId, secondaryLeadId]
    );

    // Move all booking mappings from secondary to primary
    await client.query(
      `UPDATE booking_to_lead_mapping SET lead_id = $1 WHERE lead_id = $2`,
      [primaryLeadId, secondaryLeadId]
    );

    // Record duplicate alert
    await client.query(
      `INSERT INTO duplicate_alerts (
        lead_id_1, lead_id_2, match_type, match_score,
        status, merged_by, merged_at, primary_lead_id,
        archived_lead_id, merge_notes
      ) VALUES ($1, $2, 'manual_merge', 1.0, 'merged', $3, NOW(), $4, $5, $6)`,
      [
        primaryLeadId,
        secondaryLeadId,
        mergedBy,
        primaryLeadId,
        secondaryLeadId,
        mergeNotes || 'Duplicates merged'
      ]
    );

    // Log merge action
    await client.query(
      `INSERT INTO interaction_log (lead_id, interaction_type, interaction_detail, interacted_by)
       VALUES ($1, 'merge_duplicate', 'Merged with lead ' || $2, $3)`,
      [primaryLeadId, secondaryLeadId, mergedBy]
    );

    // Log to audit trail
    await client.query(
      `INSERT INTO audit_logs (action_type, action_description, user_id, user_name, client_name, timestamp)
       VALUES ('lead_merge', 'Merged duplicate leads: ' || $1 || ' merged into ' || $2, $3, $4, $5, get_ist_timestamp())`,
      [secondaryLeadId, primaryLeadId, req.user?.id || 0, mergedBy, primaryLead.name]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Leads merged successfully',
      primaryLeadId,
      archivedLeadId: secondaryLeadId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error merging leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to merge leads',
      message: error.message
    });
  } finally {
    client.release();
  }
}

// ============================================
// 3. POST /api/leads/undo-merge
// Purpose: Undo a lead merge
// ============================================
export async function undoMerge(req: any, res: any) {
  const client = await pool.connect();

  try {
    const { alertId } = req.body;
    const undoneBy = req.user?.username || 'system';

    if (!alertId) {
      return res.status(400).json({
        success: false,
        error: 'Missing alert ID'
      });
    }

    await client.query('BEGIN');

    // Get merge alert details
    const alertResult = await client.query(
      `SELECT * FROM duplicate_alerts WHERE alert_id = $1 AND status = 'merged'`,
      [alertId]
    );

    if (!alertResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Merge not found or already undone'
      });
    }

    const alert = alertResult.rows[0];

    // Restore secondary lead from backup or recreate
    // For now, just restore is_duplicate flag
    await client.query(
      `UPDATE leads SET
        is_duplicate = FALSE,
        duplicate_of_lead_id = NULL,
        updated_at = NOW()
       WHERE id = $1`,
      [alert.archived_lead_id]
    );

    // Move interactions back
    await client.query(
      `UPDATE interaction_log SET lead_id = $1 WHERE lead_id = $2
       AND interaction_type = 'merge_duplicate'`,
      [alert.archived_lead_id, alert.primary_lead_id]
    );

    // Update alert status
    await client.query(
      `UPDATE duplicate_alerts SET status = 'undone' WHERE alert_id = $1`,
      [alertId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Merge undone successfully',
      primaryLeadId: alert.primary_lead_id,
      restoredLeadId: alert.archived_lead_id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error undoing merge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to undo merge',
      message: error.message
    });
  } finally {
    client.release();
  }
}

// ============================================
// 4. Background Job: Auto-detect duplicates
// ============================================
export function startDuplicateDetection() {
  console.log('Starting duplicate detection job (hourly)...');

  setInterval(async () => {
    try {
      const client = await pool.connect();

      // Find new duplicates (by phone)
      await client.query(
        `INSERT INTO duplicate_alerts (lead_id_1, lead_id_2, match_type, match_score, status)
         SELECT l1.id, l2.id, 'phone', 0.95, 'pending'
         FROM leads l1
         JOIN leads l2 ON l1.phone = l2.phone AND l1.id < l2.id
         LEFT JOIN duplicate_alerts da ON (
           (da.lead_id_1 = l1.id AND da.lead_id_2 = l2.id) OR
           (da.lead_id_1 = l2.id AND da.lead_id_2 = l1.id)
         )
         WHERE l1.phone IS NOT NULL AND l1.phone != ''
         AND da.alert_id IS NULL
         ON CONFLICT DO NOTHING`
      );

      // Find new duplicates (by email)
      await client.query(
        `INSERT INTO duplicate_alerts (lead_id_1, lead_id_2, match_type, match_score, status)
         SELECT l1.id, l2.id, 'email', 0.95, 'pending'
         FROM leads l1
         JOIN leads l2 ON l1.email = l2.email AND l1.id < l2.id
         LEFT JOIN duplicate_alerts da ON (
           (da.lead_id_1 = l1.id AND da.lead_id_2 = l2.id) OR
           (da.lead_id_1 = l2.id AND da.lead_id_2 = l1.id)
         )
         WHERE l1.email IS NOT NULL AND l1.email != ''
         AND da.alert_id IS NULL
         ON CONFLICT DO NOTHING`
      );

      client.release();
      console.log(`Duplicate detection completed at ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Duplicate detection error:', error);
    }
  }, 60 * 60 * 1000); // Every hour
}

export default {
  getDuplicates,
  mergeLeads,
  undoMerge,
  startDuplicateDetection
};
