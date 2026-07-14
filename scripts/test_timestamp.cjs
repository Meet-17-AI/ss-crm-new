const { Pool } = require('pg');

const sourceDb = new Pool({
  host: '72.60.103.151',
  port: 5432,
  database: 'safestories_db',
  user: 'fluidadmin',
  password: 'admin123',
});

const targetDb = new Pool({
  host: '72.60.103.151',
  port: 5432,
  database: 'safestories_db_v2',
  user: 'fluidadmin',
  password: 'admin123',
});

async function run() {
  const hwResult = await targetDb.query(`SELECT MAX(created_at) as max_ts_date, MAX(created_at)::text as max_ts_text FROM notifications`);
  console.log("Target MAX:", hwResult.rows[0]);
  
  const lastSyncTimeStr = hwResult.rows[0].max_ts_text;
  const lastSyncTimeDate = hwResult.rows[0].max_ts_date;

  const sourceRowsStr = await sourceDb.query(
    `SELECT created_at, created_at::text as created_at_text FROM notifications WHERE created_at > $1 ORDER BY created_at ASC`,
    [lastSyncTimeStr]
  );
  console.log("Source rows using STRING > :", sourceRowsStr.rows.length);
  if (sourceRowsStr.rows.length > 0) {
      console.log("First row from Source (String):", sourceRowsStr.rows[0]);
  }

  const sourceRowsDate = await sourceDb.query(
    `SELECT created_at, created_at::text as created_at_text FROM notifications WHERE created_at > $1 ORDER BY created_at ASC`,
    [lastSyncTimeDate]
  );
  console.log("Source rows using DATE > :", sourceRowsDate.rows.length);

  process.exit(0);
}

run().catch(console.error);
