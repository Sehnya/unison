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
  validateToken: TokenValidator;
}

/**
 * Create message routes
 */
export function createMessageRoutes(config: MessageRoutesConfig): Router {
  const router = Router();
  const { messagingService, validateToken } = config;
  const authMiddleware = createAuthMiddleware(validateToken);

  // All message routes require authentication
  // Apply middleware only to routes that match (not to /auth paths)
  router.use((req, res, next) => {
    // Skip auth middleware for /auth paths - let them pass through to auth router
    if (req.path.startsWith('/auth')) {
      return next(); // Pass through without auth
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

      res.status(201).json({ message });
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

      if (req.query.before) {
        const before = parseSnowflake(req.query.before as string);
        if (!before) {
          throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Invalid before cursor');
        }
        options.before = before;
      }

      if (req.query.after) {
        const after = parseSnowflake(req.query.after as string);
        if (!after) {
          throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Invalid after cursor');
        }
        options.after = after;
      }

      if (req.query.limit) {
        const limit = parseInt(req.query.limit as string, 10);
        if (isNaN(limit) || limit < 1 || limit > 100) {
          throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Limit must be between 1 and 100');
        }
        options.limit = limit;
      }

      const messages = await messagingService.getMessages(channelId, userId, options);

      res.status(200).json({ messages });
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
      const messageId = requireSnowflake('message_id', req.params.message_id);
      const { content } = req.body;

      if (content === undefined || content === null) {
        throw new ApiError(ApiErrorCode.EMPTY_MESSAGE, 400, 'Content is required', 'content');
      }

      if (typeof content !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Content must be a string', 'content');
      }

      const message = await messagingService.updateMessage(messageId, userId, content);

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
      const messageId = requireSnowflake('message_id', req.params.message_id);

      await messagingService.deleteMessage(messageId, userId);

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
