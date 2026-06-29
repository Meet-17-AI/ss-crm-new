import express from 'express';
import pool from './_lib/db.js';

const router = express.Router();

// Placeholder functions for Campaigns
const triggerNewLeadCampaign = async (leadData: any) => {
  console.log('[CAMPAIGN] Triggering WhatsApp API & Email for NEW LEAD:', leadData.name || leadData.phone);
  // TODO: Insert user-provided API campaign for new leads here
};

const triggerExistingClientCampaign = async (leadData: any) => {
  console.log('[CAMPAIGN] Triggering WhatsApp API & Email for EXISTING CLIENT:', leadData.name || leadData.phone);
  // TODO: Insert user-provided API campaign for existing clients here
};

router.post('/aisensy-lead', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.AISENSY_WEBHOOK_SECRET || 'PLACEHOLDER_SECRET';

    if (apiKey !== expectedKey) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { name, phone, city, age } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    // Clean phone to get last 10 digits
    const cleanPhone = phone.replace(/\D/g, '');
    const last10Digits = cleanPhone.slice(-10);

    if (last10Digits.length < 10) {
      return res.status(400).json({ success: false, error: 'Invalid phone number format' });
    }

    // Check if exists in leads table
    const leadResult = await pool.query(
      `SELECT id, name, phone FROM leads 
       WHERE RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = $1
       LIMIT 1`,
      [last10Digits]
    );

    let exists = leadResult.rows.length > 0;
    let existingData = exists ? leadResult.rows[0] : null;

    if (!exists) {
      // Check if exists in bookings table just in case
      const bookingResult = await pool.query(
        `SELECT booking_id, invitee_name as name, invitee_phone as phone FROM bookings 
         WHERE RIGHT(REGEXP_REPLACE(invitee_phone, '\\D', '', 'g'), 10) = $1
         LIMIT 1`,
        [last10Digits]
      );
      if (bookingResult.rows.length > 0) {
        exists = true;
        existingData = bookingResult.rows[0];
      }
    }

    if (exists) {
      // It's an existing client
      await triggerExistingClientCampaign(existingData);
      
      // Optionally update the existing lead with city/age if they are missing
      if (leadResult.rows.length > 0) {
         const updates = [];
         const values = [];
         let idx = 1;
         if (city) { updates.push(`city = $${idx++}`); values.push(city); }
         if (age) { updates.push(`age = $${idx++}`); values.push(age); }
         if (updates.length > 0) {
             values.push(existingData.id);
             await pool.query(`UPDATE leads SET ${updates.join(', ')} WHERE id = $${idx}`, values);
         }
      }

      return res.status(200).json({
        success: true,
        message: 'Existing client detected and campaign triggered',
        isNew: false
      });
    }

    // Create NEW Lead
    const newLeadResult = await pool.query(
      `INSERT INTO leads (
        name, phone, city, age, source, created_at, updated_at,
        pipeline_stage, stage_lead_inquire_at, source_aisensy, status
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 'lead-inquire', NOW(), TRUE, 'New')
      RETURNING id, name, phone, city, age`,
      [
        name || 'Aisensy Lead',
        phone,
        city || null,
        age ? parseInt(age, 10) : null,
        'Chatbot'
      ]
    );

    const newLeadData = newLeadResult.rows[0];

    // Log interaction
    await pool.query(
      `INSERT INTO interaction_log (lead_id, interaction_type, interaction_detail, interacted_by, interacted_at)
       VALUES ($1, 'stage_move', 'Captured directly via Aisensy Webhook', 'system_webhook', NOW())`,
      [newLeadData.id]
    );

    await triggerNewLeadCampaign(newLeadData);

    return res.status(201).json({
      success: true,
      message: 'New lead captured and campaign triggered',
      isNew: true,
      leadId: newLeadData.id
    });

  } catch (error) {
    console.error('Error in Aisensy Webhook:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
