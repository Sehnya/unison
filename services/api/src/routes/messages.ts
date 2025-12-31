/**
 * Message Routes
 *
 * REST API routes for message operations.
 * Requirements: 9.1-9.5, 10.1-10.5, 11.1-11.3
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import type { PaginationOptions } from '@discord-clone/types';
import { createAuthMiddleware, type AuthenticatedRequest, type TokenValidator, requireSnowflake, parseSnowflake } from '../middleware.js';
import { ApiError, ApiErrorCode } from '../errors.js';
import { getRedisCache, type MessageCache } from '@discord-clone/cache';

/**
 * Messaging service interface
 */
export interface MessagingServiceInterface {
  createMessage(channelId: string, authorId: string, content: string): Promise<unknown>;
  getMessages(channelId: string, userId: string, options?: PaginationOptions): Promise<unknown[]>;
  updateMessage(messageId: string, userId: string, content: string): Promise<unknown>;
  deleteMessage(messageId: string, userId: string): Promise<void>;
}

/**
 * Message routes configuration
 */
export interface MessageRoutesConfig {
  messagingService: MessagingServiceInterface;
  authService: { getUserById: (userId: string) => Promise<unknown> };
  validateToken: TokenValidator;
}

/**
 * Create message routes
 */
export function createMessageRoutes(config: MessageRoutesConfig): Router {
  const router = Router();
  const { messagingService, authService, validateToken } = config;
  const authMiddleware = createAuthMiddleware(validateToken);

  // All message routes require authentication
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
  // Message CRUD
  // Requirements: 9.1-9.5, 10.1-10.5, 11.1-11.3
  // ============================================

  /**
   * POST /channels/:channel_id/messages
   * Create a new message
   * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
   */
  router.post('/channels/:channel_id/messages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const channelId = requireSnowflake('channel_id', req.params.channel_id);
      const { content } = req.body;

      if (content === undefined || content === null) {
        throw new ApiError(ApiErrorCode.EMPTY_MESSAGE, 400, 'Content is required', 'content');
      }

      if (typeof content !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Content must be a string', 'content');
      }

      const message = await messagingService.createMessage(channelId, userId, content);

      // Enrich the created message with author information
      let enrichedMessage = message as Record<string, unknown>;
      const authorId = (message as any).author_id || (message as any).authorId || userId;
      if (authorId) {
        try {
          const author = await authService.getUserById(authorId) as { id: string; username: string; avatar?: string | null; username_font?: string | null } | null;
          if (author) {
            enrichedMessage = {
              ...(message as Record<string, unknown>),
              author_id: authorId,
              author_name: author.username,
              author_avatar: author.avatar || null,
              author_font: author.username_font || null,
            };
          }
        } catch (error) {
          console.warn(`Failed to fetch author info for user ${authorId}:`, error);
        }
      }

      // Add to Redis cache
      const cache = getRedisCache();
      if (cache) {
        const cacheMsg: MessageCache = {
          id: (enrichedMessage.id as string) || '',
          channel_id: channelId,
          author_id: authorId,
          author_name: (enrichedMessage.author_name as string) || 'Unknown',
          author_avatar: (enrichedMessage.author_avatar as string | null) || null,
          author_font: (enrichedMessage.author_font as string | null) || null,
          content: content,
          created_at: (enrichedMessage.created_at as string) || new Date().toISOString(),
          edited_at: null,
        };
        await cache.addMessageToCache(channelId, cacheMsg);
      }

      res.status(201).json({ message: enrichedMessage });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /channels/:channel_id/messages
   * Get messages for a channel with pagination
   * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
   */
  router.get('/channels/:channel_id/messages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const channelId = requireSnowflake('channel_id', req.params.channel_id);

      // Parse pagination options from query
      const options: PaginationOptions = {};
      let useCache = true; // Only use cache for default queries (no pagination)

      if (req.query.before) {
        const before = parseSnowflake(req.query.before as string);
        if (!before) {
          throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Invalid before cursor');
        }
        options.before = before;
        useCache = false;
      }

      if (req.query.after) {
        const after = parseSnowflake(req.query.after as string);
        if (!after) {
          throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Invalid after cursor');
        }
        options.after = after;
        useCache = false;
      }

      if (req.query.limit) {
        const limit = parseInt(req.query.limit as string, 10);
        if (isNaN(limit) || limit < 1 || limit > 100) {
          throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Limit must be between 1 and 100');
        }
        options.limit = limit;
      }

      // Try to get from Redis cache first (only for default queries)
      const cache = getRedisCache();
      if (cache && useCache) {
        const cachedMessages = await cache.getChannelMessages(channelId);
        if (cachedMessages && cachedMessages.length > 0) {
          console.log(`✓ Cache hit for channel ${channelId} (${cachedMessages.length} messages)`);
          res.status(200).json({ messages: cachedMessages, cached: true });
          return;
        }
      }

      // Cache miss or pagination - fetch from database
      const messages = await messagingService.getMessages(channelId, userId, options);

      // Enrich messages with author information (username, avatar, font)
      const enrichedMessages = await Promise.all(
        (messages as any[]).map(async (msg: any) => {
          const authorId = msg.author_id || msg.authorId;
          if (authorId) {
            // Try to get user from cache first
            let author: { username: string; avatar?: string | null; username_font?: string | null } | null = null;
            if (cache) {
              author = await cache.getUser(authorId);
            }
            
            if (!author) {
              try {
                author = await authService.getUserById(authorId) as { id: string; username: string; avatar?: string | null; username_font?: string | null } | null;
                // Cache the user for future requests
                if (author && cache) {
                  await cache.cacheUser(authorId, {
                    username: author.username,
                    avatar: author.avatar ?? null,
                    username_font: author.username_font ?? null,
                  });
                }
              } catch (error) {
                console.warn(`Failed to fetch author info for user ${authorId}:`, error);
              }
            }
            
            if (author) {
              return {
                ...msg,
                author_id: authorId,
                author_name: author.username,
                author_avatar: author.avatar || null,
                author_font: author.username_font || null,
              };
            }
          }
          // Fallback if author not found
          return {
            ...msg,
            author_id: authorId,
            author_name: 'Unknown',
            author_avatar: null,
            author_font: null,
          };
        })
      );

      // Cache the enriched messages (only for default queries without pagination)
      if (cache && useCache && enrichedMessages.length > 0) {
        const cacheMessages: MessageCache[] = enrichedMessages.map((msg: any) => ({
          id: msg.id,
          channel_id: channelId,
          author_id: msg.author_id,
          author_name: msg.author_name,
          author_avatar: msg.author_avatar,
          author_font: msg.author_font,
          content: msg.content,
          created_at: msg.created_at?.toISOString?.() || msg.created_at || new Date().toISOString(),
          edited_at: msg.edited_at?.toISOString?.() || msg.edited_at || null,
        }));
        await cache.cacheChannelMessages(channelId, cacheMessages);
        console.log(`✓ Cached ${cacheMessages.length} messages for channel ${channelId}`);
      }

      res.status(200).json({ messages: enrichedMessages });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PATCH /channels/:channel_id/messages/:message_id
   * Update a message
   * Requirements: 11.1
   */
  router.patch('/channels/:channel_id/messages/:message_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const channelId = requireSnowflake('channel_id', req.params.channel_id);
      const messageId = requireSnowflake('message_id', req.params.message_id);
      const { content } = req.body;

      if (content === undefined || content === null) {
        throw new ApiError(ApiErrorCode.EMPTY_MESSAGE, 400, 'Content is required', 'content');
      }

      if (typeof content !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Content must be a string', 'content');
      }

      const message = await messagingService.updateMessage(messageId, userId, content);

      // Update in Redis cache
      const cache = getRedisCache();
      if (cache) {
        await cache.updateMessageInCache(channelId, messageId, {
          content,
          edited_at: new Date().toISOString(),
        });
      }

      res.status(200).json({ message });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /channels/:channel_id/messages/:message_id
   * Delete a message
   * Requirements: 11.2, 11.3
   */
  router.delete('/channels/:channel_id/messages/:message_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const channelId = requireSnowflake('channel_id', req.params.channel_id);
      const messageId = requireSnowflake('message_id', req.params.message_id);

      await messagingService.deleteMessage(messageId, userId);

      // Remove from Redis cache
      const cache = getRedisCache();
      if (cache) {
        await cache.removeMessageFromCache(channelId, messageId);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
