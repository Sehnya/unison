import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { createPool, closePool } from './pool.js';

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

async function deleteAllUsers(): Promise<void> {
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
    
    // First, let's see how many users exist
    const countResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const count = parseInt(countResult.rows[0].count, 10);
    
    if (count === 0) {
      console.log('No users found in database.');
      return;
    }

    console.log(`Found ${count} user(s) to delete.`);
    console.log('Deleting all users (this will also clean up related records)...');

    // Delete guilds first (they reference users via owner_id foreign key)
    // This will cascade delete guild_members, channels, messages, etc.
    const guildsResult = await pool.query('DELETE FROM guilds');
    console.log(`✓ Deleted ${guildsResult.rowCount} guild(s) (and related records)`);
    
    // Delete sessions (they reference users via foreign key)
    const sessionsResult = await pool.query('DELETE FROM sessions');
    console.log(`✓ Deleted ${sessionsResult.rowCount} session(s)`);
    
    // Delete used refresh tokens (they reference users)
    const tokensResult = await pool.query('DELETE FROM used_refresh_tokens');
    console.log(`✓ Deleted ${tokensResult.rowCount} used refresh token(s)`);
    
    // Now delete all users (no foreign key constraints remaining)
    const result = await pool.query('DELETE FROM users');
    console.log(`✓ Deleted ${result.rowCount} user(s) from the database`);
    
    // Verify deletion
    const verifyResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const remaining = parseInt(verifyResult.rows[0].count, 10);
    console.log(`✓ Verification: ${remaining} user(s) remaining in database.`);
    
    console.log('✓ All users and related data have been deleted');
    console.log('You can now register sehnyaw@gmail.com as a new user');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('does not exist')) {
        console.error('Error: Database or table does not exist.');
        console.error('Please ensure:');
        console.error('  1. The database is created and migrations have been run');
        console.error('  2. The database name in your .env file matches your actual database');
        console.error('  3. Or use DATABASE_URL environment variable');
      } else {
        console.error('Error deleting users:', error.message);
      }
    } else {
      console.error('Error deleting users:', error);
    }
    throw error;
  } finally {
    await closePool(pool);
  }
}

// Run the script
deleteAllUsers()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to delete users:', error);
    process.exit(1);
  });

