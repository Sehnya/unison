/**
 * Gateway Errors
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

/**
 * Base gateway error
 */
export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly code: number
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

/**
 * Authentication failed error
 */
export class AuthenticationFailedError extends GatewayError {
  constructor(message = 'Authentication failed') {
    super(message, 4001);
    this.name = 'AuthenticationFailedError';
  }
}

/**
 * Session invalidated error
 */
export class SessionInvalidatedError extends GatewayError {
  constructor(message = 'Session invalidated') {
    super(message, 4002);
    this.name = 'SessionInvalidatedError';
  }
}

/**
 * Heartbeat timeout error
 */
export class HeartbeatTimeoutError extends GatewayError {
  constructor(message = 'Heartbeat timeout') {
    super(message, 4003);
    this.name = 'HeartbeatTimeoutError';
  }
}

/**
 * Invalid payload error
 */
export class InvalidPayloadError extends GatewayError {
  constructor(message = 'Invalid payload') {
    super(message, 4004);
    this.name = 'InvalidPayloadError';
  }
}

/**
 * Rate limited error
 */
export class RateLimitedError extends GatewayError {
  constructor(message = 'Rate limited') {
    super(message, 4005);
    this.name = 'RateLimitedError';
  }
}
