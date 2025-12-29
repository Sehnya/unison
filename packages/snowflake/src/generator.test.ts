import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { SnowflakeGenerator } from './generator.js';
import { MAX_WORKER_ID } from './constants.js';

describe('SnowflakeGenerator', () => {
  /**
   * Property 13: Snowflake Uniqueness
   * *For any* set of generated Snowflake IDs (across any number of workers and time periods),
   * all IDs SHALL be unique.
   * **Validates: Requirements 14.2**
   */
  describe('Property 13: Snowflake Uniqueness', () => {
    it('generates unique IDs from a single worker', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Number(MAX_WORKER_ID) }),
          fc.integer({ min: 100, max: 1000 }),
          (workerId, count) => {
            const generator = new SnowflakeGenerator(workerId);
            const ids = new Set<string>();

            for (let i = 0; i < count; i++) {
              const id = generator.generate();
              if (ids.has(id)) {
                return false; // Duplicate found
              }
              ids.add(id);
            }

            return ids.size === count;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('generates unique IDs across multiple workers', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: Number(MAX_WORKER_ID) }), { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 10, max: 100 }),
          (workerIds, idsPerWorker) => {
            const uniqueWorkerIds = [...new Set(workerIds)];
            const generators = uniqueWorkerIds.map((id) => new SnowflakeGenerator(id));
            const allIds = new Set<string>();

            for (const generator of generators) {
              for (let i = 0; i < idsPerWorker; i++) {
                const id = generator.generate();
                if (allIds.has(id)) {
                  return false; // Duplicate found
                }
                allIds.add(id);
              }
            }

            return allIds.size === uniqueWorkerIds.length * idsPerWorker;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 14: Snowflake Chronological Ordering
   * *For any* two Snowflake IDs generated at different times,
   * the ID generated later SHALL be numerically greater than the ID generated earlier.
   * **Validates: Requirements 14.3**
   */
  describe('Property 14: Snowflake Chronological Ordering', () => {
    it('generates IDs in chronological order from a single worker', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Number(MAX_WORKER_ID) }),
          fc.integer({ min: 2, max: 100 }),
          (workerId, count) => {
            const generator = new SnowflakeGenerator(workerId);
            const ids: bigint[] = [];

            for (let i = 0; i < count; i++) {
              ids.push(BigInt(generator.generate()));
            }

            // Verify each subsequent ID is greater than the previous
            for (let i = 1; i < ids.length; i++) {
              const current = ids[i];
              const previous = ids[i - 1];
              if (current === undefined || previous === undefined || current <= previous) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
