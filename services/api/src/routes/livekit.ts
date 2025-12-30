/**
 * LiveKit Routes
 *
 * REST API routes for LiveKit WebRTC token generation
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { createAuthMiddleware, type AuthenticatedRequest, type TokenValidator } from '../middleware.js';
import { ApiError, ApiErrorCode } from '../errors.js';
import type { LiveKitService } from '../services/livekit.js';

/**
 * LiveKit routes configuration
 */
export interface LiveKitRoutesConfig {
  livekitService: LiveKitService;
  validateToken: TokenValidator;
}

/**
 * Create LiveKit routes
 */
export function createLiveKitRoutes(config: LiveKitRoutesConfig): Router {
  const router = Router();
  const { livekitService, validateToken } = config;
  const authMiddleware = createAuthMiddleware(validateToken);

  // All LiveKit routes require authentication
  router.use(authMiddleware);

  /**
   * POST /api/livekit/token
   * Generate a LiveKit access token for joining a voice room
   */
  router.post('/token', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId, username } = (req as AuthenticatedRequest).user;
      const { roomName, participantName } = req.body;

      if (!roomName || typeof roomName !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Room name is required', 'roomName');
      }

      // Use provided participant name or fallback to username
      const name = participantName || username || `User ${userId}`;

      // Generate token
      const token = livekitService.generateToken({
        roomName,
        participantName: name,
        participantIdentity: userId,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      // Return token and WebSocket URL
      res.status(200).json({
        token,
        wsUrl: livekitService.getWsUrl(),
        roomName,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

