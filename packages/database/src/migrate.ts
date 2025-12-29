import { config } from 'dotenv';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root
const projectRoot = join(__dirname, '../../..');
const envPath = join(projectRoot, '.env');

const result = config({ path: envPath });
if (result.error) {
  // Fallback: try loading from default location
  console.warn('⚠ Could not load .env from:', envPath);
  const fallbackResult = config(); // Try default .env in current directory
  if (fallbackResult.error) {
    console.warn('⚠ Could not load .env from current directory either');
  } else {
    console.log('✓ Loaded .env file from current directory');
  }
} else {
  console.log('✓ Loaded .env file from:', envPath);
}

interface MigrationRecord {
  id: number;
  name: string;
  applied_at: Date;
}

export async function createMigrationTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function getAppliedMigrations(pool: pg.Pool): Promise<string[]> {
  const result = await pool.query<MigrationRecord>(
    'SELECT name FROM schema_migrations ORDER BY id'
  );
  return result.rows.map((row) => row.name);
}

export async function getMigrationFiles(direction: 'up' | 'down'): Promise<string[]> {
  const migrationsDir = join(__dirname, '..', 'migrations');
  const files = readdirSync(migrationsDir);

  const suffix = direction === 'up' ? '.sql' : '_down.sql';
  const migrationFiles = files
    .filter((f) => f.endsWith(suffix) && (direction === 'up' ? !f.includes('_down') : true))
    .sort();

  return migrationFiles;
}

export async function runMigration(
  pool: pg.Pool,
  migrationName: string,
  direction: 'up' | 'down'
): Promise<void> {
  const migrationsDir = join(__dirname, '..', 'migrations');
  const fileName = direction === 'up' ? migrationName : migrationName.replace('.sql', '_down.sql');
  const filePath = join(migrationsDir, fileName);

  const sql = readFileSync(filePath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);

    if (direction === 'up') {
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migrationName]);
    } else {
      const upName = migrationName.replace('_down.sql', '.sql');
      await client.query('DELETE FROM schema_migrations WHERE name = $1', [upName]);
    }

    await client.query('COMMIT');
    console.log(`✓ ${direction === 'up' ? 'Applied' : 'Rolled back'}: ${migrationName}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function migrateUp(pool: pg.Pool): Promise<void> {
  await createMigrationTable(pool);
  const applied = await getAppliedMigrations(pool);
  const files = await getMigrationFiles('up');

  const pending = files.filter((f) => !applied.includes(f));

  if (pending.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  for (const migration of pending) {
    await runMigration(pool, migration, 'up');
  }
}

export async function migrateDown(pool: pg.Pool, steps = 1): Promise<void> {
  await createMigrationTable(pool);
  const applied = await getAppliedMigrations(pool);

  if (applied.length === 0) {
    console.log('No migrations to roll back.');
    return;
  }

  const toRollback = applied.slice(-steps).reverse();

  for (const migration of toRollback) {
    await runMigration(pool, migration, 'down');
  }
}

// CLI entry point
async function main(): Promise<void> {
  const command = process.argv[2];

  if (!command || !['up', 'down'].includes(command)) {
    console.log('Usage: npm run migrate [up|down]');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env['DATABASE_URL'] ?? 'postgresql://localhost:5432/discord_clone',
  });

  try {
    if (command === 'up') {
      await migrateUp(pool);
    } else {
      const steps = parseInt(process.argv[3] ?? '1', 10);
      await migrateDown(pool, steps);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
