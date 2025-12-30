/**
 * API Routes Index
 *
 * Exports all route creators for the API Gateway.
 */

export { createAuthRoutes, type AuthRoutesConfig, type AuthServiceInterface } from './auth.js';
export { createGuildRoutes, type GuildRoutesConfig, type GuildServiceInterface, type ChannelServiceInterface } from './guilds.js';
export { createChannelRoutes, type ChannelRoutesConfig, type ChannelServiceInterface } from './channels.js';
export { createMessageRoutes, type MessageRoutesConfig, type MessagingServiceInterface } from './messages.js';
export { createRoleRoutes, type RoleRoutesConfig, type PermissionsServiceInterface } from './roles.js';
