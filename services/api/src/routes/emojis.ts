/**
 * Emoji Routes
 *
 * REST API routes for guild emoji operations.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { createAuthMiddleware, type AuthenticatedRequest, type TokenValidator, requireSnowflake } from '../middleware.js';
import { ApiError, ApiErrorCode } from '../errors.js';

/**
 * Guild Emoji type
 */
export interface GuildEmoji {
  id: string;
  guild_id: string;
  name: string;
  image_url: string;
  uploaded_by: string | null;
  animated: boolean;
  created_at: Date;
}

/**
 * Emoji service interface
 */
export interface EmojiServiceInterface {
  getGuildEmojis(guildId: string): Promise<GuildEmoji[]>;
  createEmoji(guildId: string, uploaderId: string, name: string, imageUrl: string, animated?: boolean): Promise<GuildEmoji>;
  updateEmoji(emojiId: string, updates: { name?: string }): Promise<GuildEmoji | null>;
  deleteEmoji(emojiId: string): Promise<boolean>;
  getEmojiById(emojiId: string): Promise<GuildEmoji | null>;
}

/**
 * Emoji routes configuration
 */
export interface EmojiRoutesConfig {
  emojiService: EmojiServiceInterface;
  validateToken: TokenValidator;
}

/**
 * Create emoji routes
 */
export function createEmojiRoutes(config: EmojiRoutesConfig): Router {
  const router = Router({ mergeParams: true });
  const { emojiService, validateToken } = config;
  const authMiddleware = createAuthMiddleware(validateToken);

  // All emoji routes require authentication
  router.use(authMiddleware);

  /**
   * GET /guilds/:guild_id/emojis
   * Get all emojis for a guild
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = requireSnowflake('guild_id', req.params.guild_id);
      const emojis = await emojiService.getGuildEmojis(guildId);
      res.status(200).json({ emojis });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /guilds/:guild_id/emojis
   * Create a new emoji
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const guildId = requireSnowflake('guild_id', req.params.guild_id);
      const { name, image_url, animated } = req.body;

      if (!name || typeof name !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Emoji name is required', 'name');
      }

      if (name.length < 2 || name.length > 32) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Emoji name must be 2-32 characters', 'name');
      }

      if (!image_url || typeof image_url !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Image URL is required', 'image_url');
      }

      // Validate URL format
      try {
        new URL(image_url);
      } catch {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Invalid image URL', 'image_url');
      }

      const emoji = await emojiService.createEmoji(
        guildId,
        userId,
        name,
        image_url,
        animated === true
      );

      res.status(201).json({ emoji });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PATCH /guilds/:guild_id/emojis/:emoji_id
   * Update an emoji
   */
  router.patch('/:emoji_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const emojiId = requireSnowflake('emoji_id', req.params.emoji_id);
      const { name } = req.body;

      if (name !== undefined) {
        if (typeof name !== 'string' || name.length < 2 || name.length > 32) {
          throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Emoji name must be 2-32 characters', 'name');
        }
      }

      const emoji = await emojiService.updateEmoji(emojiId, { name });

      if (!emoji) {
        throw new ApiError(ApiErrorCode.NOT_FOUND, 404, 'Emoji not found');
      }

      res.status(200).json({ emoji });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /guilds/:guild_id/emojis/:emoji_id
   * Delete an emoji
   */
  router.delete('/:emoji_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const emojiId = requireSnowflake('emoji_id', req.params.emoji_id);

      const deleted = await emojiService.deleteEmoji(emojiId);

      if (!deleted) {
        throw new ApiError(ApiErrorCode.NOT_FOUND, 404, 'Emoji not found');
      }

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
