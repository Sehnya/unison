/**
 * WebSocket Gateway Service
 * 
 * Real-time WebSocket connections, subscriptions, and event fanout.
 * Requirements: 12.1-12.5, 13.1-13.6
 */

// Server
export { WebSocketGateway, MockUserDataProvider } from './server.js';

// Bootstrap
export {
  bootstrapGateway,
  createDatabaseUserDataProvider,
  type GatewayBootstrapConfig,
  type BootstrappedGateway,
} from './bootstrap.js';

// Connection management
export { ConnectionManager } from './connection.js';
export type { EventReplayHandler } from './connection.js';

// Subscription management
export {
  RedisSubscriptionManager,
  InMemorySubscriptionManager,
} from './subscriptions.js';

// Event fanout
export { EventFanout } from './fanout.js';

// Event consumer
export { GatewayEventConsumer } from './event-consumer.js';
export type { GatewayEventConsumerConfig } from './event-consumer.js';

// Event replay
export { EventReplayManager, DEFAULT_REPLAY_CONFIG } from './replay.js';
export type { EventReplayConfig } from './replay.js';

// Types
export type {
  GatewayConfig,
  ClientConnection,
  ConnectionState,
  UserDataProvider,
  SubscriptionManager,
  QueuedEvent,
} from './types.js';
export { DEFAULT_GATEWAY_CONFIG } from './types.js';

// Errors
export {
  GatewayError,
  AuthenticationFailedError,
  SessionInvalidatedError,
  HeartbeatTimeoutError,
  InvalidPayloadError,
  RateLimitedError,
} from './errors.js';
