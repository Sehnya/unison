import type { Snowflake, SnowflakeComponents } from '@discord-clone/types';
import {
  DISCORD_CLONE_EPOCH,
  MAX_WORKER_ID,
  MAX_SEQUENCE,
  WORKER_ID_SHIFT,
  TIMESTAMP_SHIFT,
  SEQUENCE_BITS,
  WORKER_ID_BITS,
} from './constants.js';

/**
 * Snowflake ID Generator
 *
 * Generates 64-bit time-sortable unique identifiers.
 * Structure: | 42 bits timestamp | 10 bits worker ID | 12 bits sequence |
 */
export class SnowflakeGenerator {
  private readonly workerId: bigint;
  private sequence: bigint = 0n;
  private lastTimestamp: bigint = -1n;

  /**
   * Create a new Snowflake generator
   * @param workerId - Worker ID (0-1023)
   */
  constructor(workerId: number) {
    const workerIdBigInt = BigInt(workerId);

    if (workerIdBigInt < 0n || workerIdBigInt > MAX_WORKER_ID) {
      throw new Error(`Worker ID must be between 0 and ${MAX_WORKER_ID}`);
    }

    this.workerId = workerIdBigInt;
  }

  /**
   * Generate a new Snowflake ID
   */
  generate(): Snowflake {
    let timestamp = this.currentTimestamp();

    if (timestamp < this.lastTimestamp) {
      throw new Error('Clock moved backwards. Refusing to generate ID.');
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & MAX_SEQUENCE;

      // Sequence overflow - wait for next millisecond
      if (this.sequence === 0n) {
        timestamp = this.waitNextMillis(timestamp);
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    const id =
      ((timestamp - DISCORD_CLONE_EPOCH) << TIMESTAMP_SHIFT) |
      (this.workerId << WORKER_ID_SHIFT) |
      this.sequence;

    return id.toString();
  }

  /**
   * Parse a Snowflake ID into its components
   */
  parse(snowflake: Snowflake): SnowflakeComponents {
    const id = BigInt(snowflake);

    const timestamp = Number((id >> TIMESTAMP_SHIFT) + DISCORD_CLONE_EPOCH);
    const workerId = Number((id >> WORKER_ID_SHIFT) & ((1n << WORKER_ID_BITS) - 1n));
    const sequence = Number(id & ((1n << SEQUENCE_BITS) - 1n));

    return { timestamp, workerId, sequence };
  }

  /**
   * Get the timestamp from a Snowflake ID as a Date
   */
  getTimestamp(snowflake: Snowflake): Date {
    const { timestamp } = this.parse(snowflake);
    return new Date(timestamp);
  }

  /**
   * Get current timestamp in milliseconds
   */
  private currentTimestamp(): bigint {
    return BigInt(Date.now());
  }

  /**
   * Wait until the next millisecond
   */
  private waitNextMillis(lastTimestamp: bigint): bigint {
    let timestamp = this.currentTimestamp();
    while (timestamp <= lastTimestamp) {
      timestamp = this.currentTimestamp();
    }
    return timestamp;
  }
}
