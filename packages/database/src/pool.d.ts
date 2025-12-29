/**
 * Database Connection Pool Factory
 *
 * Creates and manages PostgreSQL connection pools for services.
 */
import { Pool } from 'pg';
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
export declare function getDatabaseConfig(): DatabaseConfig;
/**
 * Create a database connection pool
 */
export declare function createPool(config?: Partial<DatabaseConfig>): Pool;
/**
 * Test database connection
 */
export declare function testConnection(pool: Pool): Promise<boolean>;
/**
 * Close database pool gracefully
 */
export declare function closePool(pool: Pool): Promise<void>;
//# sourceMappingURL=pool.d.ts.map