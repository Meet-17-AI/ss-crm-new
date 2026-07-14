const { Pool } = require('pg');

const pool = new Pool({
  host: '72.60.103.151',
  port: 5432,
  database: 'safestories_db_v2',
  user: 'fluidadmin',
  password: 'admin123',
});

async function run() {
  const EXCL_SS = "";
  
  const revenue = await pool.query(
    `SELECT COALESCE(SUM(invitee_payment_amount), 0) as total FROM bookings WHERE booking_status NOT IN ($1, $2, $3, $4) ${EXCL_SS}`,
    ['cancelled', 'canceled', 'payment_pending', 'payment_failed']
  );

  const bookings = await pool.query(
    `SELECT COUNT(*) as total FROM bookings WHERE booking_status NOT IN ($1, $2) ${EXCL_SS}`,
    ['payment_pending', 'payment_failed']
  );

  const sessionsCompleted = await pool.query(
    `SELECT COUNT(*) as total FROM bookings b WHERE b.booking_end_at < NOW() + INTERVAL '5 hours 30 minutes' AND b.booking_status NOT IN ($1, $2, $3, $4, $5, $6) ${EXCL_SS}`,
    ['cancelled', 'canceled', 'no_show', 'no show', 'payment_pending', 'payment_failed']
  );

  const freeConsultations = await pool.query(
    `SELECT COUNT(*) as total FROM bookings WHERE (invitee_payment_amount = 0 OR invitee_payment_amount IS NULL) AND booking_status NOT IN ($1, $2)`,
    ['payment_pending', 'payment_failed']
  );

  const cancelled = await pool.query(
    `SELECT COUNT(*) as total FROM bookings WHERE booking_status IN ($1, $2) ${EXCL_SS}`,
    ['cancelled', 'canceled']
  );

  const refunds = await pool.query(
    `SELECT COUNT(*) as total FROM bookings WHERE refund_status IS NOT NULL ${EXCL_SS}`
  );

  const refundedAmount = await pool.query(
    `SELECT COALESCE(SUM(refund_amount), 0) as total FROM bookings WHERE refund_status IS NOT NULL ${EXCL_SS}`
  );

  const noShows = await pool.query(
    `SELECT COUNT(*) as total FROM bookings WHERE booking_status IN ($1, $2) ${EXCL_SS}`,
    ['no_show', 'no show']
  );

  console.log("=== Dashboard Stats from safestories_db_v2 ===");
  console.log("Revenue: ₹" + revenue.rows[0].total);
  console.log("Bookings: " + bookings.rows[0].total);
  console.log("Sessions Completed: " + sessionsCompleted.rows[0].total);
  console.log("Free Consultations: " + freeConsultations.rows[0].total);
  console.log("Cancelled: " + cancelled.rows[0].total);
  console.log("Refunds Count: " + refunds.rows[0].total);
  console.log("Refunded Amount: ₹" + refundedAmount.rows[0].total);
  console.log("No Shows: " + noShows.rows[0].total);
  console.log("===============================================");
  
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
