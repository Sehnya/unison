/**
 * Role Routes
 *
 * REST API routes for role and permission operations.
 * Requirements: 6.1-6.6, 8.5
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { createAuthMiddleware, type TokenValidator, requireSnowflake } from '../middleware.js';
import { ApiError, ApiErrorCode } from '../errors.js';

/**
 * Permissions service interface
 */
export interface PermissionsServiceInterface {
  createRole(guildId: string, name: string, permissions: bigint, color?: string): Promise<{ id: string; guild_id: string; name: string; color?: string | null; position: number; permissions: bigint; created_at: Date }>;
  getGuildRoles(guildId: string): Promise<Array<{ id: string; guild_id: string; name: string; color?: string | null; position: number; permissions: bigint; created_at: Date }>>;
  updateRole(roleId: string, updates: { name?: string; permissions?: bigint; color?: string | null }): Promise<{ id: string; guild_id: string; name: string; color?: string | null; position: number; permissions: bigint; created_at: Date }>;
  deleteRole(roleId: string): Promise<void>;
  assignRole(guildId: string, userId: string, roleId: string): Promise<void>;
  removeRole(guildId: string, userId: string, roleId: string): Promise<void>;
  getMemberRoles(guildId: string, userId: string): Promise<Array<{ id: string; guild_id: string; name: string; color?: string | null; position: number; permissions: bigint; created_at: Date }>>;
  setChannelOverwrite(channelId: string, targetId: string, targetType: 'role' | 'member', allow: bigint, deny: bigint): Promise<{ channel_id: string; target_id: string; target_type: string; allow: bigint; deny: bigint }>;
  deleteChannelOverwrite(channelId: string, targetId: string): Promise<void>;
  getChannelOverwrites(channelId: string): Promise<Array<{ channel_id: string; target_id: string; target_type: string; allow: bigint; deny: bigint }>>;
}

/**
 * Role routes configuration
 */
export interface RoleRoutesConfig {
  permissionsService: PermissionsServiceInterface;
  validateToken: TokenValidator;
}

/**
 * Create role routes
 */
export function createRoleRoutes(config: RoleRoutesConfig): Router {
  const router = Router();
  const { permissionsService, validateToken } = config;
  const authMiddleware = createAuthMiddleware(validateToken);

  // All role routes require authentication
  router.use(authMiddleware);

  // ============================================
  // Role CRUD
  // Requirements: 6.1-6.4
  // ============================================

  /**
   * POST /guilds/:guild_id/roles
   * Create a new role
   * Requirements: 6.1
   */
  router.post('/guilds/:guild_id/roles', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = requireSnowflake('guild_id', req.params.guild_id);
      const { name, permissions, color } = req.body;

      if (!name || typeof name !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Name is required', 'name');
      }

      // Parse permissions as bigint
      let permissionsBigint = 0n;
      if (permissions !== undefined) {
        try {
          permissionsBigint = BigInt(permissions);
        } catch {
          throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Invalid permissions value', 'permissions');
        }
      }

      const role = await permissionsService.createRole(guildId, name, permissionsBigint, color);

      res.status(201).json({ role: serializeRole(role) });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /guilds/:guild_id/roles
   * Get all roles for a guild
   */
  router.get('/guilds/:guild_id/roles', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = requireSnowflake('guild_id', req.params.guild_id);

      const roles = await permissionsService.getGuildRoles(guildId);

      res.status(200).json({ roles: roles.map(serializeRole) });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PATCH /guilds/:guild_id/roles/:role_id
   * Update a role
   * Requirements: 6.2
   */
  router.patch('/guilds/:guild_id/roles/:role_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roleId = requireSnowflake('role_id', req.params.role_id);
      const { name, permissions, color } = req.body;

      const updates: {
        name?: string;
        permissions?: bigint;
        color?: string | null;
      } = {};

      if (name !== undefined) updates.name = name;
      if (color !== undefined) updates.color = color;
      if (permissions !== undefined) {
        try {
          updates.permissions = BigInt(permissions);
        } catch {
          throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Invalid permissions value', 'permissions');
        }
      }

      const role = await permissionsService.updateRole(roleId, updates);

      res.status(200).json({ role: serializeRole(role) });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /guilds/:guild_id/roles/:role_id
   * Delete a role
   * Requirements: 6.4
   */
  router.delete('/guilds/:guild_id/roles/:role_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roleId = requireSnowflake('role_id', req.params.role_id);

      await permissionsService.deleteRole(roleId);

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // Role Assignment
  // Requirements: 6.5, 6.6
  // ============================================

  /**
   * PUT /guilds/:guild_id/members/:user_id/roles/:role_id
   * Assign a role to a member
   * Requirements: 6.5
   */
  router.put('/guilds/:guild_id/members/:user_id/roles/:role_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = requireSnowflake('guild_id', req.params.guild_id);
      const userId = requireSnowflake('user_id', req.params.user_id);
      const roleId = requireSnowflake('role_id', req.params.role_id);

      await permissionsService.assignRole(guildId, userId, roleId);

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /guilds/:guild_id/members/:user_id/roles/:role_id
   * Remove a role from a member
   * Requirements: 6.6
   */
  router.delete('/guilds/:guild_id/members/:user_id/roles/:role_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = requireSnowflake('guild_id', req.params.guild_id);
      const userId = requireSnowflake('user_id', req.params.user_id);
      const roleId = requireSnowflake('role_id', req.params.role_id);

      await permissionsService.removeRole(guildId, userId, roleId);

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /guilds/:guild_id/members/:user_id/roles
   * Get all roles for a member
   */
  router.get('/guilds/:guild_id/members/:user_id/roles', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = requireSnowflake('guild_id', req.params.guild_id);
      const userId = requireSnowflake('user_id', req.params.user_id);

      const roles = await permissionsService.getMemberRoles(guildId, userId);

      res.status(200).json({ roles: roles.map(serializeRole) });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // Channel Overwrites
  // Requirements: 8.5
  // ============================================

  /**
   * PUT /channels/:channel_id/overwrites/:target_id
   * Set a channel permission overwrite
   * Requirements: 8.5
   */
  router.put('/channels/:channel_id/overwrites/:target_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channelId = requireSnowflake('channel_id', req.params.channel_id);
      const targetId = requireSnowflake('target_id', req.params.target_id);
      const { type, allow, deny } = req.body;

      if (!type || (type !== 'role' && type !== 'member')) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Type must be "role" or "member"', 'type');
      }

      let allowBigint = 0n;
      let denyBigint = 0n;

      if (allow !== undefined) {
        try {
          allowBigint = BigInt(allow);
        } catch {
          throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Invalid allow value', 'allow');
        }
      }

      if (deny !== undefined) {
        try {
          denyBigint = BigInt(deny);
        } catch {
          throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Invalid deny value', 'deny');
        }
      }

      const overwrite = await permissionsService.setChannelOverwrite(
        channelId,
        targetId,
        type,
        allowBigint,
        denyBigint
      );

      res.status(200).json({ overwrite: serializeOverwrite(overwrite) });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /channels/:channel_id/overwrites/:target_id
   * Delete a channel permission overwrite
   * Requirements: 8.5
   */
  router.delete('/channels/:channel_id/overwrites/:target_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channelId = requireSnowflake('channel_id', req.params.channel_id);
      const targetId = requireSnowflake('target_id', req.params.target_id);

      await permissionsService.deleteChannelOverwrite(channelId, targetId);

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /channels/:channel_id/overwrites
   * Get all overwrites for a channel
   */
  router.get('/channels/:channel_id/overwrites', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channelId = requireSnowflake('channel_id', req.params.channel_id);

      const overwrites = await permissionsService.getChannelOverwrites(channelId);

      res.status(200).json({ overwrites: overwrites.map(serializeOverwrite) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

/**
 * Serialize role for JSON response (convert bigint to string)
 */
function serializeRole(role: { permissions: bigint; [key: string]: unknown }) {
  return {
    ...role,
    permissions: role.permissions.toString(),
  };
}

/**
 * Serialize overwrite for JSON response (convert bigint to string)
 */
function serializeOverwrite(overwrite: { allow: bigint; deny: bigint; [key: string]: unknown }) {
  return {
    ...overwrite,
    allow: overwrite.allow.toString(),
    deny: overwrite.deny.toString(),
  };
}
