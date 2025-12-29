/**
 * Connection Manager
 * 
 * Handles WebSocket connection lifecycle, heartbeats, and message handling.
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import type {
  Snowflake,
  TokenPayload,
  ClientMessage,
  ServerMessage,
  IdentifyPayload,
  SubscribePayload,
  UnsubscribePayload,
  HelloPayload,
  ReadyPayload,
  ResyncPayload,
  InvalidSessionPayload,
  WebSocketEventType,
} from '@discord-clone/types';
import { WebSocketCloseCodes } from '@discord-clone/types';
import type {
  GatewayConfig,
  ClientConnection,
  UserDataProvider,
  SubscriptionManager,
} from './types.js';
import {
  AuthenticationFailedError,
  InvalidPayloadError,
  RateLimitedError,
} from './errors.js';

/**
 * Event replay handler interface
 */
export interface EventReplayHandler {
  replayEvents(
    connection: ClientConnection,
    lastEventId: string,
    guildIds: Snowflake[]
  ): Promise<boolean>;
}

/**
 * Connection Manager
 * 
 * Manages WebSocket connections, authentication, heartbeats, and message routing.
 */
export class ConnectionManager {
  private readonly connections: Map<string, ClientConnection> = new Map();
  private readonly userConnections: Map<Snowflake, Set<string>> = new Map();
  private readonly config: GatewayConfig;
  private readonly userDataProvider: UserDataProvider;
  private readonly subscriptionManager: SubscriptionManager;
  private replayHandler?: EventReplayHandler;

  constructor(
    config: GatewayConfig,
    userDataProvider: UserDataProvider,
    subscriptionManager: SubscriptionManager
  ) {
    this.config = config;
    this.userDataProvider = userDataProvider;
    this.subscriptionManager = subscriptionManager;
  }

  /**
   * Set the event replay handler
   * Requirements: 12.5
   */
  setReplayHandler(handler: EventReplayHandler): void {
    this.replayHandler = handler;
  }

  /**
   * Handle new WebSocket connection
   * Requirements: 12.1
   */
  async handleConnection(socket: WebSocket): Promise<ClientConnection> {
    const connectionId = randomUUID();
    
    const connection: ClientConnection = {
      id: connectionId,
      socket,
      state: 'connecting',
      guilds: [],
      channelSubscriptions: new Set(),
      lastHeartbeat: Date.now(),
      lastSequence: 0,
      sendBuffer: [],
      eventsSentInWindow: 0,
      rateLimitWindowStart: Date.now(),
      createdAt: Date.now(),
    };

    this.connections.set(connectionId, connection);

    // Set up event handlers
    socket.on('message', (data) => this.handleMessage(connection, data));
    socket.on('close', () => this.handleClose(connection));
    socket.on('error', (error) => this.handleError(connection, error));

    // Send HELLO with heartbeat interval
    this.sendHello(connection);

    // Start heartbeat timeout
    this.startHeartbeatTimeout(connection);

    // Update state to identifying
    connection.state = 'identifying';

    return connection;
  }

  /**
   * Send HELLO message
   * Requirements: 12.1
   */
  private sendHello(connection: ClientConnection): void {
    const payload: HelloPayload = {
      heartbeat_interval: this.config.heartbeatInterval,
    };

    this.send(connection, {
      op: 'HELLO',
      d: payload,
    });
  }

  /**
   * Handle incoming WebSocket message
   * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
   */
  private async handleMessage(
    connection: ClientConnection,
    data: WebSocket.RawData
  ): Promise<void> {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;

      switch (message.op) {
        case 'IDENTIFY':
          await this.handleIdentify(connection, message.d as IdentifyPayload);
          break;
        case 'HEARTBEAT':
          this.handleHeartbeat(connection);
          break;
        case 'SUBSCRIBE':
          await this.handleSubscribe(connection, message.d as SubscribePayload);
          break;
        case 'UNSUBSCRIBE':
          await this.handleUnsubscribe(connection, message.d as UnsubscribePayload);
          break;
        case 'RESUME':
          await this.handleResume(connection, message.d as IdentifyPayload);
          break;
        default:
          throw new InvalidPayloadError(`Unknown opcode: ${message.op}`);
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.closeConnection(connection, WebSocketCloseCodes.INVALID_PAYLOAD, 'Invalid JSON');
      } else if (error instanceof InvalidPayloadError) {
        this.closeConnection(connection, WebSocketCloseCodes.INVALID_PAYLOAD, error.message);
      } else if (error instanceof AuthenticationFailedError) {
        this.closeConnection(connection, WebSocketCloseCodes.AUTHENTICATION_FAILED, error.message);
      } else if (error instanceof RateLimitedError) {
        this.closeConnection(connection, WebSocketCloseCodes.RATE_LIMITED, error.message);
      } else {
        console.error('Error handling message:', error);
        this.closeConnection(connection, WebSocketCloseCodes.INVALID_PAYLOAD, 'Internal error');
      }
    }
  }

  /**
   * Handle IDENTIFY message
   * Requirements: 12.1, 12.2
   */
  private async handleIdentify(
    connection: ClientConnection,
    payload: IdentifyPayload
  ): Promise<void> {
    if (connection.state !== 'identifying') {
      throw new InvalidPayloadError('Already identified');
    }

    // Validate JWT
    let tokenPayload: TokenPayload;
    try {
      tokenPayload = jwt.verify(payload.token, this.config.jwtSecret) as TokenPayload;
    } catch {
      throw new AuthenticationFailedError('Invalid token');
    }

    // Validate session
    const sessionValid = await this.userDataProvider.validateSession(tokenPayload.session_id);
    if (!sessionValid) {
      throw new AuthenticationFailedError('Session invalid');
    }

    // Get user data
    const user = await this.userDataProvider.getUser(tokenPayload.sub);
    if (!user) {
      throw new AuthenticationFailedError('User not found');
    }

    // Get user's guilds
    const guilds = await this.userDataProvider.getUserGuilds(tokenPayload.sub);

    // Update connection state
    connection.userId = tokenPayload.sub;
    connection.sessionId = tokenPayload.session_id;
    connection.tokenPayload = tokenPayload;
    connection.user = user;
    connection.guilds = guilds;
    connection.state = 'ready';
    if (payload.last_event_id) {
      connection.lastEventId = payload.last_event_id;
    }

    // Track user connection
    this.addUserConnection(tokenPayload.sub, connection.id);

    // Subscribe to user's guilds
    for (const guild of guilds) {
      await this.subscriptionManager.subscribeToGuild(connection.id, guild.id);
    }

    // Handle reconnection with last_event_id
    // Requirements: 12.5
    if (payload.last_event_id && this.replayHandler) {
      const guildIds = guilds.map(g => g.id);
      const replaySuccess = await this.replayHandler.replayEvents(
        connection,
        payload.last_event_id,
        guildIds
      );

      if (!replaySuccess) {
        // Replay window exceeded, send RESYNC_REQUIRED
        this.sendResyncRequired(connection, 'replay_window_exceeded');
        return;
      }
    }

    // Send READY
    const readyPayload: ReadyPayload = {
      user,
      guilds,
      session_id: connection.id,
    };

    this.send(connection, {
      op: 'DISPATCH',
      t: 'READY',
      s: ++connection.lastSequence,
      d: readyPayload,
    });
  }

  /**
   * Handle HEARTBEAT message
   * Requirements: 12.4
   */
  private handleHeartbeat(connection: ClientConnection): void {
    connection.lastHeartbeat = Date.now();
    
    // Reset heartbeat timeout
    this.resetHeartbeatTimeout(connection);

    // Send HEARTBEAT_ACK
    this.send(connection, {
      op: 'HEARTBEAT_ACK',
      d: null,
    });
  }

  /**
   * Handle SUBSCRIBE message
   * Requirements: 12.2
   */
  private async handleSubscribe(
    connection: ClientConnection,
    payload: SubscribePayload
  ): Promise<void> {
    if (connection.state !== 'ready') {
      throw new InvalidPayloadError('Not ready');
    }

    const channelId = payload.channel_id;

    // Add to local subscriptions
    connection.channelSubscriptions.add(channelId);

    // Add to subscription manager
    await this.subscriptionManager.subscribeToChannel(connection.id, channelId);
  }

  /**
   * Handle UNSUBSCRIBE message
   * Requirements: 12.2
   */
  private async handleUnsubscribe(
    connection: ClientConnection,
    payload: UnsubscribePayload
  ): Promise<void> {
    if (connection.state !== 'ready') {
      throw new InvalidPayloadError('Not ready');
    }

    const channelId = payload.channel_id;

    // Remove from local subscriptions
    connection.channelSubscriptions.delete(channelId);

    // Remove from subscription manager
    await this.subscriptionManager.unsubscribeFromChannel(connection.id, channelId);
  }

  /**
   * Handle RESUME message
   * Requirements: 12.2
   */
  private async handleResume(
    connection: ClientConnection,
    payload: IdentifyPayload
  ): Promise<void> {
    // For now, treat RESUME like IDENTIFY
    // Full implementation in task 12.5
    await this.handleIdentify(connection, payload);
  }

  /**
   * Start heartbeat timeout
   * Requirements: 12.4, 12.5
   */
  private startHeartbeatTimeout(connection: ClientConnection): void {
    connection.heartbeatTimeout = setTimeout(() => {
      this.handleHeartbeatTimeout(connection);
    }, this.config.heartbeatTimeout);
  }

  /**
   * Reset heartbeat timeout
   * Requirements: 12.4
   */
  private resetHeartbeatTimeout(connection: ClientConnection): void {
    if (connection.heartbeatTimeout) {
      clearTimeout(connection.heartbeatTimeout);
    }
    this.startHeartbeatTimeout(connection);
  }

  /**
   * Handle heartbeat timeout
   * Requirements: 12.5
   */
  private handleHeartbeatTimeout(connection: ClientConnection): void {
    this.closeConnection(
      connection,
      WebSocketCloseCodes.HEARTBEAT_TIMEOUT,
      'Heartbeat timeout'
    );
  }

  /**
   * Handle WebSocket close
   */
  private async handleClose(connection: ClientConnection): Promise<void> {
    await this.cleanupConnection(connection);
  }

  /**
   * Handle WebSocket error
   */
  private handleError(connection: ClientConnection, error: Error): void {
    console.error(`WebSocket error for connection ${connection.id}:`, error);
  }

  /**
   * Close a connection with a code and reason
   */
  closeConnection(connection: ClientConnection, code: number, reason: string): void {
    connection.state = 'disconnected';
    connection.socket.close(code, reason);
  }

  /**
   * Clean up a connection
   */
  private async cleanupConnection(connection: ClientConnection): Promise<void> {
    // Clear heartbeat timeout
    if (connection.heartbeatTimeout) {
      clearTimeout(connection.heartbeatTimeout);
    }

    // Remove from user connections
    if (connection.userId) {
      this.removeUserConnection(connection.userId, connection.id);
    }

    // Remove subscriptions
    await this.subscriptionManager.removeConnection(connection.id);

    // Remove from connections map
    this.connections.delete(connection.id);

    connection.state = 'disconnected';
  }

  /**
   * Send a message to a connection
   * Requirements: 12.4
   */
  send(connection: ClientConnection, message: ServerMessage): boolean {
    if (connection.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      connection.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Error sending message to connection ${connection.id}:`, error);
      return false;
    }
  }

  /**
   * Dispatch an event to a connection with backpressure handling
   * Requirements: 12.4, 12.5
   */
  dispatchEvent(
    connection: ClientConnection,
    eventType: WebSocketEventType,
    data: unknown,
    eventId: string
  ): boolean {
    // Check rate limit
    if (!this.checkRateLimit(connection)) {
      // Rate limited - add to buffer or disconnect slow consumer
      return this.handleSlowConsumer(connection, eventType, data, eventId);
    }

    // Check send buffer size (backpressure)
    if (connection.sendBuffer.length >= this.config.maxSendBufferSize) {
      // Buffer full - disconnect slow consumer
      this.closeConnection(
        connection,
        WebSocketCloseCodes.RATE_LIMITED,
        'Send buffer full - slow consumer'
      );
      return false;
    }

    const sequence = ++connection.lastSequence;
    connection.lastEventId = eventId;

    const sent = this.send(connection, {
      op: 'DISPATCH',
      t: eventType,
      s: sequence,
      d: data,
    });

    if (!sent) {
      // Failed to send - add to buffer for retry
      connection.sendBuffer.push({
        type: eventType,
        data,
        sequence,
        eventId,
        timestamp: Date.now(),
      });
    }

    return sent;
  }

  /**
   * Handle slow consumer by buffering or disconnecting
   * Requirements: 12.4, 12.5
   */
  private handleSlowConsumer(
    connection: ClientConnection,
    eventType: WebSocketEventType,
    data: unknown,
    eventId: string
  ): boolean {
    // Check if buffer is full
    if (connection.sendBuffer.length >= this.config.maxSendBufferSize) {
      // Disconnect slow consumer
      this.closeConnection(
        connection,
        WebSocketCloseCodes.RATE_LIMITED,
        'Rate limited - slow consumer'
      );
      return false;
    }

    // Add to buffer
    const sequence = ++connection.lastSequence;
    connection.sendBuffer.push({
      type: eventType,
      data,
      sequence,
      eventId,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Flush send buffer for a connection
   * Requirements: 12.4
   */
  flushSendBuffer(connection: ClientConnection): void {
    while (connection.sendBuffer.length > 0 && this.checkRateLimit(connection)) {
      const event = connection.sendBuffer.shift();
      if (event) {
        this.send(connection, {
          op: 'DISPATCH',
          t: event.type as WebSocketEventType,
          s: event.sequence,
          d: event.data,
        });
      }
    }
  }

  /**
   * Check rate limit for a connection
   * Requirements: 12.4
   */
  private checkRateLimit(connection: ClientConnection): boolean {
    const now = Date.now();
    const windowDuration = 1000; // 1 second

    // Reset window if expired
    if (now - connection.rateLimitWindowStart >= windowDuration) {
      connection.rateLimitWindowStart = now;
      connection.eventsSentInWindow = 0;
    }

    // Check if over limit
    if (connection.eventsSentInWindow >= this.config.maxEventsPerSecond) {
      return false;
    }

    connection.eventsSentInWindow++;
    return true;
  }

  /**
   * Add a user connection mapping
   */
  private addUserConnection(userId: Snowflake, connectionId: string): void {
    let connections = this.userConnections.get(userId);
    if (!connections) {
      connections = new Set();
      this.userConnections.set(userId, connections);
    }
    connections.add(connectionId);
  }

  /**
   * Remove a user connection mapping
   */
  private removeUserConnection(userId: Snowflake, connectionId: string): void {
    const connections = this.userConnections.get(userId);
    if (connections) {
      connections.delete(connectionId);
      if (connections.size === 0) {
        this.userConnections.delete(userId);
      }
    }
  }

  /**
   * Get a connection by ID
   */
  getConnection(connectionId: string): ClientConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections for a user
   */
  getUserConnections(userId: Snowflake): ClientConnection[] {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) {
      return [];
    }

    const connections: ClientConnection[] = [];
    for (const id of connectionIds) {
      const connection = this.connections.get(id);
      if (connection) {
        connections.push(connection);
      }
    }
    return connections;
  }

  /**
   * Get all connections
   */
  getAllConnections(): ClientConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Send RESYNC_REQUIRED to a connection
   */
  sendResyncRequired(connection: ClientConnection, reason: ResyncPayload['reason']): void {
    const payload: ResyncPayload = { reason };
    this.send(connection, {
      op: 'RESYNC_REQUIRED',
      d: payload,
    });
  }

  /**
   * Send INVALID_SESSION to a connection
   */
  sendInvalidSession(connection: ClientConnection, resumable: boolean): void {
    const payload: InvalidSessionPayload = { resumable };
    this.send(connection, {
      op: 'INVALID_SESSION',
      d: payload,
    });
  }

  /**
   * Disconnect connections for a session
   * Requirements: 2.5
   */
  async disconnectSession(sessionId: string): Promise<void> {
    for (const connection of this.connections.values()) {
      if (connection.sessionId === sessionId) {
        this.closeConnection(
          connection,
          WebSocketCloseCodes.SESSION_INVALIDATED,
          'Session invalidated'
        );
      }
    }
  }

  /**
   * Disconnect all connections for a user
   */
  async disconnectUser(userId: Snowflake): Promise<void> {
    const connections = this.getUserConnections(userId);
    for (const connection of connections) {
      this.closeConnection(
        connection,
        WebSocketCloseCodes.SESSION_INVALIDATED,
        'All sessions invalidated'
      );
    }
  }
}
