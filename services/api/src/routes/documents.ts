/**
 * Document Routes
 *
 * REST API routes for collaborative document editing in document channels.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { createAuthMiddleware, type AuthenticatedRequest, type TokenValidator, requireSnowflake } from '../middleware.js';
import { ApiError, ApiErrorCode } from '../errors.js';
import type { Pool } from 'pg';

/**
 * Document data structure
 */
export interface ChannelDocument {
  channel_id: string;
  content: string;
  version: number;
  last_edited_by: string | null;
  last_edited_at: Date;
  created_at: Date;
}

/**
 * Document routes configuration
 */
export interface DocumentRoutesConfig {
  pool: Pool;
  validateToken: TokenValidator;
}

/**
 * Create document routes
 */
export function createDocumentRoutes(config: DocumentRoutesConfig): Router {
  const router = Router({ mergeParams: true });
  const { pool, validateToken } = config;
  const authMiddleware = createAuthMiddleware(validateToken);

  router.use(authMiddleware);

  /**
   * GET /channels/:channel_id/document
   * Get the document content for a document channel
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channelId = requireSnowflake('channel_id', req.params.channel_id);

      // Verify channel exists and is a document channel
      const channelResult = await pool.query(
        'SELECT id, type FROM channels WHERE id = $1 AND deleted_at IS NULL',
        [channelId]
      );

      if (channelResult.rows.length === 0) {
        throw new ApiError(ApiErrorCode.NOT_FOUND, 404, 'Channel not found');
      }

      if (channelResult.rows[0].type !== 3) { // DOCUMENT type
        throw new ApiError(ApiErrorCode.INVALID_CHANNEL_TYPE, 400, 'Channel is not a document channel');
      }

      // Get or create document
      let result = await pool.query<ChannelDocument>(
        'SELECT channel_id, content, version, last_edited_by, last_edited_at, created_at FROM channel_documents WHERE channel_id = $1',
        [channelId]
      );

      if (result.rows.length === 0) {
        // Create empty document
        result = await pool.query<ChannelDocument>(
          `INSERT INTO channel_documents (channel_id, content, version)
           VALUES ($1, $2, 1)
           RETURNING channel_id, content, version, last_edited_by, last_edited_at, created_at`,
          [channelId, '']
        );
      }

      const doc = result.rows[0];
      if (!doc) {
        throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 500, 'Failed to retrieve document');
      }
      res.status(200).json({
        document: {
          channelId: doc.channel_id,
          content: doc.content,
          version: doc.version,
          lastEditedBy: doc.last_edited_by,
          lastEditedAt: doc.last_edited_at,
          createdAt: doc.created_at,
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /channels/:channel_id/document
   * Update the document content
   */
  router.put('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const channelId = requireSnowflake('channel_id', req.params.channel_id);
      const { content, version } = req.body;

      if (typeof content !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Content is required', 'content');
      }

      // Verify channel exists and is a document channel
      const channelResult = await pool.query(
        'SELECT id, type FROM channels WHERE id = $1 AND deleted_at IS NULL',
        [channelId]
      );

      if (channelResult.rows.length === 0) {
        throw new ApiError(ApiErrorCode.NOT_FOUND, 404, 'Channel not found');
      }

      if (channelResult.rows[0].type !== 3) {
        throw new ApiError(ApiErrorCode.INVALID_CHANNEL_TYPE, 400, 'Channel is not a document channel');
      }

      // Optimistic concurrency: only update if version matches
      const result = await pool.query<ChannelDocument>(
        `INSERT INTO channel_documents (channel_id, content, version, last_edited_by, last_edited_at)
         VALUES ($1, $2, 1, $3, NOW())
         ON CONFLICT (channel_id) DO UPDATE
         SET content = $2,
             version = channel_documents.version + 1,
             last_edited_by = $3,
             last_edited_at = NOW()
         WHERE ($4::integer IS NULL OR channel_documents.version = $4)
         RETURNING channel_id, content, version, last_edited_by, last_edited_at, created_at`,
        [channelId, content, userId, version || null]
      );

      if (result.rows.length === 0) {
        throw new ApiError(ApiErrorCode.CONFLICT, 409, 'Document was modified by another user. Please refresh and try again.');
      }

      const updatedDoc = result.rows[0];
      if (!updatedDoc) {
        throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 500, 'Failed to update document');
      }
      res.status(200).json({
        document: {
          channelId: updatedDoc.channel_id,
          content: updatedDoc.content,
          version: updatedDoc.version,
          lastEditedBy: updatedDoc.last_edited_by,
          lastEditedAt: updatedDoc.last_edited_at,
          createdAt: updatedDoc.created_at,
        }
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
