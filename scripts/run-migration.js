const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.js <migration-file>');
  process.exit(1);
}

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_2hPFUZ4XiCGd@ep-wispy-lab-ado832r1-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function runMigration() {
  const sqlPath = path.resolve(migrationFile);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  try {
    await pool.query(sql);
    console.log('Migration completed successfully:', migrationFile);
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
