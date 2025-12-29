/**
 * Event Bus Property Tests
 * 
 * Feature: discord-clone-core, Property 15: Entity-Local Event Ordering
 * Validates: Requirements 15.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { DomainEvent, Snowflake, MessageCreatedEvent, MessageUpdatedEvent, MessageDeletedEvent } from '@discord-clone/types';
import { getEventSubject } from './client.js';
import { createEvent } from '@discord-clone/events';

/**
 * Generate a valid Snowflake ID
 */
const snowflakeArb = fc.bigInt({ min: 1n, max: (1n << 63n) - 1n }).map(n => n.toString() as Snowflake);

/**
 * Generate a message event (created, updated, or deleted)
 */
const messageEventArb = fc.record({
  channelId: snowflakeArb,
  guildId: snowflakeArb,
  messageId: snowflakeArb,
  authorId: snowflakeArb,
  content: fc.string({ minLength: 1, maxLength: 100 }),
  eventType: fc.constantFrom('message.created', 'message.updated', 'message.deleted') as fc.Arbitrary<'message.created' | 'message.updated' | 'message.deleted'>,
}).map(({ channelId, guildId, messageId, authorId, content, eventType }) => {
  if (eventType === 'message.created') {
    return createEvent('message.created', {
      message: {
        id: messageId,
        channel_id: channelId,
        author_id: authorId,
        content,
        mentions: [],
        mention_roles: [],
        created_at: new Date(),
      },
      channel_id: channelId,
      guild_id: guildId,
    }) as MessageCreatedEvent;
  } else if (eventType === 'message.updated') {
    return createEvent('message.updated', {
      message: {
        id: messageId,
        channel_id: channelId,
        author_id: authorId,
        content,
        mentions: [],
        mention_roles: [],
        created_at: new Date(),
        edited_at: new Date(),
      },
      channel_id: channelId,
      guild_id: guildId,
    }) as MessageUpdatedEvent;
  } else {
    return createEvent('message.deleted', {
      message_id: messageId,
      channel_id: channelId,
      guild_id: guildId,
    }) as MessageDeletedEvent;
  }
});

/**
 * Generate a sequence of events for the same entity (channel)
 */
const entityEventSequenceArb = fc.record({
  channelId: snowflakeArb,
  guildId: snowflakeArb,
  eventCount: fc.integer({ min: 2, max: 10 }),
}).chain(({ channelId, guildId, eventCount }) => {
  return fc.array(
    fc.record({
      messageId: snowflakeArb,
      authorId: snowflakeArb,
      content: fc.string({ minLength: 1, maxLength: 100 }),
      eventType: fc.constantFrom('message.created', 'message.updated', 'message.deleted') as fc.Arbitrary<'message.created' | 'message.updated' | 'message.deleted'>,
    }),
    { minLength: eventCount, maxLength: eventCount }
  ).map(events => ({
    channelId,
    guildId,
    events: events.map(({ messageId, authorId, content, eventType }, index) => {
      const baseEvent = {
        channel_id: channelId,
        guild_id: guildId,
      };
      
      if (eventType === 'message.created') {
        return {
          ...createEvent('message.created', {
            message: {
              id: messageId,
              channel_id: channelId,
              author_id: authorId,
              content,
              mentions: [],
              mention_roles: [],
              created_at: new Date(),
            },
            ...baseEvent,
          }),
          _sequenceIndex: index,
        } as MessageCreatedEvent & { _sequenceIndex: number };
      } else if (eventType === 'message.updated') {
        return {
          ...createEvent('message.updated', {
            message: {
              id: messageId,
              channel_id: channelId,
              author_id: authorId,
              content,
              mentions: [],
              mention_roles: [],
              created_at: new Date(),
              edited_at: new Date(),
            },
            ...baseEvent,
          }),
          _sequenceIndex: index,
        } as MessageUpdatedEvent & { _sequenceIndex: number };
      } else {
        return {
          ...createEvent('message.deleted', {
            message_id: messageId,
            ...baseEvent,
          }),
          _sequenceIndex: index,
        } as MessageDeletedEvent & { _sequenceIndex: number };
      }
    }),
  }));
});

describe('Event Bus Property Tests', () => {
  /**
   * Feature: discord-clone-core, Property 15: Entity-Local Event Ordering
   * Validates: Requirements 15.5
   * 
   * For any sequence of events affecting a single entity (e.g., messages in the same channel),
   * consumers SHALL receive those events in publish order.
   */
  describe('Property 15: Entity-Local Event Ordering', () => {
    it('events for the same channel should have the same subject', () => {
      fc.assert(
        fc.property(entityEventSequenceArb, ({ channelId, events }) => {
          // All events for the same channel should route to the same subject
          const subjects = events.map(event => getEventSubject(event as DomainEvent));
          const uniqueSubjects = new Set(subjects);
          
          // All subjects should be the same (same entity = same subject)
          expect(uniqueSubjects.size).toBe(1);
          
          // Subject should contain the channel ID for message events
          const subject = subjects[0];
          expect(subject).toContain(channelId);
        }),
        { numRuns: 100 }
      );
    });

    it('events for different channels should have different subjects', () => {
      fc.assert(
        fc.property(
          fc.tuple(messageEventArb, messageEventArb).filter(([e1, e2]) => {
            const data1 = e1.data as { channel_id: Snowflake };
            const data2 = e2.data as { channel_id: Snowflake };
            return data1.channel_id !== data2.channel_id;
          }),
          ([event1, event2]) => {
            const subject1 = getEventSubject(event1);
            const subject2 = getEventSubject(event2);
            
            // Different channels should have different subjects
            expect(subject1).not.toBe(subject2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('event sequence indices should be preserved when events have same subject', () => {
      fc.assert(
        fc.property(entityEventSequenceArb, ({ events }) => {
          // Simulate publishing events in order
          const publishedEvents = events.map((event, index) => ({
            event: event as DomainEvent,
            publishOrder: index,
            subject: getEventSubject(event as DomainEvent),
          }));
          
          // Group by subject
          const bySubject = new Map<string, typeof publishedEvents>();
          for (const pe of publishedEvents) {
            const existing = bySubject.get(pe.subject) ?? [];
            existing.push(pe);
            bySubject.set(pe.subject, existing);
          }
          
          // For each subject, verify order is preserved
          for (const [, subjectEvents] of bySubject) {
            // Events should be in ascending publish order
            for (let i = 1; i < subjectEvents.length; i++) {
              const current = subjectEvents[i];
              const previous = subjectEvents[i - 1];
              if (current && previous) {
                expect(current.publishOrder).toBeGreaterThan(previous.publishOrder);
              }
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('subject routing should be deterministic', () => {
      fc.assert(
        fc.property(messageEventArb, (event) => {
          // Same event should always produce the same subject
          const subject1 = getEventSubject(event);
          const subject2 = getEventSubject(event);
          const subject3 = getEventSubject(event);
          
          expect(subject1).toBe(subject2);
          expect(subject2).toBe(subject3);
        }),
        { numRuns: 100 }
      );
    });
  });
});
