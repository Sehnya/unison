/**
 * Snowflake ID type - 64-bit ID as string for JSON compatibility
 * Structure: | 42 bits timestamp | 10 bits worker ID | 12 bits sequence |
 */
export type Snowflake = string;

/**
 * Parsed components of a Snowflake ID
 */
export interface SnowflakeComponents {
  timestamp: number;
  workerId: number;
  sequence: number;
}
