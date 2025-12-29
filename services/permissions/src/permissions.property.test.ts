/**
 * Property-Based Tests for Permission Computation
 *
 * Feature: discord-clone-core
 * Property 9: Permission Computation Correctness
 * Validates: Requirements 7.1, 7.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Permissions, type Role, type ChannelOverwrite, type Guild } from '@discord-clone/types';
import type { Snowflake } from '@discord-clone/types';
import { computePermissions, type ComputePermissionsInput } from './compute.js';
import { hasPermission, addPermission, removePermission, ALL_PERMISSIONS } from './bitset.js';

// Generators for property-based testing
const snowflakeGen = fc.bigInt({ min: 1n, max: (1n << 63n) - 1n }).map((n) => n.toString());

// Permission bitset generator (using defined permission bits)
const permissionBitsetGen = fc.bigInt({ min: 0n, max: (1n << 11n) - 1n });

// Role generator
const roleGen = (guildId: Snowflake): fc.Arbitrary<Role> =>
  fc.record({
    id: snowflakeGen,
    guild_id: fc.constant(guildId),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    color: fc.option(fc.hexaString({ minLength: 6, maxLength: 6 }).map((s) => `#${s}`), { nil: undefined }),
    position: fc.integer({ min: 0, max: 100 }),
    permissions: permissionBitsetGen,
    created_at: fc.date(),
  });

// Channel overwrite generator
const channelOverwriteGen = (channelId: Snowflake): fc.Arbitrary<ChannelOverwrite> =>
  fc.record({
    channel_id: fc.constant(channelId),
    target_id: snowflakeGen,
    target_type: fc.constantFrom('role' as const, 'member' as const),
    allow: permissionBitsetGen,
    deny: permissionBitsetGen,
  });

// Guild generator
const guildGen: fc.Arbitrary<Pick<Guild, 'id' | 'owner_id'>> = fc.record({
  id: snowflakeGen,
  owner_id: snowflakeGen,
});

describe('Property Tests: Permission Computation', () => {
  /**
   * Property 9: Permission Computation Correctness
   *
   * For any user, channel, and set of roles/overwrites, the computed permissions SHALL equal:
   * 1. Start with @everyone role permissions
   * 2. OR together all member role permissions
   * 3. Apply @everyone channel overwrite (deny then allow)
   * 4. Apply role channel overwrites by position (deny then allow, accumulated)
   * 5. Apply member-specific channel overwrite (deny then allow)
   *
   * Special cases:
   * - Guild owner always has all permissions (~0n)
   * - ADMINISTRATOR permission grants all permissions (~0n)
   *
   * Feature: discord-clone-core, Property 9: Permission Computation Correctness
   * Validates: Requirements 7.1, 7.2
   */
  describe('Property 9: Permission Computation Correctness', () => {
    it('guild owner should always have all permissions', () => {
      fc.assert(
        fc.property(
          snowflakeGen,
          fc.array(roleGen('guild-id'), { minLength: 0, maxLength: 5 }),
          fc.array(channelOverwriteGen('channel-id'), { minLength: 0, maxLength: 5 }),
          (userId, roles, overwrites) => {
            const guild = { id: 'guild-id', owner_id: userId };
            const input: ComputePermissionsInput = {
              userId,
              guild,
              memberRoles: roles,
              channelOverwrites: overwrites,
            };

            const permissions = computePermissions(input);
            expect(permissions).toBe(ALL_PERMISSIONS);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('administrator permission should grant all permissions', () => {
      fc.assert(
        fc.property(
          snowflakeGen,
          snowflakeGen,
          fc.array(channelOverwriteGen('channel-id'), { minLength: 0, maxLength: 5 }),
          (userId, ownerId, overwrites) => {
            // Ensure user is not the owner
            fc.pre(userId !== ownerId);

            const guildId = 'guild-id';
            const guild = { id: guildId, owner_id: ownerId };

            // Create @everyone role with ADMINISTRATOR
            const everyoneRole: Role = {
              id: guildId,
              guild_id: guildId,
              name: '@everyone',
              position: 0,
              permissions: Permissions.ADMINISTRATOR,
              created_at: new Date(),
            };

            const input: ComputePermissionsInput = {
              userId,
              guild,
              memberRoles: [everyoneRole],
              channelOverwrites: overwrites,
            };

            const permissions = computePermissions(input);
            expect(permissions).toBe(ALL_PERMISSIONS);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should start with @everyone role permissions', () => {
      fc.assert(
        fc.property(
          snowflakeGen,
          snowflakeGen,
          permissionBitsetGen,
          (userId, ownerId, everyonePerms) => {
            // Ensure user is not the owner and no admin
            fc.pre(userId !== ownerId);
            fc.pre((everyonePerms & Permissions.ADMINISTRATOR) === 0n);

            const guildId = 'guild-id';
            const guild = { id: guildId, owner_id: ownerId };

            const everyoneRole: Role = {
              id: guildId,
              guild_id: guildId,
              name: '@everyone',
              position: 0,
              permissions: everyonePerms,
              created_at: new Date(),
            };

            const input: ComputePermissionsInput = {
              userId,
              guild,
              memberRoles: [everyoneRole],
              channelOverwrites: [],
            };

            const permissions = computePermissions(input);
            expect(permissions).toBe(everyonePerms);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should OR together all member role permissions', () => {
      fc.assert(
        fc.property(
          snowflakeGen,
          snowflakeGen,
          permissionBitsetGen,
          permissionBitsetGen,
          permissionBitsetGen,
          (userId, ownerId, everyonePerms, role1Perms, role2Perms) => {
            // Ensure user is not the owner and no admin
            fc.pre(userId !== ownerId);
            fc.pre((everyonePerms & Permissions.ADMINISTRATOR) === 0n);
            fc.pre((role1Perms & Permissions.ADMINISTRATOR) === 0n);
            fc.pre((role2Perms & Permissions.ADMINISTRATOR) === 0n);

            const guildId = 'guild-id';
            const guild = { id: guildId, owner_id: ownerId };

            const everyoneRole: Role = {
              id: guildId,
              guild_id: guildId,
              name: '@everyone',
              position: 0,
              permissions: everyonePerms,
              created_at: new Date(),
            };

            const role1: Role = {
              id: 'role-1',
              guild_id: guildId,
              name: 'Role 1',
              position: 1,
              permissions: role1Perms,
              created_at: new Date(),
            };

            const role2: Role = {
              id: 'role-2',
              guild_id: guildId,
              name: 'Role 2',
              position: 2,
              permissions: role2Perms,
              created_at: new Date(),
            };

            const input: ComputePermissionsInput = {
              userId,
              guild,
              memberRoles: [everyoneRole, role1, role2],
              channelOverwrites: [],
            };

            const permissions = computePermissions(input);
            const expected = everyonePerms | role1Perms | role2Perms;
            expect(permissions).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply @everyone channel overwrite (deny then allow)', () => {
      fc.assert(
        fc.property(
          snowflakeGen,
          snowflakeGen,
          permissionBitsetGen,
          permissionBitsetGen,
          permissionBitsetGen,
          (userId, ownerId, everyonePerms, allowBits, denyBits) => {
            // Ensure user is not the owner and no admin
            fc.pre(userId !== ownerId);
            fc.pre((everyonePerms & Permissions.ADMINISTRATOR) === 0n);

            const guildId = 'guild-id';
            const channelId = 'channel-id';
            const guild = { id: guildId, owner_id: ownerId };

            const everyoneRole: Role = {
              id: guildId,
              guild_id: guildId,
              name: '@everyone',
              position: 0,
              permissions: everyonePerms,
              created_at: new Date(),
            };

            const everyoneOverwrite: ChannelOverwrite = {
              channel_id: channelId,
              target_id: guildId,
              target_type: 'role',
              allow: allowBits,
              deny: denyBits,
            };

            const input: ComputePermissionsInput = {
              userId,
              guild,
              memberRoles: [everyoneRole],
              channelOverwrites: [everyoneOverwrite],
            };

            const permissions = computePermissions(input);
            // Apply deny then allow
            const expected = (everyonePerms & ~denyBits) | allowBits;
            expect(permissions).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply member-specific overwrite with highest priority', () => {
      fc.assert(
        fc.property(
          snowflakeGen,
          snowflakeGen,
          permissionBitsetGen,
          permissionBitsetGen,
          permissionBitsetGen,
          (userId, ownerId, everyonePerms, memberAllow, memberDeny) => {
            // Ensure user is not the owner and no admin
            fc.pre(userId !== ownerId);
            fc.pre((everyonePerms & Permissions.ADMINISTRATOR) === 0n);

            const guildId = 'guild-id';
            const channelId = 'channel-id';
            const guild = { id: guildId, owner_id: ownerId };

            const everyoneRole: Role = {
              id: guildId,
              guild_id: guildId,
              name: '@everyone',
              position: 0,
              permissions: everyonePerms,
              created_at: new Date(),
            };

            const memberOverwrite: ChannelOverwrite = {
              channel_id: channelId,
              target_id: userId,
              target_type: 'member',
              allow: memberAllow,
              deny: memberDeny,
            };

            const input: ComputePermissionsInput = {
              userId,
              guild,
              memberRoles: [everyoneRole],
              channelOverwrites: [memberOverwrite],
            };

            const permissions = computePermissions(input);
            // Member overwrite applied last: deny then allow
            const expected = (everyonePerms & ~memberDeny) | memberAllow;
            expect(permissions).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply role overwrites by position order', () => {
      fc.assert(
        fc.property(
          snowflakeGen,
          snowflakeGen,
          (userId, ownerId) => {
            // Ensure user is not the owner
            fc.pre(userId !== ownerId);

            const guildId = 'guild-id';
            const channelId = 'channel-id';
            const guild = { id: guildId, owner_id: ownerId };

            // Start with VIEW_CHANNEL permission
            const everyoneRole: Role = {
              id: guildId,
              guild_id: guildId,
              name: '@everyone',
              position: 0,
              permissions: Permissions.VIEW_CHANNEL,
              created_at: new Date(),
            };

            // Role 1 at position 1 - denies VIEW_CHANNEL
            const role1: Role = {
              id: 'role-1',
              guild_id: guildId,
              name: 'Role 1',
              position: 1,
              permissions: 0n,
              created_at: new Date(),
            };

            // Role 2 at position 2 - allows VIEW_CHANNEL
            const role2: Role = {
              id: 'role-2',
              guild_id: guildId,
              name: 'Role 2',
              position: 2,
              permissions: 0n,
              created_at: new Date(),
            };

            const role1Overwrite: ChannelOverwrite = {
              channel_id: channelId,
              target_id: 'role-1',
              target_type: 'role',
              allow: 0n,
              deny: Permissions.VIEW_CHANNEL,
            };

            const role2Overwrite: ChannelOverwrite = {
              channel_id: channelId,
              target_id: 'role-2',
              target_type: 'role',
              allow: Permissions.VIEW_CHANNEL,
              deny: 0n,
            };

            const input: ComputePermissionsInput = {
              userId,
              guild,
              memberRoles: [everyoneRole, role1, role2],
              channelOverwrites: [role1Overwrite, role2Overwrite],
            };

            const permissions = computePermissions(input);
            // Role overwrites are accumulated: allow |= all allows, deny |= all denies
            // Then applied: (base & ~deny) | allow
            // So VIEW_CHANNEL should be present because allow includes it
            expect(hasPermission(permissions, Permissions.VIEW_CHANNEL)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty roles and overwrites', () => {
      fc.assert(
        fc.property(snowflakeGen, snowflakeGen, (userId, ownerId) => {
          // Ensure user is not the owner
          fc.pre(userId !== ownerId);

          const guild = { id: 'guild-id', owner_id: ownerId };

          const input: ComputePermissionsInput = {
            userId,
            guild,
            memberRoles: [],
            channelOverwrites: [],
          };

          const permissions = computePermissions(input);
          // No roles means no permissions
          expect(permissions).toBe(0n);
        }),
        { numRuns: 100 }
      );
    });
  });
});

describe('Property Tests: Bitset Operations', () => {
  it('hasPermission should return true for set bits', () => {
    fc.assert(
      fc.property(permissionBitsetGen, (permissions) => {
        // For each permission that is set, hasPermission should return true
        for (const [, flag] of Object.entries(Permissions)) {
          if ((permissions & flag) === flag) {
            expect(hasPermission(permissions, flag)).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('addPermission should set the bit', () => {
    fc.assert(
      fc.property(permissionBitsetGen, permissionBitsetGen, (base, toAdd) => {
        const result = addPermission(base, toAdd);
        expect((result & toAdd) === toAdd).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('removePermission should clear the bit', () => {
    fc.assert(
      fc.property(permissionBitsetGen, permissionBitsetGen, (base, toRemove) => {
        const result = removePermission(base, toRemove);
        expect((result & toRemove) === 0n).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('addPermission then removePermission should be idempotent for the removed bits', () => {
    fc.assert(
      fc.property(permissionBitsetGen, permissionBitsetGen, (base, permission) => {
        const added = addPermission(base, permission);
        const removed = removePermission(added, permission);
        // The removed bits should not be present
        expect((removed & permission) === 0n).toBe(true);
        // Original bits that weren't in permission should still be there
        expect((removed & (base & ~permission)) === (base & ~permission)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('ADMINISTRATOR should grant all permissions via hasPermission', () => {
    fc.assert(
      fc.property(permissionBitsetGen, (permission) => {
        const adminPerms = Permissions.ADMINISTRATOR;
        expect(hasPermission(adminPerms, permission)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
