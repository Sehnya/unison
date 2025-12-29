/**
 * Gateway Service Bootstrap
 *
 * Wires together the WebSocket gateway with NATS JetStream event consumer.
 */

import type { Snowflake, User, Guild } from '@discord-clone/types';
import type { EventBusConfig } from '@discord-clone/eventbus';
import { WebSocketGateway } from './server.js';
import { GatewayEventConsumer, type GatewayEventConsumerConfig } from './event-consumer.js';
import { EventFanout } from './fanout.js';
import type { GatewayConfig, UserDataProvider, SubscriptionManager } from './types.js';

/**
 * Gateway bootstrap configuration
 */
export interface GatewayBootstrapConfig {
  /** WebSocket gateway configuration */
  gateway?: Partial<GatewayConfig>;
  /** NATS event bus configuration */
  nats?: Partial<EventBusConfig>;
  /** User data provider for authentication and guild data */
  userDataProvider: UserDataProvider;
  /** Optional subscription manager (defaults to in-memory) */
  subscriptionManager?: SubscriptionManager;
  /** Consumer group name for NATS */
  consumerGroup?: string;
}

/**
 * Bootstrapped gateway with all components
 */
export interface BootstrappedGateway {
  gateway: WebSocketGateway;
  eventConsumer: GatewayEventConsumer;
  fanout: EventFanout;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Get NATS configuration from environment
 */
function getNatsConfig(): EventBusConfig {
  const servers = process.env.NATS_SERVERS?.split(',') ?? ['nats://localhost:4222'];
  return {
    servers,
    name: process.env.NATS_CLIENT_NAME ?? 'gateway',
  };
}

/**
 * Bootstrap the gateway service with NATS event consumer
 */
export function bootstrapGateway(config: GatewayBootstrapConfig): BootstrappedGateway {
  const { userDataProvider, subscriptionManager, consumerGroup = 'gateway' } = config;

  // Create WebSocket gateway
  const gateway = new WebSocketGateway(
    config.gateway,
    userDataProvider,
    subscriptionManager
  );

  // Create event fanout
  const fanout = new EventFanout(
    gateway.getConnectionManager(),
    gateway.getSubscriptionManager()
  );

  // Create NATS event consumer
  const natsConfig = { ...getNatsConfig(), ...config.nats };
  const eventConsumerConfig: GatewayEventConsumerConfig = {
    servers: natsConfig.servers,
    consumerGroup,
  };
  if (natsConfig.name) {
    eventConsumerConfig.name = natsConfig.name;
  }
  const eventConsumer = new GatewayEventConsumer(eventConsumerConfig, fanout);

  return {
    gateway,
    eventConsumer,
    fanout,
    start: async () => {
      await eventConsumer.start();
    },
    stop: async () => {
      await eventConsumer.stop();
      await gateway.close();
    },
  };
}

/**
 * Create a simple user data provider from a database pool
 * This is a factory for creating providers that query the database
 */
export function createDatabaseUserDataProvider(
  getUserById: (userId: Snowflake) => Promise<User | null>,
  getUserGuilds: (userId: Snowflake) => Promise<Guild[]>,
  validateSession: (sessionId: string) => Promise<boolean>
): UserDataProvider {
  return {
    getUser: getUserById,
    getUserGuilds,
    validateSession,
  };
}
