/**
 * API Gateway Service
 *
 * REST API gateway for the Discord Clone platform.
 * Requirements: All API requirements
 */

// Server
export { createApiServer, startApiServer, type ApiServerConfig } from './server.js';

// Bootstrap
export {
  bootstrapApi,
  EventBusEmitter,
  createMockTokenValidator,
  type BootstrapConfig,
  type BootstrappedApi,
  type TokenPayload,
} from './bootstrap.js';

// Middleware
export {
  createAuthMiddleware,
  createOptionalAuthMiddleware,
  validateBody,
  parseSnowflake,
  requireSnowflake,
  type AuthenticatedRequest,
  type TokenValidator,
} from './middleware.js';

// Errors
export {
  ApiError,
  ApiErrorCode,
  mapServiceError,
  sendError,
  errorHandler,
  type ApiErrorResponse,
} from './errors.js';

// Routes
export {
  createAuthRoutes,
  createGuildRoutes,
  createChannelRoutes,
  createMessageRoutes,
  createRoleRoutes,
  type AuthRoutesConfig,
  type GuildRoutesConfig,
  type ChannelRoutesConfig,
  type MessageRoutesConfig,
  type RoleRoutesConfig,
} from './routes/index.js';
