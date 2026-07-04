const { Pool } = require('pg');
const pool = new Pool({
  host: '72.60.103.151',
  port: 5432,
  database: 'safestories_db_v2',
  user: 'fluidadmin',
  password: 'admin123'
});

async function test() {
  try {
    const res = await pool.query(`
      SELECT l.id, l.name, l.pipeline_stage, l.phone, b.booking_id, b.booking_resource_name, b.booking_status
      FROM leads l
      JOIN bookings b ON RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), 10) = RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(b.invitee_phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), 10)
      WHERE l.pipeline_stage = 'lead-inquire' 
        AND (b.booking_resource_name ILIKE '%pre therapy%' OR b.booking_resource_name ILIKE '%free consultation%')
        AND b.booking_status NOT IN ('cancelled', 'canceled')
      ORDER BY l.created_at DESC
      LIMIT 5;
    `);
    console.log("Leads in 'lead-inquire' that have a Pre Therapy booking:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
test();
