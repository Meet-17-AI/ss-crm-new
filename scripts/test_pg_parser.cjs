const { Pool, types } = require('pg');

types.setTypeParser(1114, str => str);
types.setTypeParser(1184, str => str);

const sourceDb = new Pool({
  host: '72.60.103.151',
  port: 5432,
  database: 'safestories_db',
  user: 'fluidadmin',
  password: 'admin123',
});

async function run() {
  const sourceRows = await sourceDb.query(
    `SELECT created_at FROM notifications ORDER BY created_at DESC LIMIT 1`
  );
  console.log("Source row with custom type parser:", sourceRows.rows[0]);
  process.exit(0);
}

run().catch(console.error);
