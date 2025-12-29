/**
 * API Service Bootstrap
 *
 * Wires together all services with real database and event bus connections.
 * 
 * Note: This module provides factory functions for creating a fully wired API server.
 * Services are passed in as dependencies rather than imported directly to avoid
 * cross-package compilation issues.
 */

import type { Pool } from 'pg';
import type { Express } from 'express';
import type { DomainEvent, Snowflake } from '@discord-clone/types';
import type { EventBusClient } from '@discord-clone/eventbus';
import { createApiServer, type ApiServerConfig } from './server.js';
import type { TokenValidator } from './middleware.js';

/**
 * Event emitter adapter for services
 */
export class EventBusEmitter {
  constructor(private readonly eventBus: EventBusClient | undefined) {}

  async emit(event: DomainEvent): Promise<void> {
    if (this.eventBus) {
      await this.eventBus.publish(event);
    }
  }
}

/**
 * Token payload returned by validator
 */
export interface TokenPayload {
  userId: Snowflake;
  sessionId: string;
}

/**
 * Create a mock token validator for development/testing
 * Token format: "userId:sessionId"
 */
export function createMockTokenValidator(): TokenValidator {
  return (token: string) => {
    const parts = token.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error('Invalid token format');
    }
    return {
      sub: parts[0] as Snowflake,
      session_id: parts[1],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
  };
}

/**
 * Bootstrap configuration
 */
export interface BootstrapConfig {
  pool: Pool;
  eventBus?: EventBusClient;
  services: ApiServerConfig;
}

/**
 * Bootstrapped API server
 */
export interface BootstrappedApi {
  app: Express;
}

/**
 * Bootstrap the API server with provided services
 * 
 * This creates the Express app with all routes wired to the provided services.
 * Services should be created externally and passed in.
 */
export function bootstrapApi(config: BootstrapConfig): BootstrappedApi {
  const app = createApiServer(config.services);
  return { app };
}
