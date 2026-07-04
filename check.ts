import { Client } from 'pg';

async function run() {
  const c1 = new Client({ host: '72.60.103.151', port: 5432, database: 'safestories_db', user: 'fluidadmin', password: 'admin123' });
  const c2 = new Client({ host: '72.60.103.151', port: 5432, database: 'safestories_db_v2', user: 'fluidadmin', password: 'admin123' });
  await c1.connect(); await c2.connect();
  
  const res1 = await c1.query('SELECT booking_id FROM bookings');
  const res2 = await c2.query('SELECT booking_id FROM bookings');
  
  const s1 = new Set(res1.rows.map(r => r.booking_id));
  const s2 = new Set(res2.rows.map(r => r.booking_id));
  
  const missing = [...s1].filter(x => !s2.has(x));
  console.log('Missing bookings count:', missing.length);
  
  if(missing.length > 0) {
    const sample = await c1.query('SELECT * FROM bookings WHERE booking_id = $1', [missing[0]]);
    console.log('Sample missing booking:', sample.rows[0]);
  }
  
  await c1.end(); await c2.end();
}
run().catch(console.error);
