/**
 * API Server Startup Script
 *
 * Bootstraps and starts the API server with all services connected to Neon database.
 */
import { config } from 'dotenv';
import { join } from 'path';
import { Pool } from 'pg';
import { createApiServer, startApiServer } from './server.js';
import { AuthService } from '@discord-clone/auth';
import { GuildService } from '@discord-clone/guild';
import { ChannelService } from '@discord-clone/channel';
import { MessagingService } from '@discord-clone/messaging';
import { PermissionsService } from '@discord-clone/permissions';
import { LiveKitService } from './services/livekit.js';
import { createRedisCache } from '@discord-clone/cache';

// Load .env file from project root
const cwd = process.cwd();
let envPath = join(cwd, '.env');
// If we're in services/api, go up to project root
if (cwd.endsWith('services/api')) {
  envPath = join(cwd, '../../.env');
} else if (cwd.endsWith('services')) {
  envPath = join(cwd, '../.env');
}
const result = config({ path: envPath });
if (result.error) {
  // Fallback: try loading from default location
  console.warn('⚠ Could not load .env from:', envPath);
  config(); // Try default .env in current directory
} else {
  console.log('✓ Loaded .env file from:', envPath);
}

const PORT = parseInt(process.env.PORT ?? '3001', 10);

async function main() {
  console.log('Starting API server...');
  
  // Verify DATABASE_URL is loaded
  if (!process.env.DATABASE_URL) {
    console.error('✗ DATABASE_URL is not set!');
    console.error('Make sure .env file exists in the project root with DATABASE_URL');
    process.exit(1);
  }

  // Initialize Redis cache (optional - will work without it)
  const redisCache = createRedisCache();
  if (process.env.REDIS_URL) {
    console.log('✓ Redis cache initialized');
  } else {
    console.warn('⚠️  REDIS_URL not set - running without cache');
  }

  // Create database pool directly with connection string
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS ?? '20', 10),
    idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT ?? '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT ?? '5000', 10),
  });

  // Test connection
  try {
    await pool.query('SELECT 1');
    console.log('✓ Database connection successful');
  } catch (error) {
    console.error('✗ Failed to connect to database:', error);
    process.exit(1);
  }

  // Initialize services
  const workerId = parseInt(process.env.WORKER_ID ?? '1', 10);
  const permissionsService = new PermissionsService(pool, { workerId });
  const authService = new AuthService(pool, { workerId });
  const guildService = new GuildService(pool, { workerId });
  const channelService = new ChannelService(pool, { workerId });
  const messagingService = new MessagingService(pool, {
    workerId,
    permissionChecker: {
      hasPermission: async (userId, channelId, permission) => {
        return permissionsService.hasPermission(userId, channelId, permission);
      },
    },
  });

  // Initialize LiveKit service
  const livekitApiKey = process.env.LIVEKIT_API_KEY || '';
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET || '';
  const livekitWsUrl = process.env.LIVEKIT_WS_URL || 'wss://unison-livekit.livekit.cloud';

  if (!livekitApiKey || !livekitApiSecret) {
    console.warn('⚠️  LiveKit API key or secret not set. Voice calls will not work.');
  }

  const livekitService = new LiveKitService({
    apiKey: livekitApiKey,
    apiSecret: livekitApiSecret,
    wsUrl: livekitWsUrl,
  });

  // Create token validator using the auth service's validateToken method
  const validateToken = (token: string) => {
    try {
      return authService.validateToken(token);
    } catch (error) {
      // Log the error for debugging
      console.error('Token validation error:', error instanceof Error ? error.message : error);
      throw error;
    }
  };

  // Create API server
  const app = createApiServer({
    authService,
    guildService,
    channelService,
    messagingService,
    permissionsService,
    livekitService,
    validateToken,
  });

  // Start server
  await startApiServer(app, PORT);
  console.log(`✓ API server running on http://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await redisCache.close();
    await pool.end();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await redisCache.close();
    await pool.end();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Failed to start API server:', error);
  process.exit(1);
});

