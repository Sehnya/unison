/**
 * Custom epoch: January 1, 2024 00:00:00 UTC
 */
export const DISCORD_CLONE_EPOCH = 1704067200000n;

/**
 * Bit allocation for Snowflake ID components
 */
export const TIMESTAMP_BITS = 42n;
export const WORKER_ID_BITS = 10n;
export const SEQUENCE_BITS = 12n;

/**
 * Maximum values for each component
 */
export const MAX_WORKER_ID = (1n << WORKER_ID_BITS) - 1n; // 1023
export const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n; // 4095

/**
 * Bit shifts for component extraction
 */
export const WORKER_ID_SHIFT = SEQUENCE_BITS;
export const TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS;
