/**
 * Auth Routes
 *
 * REST API routes for authentication operations.
 * Requirements: 1.1-1.7, 2.1-2.4
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import type { DeviceInfo } from '@discord-clone/types';
import { createAuthMiddleware, type AuthenticatedRequest, type TokenValidator } from '../middleware.js';
import { ApiError, ApiErrorCode } from '../errors.js';

/**
 * Auth service interface
 */
export interface AuthServiceInterface {
  register(email: string, password: string, username: string, deviceInfo?: DeviceInfo): Promise<{ user: unknown; tokens: unknown; session: unknown }>;
  login(email: string, password: string, deviceInfo?: DeviceInfo): Promise<{ user: unknown; tokens: unknown; sessionId: string }>;
  refreshTokens(refreshToken: string): Promise<unknown>;
  logout(sessionId: string): Promise<void>;
  getSessions(userId: string): Promise<unknown[]>;
  revokeSession(userId: string, sessionId: string): Promise<void>;
  getUserById(userId: string): Promise<unknown>;
  acceptTerms(userId: string): Promise<void>;
  updateProfile(userId: string, updates: { username?: string; avatar?: string; bio?: string }): Promise<unknown>;
  getProfileData(userId: string): Promise<unknown>;
  saveProfileData(userId: string, profileData: unknown, backgroundImage?: string | null): Promise<void>;
  getMiniProfileData(userId: string): Promise<{
    userId: string;
    username: string;
    avatar: string | null;
    bio: string | null;
    backgroundImage: string | null;
    usernameFont: string | null;
    textColor: string | null;
  } | null>;
  updateMiniProfileSettings(userId: string, settings: { mini_profile_background?: string | null; mini_profile_font?: string; mini_profile_text_color?: string }): Promise<unknown>;
}

/**
 * Auth routes configuration
 */
export interface AuthRoutesConfig {
  authService: AuthServiceInterface;
  guildService: { getGuildByName: (name: string) => Promise<unknown>; getRepository: () => { addMember: (guildId: string, userId: string, isOwner?: boolean) => Promise<unknown> } } | null;
  validateToken: TokenValidator;
}

/**
 * Create auth routes
 */
export function createAuthRoutes(config: AuthRoutesConfig): Router {
  const router = Router();
  const { authService, guildService, validateToken } = config;
  const authMiddleware = createAuthMiddleware(validateToken);

  /**
   * POST /auth/register
   * Register a new user
   * Requirements: 1.1, 1.2
   */
  router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, username } = req.body;

      // Validate required fields with explicit type checking
      if (!email || typeof email !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Email is required and must be a string', 'email');
      }
      if (password === undefined || password === null || typeof password !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Password is required and must be a string', 'password');
      }
      if (!username || typeof username !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Username is required and must be a string', 'username');
      }
      
      // Ensure password is definitely a string (defensive)
      const passwordString = String(password);

      // Extract device info from request
      const deviceInfo: DeviceInfo = {};
      if (req.headers['user-agent']) {
        deviceInfo.user_agent = req.headers['user-agent'];
      }
      if (req.ip) {
        deviceInfo.ip_address = req.ip;
      }

      const result = await authService.register(email, passwordString, username, deviceInfo);

      // Auto-add user to BETA guild if it exists
      if (guildService) {
        try {
          const betaGuild = await guildService.getGuildByName('BETA') as { id: string } | null;
          if (betaGuild) {
            const userId = (result.user as { id: string }).id;
            // Use the repository's addMember method
            const repository = guildService.getRepository();
            await repository.addMember(betaGuild.id, userId, false);
            console.log(`✓ Added user ${userId} to BETA guild`);
          } else {
            console.warn('BETA guild not found - new users will not be auto-added');
          }
        } catch (error) {
          // Log error but don't fail registration if BETA guild doesn't exist or add fails
          console.warn('Failed to add user to BETA guild:', error);
        }
      }

      res.status(201).json({
        user: result.user,
        tokens: result.tokens,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /auth/login
   * Login with email and password
   * Requirements: 1.3, 1.4, 2.1
   */
  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, device_info } = req.body;

      // Validate required fields
      if (!email || typeof email !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Email is required', 'email');
      }
      if (!password || typeof password !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Password is required', 'password');
      }

      // Build device info
      const deviceInfo: DeviceInfo = {};
      if (req.headers['user-agent']) {
        deviceInfo.user_agent = req.headers['user-agent'];
      }
      if (req.ip) {
        deviceInfo.ip_address = req.ip;
      }
      if (device_info?.device_name) {
        deviceInfo.device_name = device_info.device_name;
      }

      const result = await authService.login(email, password, deviceInfo);

      res.status(200).json({
        user: result.user,
        tokens: result.tokens,
        session_id: result.sessionId,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /auth/refresh
   * Refresh tokens using refresh token
   * Requirements: 1.5, 1.6, 1.7
   */
  router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token || typeof refresh_token !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Refresh token is required', 'refresh_token');
      }

      const tokens = await authService.refreshTokens(refresh_token);

      res.status(200).json({ tokens });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /auth/logout
   * Logout current session
   * Requirements: 2.4
   */
  router.post('/logout', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = (req as AuthenticatedRequest).user;

      await authService.logout(sessionId);

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /auth/sessions
   * Get all sessions for current user
   * Requirements: 2.2
   */
  router.get('/sessions', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;

      const sessions = await authService.getSessions(userId);

      res.status(200).json({ sessions });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /auth/sessions/:session_id
   * Revoke a specific session
   * Requirements: 2.3
   */
  router.delete('/sessions/:session_id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const { session_id } = req.params;

      if (!session_id) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Session ID is required');
      }

      await authService.revokeSession(userId, session_id);

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /auth/me
   * Get current user information
   */
  router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      
      const user = await authService.getUserById(userId);

      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /auth/users/:user_id
   * Get a user profile by ID (for viewing other users' profiles)
   */
  router.get('/users/:user_id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user_id } = req.params;
      
      if (!user_id) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'User ID is required');
      }

      const user = await authService.getUserById(user_id);

      if (!user) {
        throw new ApiError(ApiErrorCode.USER_NOT_FOUND, 404, 'User not found');
      }

      // Return user profile (exclude sensitive data like email if needed)
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /auth/users/:user_id/mini-profile
   * Get mini-profile data for a user
   * Requirements: 1.3, 2.5
   */
  router.get('/users/:user_id/mini-profile', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user_id } = req.params;
      
      if (!user_id) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'User ID is required');
      }

      const miniProfile = await authService.getMiniProfileData(user_id);

      if (!miniProfile) {
        throw new ApiError(ApiErrorCode.USER_NOT_FOUND, 404, 'User not found');
      }

      res.status(200).json(miniProfile);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /auth/accept-terms
   * Accept terms and conditions
   */
  router.post('/accept-terms', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      
      await authService.acceptTerms(userId);

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PATCH /auth/profile
   * Update user profile (username, avatar, bio, username_font, mini-profile settings)
   */
  router.patch('/profile', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const { username, avatar, bio, background_image, username_font, mini_profile_background, mini_profile_font, mini_profile_text_color } = req.body;

      const updates: { username?: string; avatar?: string; bio?: string; background_image?: string | null; username_font?: string; mini_profile_background?: string | null; mini_profile_font?: string; mini_profile_text_color?: string } = {};
      if (username !== undefined) updates.username = username;
      if (avatar !== undefined) updates.avatar = avatar;
      if (bio !== undefined) updates.bio = bio;
      if (background_image !== undefined) updates.background_image = background_image;
      if (username_font !== undefined) updates.username_font = username_font;
      if (mini_profile_background !== undefined) updates.mini_profile_background = mini_profile_background;
      if (mini_profile_font !== undefined) updates.mini_profile_font = mini_profile_font;
      if (mini_profile_text_color !== undefined) updates.mini_profile_text_color = mini_profile_text_color;

      const user = await authService.updateProfile(userId, updates);

      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /auth/profile-data
   * Get user's profile customization data (cards, layout, widgets, etc.)
   */
  router.get('/profile-data', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      
      const profileData = await authService.getProfileData(userId);

      res.status(200).json({ profileData: profileData || null });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /auth/users/:user_id/profile-data
   * Get another user's profile customization data (read-only)
   */
  router.get('/users/:user_id/profile-data', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user_id } = req.params;
      
      if (!user_id) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'User ID is required');
      }

      const profileData = await authService.getProfileData(user_id);

      res.status(200).json({ profileData: profileData || null });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /auth/profile-data
   * Save user's profile customization data (cards, layout, widgets, etc.)
   */
  router.put('/profile-data', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = (req as AuthenticatedRequest).user;
      const { profileData, backgroundImage } = req.body;

      if (!profileData || typeof profileData !== 'object') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 400, 'Profile data is required');
      }

      await authService.saveProfileData(userId, profileData, backgroundImage);

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
