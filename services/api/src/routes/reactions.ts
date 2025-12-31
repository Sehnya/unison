/**
 * Reaction Routes
 *
 * REST API routes for message reactions.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { createAuthMiddleware, type AuthenticatedRequest, type TokenValidator, requireSnowflake } from '../middleware.js';
import { ApiError, ApiErrorCode } from '../errors.js';
import type { Pool } from 'pg';

/**
 * Reaction type
 */
export interface MessageReaction {
  emoji: string;
  emoji_url?: string;
  count: number;
  users: string[];
  me: boolean;
}

/**
 * Reaction routes configuration
 */
export interface ReactionRoutesConfig {
  pool: Pool;
  validateToken: TokenValidator;
}

/**
 * Create reaction routes
 */
export function createReactionRoutes(config: ReactionRoutesConfig): Router {
  const router = Router({ mergeParams: true });
  const { pool, validateToken } = config;
  const authMiddleware = createAuthMiddleware(validateToken);

  router.use(authMiddleware);

  /**
   * GET /channels/:channel_id/messages/:message_id/reactions
   * Get all reactions for a message
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const messageId = requireSnowflake('message_id', req.params.message_id);

      const result = await pool.query(
        `SELECT emoji, emoji_url, 
                array_agg(user_id::text) as users,
                COUNT(*) as count
         FROM message_reactions
         WHERE message_id = $1
         GROUP BY emoji, emoji_url`,
        [messageId]
      );

      const reactions: MessageReaction[] = result.rows.map(row => ({
        emoji: row.emoji,
        emoji_url: row.emoji_url || undefined,
        count: parseInt(row.count, 10),
        users: row.users,
        me: row.users.includes(userId),
      }));

      res.status(200).json({ reactions });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /channels/:channel_id/messages/:message_id/reactions/:emoji
   * Add a reaction to a message
   */
  router.put('/:emoji', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const messageId = requireSnowflake('message_id', req.params.message_id);
      const emoji = decodeURIComponent(req.params.emoji);
      const { emoji_url } = req.body;

      // Insert reaction (ignore if already exists)
      await pool.query(
        `INSERT INTO message_reactions (message_id, user_id, emoji, emoji_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
        [messageId, userId, emoji, emoji_url || null]
      );

      // Get updated reaction count
      const countResult = await pool.query(
        `SELECT COUNT(*) as count, array_agg(user_id::text) as users
         FROM message_reactions
         WHERE message_id = $1 AND emoji = $2`,
        [messageId, emoji]
      );

      const row = countResult.rows[0];
      const reaction: MessageReaction = {
        emoji,
        emoji_url: emoji_url || undefined,
        count: parseInt(row?.count || '0', 10),
        users: row?.users || [],
        me: true,
      };

      res.status(200).json({ reaction });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /channels/:channel_id/messages/:message_id/reactions/:emoji
   * Remove own reaction from a message
   */
  router.delete('/:emoji', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const messageId = requireSnowflake('message_id', req.params.message_id);
      const emoji = decodeURIComponent(req.params.emoji);

      await pool.query(
        `DELETE FROM message_reactions
         WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
        [messageId, userId, emoji]
      );

      // Get updated reaction count
      const countResult = await pool.query(
        `SELECT COUNT(*) as count, array_agg(user_id::text) as users
         FROM message_reactions
         WHERE message_id = $1 AND emoji = $2`,
        [messageId, emoji]
      );

      const row = countResult.rows[0];
      const count = parseInt(row?.count || '0', 10);

      res.status(200).json({ 
        reaction: count > 0 ? {
          emoji,
          count,
          users: row?.users || [],
          me: false,
        } : null
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
