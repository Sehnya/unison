/**
 * Database Connection Pool Factory
 *
 * Creates and manages PostgreSQL connection pools for services.
 */
import { Pool } from 'pg';
/**
 * Get database configuration from environment variables
 */
export function getDatabaseConfig() {
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
export function createPool(config) {
    const dbConfig = { ...getDatabaseConfig(), ...config };
    const poolConfig = {
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
export async function testConnection(pool) {
    try {
        await pool.query('SELECT 1');
        return true;
    }
    catch (error) {
        console.error('Database connection test failed:', error);
        return false;
    }
}
/**
 * Close database pool gracefully
 */
export async function closePool(pool) {
    await pool.end();
}
//# sourceMappingURL=pool.js.map