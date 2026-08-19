import { Pool } from 'pg';
import * as dotenv from 'dotenv';

import path from 'path';

// crm-backend/.env.local — two directories up from src/lib.
//
// This used to resolve '../../../../.env.local', which lands on C:\Meet\.env.local:
// outside every repo, and non-existent. dotenv fails SILENTLY on a missing path,
// so no PG* variable was ever set and the defaults below took over — and those
// named the PRODUCTION database. Running this service locally therefore read and
// wrote production, with nothing on screen to say so.
//
// Note there is a second, near-identical copy at crm-backend/src/db.ts that
// nothing imports; index.ts imports THIS one. Fixing the wrong copy changes
// nothing, which is a hazard of its own — the duplicate is worth deleting.
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// No fallbacks. A missing variable stops the process rather than quietly
// selecting a database nobody chose — precisely how the bug above stayed hidden.
// Naming production as a default is never worth the convenience.
const required = ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'];
const missing = required.filter((v) => !process.env[v]);
if (missing.length) {
  console.error('❌ FATAL: missing database configuration:', missing.join(', '));
  console.error('   Expected in crm-backend/.env.local');
  process.exit(1);
}

// Announced on the first line of the log, so pointing at the wrong database is
// something you see at boot rather than infer from the data days later.
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
