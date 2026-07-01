import { Client, Pool } from 'pg';

const POLLING_INTERVAL_MS = 10000; // 10 seconds

// Connect to Production (Source)
const sourceDb = new Pool({
  host: '72.60.103.151',
  port: 5432,
  database: 'safestories_db',
  user: 'fluidadmin',
  password: 'admin123',
  max: 2,
});

// Connect to Testing (Target)
const targetDb = new Pool({
  host: '72.60.103.151',
  port: 5432,
  database: 'safestories_db_v2',
  user: 'fluidadmin',
  password: 'admin123',
  max: 2,
});

interface TableConfig {
  name: string;
  primaryKey: string[]; // e.g. ['id'] or ['booking_id']
  timestampCol: string; // e.g. 'updated_at' or 'created_at'
}

const SYNC_TABLES: TableConfig[] = [
  { name: 'leads', primaryKey: ['id'], timestampCol: 'updated_at' },
  { name: 'bookings', primaryKey: ['booking_id'], timestampCol: 'booking_updated_at' },
  { name: 'users', primaryKey: ['id'], timestampCol: 'updated_at' },
  { name: 'pretherapy_call_forms', primaryKey: ['id'], timestampCol: 'submitted_at' },
  { name: 'crm_audit_logs', primaryKey: ['log_id'], timestampCol: 'timestamp' },
  { name: 'masked_emails', primaryKey: ['id'], timestampCol: 'created_at' },
  { name: 'notifications', primaryKey: ['notification_id'], timestampCol: 'created_at' },
  { name: 'payments', primaryKey: ['id'], timestampCol: 'created_at' }
];

async function getTargetSchema(tableName: string): Promise<string[]> {
  const result = await targetDb.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = $1 AND is_generated = 'NEVER'
  `, [tableName]);
  return result.rows.map(r => r.column_name);
}

async function syncTable(config: TableConfig) {
  try {
    // 1. Get high-water mark from Target
    let lastSyncTime = new Date(0);
    const hwResult = await targetDb.query(`SELECT MAX(${config.timestampCol}) as max_ts FROM ${config.name}`);
    if (hwResult.rows[0].max_ts) {
      lastSyncTime = new Date(hwResult.rows[0].max_ts);
      // Subtract a minute just to be safe with timezone/microsecond precision issues
      lastSyncTime = new Date(lastSyncTime.getTime() - 60000); 
    }

    // 2. Fetch updated/new rows from Source
    const sourceRows = await sourceDb.query(
      `SELECT * FROM ${config.name} WHERE ${config.timestampCol} > $1 OR ${config.timestampCol} IS NULL ORDER BY ${config.timestampCol} ASC NULLS FIRST`,
      [lastSyncTime]
    );

    if (sourceRows.rows.length === 0) {
      return; // Nothing to sync
    }

    console.log(`[SYNC] ${config.name}: Found ${sourceRows.rows.length} new/updated rows.`);

    // 3. Get schema to ensure we don't insert columns that don't exist in target (though they should match)
    const targetCols = await getTargetSchema(config.name);

    // 4. Upsert into Target
    const client = await targetDb.connect();
    try {
      await client.query('BEGIN');
      
      // CRITICAL: Disable triggers temporarily to avoid "duplicate key" on side-effects (like notifications)
      await client.query("SET LOCAL session_replication_role = 'replica'");

      for (const row of sourceRows.rows) {
        // Filter row to only include columns that exist in target
        const rowCols = Object.keys(row).filter(c => targetCols.includes(c));
        const rowVals = rowCols.map(c => row[c]);
        
        const placeholders = rowCols.map((_, i) => `$${i + 1}`).join(', ');
        
        // Build ON CONFLICT UPDATE clause
        const updateSet = rowCols
          .filter(c => !config.primaryKey.includes(c)) // Don't update primary keys
          .map(c => `${c} = EXCLUDED.${c}`)
          .join(', ');

        let query = `INSERT INTO ${config.name} (${rowCols.join(', ')}) VALUES (${placeholders})`;
        
        if (updateSet.length > 0) {
          query += ` ON CONFLICT (${config.primaryKey.join(', ')}) DO UPDATE SET ${updateSet}`;
        } else {
          query += ` ON CONFLICT (${config.primaryKey.join(', ')}) DO NOTHING`;
        }

        await client.query(query, rowVals);
      }

      await client.query('COMMIT');
      console.log(`[SYNC] ${config.name}: Successfully applied ${sourceRows.rows.length} rows.`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[SYNC] Failed to apply changes for ${config.name}:`, err);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`[SYNC] Error syncing table ${config.name}:`, error);
  }
}

async function startDaemon() {
  console.log('🚀 Starting One-Way Sync Daemon (Source -> Target)...');
  
  while (true) {
    for (const table of SYNC_TABLES) {
      await syncTable(table);
    }
    
    // Wait for the polling interval
    await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
  }
}

startDaemon().catch(console.error);
