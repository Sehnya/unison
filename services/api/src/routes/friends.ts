/**
 * Friends Routes
 *
 * REST API routes for friends and direct messaging
 */

import { Router, type Response, type NextFunction } from 'express';
import { createAuthMiddleware, type AuthenticatedRequest, type TokenValidator } from '../middleware.js';
import { ApiError, ApiErrorCode } from '../errors.js';

/**
 * Friends service interface
 */
export interface FriendsServiceInterface {
  // DM Privacy
  getDMPrivacy(userId: string): Promise<string>;
  setDMPrivacy(userId: string, privacy: string): Promise<void>;
  
  // Friend Requests
  sendFriendRequest(userId: string, friendId: string): Promise<unknown>;
  getIncomingFriendRequests(userId: string): Promise<unknown[]>;
  getOutgoingFriendRequests(userId: string): Promise<unknown[]>;
  acceptFriendRequest(requestId: string, userId: string): Promise<void>;
  declineFriendRequest(requestId: string, userId: string): Promise<void>;
  
  // Friends
  getFriends(userId: string): Promise<unknown[]>;
  removeFriend(userId: string, friendId: string): Promise<void>;
  getMutualFriends(userId: string, otherUserId: string): Promise<{
    mutualFriends: { id: string; username: string; avatar: string | null }[];
    totalCount: number;
  }>;
  
  // Blocking
  blockUser(userId: string, blockedUserId: string): Promise<void>;
  unblockUser(userId: string, blockedUserId: string): Promise<void>;
  getBlockedUsers(userId: string): Promise<unknown[]>;
  
  // DM Conversations
  canSendDM(senderId: string, recipientId: string): Promise<{ allowed: boolean; reason?: string }>;
  startDMConversation(userId: string, otherUserId: string): Promise<unknown>;
  getDMConversations(userId: string): Promise<unknown[]>;
  getDMConversation(conversationId: string, userId: string): Promise<unknown>;
  sendDM(conversationId: string, authorId: string, content: string): Promise<unknown>;
  getDMMessages(conversationId: string, userId: string, limit?: number, before?: string): Promise<unknown[]>;
  markConversationRead(conversationId: string, userId: string): Promise<void>;
  
  // Search
  searchUsers(query: string, currentUserId: string): Promise<unknown[]>;
}

/**
 * Friends routes configuration
 */
export interface FriendsRoutesConfig {
  friendsService: FriendsServiceInterface;
  validateToken: TokenValidator;
}

/**
 * Create friends routes
 */
export function createFriendsRoutes(config: FriendsRoutesConfig): Router {
  const router = Router();
  const { friendsService, validateToken } = config;
  const authMiddleware = createAuthMiddleware(validateToken);

  // ============================================
  // DM Privacy Settings
  // ============================================

  /**
   * GET /friends/privacy
   * Get current user's DM privacy setting
   */
  router.get('/privacy', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const privacy = await friendsService.getDMPrivacy(userId);
      res.json({ privacy });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /friends/privacy
   * Update DM privacy setting
   */
  router.put('/privacy', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const { privacy } = req.body;

      if (!privacy || !['open', 'friends', 'closed'].includes(privacy)) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Invalid privacy setting. Must be: open, friends, or closed');
      }

      await friendsService.setDMPrivacy(userId, privacy);
      res.json({ success: true, privacy });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // Friend Requests
  // ============================================

  /**
   * POST /friends/requests
   * Send a friend request
   */
  router.post('/requests', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const { friend_id } = req.body;

      if (!friend_id) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'friend_id is required');
      }

      const request = await friendsService.sendFriendRequest(userId, friend_id);
      res.status(201).json(request);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'CANNOT_FRIEND_SELF') {
        next(new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Cannot send friend request to yourself'));
        return;
      }
      if ((error as { code?: string }).code === 'USER_NOT_FOUND') {
        next(new ApiError(ApiErrorCode.NOT_FOUND, 404, 'User not found'));
        return;
      }
      if ((error as { code?: string }).code === 'ALREADY_FRIENDS') {
        next(new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Already friends with this user'));
        return;
      }
      if ((error as { code?: string }).code === 'FRIEND_REQUEST_EXISTS') {
        next(new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Friend request already exists'));
        return;
      }
      if ((error as { code?: string }).code === 'USER_BLOCKED') {
        next(new ApiError(ApiErrorCode.FORBIDDEN, 403, 'Cannot send friend request to this user'));
        return;
      }
      next(error);
    }
  });

  /**
   * GET /friends/requests/incoming
   * Get incoming friend requests
   */
  router.get('/requests/incoming', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const requests = await friendsService.getIncomingFriendRequests(userId);
      res.json(requests);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /friends/requests/outgoing
   * Get outgoing friend requests
   */
  router.get('/requests/outgoing', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const requests = await friendsService.getOutgoingFriendRequests(userId);
      res.json(requests);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /friends/requests/:requestId/accept
   * Accept a friend request
   */
  router.post('/requests/:requestId/accept', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const { requestId } = req.params;

      await friendsService.acceptFriendRequest(requestId!, userId);
      res.json({ success: true });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'FRIEND_REQUEST_NOT_FOUND') {
        next(new ApiError(ApiErrorCode.NOT_FOUND, 404, 'Friend request not found'));
        return;
      }
      next(error);
    }
  });

  /**
   * POST /friends/requests/:requestId/decline
   * Decline a friend request
   */
  router.post('/requests/:requestId/decline', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const { requestId } = req.params;

      await friendsService.declineFriendRequest(requestId!, userId);
      res.json({ success: true });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'FRIEND_REQUEST_NOT_FOUND') {
        next(new ApiError(ApiErrorCode.NOT_FOUND, 404, 'Friend request not found'));
        return;
      }
      next(error);
    }
  });

  // ============================================
  // Friends List
  // ============================================

  /**
   * GET /friends
   * Get all friends
   */
  router.get('/', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const friends = await friendsService.getFriends(userId);
      res.json(friends);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /friends/mutual/:userId
   * Get mutual friends between the authenticated user and the target user
   * Requirements: 4.1, 4.2
   */
  router.get('/mutual/:userId', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const currentUserId = (req as AuthenticatedRequest).user.id;
      const { userId } = req.params;

      if (!userId) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'User ID is required');
      }

      const result = await friendsService.getMutualFriends(currentUserId, userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /friends/:friendId
   * Remove a friend
   */
  router.delete('/:friendId', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const { friendId } = req.params;

      await friendsService.removeFriend(userId, friendId!);
      res.json({ success: true });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'NOT_FRIENDS') {
        next(new ApiError(ApiErrorCode.NOT_FOUND, 404, 'Not friends with this user'));
        return;
      }
      next(error);
    }
  });

  // ============================================
  // Blocking
  // ============================================

  /**
   * POST /friends/block/:userId
   * Block a user
   */
  router.post('/block/:userId', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const currentUserId = (req as AuthenticatedRequest).user.id;
      const { userId } = req.params;

      await friendsService.blockUser(currentUserId, userId!);
      res.json({ success: true });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'USER_NOT_FOUND') {
        next(new ApiError(ApiErrorCode.NOT_FOUND, 404, 'User not found'));
        return;
      }
      next(error);
    }
  });

  /**
   * DELETE /friends/block/:userId
   * Unblock a user
   */
  router.delete('/block/:userId', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const currentUserId = (req as AuthenticatedRequest).user.id;
      const { userId } = req.params;

      await friendsService.unblockUser(currentUserId, userId!);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /friends/blocked
   * Get blocked users
   */
  router.get('/blocked', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const blocked = await friendsService.getBlockedUsers(userId);
      res.json(blocked);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // Direct Messages
  // ============================================

  /**
   * GET /friends/dm
   * Get all DM conversations
   */
  router.get('/dm', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const conversations = await friendsService.getDMConversations(userId);
      res.json(conversations);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /friends/dm
   * Start a new DM conversation
   */
  router.post('/dm', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const { user_id } = req.body;

      if (!user_id) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'user_id is required');
      }

      const conversation = await friendsService.startDMConversation(userId, user_id);
      res.status(201).json(conversation);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'DM_PRIVACY_BLOCKED') {
        next(new ApiError(ApiErrorCode.FORBIDDEN, 403, (error as Error).message));
        return;
      }
      next(error);
    }
  });

  /**
   * GET /friends/dm/:conversationId
   * Get a specific DM conversation
   */
  router.get('/dm/:conversationId', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const { conversationId } = req.params;

      const conversation = await friendsService.getDMConversation(conversationId!, userId);
      res.json(conversation);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'NOT_PARTICIPANT') {
        next(new ApiError(ApiErrorCode.FORBIDDEN, 403, 'Not a participant in this conversation'));
        return;
      }
      if ((error as { code?: string }).code === 'CONVERSATION_NOT_FOUND') {
        next(new ApiError(ApiErrorCode.NOT_FOUND, 404, 'Conversation not found'));
        return;
      }
      next(error);
    }
  });

  /**
   * GET /friends/dm/:conversationId/messages
   * Get messages in a conversation
   */
  router.get('/dm/:conversationId/messages', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const { conversationId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const before = req.query.before as string | undefined;

      const messages = await friendsService.getDMMessages(conversationId!, userId, limit, before);
      res.json(messages);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'NOT_PARTICIPANT') {
        next(new ApiError(ApiErrorCode.FORBIDDEN, 403, 'Not a participant in this conversation'));
        return;
      }
      next(error);
    }
  });

  /**
   * POST /friends/dm/:conversationId/messages
   * Send a message in a conversation
   */
  router.post('/dm/:conversationId/messages', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const { conversationId } = req.params;
      const { content } = req.body;

      if (!content || !content.trim()) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Message content is required');
      }

      const message = await friendsService.sendDM(conversationId!, userId, content);
      res.status(201).json(message);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'NOT_PARTICIPANT') {
        next(new ApiError(ApiErrorCode.FORBIDDEN, 403, 'Not a participant in this conversation'));
        return;
      }
      if ((error as { code?: string }).code === 'DM_PRIVACY_BLOCKED') {
        next(new ApiError(ApiErrorCode.FORBIDDEN, 403, (error as Error).message));
        return;
      }
      next(error);
    }
  });

  /**
   * POST /friends/dm/:conversationId/read
   * Mark conversation as read
   */
  router.post('/dm/:conversationId/read', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const { conversationId } = req.params;

      await friendsService.markConversationRead(conversationId!, userId);
      res.json({ success: true });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'NOT_PARTICIPANT') {
        next(new ApiError(ApiErrorCode.FORBIDDEN, 403, 'Not a participant in this conversation'));
        return;
      }
      next(error);
    }
  });

  /**
   * GET /friends/dm/check/:userId
   * Check if can send DM to a user
   */
  router.get('/dm/check/:userId', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const currentUserId = (req as AuthenticatedRequest).user.id;
      const { userId } = req.params;

      const result = await friendsService.canSendDM(currentUserId, userId!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // User Search
  // ============================================

  /**
   * GET /friends/search
   * Search users by username
   */
  router.get('/search', authMiddleware, async (req, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const query = req.query.q as string;

      if (!query || query.length < 2) {
        res.json([]);
        return;
      }

      const users = await friendsService.searchUsers(query, userId);
      res.json(users);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
