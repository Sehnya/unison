/**
 * WebSocket Gateway Server
 * 
 * Main entry point for the WebSocket Gateway service.
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Snowflake, User, Guild } from '@discord-clone/types';
import type { GatewayConfig, UserDataProvider, SubscriptionManager } from './types.js';
import { DEFAULT_GATEWAY_CONFIG } from './types.js';
import { ConnectionManager } from './connection.js';
import { RedisSubscriptionManager, InMemorySubscriptionManager } from './subscriptions.js';

/**
 * WebSocket Gateway Server
 * 
 * Handles WebSocket connections, authentication, and real-time event delivery.
 */
export class WebSocketGateway {
  private readonly config: GatewayConfig;
  private readonly wss: WebSocketServer;
  private readonly connectionManager: ConnectionManager;
  private readonly subscriptionManager: SubscriptionManager;
  private readonly userDataProvider: UserDataProvider;

  constructor(
    config: Partial<GatewayConfig> = {},
    userDataProvider: UserDataProvider,
    subscriptionManager?: SubscriptionManager
  ) {
    this.config = { ...DEFAULT_GATEWAY_CONFIG, ...config };
    this.userDataProvider = userDataProvider;

    // Create subscription manager
    if (subscriptionManager) {
      this.subscriptionManager = subscriptionManager;
    } else if (this.config.redisUrl) {
      this.subscriptionManager = new RedisSubscriptionManager(this.config.redisUrl);
    } else {
      this.subscriptionManager = new InMemorySubscriptionManager();
    }

    // Create connection manager
    this.connectionManager = new ConnectionManager(
      this.config,
      this.userDataProvider,
      this.subscriptionManager
    );

    // Create WebSocket server
    this.wss = new WebSocketServer({
      port: this.config.port,
      clientTracking: false, // We manage connections ourselves
    });

    // Set up connection handler
    this.wss.on('connection', (socket, request) => this.handleConnection(socket, request));
  }

  /**
   * Handle new WebSocket connection
   * Requirements: 12.1
   */
  private async handleConnection(socket: WebSocket, _request: IncomingMessage): Promise<void> {
    try {
      await this.connectionManager.handleConnection(socket);
    } catch (error) {
      console.error('Error handling connection:', error);
      socket.close(4000, 'Internal error');
    }
  }

  /**
   * Get the connection manager
   */
  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  /**
   * Get the subscription manager
   */
  getSubscriptionManager(): SubscriptionManager {
    return this.subscriptionManager;
  }

  /**
   * Get server configuration
   */
  getConfig(): GatewayConfig {
    return this.config;
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connectionManager.getConnectionCount();
  }

  /**
   * Close the server
   */
  async close(): Promise<void> {
    // Close all connections
    for (const connection of this.connectionManager.getAllConnections()) {
      connection.socket.close(1001, 'Server shutting down');
    }

    // Close WebSocket server
    await new Promise<void>((resolve, reject) => {
      this.wss.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Close subscription manager if it's Redis-based
    if (this.subscriptionManager instanceof RedisSubscriptionManager) {
      await this.subscriptionManager.close();
    }
  }
}

/**
 * Mock User Data Provider for testing
 */
export class MockUserDataProvider implements UserDataProvider {
  private readonly users: Map<Snowflake, User> = new Map();
  private readonly userGuilds: Map<Snowflake, Guild[]> = new Map();
  private readonly validSessions: Set<string> = new Set();

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  setUserGuilds(userId: Snowflake, guilds: Guild[]): void {
    this.userGuilds.set(userId, guilds);
  }

  addValidSession(sessionId: string): void {
    this.validSessions.add(sessionId);
  }

  removeValidSession(sessionId: string): void {
    this.validSessions.delete(sessionId);
  }

  async getUser(userId: Snowflake): Promise<User | null> {
    return this.users.get(userId) ?? null;
  }

  async getUserGuilds(userId: Snowflake): Promise<Guild[]> {
    return this.userGuilds.get(userId) ?? [];
  }

  async validateSession(sessionId: string): Promise<boolean> {
    return this.validSessions.has(sessionId);
  }
}
