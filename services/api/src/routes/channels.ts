/**
 * Channel Routes
 *
 * REST API routes for channel operations.
 * Requirements: 8.1-8.4
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { ChannelType } from '@discord-clone/types';
import { createAuthMiddleware, type AuthenticatedRequest, type TokenValidator, requireSnowflake } from '../middleware.js';
import { ApiError, ApiErrorCode } from '../errors.js';

/**
 * Channel service interface
 */
export interface ChannelServiceInterface {
  createChannel(guildId: string, options: { name: string; type?: number; parentId?: string; topic?: string }): Promise<unknown>;
  getGuildChannels(guildId: string): Promise<unknown[]>;
  getChannel(channelId: string): Promise<unknown>;
  updateChannel(channelId: string, updates: { name?: string; topic?: string | null; position?: number; parentId?: string | null }): Promise<unknown>;
  deleteChannel(channelId: string): Promise<void>;
}

/**
 * User lookup interface for admin checks
 */
export interface UserLookupInterface {
  getUserById(userId: string): Promise<{ email: string } | null>;
}

// Admin email that can delete any channel
const ADMIN_EMAIL = 'sehnyaw@gmail.com';

/**
 * Database pool interface for document operations
 */
export interface PoolInterface {
  query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

/**
 * Channel routes configuration
 */
export interface ChannelRoutesConfig {
  channelService: ChannelServiceInterface;
  guildService: { getRepository: () => { isOwner: (guildId: string, userId: string) => Promise<boolean> } };
  userLookup?: UserLookupInterface;
  validateToken: TokenValidator;
  pool?: PoolInterface;
}

/**
 * Create channel routes
 */
export function createChannelRoutes(config: ChannelRoutesConfig): Router {
  const router = Router();
  const { channelService, guildService, userLookup, validateToken, pool } = config;
  const authMiddleware = createAuthMiddleware(validateToken);

  // All channel routes require authentication
  // Skip this router entirely for /auth paths to avoid 405 errors
  router.use((req, res, next) => {
    // If this is an auth route, skip this router by calling next() without applying middleware
    // This allows Express to continue to the next router (auth router)
    const path = req.path || req.url || '';
    const originalUrl = req.originalUrl || req.url || '';
    if (path.startsWith('/auth') || originalUrl.includes('/auth/')) {
      // Skip this router - don't apply middleware, don't try to match routes
      // Express will continue to the next router in the chain
      return next();
    }
    return authMiddleware(req, res, next);
  });

  // ============================================
  // Guild Channels
  // Requirements: 8.1
  // ============================================

  /**
   * POST /guilds/:guild_id/channels
   * Create a new channel
   * Requirements: 8.1
   * Only guild owners can create channels
   */
  router.post('/guilds/:guild_id/channels', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const guildId = requireSnowflake('guild_id', req.params.guild_id);
      const { name, type, parent_id, topic } = req.body;

      // Check if user is the owner of the guild
      const isOwner = await guildService.getRepository().isOwner(guildId, userId);
      if (!isOwner) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          403,
          'Only guild owners can create channels'
        );
      }

      if (!name || typeof name !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Name is required', 'name');
      }

      // Parse channel type
      let channelType = ChannelType.TEXT;
      if (type !== undefined) {
        if (type === 'CATEGORY' || type === 1) {
          channelType = ChannelType.CATEGORY;
        } else if (type === 'voice' || type === 'VOICE' || type === 2) {
          channelType = ChannelType.VOICE;
        } else if (type === 'document' || type === 'DOCUMENT' || type === 3) {
          channelType = ChannelType.DOCUMENT;
        } else if (type !== 'TEXT' && type !== 'text' && type !== 0) {
          throw new ApiError(ApiErrorCode.INVALID_CHANNEL_TYPE, 400, 'Invalid channel type');
        }
      }

      const createOptions: {
        name: string;
        type: ChannelType;
        parentId?: string;
        topic?: string;
      } = {
        name,
        type: channelType,
      };
      
      if (parent_id) {
        createOptions.parentId = requireSnowflake('parent_id', parent_id);
      }
      if (topic) {
        createOptions.topic = topic;
      }

      const channel = await channelService.createChannel(guildId, createOptions);

      res.status(201).json({ channel });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /guilds/:guild_id/channels
   * Get all channels for a guild
   * Requirements: 8.1
   */
  router.get('/guilds/:guild_id/channels', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = requireSnowflake('guild_id', req.params.guild_id);

      const channels = await channelService.getGuildChannels(guildId);

      res.status(200).json({ channels });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // Individual Channel Operations
  // Requirements: 8.2, 8.3, 8.4
  // ============================================

  /**
   * GET /channels/:channel_id
   * Get a channel by ID
   */
  router.get('/channels/:channel_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channelId = requireSnowflake('channel_id', req.params.channel_id);

      const channel = await channelService.getChannel(channelId);

      res.status(200).json({ channel });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PATCH /channels/:channel_id
   * Update channel settings
   * Requirements: 8.2
   */
  router.patch('/channels/:channel_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channelId = requireSnowflake('channel_id', req.params.channel_id);
      const { name, topic, position, parent_id } = req.body;

      const updates: {
        name?: string;
        topic?: string | null;
        position?: number;
        parentId?: string | null;
      } = {};

      if (name !== undefined) updates.name = name;
      if (topic !== undefined) updates.topic = topic;
      if (position !== undefined) updates.position = Number(position);
      if (parent_id !== undefined) {
        updates.parentId = parent_id === null ? null : requireSnowflake('parent_id', parent_id);
      }

      const channel = await channelService.updateChannel(channelId, updates);

      res.status(200).json({ channel });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /channels/:channel_id
   * Delete a channel
   * Requirements: 8.4
   * Only admin (sehnyaw@gmail.com) can delete channels
   */
  router.delete('/channels/:channel_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const channelId = requireSnowflake('channel_id', req.params.channel_id);

      // Check if user is the admin
      if (userLookup) {
        const user = await userLookup.getUserById(userId);
        if (!user || user.email !== ADMIN_EMAIL) {
          throw new ApiError(
            ApiErrorCode.FORBIDDEN,
            403,
            'Only the admin can delete channels'
          );
        }
      } else {
        // If no user lookup available, deny all deletes for safety
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          403,
          'Channel deletion is not available'
        );
      }

      await channelService.deleteChannel(channelId);

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // Document Channel Operations
  // ============================================

  /**
   * GET /channels/:channel_id/document
   * Get document content for a document channel
   */
  router.get('/channels/:channel_id/document', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channelId = requireSnowflake('channel_id', req.params.channel_id);

      if (!pool) {
        throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 500, 'Document storage not available');
      }

      // Check if channel exists and is a document channel
      const channel = await channelService.getChannel(channelId) as { type: number } | null;
      if (!channel) {
        throw new ApiError(ApiErrorCode.NOT_FOUND, 404, 'Channel not found');
      }
      if (channel.type !== ChannelType.DOCUMENT) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Channel is not a document channel');
      }

      // Get document content
      const result = await pool.query<{
        content: string;
        version: number;
        last_edited_by: string | null;
        last_edited_at: Date;
      }>(
        `SELECT cd.content, cd.version, cd.last_edited_by, cd.last_edited_at, u.username as last_edited_by_username
         FROM channel_documents cd
         LEFT JOIN users u ON u.id = cd.last_edited_by
         WHERE cd.channel_id = $1`,
        [channelId]
      );

      if (result.rows.length === 0) {
        // No document exists yet, return empty content
        res.status(200).json({
          content: '',
          version: 0,
          last_edited_by: null,
          last_edited_at: null,
        });
        return;
      }

      res.status(200).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /channels/:channel_id/document
   * Update document content for a document channel
   */
  router.put('/channels/:channel_id/document', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const channelId = requireSnowflake('channel_id', req.params.channel_id);
      const { content, version: _version } = req.body;

      if (!pool) {
        throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 500, 'Document storage not available');
      }

      if (content === undefined) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Content is required');
      }

      // Check if channel exists and is a document channel
      const channel = await channelService.getChannel(channelId) as { type: number } | null;
      if (!channel) {
        throw new ApiError(ApiErrorCode.NOT_FOUND, 404, 'Channel not found');
      }
      if (channel.type !== ChannelType.DOCUMENT) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Channel is not a document channel');
      }

      // Upsert document content
      const result = await pool.query<{ version: number }>(
        `INSERT INTO channel_documents (channel_id, content, version, last_edited_by, last_edited_at)
         VALUES ($1, $2, 1, $3, NOW())
         ON CONFLICT (channel_id) DO UPDATE SET
           content = $2,
           version = channel_documents.version + 1,
           last_edited_by = $3,
           last_edited_at = NOW()
         RETURNING version`,
        [channelId, content, userId]
      );

      res.status(200).json({
        success: true,
        version: result.rows[0]?.version || 1,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
