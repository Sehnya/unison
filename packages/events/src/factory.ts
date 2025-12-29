import type { BaseEvent, DomainEvent } from '@discord-clone/types';
import { SnowflakeGenerator } from '@discord-clone/snowflake';

// Use worker ID 0 for event ID generation (can be configured per service)
const eventIdGenerator = new SnowflakeGenerator(0);

/**
 * Generate a unique event ID
 */
export function createEventId(): string {
  return eventIdGenerator.generate();
}

/**
 * Create a domain event with auto-generated ID and timestamp
 */
export function createEvent<T extends DomainEvent['type'], D>(
  type: T,
  data: D
): BaseEvent<T, D> {
  return {
    id: createEventId(),
    type,
    timestamp: Date.now(),
    data,
  };
}
