/**
 * Event Bus Package
 * 
 * NATS JetStream-based event bus for inter-service communication.
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */

export { JetStreamEventBus, getEventSubject } from './client.js';
export { EventConsumerWithRetry, createEventConsumer } from './consumer.js';
export { ServiceEventConsumer, createServiceConsumer, type ServiceConsumerConfig } from './service-consumer.js';
export {
  createEventBusClient,
  createServiceEventConsumer,
  createNatsConnection,
  getEventBusConfig,
  testNatsConnection,
} from './factory.js';
export {
  type EventBusClient,
  type EventBusConfig,
  type EventPublisher,
  type EventConsumer,
  type EventHandler,
  type StreamConfig,
  type ConsumerConfig,
  type RetryConfig,
  DEFAULT_RETRY_CONFIG,
  STREAM_CONFIGS,
} from './types.js';
