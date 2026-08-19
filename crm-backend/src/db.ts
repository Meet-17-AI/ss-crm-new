import { Pool } from 'pg';
import * as dotenv from 'dotenv';

import path from 'path';

// crm-backend/.env.local — one directory up from src/.
//
// This used to resolve '../../../.env.local', which lands OUTSIDE both repos on a
// file that does not exist. dotenv fails silently when a path is missing, so every
// PG* variable stayed undefined and the defaults below took over — and those
// defaults named the PRODUCTION database. Running this service locally therefore
// read and wrote production without anything on screen to say so.
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// No fallbacks. A missing variable now stops the process instead of quietly
// selecting a database nobody chose — which is exactly how the bug above went
// unnoticed. Naming production as a default is never worth the convenience.
const required = ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'];
const missing = required.filter((v) => !process.env[v]);
if (missing.length) {
  console.error('❌ FATAL: missing database configuration:', missing.join(', '));
  console.error('   Expected in crm-backend/.env.local');
  process.exit(1);
}

// Loud about where it is pointed, so connecting to the wrong database is visible
// in the first line of the log rather than discovered from the data later.
console.log(`[DB] crm-backend -> ${process.env.PGDATABASE} @ ${process.env.PGHOST}`);

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT!),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: 1, // Limit connections for serverless
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('connect', (client) => {
  client.query("SET timezone = 'Asia/Kolkata'");
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

export default pool;
