/**
 * Lead Sync API Endpoints
 * Purpose: Synchronize booking system data with CRM leads
 * Phase 1: Data Accuracy Implementation
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
// 1. GET /api/sync/status
// Purpose: Get current sync status and statistics
// ============================================
export async function getSyncStatus(req: any, res: any) {
  try {
    const { syncType = 'booking_to_lead' } = req.query;

    const result = await pool.query(
      `SELECT
        sync_type,
        COUNT(*) as total_syncs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(records_processed) as total_records_processed,
        SUM(records_created) as total_records_created,
        SUM(records_updated) as total_records_updated,
        MAX(completed_at) as last_sync_at
      FROM lead_sync_log
      WHERE sync_type = $1
      GROUP BY sync_type`,
      [syncType]
    );

    const stats = result.rows[0] || {
      sync_type: syncType,
      total_syncs: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      total_records_processed: 0,
      total_records_created: 0,
      total_records_updated: 0,
      last_sync_at: null
    };

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
      message: error.message
    });
  }
}

// ============================================
// 2. POST /api/sync/trigger
// Purpose: Manually trigger booking to lead sync
// ============================================
export async function triggerSync(req: any, res: any) {
  const client = await pool.connect();

  try {
    const { syncType = 'booking_to_lead' } = req.body;
    const triggeredBy = req.user?.username || 'system';

    // Start sync log
    const syncLogResult = await client.query(
      `INSERT INTO lead_sync_log (sync_type, started_at, status, created_by)
       VALUES ($1, CURRENT_TIMESTAMP, 'pending', $2)
       RETURNING sync_id, started_at`,
      [syncType, triggeredBy]
    );

    const syncId = syncLogResult.rows[0].sync_id;

    if (syncType === 'booking_to_lead') {
      await syncBookingsToLeads(client, syncId);
    } else if (syncType === 'aisensy_to_lead') {
      // DISABLED: Replaced by direct Webhook in aisensy-webhook.ts
      // await syncAiensyToLeads(client, syncId);
    }

    res.json({
      success: true,
      message: 'Sync triggered successfully',
      syncId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error triggering sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger sync',
      message: error.message
    });
  } finally {
    client.release();
  }
}

// ============================================
// 3. Internal Function: syncBookingsToLeads
// Purpose: Sync bookings to CRM leads
// ============================================
async function syncBookingsToLeads(client: any, syncId: number) {
  const startTime = Date.now();
  let recordsProcessed = 0,
    recordsCreated = 0,
    recordsUpdated = 0,
    recordsFailed = 0;
  let errorMessage = null;

  try {
    // Get bookings from last 24 hours that aren't synced yet
    const bookingsResult = await client.query(
      `SELECT DISTINCT
        b.booking_id,
        b.invitee_email,
        b.invitee_phone,
        b.invitee_name,
        b.booking_start_at,
        b.therapist_id,
        b.booking_status
      FROM bookings b
      LEFT JOIN booking_to_lead_mapping btlm ON b.booking_id = btlm.booking_id
      WHERE btlm.mapping_id IS NULL -- Not yet synced
      AND b.booking_status IN ('confirmed', 'completed')
      AND b.booking_start_at >= NOW() - INTERVAL '24 hours'
      LIMIT 1000` // Batch process
    );

    console.log(`Processing ${bookingsResult.rows.length} bookings for sync`);

    for (const booking of bookingsResult.rows) {
      recordsProcessed++;

      try {
        // Find an existing lead using NORMALIZED matching (last-10-digit phone
        // + case-insensitive email), identical to the new-booking webhook.
        // Exact string matching missed leads stored in a different phone
        // format (e.g. "1236549877" vs "+911236549877") or without an email,
        // which caused a duplicate source='booking_system' lead to be created
        // for a client who already had a real CRM lead — and that duplicate is
        // hidden from the pipeline, so the real lead appeared "not moved".
        const leadResult = await client.query(
          `SELECT id FROM leads
           WHERE ( (RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '\\D', '', 'g'), 10) = RIGHT(REGEXP_REPLACE($1, '\\D', '', 'g'), 10) AND REGEXP_REPLACE($1, '\\D', '', 'g') <> '')
                OR (LOWER(TRIM(email)) = LOWER(TRIM($2)) AND COALESCE(TRIM($2),'') <> '') )
           ORDER BY created_at DESC
           LIMIT 1`,
          [booking.invitee_phone || '', booking.invitee_email || '']
        );

        let leadId = leadResult.rows[0]?.id;
        let matchType = leadId ? 'normalized_match' : 'new_lead';
        let matchScore = leadId ? 0.9 : 0;

        if (!leadId) {
          // Create new lead from booking
          const newLeadResult = await client.query(
            `INSERT INTO leads (
              name, email, phone, created_at, updated_at,
              booking_id, sync_status, source, status, pipeline_stage
            ) VALUES ($1, $2, $3, NOW(), NOW(), $4, 'synced', 'booking_system', 'New', 'lead-inquire')
            RETURNING id`,
            [booking.invitee_name, booking.invitee_email, booking.invitee_phone, booking.booking_id]
          );
          leadId = newLeadResult.rows[0].id;
          matchType = 'new_lead';
          recordsCreated++;
        } else {
          // Update existing lead
          await client.query(
            `UPDATE leads
             SET booking_id = $1, sync_status = 'synced', updated_at = NOW()
             WHERE id = $2`,
            [booking.booking_id, leadId]
          );
          recordsUpdated++;
        }

        // Create mapping record
        await client.query(
          `INSERT INTO booking_to_lead_mapping (
            booking_id, lead_id, lead_email, lead_phone, lead_name,
            match_type, match_score, therapist_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (booking_id) DO UPDATE SET
            lead_id = $2, match_type = $6, match_score = $7`,
          [
            booking.booking_id,
            leadId,
            booking.invitee_email,
            booking.invitee_phone,
            booking.invitee_name,
            matchType,
            matchScore,
            booking.therapist_id
          ]
        );

        // NOTE: Stage progression is intentionally NOT done here. This sync
        // used to force every confirmed booking to 'booked-first-session',
        // which is wrong for free consultations (they must go to
        // 'pretherapy-call') and raced the new-booking webhook. The webhook
        // (/api/webhooks/new-booking) — invoked on booking creation and by the
        // safety-net poller — is the single authority on lead movement and
        // correctly distinguishes free vs paid bookings. This sync only links
        // bookings to leads; it no longer moves them.
      } catch (itemError) {
        console.error(`Error processing booking ${booking.booking_id}:`, itemError);
        recordsFailed++;
      }
    }
  } catch (error) {
    errorMessage = error.message;
    console.error('Error in syncBookingsToLeads:', error);
    throw error;
  } finally {
    // Update sync log
    await client.query(
      `UPDATE lead_sync_log
       SET status = $1,
           completed_at = CURRENT_TIMESTAMP,
           records_processed = $2,
           records_created = $3,
           records_updated = $4,
           records_failed = $5,
           error_message = $6
       WHERE sync_id = $7`,
      [
        errorMessage ? 'failed' : 'completed',
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        errorMessage,
        syncId
      ]
    );

    console.log(
      `Sync completed: Processed=${recordsProcessed}, Created=${recordsCreated}, Updated=${recordsUpdated}, Failed=${recordsFailed}`
    );
  }
}

// ============================================
// 4. Internal Function: syncAiensyToLeads
// Purpose: Sync Aisensy leads to CRM
// ============================================
async function syncAiensyToLeads(client: any, syncId: number) {
  const startTime = Date.now();
  let recordsProcessed = 0,
    recordsCreated = 0,
    recordsUpdated = 0,
    recordsFailed = 0;
  let errorMessage = null;

  try {
    // 1. Get all leads from aisensy_leads
    const aisensyResult = await client.query(
      `SELECT id, name, whatsapp_number, enquiry, date_created 
       FROM aisensy_leads
       ORDER BY id DESC`
    );

    console.log(`Processing ${aisensyResult.rows.length} Aisensy leads for sync`);

    for (const aLead of aisensyResult.rows) {
      recordsProcessed++;

      try {
        if (!aLead.whatsapp_number) {
          continue;
        }

        // Clean/normalize whatsapp_number to get last 10 digits
        const cleanPhone = aLead.whatsapp_number.replace(/\D/g, '');
        const last10Digits = cleanPhone.slice(-10);

        if (last10Digits.length < 10) {
          continue;
        }

        // 2. Check if a lead with matching phone exists in leads table (comparing last 10 digits)
        const existingLeadResult = await client.query(
          `SELECT id FROM leads 
           WHERE RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = $1
           LIMIT 1`,
          [last10Digits]
        );

        let leadId = existingLeadResult.rows[0]?.id;

        // Parse date_created from "2026-02-17 04:25:26 PM IST" or similar
        let createdAt = new Date();
        if (aLead.date_created) {
          const dateStr = aLead.date_created.replace(' IST', '');
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            createdAt = parsedDate;
          }
        }

        if (!leadId) {
          // Create new lead from Aisensy
          const newLeadResult = await client.query(
            `INSERT INTO leads (
              name, phone, source, created_at, updated_at,
              pipeline_stage, stage_lead_inquire_at, source_aisensy, aisensy_interaction_type, remark_lead_inquire, status
            ) VALUES ($1, $2, $3, $4::timestamp with time zone, NOW(), 'lead-inquire', $4::timestamp without time zone, TRUE, $5, $6, 'New')
            RETURNING id`,
            [
              aLead.name || 'Aisensy Lead',
              aLead.whatsapp_number,
              'Aisensy',
              createdAt,
              aLead.enquiry || 'No interaction',
              `Aisensy Lead Sync: ${aLead.enquiry || 'No interaction'}`
            ]
          );
          leadId = newLeadResult.rows[0].id;
          recordsCreated++;
          
          // Log interaction
          await client.query(
            `INSERT INTO interaction_log (lead_id, interaction_type, interaction_detail, interacted_by, interacted_at)
             VALUES ($1, 'stage_move', 'Imported automatically from Aisensy', 'system_sync', $2)`,
            [leadId, createdAt]
          );
        } else {
          // Lead already exists. Update its source_aisensy flags
          await client.query(
            `UPDATE leads 
             SET source_aisensy = TRUE, 
                 aisensy_interaction_type = COALESCE(aisensy_interaction_type, $1),
                 updated_at = NOW()
             WHERE id = $2`,
            [aLead.enquiry || 'No interaction', leadId]
          );
          recordsUpdated++;
        }
      } catch (itemError) {
        console.error(`Error processing Aisensy lead ${aLead.id}:`, itemError);
        recordsFailed++;
      }
    }

    // 3. Post-sync step: auto-update duplicates flags in the leads table
    console.log("Updating duplicate flags in database...");
    await client.query(`UPDATE leads SET is_duplicate = FALSE`);
    
    // Mark duplicates by phone
    await client.query(`
      UPDATE leads 
      SET is_duplicate = TRUE 
      WHERE phone IN (
        SELECT phone FROM leads 
        WHERE phone IS NOT NULL AND phone != '' 
        GROUP BY phone HAVING COUNT(*) > 1
      )
    `);

    // Mark duplicates by email
    await client.query(`
      UPDATE leads 
      SET is_duplicate = TRUE 
      WHERE email IN (
        SELECT email FROM leads 
        WHERE email IS NOT NULL AND email != '' 
        GROUP BY email HAVING COUNT(*) > 1
      )
    `);

    // Mark duplicates by name
    await client.query(`
      UPDATE leads 
      SET is_duplicate = TRUE 
      WHERE name IN (
        SELECT name FROM leads 
        WHERE name IS NOT NULL AND name != '' 
        GROUP BY name HAVING COUNT(*) > 1
      )
    `);
    console.log("Duplicate flags updated successfully.");

  } catch (error) {
    errorMessage = error.message;
    console.error('Error in syncAiensyToLeads:', error);
    throw error;
  } finally {
    // Update sync log
    await client.query(
      `UPDATE lead_sync_log
       SET status = $1,
           completed_at = CURRENT_TIMESTAMP,
           records_processed = $2,
           records_created = $3,
           records_updated = $4,
           records_failed = $5,
           error_message = $6
       WHERE sync_id = $7`,
      [
        errorMessage ? 'failed' : 'completed',
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        errorMessage,
        syncId
      ]
    );

    console.log(
      `Aisensy Sync completed: Processed=${recordsProcessed}, Created=${recordsCreated}, Updated=${recordsUpdated}, Failed=${recordsFailed}`
    );
  }
}

// ============================================
// 5. GET /api/sync/logs
// Purpose: Get sync logs for monitoring
// ============================================
export async function getSyncLogs(req: any, res: any) {
  try {
    const { limit = 50, offset = 0, syncType } = req.query;

    let query = 'SELECT * FROM lead_sync_log';
    const params: any[] = [];

    if (syncType) {
      query += ' WHERE sync_type = $1';
      params.push(syncType);
    }

    query += ' ORDER BY completed_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching sync logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sync logs',
      message: error.message
    });
  }
}

// ============================================
// 6. Scheduled Job: Auto-sync every 30 minutes
// ============================================
export function startAutoSync() {
  console.log('Starting auto-sync job (every 30 minutes)...');

  const runSync = async () => {
    try {
      const client = await pool.connect();

      // 1. Sync Bookings
      const syncLogResult1 = await client.query(
        `INSERT INTO lead_sync_log (sync_type, started_at, status, created_by)
         VALUES ('booking_to_lead', CURRENT_TIMESTAMP, 'pending', 'auto_sync_job')
         RETURNING sync_id`
      );
      const syncId1 = syncLogResult1.rows[0].sync_id;
      await syncBookingsToLeads(client, syncId1);

      // 2. Sync Aisensy
      // DISABLED: Replaced by direct Webhook in aisensy-webhook.ts
      /*
      const syncLogResult2 = await client.query(
        \`INSERT INTO lead_sync_log (sync_type, started_at, status, created_by)
         VALUES ('aisensy_to_lead', CURRENT_TIMESTAMP, 'pending', 'auto_sync_job')
         RETURNING sync_id\`
      );
      const syncId2 = syncLogResult2.rows[0].sync_id;
      await syncAiensyToLeads(client, syncId2);
      */

      client.release();
      console.log(`Auto-sync completed successfully at ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Auto-sync error:', error);
    }
  };

  // Run immediately on startup
  runSync();

  // Run every 30 minutes
  setInterval(runSync, 30 * 60 * 1000);
}

export default {
  getSyncStatus,
  triggerSync,
  getSyncLogs,
  startAutoSync
};
