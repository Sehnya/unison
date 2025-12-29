/**
 * Database Connection Pool Factory
 *
 * Creates and manages PostgreSQL connection pools for services.
 */

import { Pool, type PoolConfig } from 'pg';

/**
 * Database configuration from environment
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  maxConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

/**
 * Get database configuration from environment variables
 */
export function getDatabaseConfig(): DatabaseConfig {
  // On macOS, PostgreSQL often uses the system username instead of 'postgres'
  const defaultUser = process.env.USER || process.env.USERNAME || 'postgres';
  return {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    database: process.env.POSTGRES_DB ?? 'discord_clone',
    user: process.env.POSTGRES_USER ?? defaultUser,
    password: process.env.POSTGRES_PASSWORD ?? '',
    maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS ?? '20', 10),
    idleTimeoutMs: parseInt(process.env.POSTGRES_IDLE_TIMEOUT ?? '30000', 10),
    connectionTimeoutMs: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT ?? '5000', 10),
  };
}

/**
 * Create a database connection pool
 */
export function createPool(config?: Partial<DatabaseConfig>): Pool {
  const dbConfig = { ...getDatabaseConfig(), ...config };

  const poolConfig: PoolConfig = {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    max: dbConfig.maxConnections,
    idleTimeoutMillis: dbConfig.idleTimeoutMs,
    connectionTimeoutMillis: dbConfig.connectionTimeoutMs,
  };

  const pool = new Pool(poolConfig);

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
  });

  return pool;
}

/**
 * Test database connection
 */
export async function testConnection(pool: Pool): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Close database pool gracefully
 */
export async function closePool(pool: Pool): Promise<void> {
  await pool.end();
}
