/**
 * Rate limiting middleware for the API.
 * 
 * Separate limiters for auth endpoints (strict) and general API (relaxed).
 */

import rateLimit from 'express-rate-limit';

/**
 * Strict rate limiter for auth endpoints (login, register).
 * 10 attempts per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});

/**
 * General API rate limiter.
 * 200 requests per minute per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});
