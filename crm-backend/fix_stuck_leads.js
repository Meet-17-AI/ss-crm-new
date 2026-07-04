const { Pool } = require('pg');
const pool = new Pool({
  host: '72.60.103.151',
  port: 5432,
  database: 'safestories_db_v2',
  user: 'fluidadmin',
  password: 'admin123'
});

async function run() {
  try {
    const res = await pool.query(`
      UPDATE leads l
      SET pipeline_stage = 'pretherapy-call',
          stage_pretherapy_call_at = CURRENT_TIMESTAMP,
          remark_lead_manager = COALESCE(remark_lead_manager, '') || '\n[System]: Auto-moved to pretherapy-call due to retroactive fix for Pre Therapy booking',
          updated_at = CURRENT_TIMESTAMP
      FROM bookings b
      WHERE RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), 10) = RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(b.invitee_phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), 10)
        AND l.pipeline_stage = 'lead-inquire' 
        AND (b.booking_resource_name ILIKE '%pre therapy%' OR b.booking_resource_name ILIKE '%free consultation%')
        AND b.booking_status NOT IN ('cancelled', 'canceled')
      RETURNING l.name, l.phone;
    `);
    console.log("Moved leads:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
