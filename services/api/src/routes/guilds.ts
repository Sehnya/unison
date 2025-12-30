/**
 * Guild Routes
 *
 * REST API routes for guild operations.
 * Requirements: 3.1-3.6, 4.1-4.6, 5.1-5.5
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { createAuthMiddleware, type AuthenticatedRequest, type TokenValidator, requireSnowflake } from '../middleware.js';
import { ApiError, ApiErrorCode } from '../errors.js';
import type { ChannelServiceInterface } from './channels.js';

/**
 * Guild service interface
 */
export interface GuildServiceInterface {
  createGuild(ownerId: string, name: string, options?: { description?: string; icon?: string; banner?: string }): Promise<{ guild: unknown }>;
  getUserGuilds(userId: string): Promise<unknown[]>;
  getGuild(guildId: string): Promise<unknown>;
  updateGuild(guildId: string, requesterId: string, updates: { name?: string; description?: string | null; icon?: string | null; banner?: string | null }): Promise<unknown>;
  deleteGuild(guildId: string, requesterId: string): Promise<void>;
  joinGuild(userId: string, inviteCode: string): Promise<unknown>;
  getGuildMembers(guildId: string): Promise<unknown[]>;
  leaveGuild(guildId: string, userId: string): Promise<void>;
  kickMember(guildId: string, requesterId: string, targetUserId: string): Promise<void>;
  createInvite(guildId: string, creatorId: string, options?: { max_uses?: number; expires_in?: number }): Promise<unknown>;
  getGuildInvites(guildId: string): Promise<unknown[]>;
  revokeInvite(guildId: string, code: string): Promise<void>;
  getGuildBans(guildId: string): Promise<unknown[]>;
  banMember(guildId: string, requesterId: string, targetUserId: string, reason?: string): Promise<unknown>;
  unbanMember(guildId: string, targetUserId: string): Promise<void>;
  getRepository(): { isOwner: (guildId: string, userId: string) => Promise<boolean> };
}

/**
 * Guild routes configuration
 */
export interface GuildRoutesConfig {
  guildService: GuildServiceInterface;
  channelService: ChannelServiceInterface;
  authService: { getUserById: (userId: string) => Promise<unknown> };
  validateToken: TokenValidator;
}

/**
 * Create guild routes
 */
export function createGuildRoutes(config: GuildRoutesConfig): Router {
  const router = Router();
  const { guildService, channelService, authService, validateToken } = config;
  const authMiddleware = createAuthMiddleware(validateToken);

  // All guild routes require authentication
  router.use(authMiddleware);

  // ============================================
  // Guild CRUD
  // Requirements: 3.1-3.6
  // ============================================

  /**
   * GET /guilds
   * Get all guilds for the authenticated user
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const guilds = await guildService.getUserGuilds(userId);
      res.status(200).json({ guilds });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /guilds/dashboard
   * Get dashboard data for the authenticated user
   * Returns user's guilds with summary information
   */
  router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const guilds = await guildService.getUserGuilds(userId);

      // Get channel counts for each guild
      const guildsWithChannels = await Promise.all(
        guilds.map(async (guild: any) => {
          try {
            const channels = await channelService.getGuildChannels(guild.id);
            return {
              ...guild,
              channel_count: channels.length,
            };
          } catch {
            return {
              ...guild,
              channel_count: 0,
            };
          }
        })
      );

      res.status(200).json({
        guilds: guildsWithChannels,
        total_guilds: guildsWithChannels.length,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /guilds
   * Create a new guild
   * Requirements: 3.1, 3.2, 3.3
   * Only sehnyaw@gmail.com can create guilds
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const { name, description, icon, banner } = req.body;

      // Check if user is allowed to create guilds (only sehnyaw@gmail.com)
      const user = await authService.getUserById(userId) as { email: string } | null;
      if (!user || user.email !== 'sehnyaw@gmail.com') {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          403,
          'Only the administrator can create guilds. Regular users can join existing guilds and chat.'
        );
      }

      if (!name || typeof name !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Name is required', 'name');
      }

      const options: { description?: string; icon?: string; banner?: string } = {};
      if (description) options.description = description;
      if (icon) options.icon = icon;
      if (banner) options.banner = banner;

      const result = await guildService.createGuild(userId, name, options);

      res.status(201).json({ guild: result.guild });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /guilds/:guild_id
   * Get a guild by ID
   */
  router.get('/:guild_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = requireSnowflake('guild_id', req.params.guild_id);

      const guild = await guildService.getGuild(guildId);

      res.status(200).json({ guild });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /guilds/:guild_id/navigate
   * Get guild with channels and members for navigation
   * Returns all data needed to navigate to and display a guild
   */
  router.get('/:guild_id/navigate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = requireSnowflake('guild_id', req.params.guild_id);

      // Get guild, channels, and members in parallel
      const [guild, channels, members] = await Promise.all([
        guildService.getGuild(guildId),
        channelService.getGuildChannels(guildId),
        guildService.getGuildMembers(guildId),
      ]);

      res.status(200).json({
        guild,
        channels,
        members,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PATCH /guilds/:guild_id
   * Update guild settings
   * Requirements: 3.4
   */
  router.patch('/:guild_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const guildId = requireSnowflake('guild_id', req.params.guild_id);
      const { name, description, icon, banner } = req.body;

      const updates: { name?: string; description?: string | null; icon?: string | null; banner?: string | null } = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (icon !== undefined) updates.icon = icon;
      if (banner !== undefined) updates.banner = banner;

      const guild = await guildService.updateGuild(guildId, userId, updates);

      res.status(200).json({ guild });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /guilds/:guild_id
   * Delete a guild
   * Requirements: 3.6
   */
  router.delete('/:guild_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const guildId = requireSnowflake('guild_id', req.params.guild_id);

      await guildService.deleteGuild(guildId, userId);

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // Membership
  // Requirements: 4.1-4.6
  // ============================================

  /**
   * POST /guilds/:guild_id/members
   * Join a guild via invite
   * Requirements: 4.1
   */
  router.post('/:guild_id/members', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const { invite_code } = req.body;

      if (!invite_code || typeof invite_code !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Invite code is required', 'invite_code');
      }

      const member = await guildService.joinGuild(userId, invite_code);

      res.status(201).json({ member });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /guilds/:guild_id/members
   * Get all members of a guild
   */
  router.get('/:guild_id/members', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = requireSnowflake('guild_id', req.params.guild_id);

      const members = await guildService.getGuildMembers(guildId);

      res.status(200).json({ members });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /guilds/:guild_id/members/:user_id
   * Leave guild (self) or kick member
   * Requirements: 4.3, 4.4
   */
  router.delete('/:guild_id/members/:user_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: requesterId } = (req as AuthenticatedRequest).user;
      const guildId = requireSnowflake('guild_id', req.params.guild_id);
      const targetUserId = requireSnowflake('user_id', req.params.user_id);

      if (requesterId === targetUserId) {
        // User is leaving
        await guildService.leaveGuild(guildId, requesterId);
      } else {
        // User is kicking another member
        await guildService.kickMember(guildId, requesterId, targetUserId);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // Invites
  // Requirements: 5.1-5.5
  // ============================================

  /**
   * POST /guilds/:guild_id/invites
   * Create an invite
   * Requirements: 5.1
   */
  router.post('/:guild_id/invites', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const guildId = requireSnowflake('guild_id', req.params.guild_id);
      const { max_uses, expires_in } = req.body;

      const options: { max_uses?: number; expires_in?: number } = {};
      if (max_uses !== undefined) options.max_uses = Number(max_uses);
      if (expires_in !== undefined) options.expires_in = Number(expires_in);

      const invite = await guildService.createInvite(guildId, userId, options);

      res.status(201).json({ invite });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /guilds/:guild_id/invites
   * Get all invites for a guild
   */
  router.get('/:guild_id/invites', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = requireSnowflake('guild_id', req.params.guild_id);

      const invites = await guildService.getGuildInvites(guildId);

      res.status(200).json({ invites });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /guilds/:guild_id/invites/:invite_code
   * Revoke an invite
   * Requirements: 5.5
   */
  router.delete('/:guild_id/invites/:invite_code', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = requireSnowflake('guild_id', req.params.guild_id);
      const { invite_code } = req.params;

      if (!invite_code) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Invite code is required');
      }

      await guildService.revokeInvite(guildId, invite_code);

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // Bans
  // Requirements: 4.5, 4.6
  // ============================================

  /**
   * GET /guilds/:guild_id/bans
   * Get all bans for a guild
   */
  router.get('/:guild_id/bans', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = requireSnowflake('guild_id', req.params.guild_id);

      const bans = await guildService.getGuildBans(guildId);

      res.status(200).json({ bans });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /guilds/:guild_id/bans/:user_id
   * Ban a user
   * Requirements: 4.5
   */
  router.post('/:guild_id/bans/:user_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: requesterId } = (req as AuthenticatedRequest).user;
      const guildId = requireSnowflake('guild_id', req.params.guild_id);
      const targetUserId = requireSnowflake('user_id', req.params.user_id);
      const { reason } = req.body;

      await guildService.banMember(guildId, requesterId, targetUserId, reason);

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /guilds/:guild_id/bans/:user_id
   * Unban a user
   */
  router.delete('/:guild_id/bans/:user_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = requireSnowflake('guild_id', req.params.guild_id);
      const targetUserId = requireSnowflake('user_id', req.params.user_id);

      await guildService.unbanMember(guildId, targetUserId);

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
