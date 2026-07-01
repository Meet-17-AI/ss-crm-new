import { Pool } from 'pg';

const srcPool = new Pool({
  host: '72.60.103.151',
  port: 5432,
  database: 'safestories_db',
  user: 'fluidadmin',
  password: 'admin123',
  max: 10
});

const destPool = new Pool({
  host: '72.60.103.151',
  port: 5432,
  database: 'safestories_db_v2',
  user: 'fluidadmin',
  password: 'admin123',
  max: 10
});

async function getTables(pool: Pool) {
  const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
  return res.rows.map(r => r.table_name);
}

async function getColumns(pool: Pool, tableName: string) {
  const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [tableName]);
  return res.rows.map(r => r.column_name);
}

async function getPrimaryKey(pool: Pool, tableName: string): Promise<string[]> {
  try {
    const result = await pool.query(`
      SELECT a.attname
      FROM   pg_index i
      JOIN   pg_attribute a ON a.attrelid = i.indrelid
                           AND a.attnum = ANY(i.indkey)
      WHERE  i.indrelid = $1::regclass
      AND    i.indisprimary;
    `, [tableName]);
    return result.rows.map(r => r.attname);
  } catch (e) {
    return [];
  }
}

async function getTableDDL(pool: Pool, tableName: string): Promise<string> {
    const res = await pool.query(`
        SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
    `, [tableName]);
    
    let ddl = "CREATE TABLE IF NOT EXISTS \"" + tableName + "\" (\n";
    const colDefs = [];
    for (const row of res.rows) {
        let type = row.data_type;
        if (type === 'character varying' && row.character_maximum_length) {
            type += "(" + row.character_maximum_length + ")";
        }
        let def = "  \"" + row.column_name + "\" " + type;
        if (row.is_nullable === 'NO') def += ' NOT NULL';
        
        if (row.column_default) {
            if (row.column_default.includes('nextval')) {
                // Reconstruct without the nextval default, replace type with SERIAL
                if (row.data_type === 'integer') type = 'SERIAL';
                if (row.data_type === 'bigint') type = 'BIGSERIAL';
                def = "  \"" + row.column_name + "\" " + type;
                if (row.is_nullable === 'NO') def += ' NOT NULL';
            } else {
                def += " DEFAULT " + row.column_default;
            }
        }
        colDefs.push(def);
    }
    ddl += colDefs.join(",\n") + "\n);";
    return ddl;
}


async function migrateTable(tableName: string) {
  console.log("\nMigrating table: " + tableName);
  const srcCols = await getColumns(srcPool, tableName);
  const destCols = await getColumns(destPool, tableName);
  
  const commonCols = srcCols.filter(c => destCols.includes(c));
  if (commonCols.length === 0) {
    console.log("No common columns found for " + tableName + ". Skipping.");
    return;
  }
  
  const pks = await getPrimaryKey(destPool, tableName);
  
  const batchSize = 500;
  let offset = 0;
  let hasMore = true;
  let totalInserted = 0;
  
  while (hasMore) {
    const rowsRes = await srcPool.query("SELECT " + commonCols.map(c => "\"" + c + "\"").join(', ') + " FROM \"" + tableName + "\" LIMIT $1 OFFSET $2", [batchSize, offset]);
    
    if (rowsRes.rows.length === 0) {
      hasMore = false;
      break;
    }
    
    for (const row of rowsRes.rows) {
      const vals = commonCols.map(c => row[c]);
      const placeholders = commonCols.map((_, i) => "$" + (i + 1));
      
      let query = "INSERT INTO \"" + tableName + "\" (" + commonCols.map(c => "\"" + c + "\"").join(', ') + ") VALUES (" + placeholders.join(', ') + ")";
      
      if (pks.length > 0) {
        const updateCols = commonCols.filter(c => !pks.includes(c));
        if (updateCols.length > 0) {
            const updateStr = updateCols.map(c => "\"" + c + "\" = EXCLUDED.\"" + c + "\"").join(', ');
            query += " ON CONFLICT (" + pks.map(p => "\"" + p + "\"").join(', ') + ") DO UPDATE SET " + updateStr;
        } else {
            query += " ON CONFLICT (" + pks.map(p => "\"" + p + "\"").join(', ') + ") DO NOTHING";
        }
      }
      
      try {
        await destPool.query(query, vals);
        totalInserted++;
      } catch (err: any) {
        console.error("Error inserting row into " + tableName + ": " + err.message);
      }
    }
    
    offset += batchSize;
    console.log("Processed " + offset + " rows for " + tableName + "...");
  }
  
  console.log("Finished " + tableName + ". Total rows processed: " + totalInserted);
}

async function run() {
  try {
    console.log('Ensuring future_action exists in leads...');
    try {
      await destPool.query('ALTER TABLE leads ADD COLUMN IF NOT EXISTS future_action TEXT');
      console.log('Added future_action column to leads.');
    } catch (e: any) {
      console.error('Error adding future_action column:', e.message);
    }

    console.log('Checking for booking_lead_movement_log in destination...');
    const destTables = await getTables(destPool);
    if (!destTables.includes('booking_lead_movement_log')) {
        console.log('Creating booking_lead_movement_log...');
        const ddl = await getTableDDL(srcPool, 'booking_lead_movement_log');
        await destPool.query(ddl);
        const srcPks = await getPrimaryKey(srcPool, 'booking_lead_movement_log');
        if (srcPks.length > 0) {
             await destPool.query("ALTER TABLE booking_lead_movement_log ADD PRIMARY KEY (" + srcPks.join(',') + ")");
        }
        console.log('Table booking_lead_movement_log created.');
    }

    const srcTables = await getTables(srcPool);
    const destTablesUpdated = await getTables(destPool);
    
    const commonTables = srcTables.filter(t => destTablesUpdated.includes(t));
    
    console.log("Found " + commonTables.length + " tables to migrate.");
    
    for (const table of commonTables) {
      await migrateTable(table);
    }
    
    console.log('\\nMigration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await srcPool.end();
    await destPool.end();
  }
}

run();
