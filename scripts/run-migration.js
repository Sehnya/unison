require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.js <migration-file>');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Create a .env file in the project root.');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
const isNeon = connectionString.includes('neon.tech');

const pool = new Pool({
  connectionString,
  ...(isNeon ? { ssl: { rejectUnauthorized: false } } : {}),
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
