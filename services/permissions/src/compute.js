/**
 * Permission Computation Algorithm
 *
 * Implements the permission evaluation algorithm as specified in the design.
 * Requirements: 7.1, 7.2
 */
import { Permissions } from '@discord-clone/types';
import { ALL_PERMISSIONS } from './bitset.js';
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
export function computePermissions(input) {
    const { userId, guild, memberRoles, channelOverwrites } = input;
    // Guild owner has all permissions
    if (guild.owner_id === userId) {
        return ALL_PERMISSIONS;
    }
    // Start with @everyone role permissions
    const everyoneRole = memberRoles.find((r) => r.id === guild.id);
    let permissions = everyoneRole?.permissions ?? 0n;
    // Apply role permissions (OR together)
    for (const role of memberRoles) {
        if (role.id !== guild.id) {
            permissions |= role.permissions;
        }
    }
    // Administrator bypasses all overwrites
    if ((permissions & Permissions.ADMINISTRATOR) !== 0n) {
        return ALL_PERMISSIONS;
    }
    // Apply channel overwrites
    // 1. @everyone role overwrite
    const everyoneOverwrite = channelOverwrites.find((o) => o.target_id === guild.id && o.target_type === 'role');
    if (everyoneOverwrite) {
        permissions &= ~everyoneOverwrite.deny;
        permissions |= everyoneOverwrite.allow;
    }
    // 2. Role overwrites (by position, lowest first)
    // Get role overwrites that apply to the member's roles
    const roleOverwrites = channelOverwrites
        .filter((o) => o.target_type === 'role' &&
        o.target_id !== guild.id && // Exclude @everyone, already handled
        memberRoles.some((r) => r.id === o.target_id))
        .sort((a, b) => {
        const roleA = memberRoles.find((r) => r.id === a.target_id);
        const roleB = memberRoles.find((r) => r.id === b.target_id);
        return (roleA?.position ?? 0) - (roleB?.position ?? 0);
    });
    // Accumulate allow and deny from role overwrites
    let allow = 0n;
    let deny = 0n;
    for (const overwrite of roleOverwrites) {
        allow |= overwrite.allow;
        deny |= overwrite.deny;
    }
    permissions &= ~deny;
    permissions |= allow;
    // 3. Member-specific overwrite (highest priority)
    const memberOverwrite = channelOverwrites.find((o) => o.target_id === userId && o.target_type === 'member');
    if (memberOverwrite) {
        permissions &= ~memberOverwrite.deny;
        permissions |= memberOverwrite.allow;
    }
    return permissions;
}
/**
 * Check if a user has a specific permission in a channel
 */
export function hasChannelPermission(input, permission) {
    const permissions = computePermissions(input);
    return (permissions & permission) === permission;
}
//# sourceMappingURL=compute.js.map