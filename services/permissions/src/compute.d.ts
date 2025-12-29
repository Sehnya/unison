/**
 * Permission Computation Algorithm
 *
 * Implements the permission evaluation algorithm as specified in the design.
 * Requirements: 7.1, 7.2
 */
import { type ChannelOverwrite, type Role, type Guild } from '@discord-clone/types';
import type { Snowflake } from '@discord-clone/types';
/**
 * Input for permission computation
 */
export interface ComputePermissionsInput {
    userId: Snowflake;
    guild: Pick<Guild, 'id' | 'owner_id'>;
    memberRoles: Role[];
    channelOverwrites: ChannelOverwrite[];
}
/**
 * Compute effective permissions for a user in a channel
 *
 * Algorithm:
 * 1. Guild owner has all permissions
 * 2. Start with @everyone role permissions (role.id === guild.id)
 * 3. OR together all member role permissions
 * 4. If ADMINISTRATOR, return all permissions
 * 5. Apply @everyone channel overwrite (deny then allow)
 * 6. Apply role channel overwrites by position (accumulated deny then allow)
 * 7. Apply member-specific channel overwrite (deny then allow)
 *
 * Requirements: 7.1, 7.2
 */
export declare function computePermissions(input: ComputePermissionsInput): bigint;
/**
 * Check if a user has a specific permission in a channel
 */
export declare function hasChannelPermission(input: ComputePermissionsInput, permission: bigint): boolean;
//# sourceMappingURL=compute.d.ts.map