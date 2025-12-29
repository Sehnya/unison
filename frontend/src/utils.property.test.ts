import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sortBySnowflake } from './utils';
import type { Message } from './types';

/**
 * Property 1: Message Ordering by Snowflake ID
 * 
 * For any array of messages with Snowflake IDs, after sorting, each message's ID 
 * SHALL be less than or equal to the next message's ID when compared as BigInt values.
 * 
 * **Validates: Requirements 2.2**
 */
describe('sortBySnowflake', () => {
  // Arbitrary for generating valid Snowflake-like IDs (large numeric strings)
  const snowflakeArb = fc.bigUintN(63).map(n => n.toString());

  // Arbitrary for generating a Message with a random Snowflake ID
  const messageArb = snowflakeArb.chain(id =>
    fc.record({
      id: fc.constant(id),
      author_id: snowflakeArb,
      content: fc.string(),
      created_at: fc.date().map(d => d.toISOString())
    })
  );

  it('Property 1: sorted messages are in ascending Snowflake ID order', () => {
    fc.assert(
      fc.property(fc.array(messageArb), (messages: Message[]) => {
        const sorted = sortBySnowflake(messages);
        
        // Verify each consecutive pair is in ascending order
        for (let i = 0; i < sorted.length - 1; i++) {
          const currentId = BigInt(sorted[i].id);
          const nextId = BigInt(sorted[i + 1].id);
          expect(currentId <= nextId).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1: sorting preserves all original messages', () => {
    fc.assert(
      fc.property(fc.array(messageArb), (messages: Message[]) => {
        const sorted = sortBySnowflake(messages);
        
        // Same length
        expect(sorted.length).toBe(messages.length);
        
        // All original IDs are present
        const originalIds = new Set(messages.map(m => m.id));
        const sortedIds = new Set(sorted.map(m => m.id));
        expect(sortedIds).toEqual(originalIds);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1: sorting is idempotent', () => {
    fc.assert(
      fc.property(fc.array(messageArb), (messages: Message[]) => {
        const sortedOnce = sortBySnowflake(messages);
        const sortedTwice = sortBySnowflake(sortedOnce);
        
        // Sorting twice should produce the same result as sorting once
        expect(sortedTwice.map(m => m.id)).toEqual(sortedOnce.map(m => m.id));
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 4: Message List Append Invariant
 * 
 * For any set of new messages received from polling, the message list length after 
 * appending SHALL equal the previous length plus the count of new messages, and all 
 * new messages SHALL appear after existing messages.
 * 
 * **Validates: Requirements 3.3**
 */
describe('Message List Append Invariant', () => {
  // Arbitrary for generating valid Snowflake-like IDs (large numeric strings)
  const snowflakeArb = fc.bigUintN(63).map(n => n.toString());

  // Arbitrary for generating a Message with a random Snowflake ID
  const messageArb = snowflakeArb.chain(id =>
    fc.record({
      id: fc.constant(id),
      author_id: snowflakeArb,
      content: fc.string(),
      created_at: fc.date().map(d => d.toISOString())
    })
  );

  /**
   * Simulates the append behavior from MessageList component:
   * messages = [...messages, ...sortBySnowflake(newMessages)]
   */
  function appendMessages(existing: Message[], newMessages: Message[]): Message[] {
    return [...existing, ...sortBySnowflake(newMessages)];
  }

  it('Property 4: appending messages increases list length by count of new messages', () => {
    fc.assert(
      fc.property(
        fc.array(messageArb),
        fc.array(messageArb),
        (existingMessages: Message[], newMessages: Message[]) => {
          const result = appendMessages(existingMessages, newMessages);
          
          // Length after append equals previous length plus new message count
          expect(result.length).toBe(existingMessages.length + newMessages.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4: new messages appear after existing messages', () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 1 }),
        fc.array(messageArb, { minLength: 1 }),
        (existingMessages: Message[], newMessages: Message[]) => {
          const result = appendMessages(existingMessages, newMessages);
          
          // Existing messages should be at the beginning in their original order
          for (let i = 0; i < existingMessages.length; i++) {
            expect(result[i].id).toBe(existingMessages[i].id);
          }
          
          // New messages should appear after existing messages
          const appendedPortion = result.slice(existingMessages.length);
          expect(appendedPortion.length).toBe(newMessages.length);
          
          // All new message IDs should be present in the appended portion
          const newMessageIds = new Set(newMessages.map(m => m.id));
          const appendedIds = new Set(appendedPortion.map(m => m.id));
          expect(appendedIds).toEqual(newMessageIds);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4: appending empty array preserves original list', () => {
    fc.assert(
      fc.property(fc.array(messageArb), (existingMessages: Message[]) => {
        const result = appendMessages(existingMessages, []);
        
        expect(result.length).toBe(existingMessages.length);
        expect(result.map(m => m.id)).toEqual(existingMessages.map(m => m.id));
      }),
      { numRuns: 100 }
    );
  });
});
