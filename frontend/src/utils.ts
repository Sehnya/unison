import type { Message } from './types';

/**
 * Sorts messages by their Snowflake ID in ascending order (oldest to newest).
 * Snowflake IDs are numeric strings that need to be compared as BigInt for accuracy.
 * 
 * @param messages - Array of messages to sort
 * @returns New array sorted by Snowflake ID ascending
 */
export function sortBySnowflake(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => {
    const idA = BigInt(a.id);
    const idB = BigInt(b.id);
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });
}
