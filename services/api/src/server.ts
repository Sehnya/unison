/**
 * API Server
 *
 * Express server that combines all routes and middleware.
 * Requirements: All API requirements
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import compression from 'compression';
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

/**
 * API Server configuration
 */
export interface ApiServerConfig {
  authService: AuthServiceInterface;
  guildService: GuildServiceInterface;
  channelService: ChannelServiceInterface;
  messagingService: MessagingServiceInterface;
  permissionsService: PermissionsServiceInterface;
  validateToken: TokenValidator;
}

/**
 * Create the API server
 */
export function createApiServer(config: ApiServerConfig): Express {
  const app = express();

  // Middleware
  // Compression middleware for production (reduces response size)
  if (process.env.NODE_ENV === 'production') {
    app.use(compression());
  }
  
  // Increase body size limit to 10MB to handle image uploads (base64 encoded)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // Auth routes - MUST be registered before other /api routes to avoid conflicts
  app.use('/api/auth', createAuthRoutes({
    authService: config.authService,
    validateToken: config.validateToken,
  }));

  // Also mount at /auth for backwards compatibility
  app.use('/auth', createAuthRoutes({
    authService: config.authService,
    validateToken: config.validateToken,
  }));

  // Guild routes
  app.use('/api/guilds', createGuildRoutes({
    guildService: config.guildService,
    authService: config.authService,
    validateToken: config.validateToken,
  }));

  // Also mount at /guilds for backwards compatibility
  app.use('/guilds', createGuildRoutes({
    guildService: config.guildService,
    authService: config.authService,
    validateToken: config.validateToken,
  }));

  // Channel routes (includes /guilds/:guild_id/channels and /channels/:channel_id)
  // Routes are defined with full paths, so mount at /api (but auth router is registered first)
  // Add middleware to skip /api/auth requests before mounting
  app.use('/api', (req, res, next) => {
    // If this is an auth route, skip to next middleware/router
    if (req.path?.startsWith('/auth')) {
      return next('route'); // Skip to next router
    }
    next(); // Continue to channel routes
  });
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
