/**
 * Event Bus Factory
 *
 * Creates and manages NATS JetStream connections for services.
 * Requirements: 15.1, 15.2
 */

import { connect, type NatsConnection } from 'nats';
import type { EventBusConfig } from './types.js';
import { JetStreamEventBus } from './client.js';
import { ServiceEventConsumer, type ServiceConsumerConfig } from './service-consumer.js';

/**
 * Get event bus configuration from environment variables
 */
export function getEventBusConfig(): EventBusConfig {
  const servers = process.env.NATS_SERVERS?.split(',') ?? ['nats://localhost:4222'];
  
  const config: EventBusConfig = {
    servers,
    maxReconnectAttempts: parseInt(process.env.NATS_MAX_RECONNECT ?? '10', 10),
    reconnectTimeWait: parseInt(process.env.NATS_RECONNECT_WAIT ?? '1000', 10),
  };
  
  if (process.env.NATS_CLIENT_NAME) {
    config.name = process.env.NATS_CLIENT_NAME;
  }
  if (process.env.NATS_USER) {
    config.user = process.env.NATS_USER;
  }
  if (process.env.NATS_PASS) {
    config.pass = process.env.NATS_PASS;
  }
  if (process.env.NATS_TOKEN) {
    config.token = process.env.NATS_TOKEN;
  }
  
  return config;
}

/**
 * Create an event bus client for publishing events
 */
export async function createEventBusClient(config?: Partial<EventBusConfig>): Promise<JetStreamEventBus> {
  const eventBusConfig = { ...getEventBusConfig(), ...config };
  const client = new JetStreamEventBus(eventBusConfig);
  await client.connect();
  return client;
}

/**
 * Create a service event consumer
 */
export function createServiceEventConsumer(
  serviceName: string,
  config?: Partial<EventBusConfig>
): ServiceEventConsumer {
  const eventBusConfig = { ...getEventBusConfig(), ...config };
  
  const consumerConfig: ServiceConsumerConfig = {
    serviceName,
    eventBusConfig,
  };
  
  return new ServiceEventConsumer(consumerConfig);
}

/**
 * Create a raw NATS connection (for advanced use cases)
 */
export async function createNatsConnection(config?: Partial<EventBusConfig>): Promise<NatsConnection> {
  const eventBusConfig = { ...getEventBusConfig(), ...config };
  
  const connectionOptions: Parameters<typeof connect>[0] = {
    servers: eventBusConfig.servers,
  };
  
  if (eventBusConfig.name) {
    connectionOptions.name = eventBusConfig.name;
  }
  if (eventBusConfig.user) {
    connectionOptions.user = eventBusConfig.user;
  }
  if (eventBusConfig.pass) {
    connectionOptions.pass = eventBusConfig.pass;
  }
  if (eventBusConfig.token) {
    connectionOptions.token = eventBusConfig.token;
  }
  if (eventBusConfig.maxReconnectAttempts !== undefined) {
    connectionOptions.maxReconnectAttempts = eventBusConfig.maxReconnectAttempts;
  }
  if (eventBusConfig.reconnectTimeWait !== undefined) {
    connectionOptions.reconnectTimeWait = eventBusConfig.reconnectTimeWait;
  }
  
  return connect(connectionOptions);
}

/**
 * Test NATS connection
 */
export async function testNatsConnection(servers?: string[]): Promise<boolean> {
  try {
    const config = getEventBusConfig();
    const connection = await connect({
      servers: servers ?? config.servers,
      maxReconnectAttempts: 1,
      reconnectTimeWait: 100,
    });
    await connection.close();
    return true;
  } catch {
    return false;
  }
}
