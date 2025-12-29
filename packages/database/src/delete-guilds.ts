/**
 * Script to delete all guilds from the database
 * 
 * This will cascade delete:
 * - guild_members
 * - guild_bans
 * - invites
 * - channels (and their messages)
 * - roles
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { createPool, closePool, getDatabaseConfig } from './pool';

// Load .env file from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Go up from packages/database/src to project root (3 levels up)
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

async function deleteAllGuilds(): Promise<void> {
  // Use DATABASE_URL if available, otherwise use config
  let pool: Pool;
  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  } else {
    pool = createPool();
  }

  try {
    console.log('Connecting to database...');
    
    // Test connection first
    await pool.query('SELECT 1');
    console.log('✓ Connected to database');
    
    // First, let's see how many guilds exist
    const countResult = await pool.query('SELECT COUNT(*) as count FROM guilds WHERE deleted_at IS NULL');
    const count = parseInt(countResult.rows[0].count, 10);
    
    if (count === 0) {
      console.log('No guilds found in database.');
      return;
    }

    console.log(`Found ${count} guild(s) to delete.`);
    console.log('Deleting all guilds (this will cascade delete related records)...');

    // Delete all guilds (CASCADE will handle related tables)
    const result = await pool.query('DELETE FROM guilds');
    
    console.log(`✓ Successfully deleted ${result.rowCount} guild(s) and all related records.`);
    
    // Verify deletion
    const verifyResult = await pool.query('SELECT COUNT(*) as count FROM guilds');
    const remaining = parseInt(verifyResult.rows[0].count, 10);
    console.log(`✓ Verification: ${remaining} guild(s) remaining in database.`);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('does not exist')) {
        console.error('Error: Database or table does not exist.');
        console.error('Please ensure:');
        console.error('  1. The database is created and migrations have been run');
        console.error('  2. The database name in your .env file matches your actual database');
        console.error('  3. Or use DATABASE_URL environment variable');
        console.error('\nYou can also run the SQL directly:');
        console.error('  psql -d <your_database> -f packages/database/migrations/delete_all_guilds.sql');
      } else {
        console.error('Error deleting guilds:', error.message);
      }
    } else {
      console.error('Error deleting guilds:', error);
    }
    throw error;
  } finally {
    await closePool(pool);
  }
}

// Run the script
deleteAllGuilds()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to delete guilds:', error);
    process.exit(1);
  });

