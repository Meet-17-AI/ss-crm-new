import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || '72.60.103.151',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'safestories_db',
  user: process.env.DB_USER || 'fluidadmin',
  password: process.env.DB_PASSWORD || 'admin123'
});

async function main() {
  try {
    console.log('Adding future_action column to leads table...');
    await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS future_action VARCHAR(50)`);
    console.log('Column future_action added successfully.');
  } catch (err) {
    console.error('Error adding column:', err);
  } finally {
    await pool.end();
  }
}

main();
