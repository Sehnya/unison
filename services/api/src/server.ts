/**
 * API Server
 *
 * Express server that combines all routes and middleware.
 * Requirements: All API requirements
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import compression from 'compression';
import cors from 'cors';
import type { TokenValidator } from './middleware.js';
import { errorHandler, ApiError, ApiErrorCode } from './errors.js';
import {
  createAuthRoutes,
  createGuildRoutes,
  createChannelRoutes,
  createMessageRoutes,
  createRoleRoutes,
  type AuthServiceInterface,
  type GuildServiceInterface,
  type ChannelServiceInterface,
  type MessagingServiceInterface,
  type PermissionsServiceInterface,
} from './routes/index.js';
import { createLiveKitRoutes } from './routes/livekit.js';
import type { LiveKitService } from './services/livekit.js';

/**
 * API Server configuration
 */
export interface ApiServerConfig {
  authService: AuthServiceInterface;
  guildService: GuildServiceInterface;
  channelService: ChannelServiceInterface;
  messagingService: MessagingServiceInterface;
  permissionsService: PermissionsServiceInterface;
  livekitService: LiveKitService;
  validateToken: TokenValidator;
}

/**
 * Create the API server
 */
export function createApiServer(config: ApiServerConfig): Express {
  const app = express();

  // CORS configuration
  // Allow requests from frontend origin(s)
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://unison-production-1938.up.railway.app',
        // Add other frontend origins as needed
      ];

  // In development, allow all origins for easier testing
  const corsOptions = process.env.NODE_ENV === 'development' 
    ? {
        origin: true, // Allow all origins in development
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      }
    : {
        origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          // Allow requests with no origin (like mobile apps or curl requests)
          if (!origin) return callback(null, true);
          
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            console.warn(`CORS: Blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      };

  app.use(cors(corsOptions));

  // Middleware
  // Compression middleware for production (reduces response size)
  if (process.env.NODE_ENV === 'production') {
    app.use(compression());
  }
  
  // Increase body size limit to 50MB to handle image uploads (base64 encoded)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // Auth routes - MUST be registered before other /api routes to avoid conflicts
  app.use('/api/auth', createAuthRoutes({
    authService: config.authService,
    guildService: config.guildService,
    validateToken: config.validateToken,
  }));

  // Also mount at /auth for backwards compatibility
  app.use('/auth', createAuthRoutes({
    authService: config.authService,
    guildService: config.guildService,
    validateToken: config.validateToken,
  }));

  // Guild routes
  app.use('/api/guilds', createGuildRoutes({
    guildService: config.guildService,
    channelService: config.channelService,
    authService: config.authService,
    validateToken: config.validateToken,
  }));

  // Also mount at /guilds for backwards compatibility
  app.use('/guilds', createGuildRoutes({
    guildService: config.guildService,
    channelService: config.channelService,
    authService: config.authService,
    validateToken: config.validateToken,
  }));

  // Channel routes (includes /guilds/:guild_id/channels and /channels/:channel_id)
  // Routes are defined with full paths, so mount at /api (but auth router is registered first)
  const channelRoutes = createChannelRoutes({
    channelService: config.channelService,
    guildService: config.guildService,
    validateToken: config.validateToken,
  });
  app.use('/api', channelRoutes);
  app.use('/', channelRoutes);

  // Message routes (includes /channels/:channel_id/messages)
  // Routes are defined with full paths, so mount at /api (but auth router is registered first)
  const messageRoutes = createMessageRoutes({
    messagingService: config.messagingService,
    authService: config.authService,
    validateToken: config.validateToken,
  });
  app.use('/api', messageRoutes);
  app.use('/', messageRoutes);

  // Role routes (includes /guilds/:guild_id/roles and /channels/:channel_id/overwrites)
  // Routes are defined with full paths, so mount at /api (but auth router is registered first)
  const roleRoutes = createRoleRoutes({
    permissionsService: config.permissionsService,
    validateToken: config.validateToken,
  });
  app.use('/api', roleRoutes);
  app.use('/', roleRoutes);

  // LiveKit routes for voice/video calls
  const livekitRoutes = createLiveKitRoutes({
    livekitService: config.livekitService,
    validateToken: config.validateToken,
  });
  app.use('/api/livekit', livekitRoutes);

  // 404 handler
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new ApiError(ApiErrorCode.NOT_FOUND, 404, 'Not found'));
  });

  // Error handler
  app.use(errorHandler as express.ErrorRequestHandler);

  return app;
}

/**
 * Start the API server
 */
export function startApiServer(app: Express, port: number): Promise<void> {
  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`API server listening on port ${port}`);
      resolve();
    });
  });
}
