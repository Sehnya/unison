/**
 * Permission Bitset Utilities
 *
 * Provides bitwise operations for permission management.
 * Requirements: 7.1, 7.2
 */
/**
 * Check if a permission bitset has a specific permission
 */
export declare function hasPermission(permissions: bigint, permission: bigint): boolean;
/**
 * Check if a permission bitset has any of the specified permissions
 */
export declare function hasAnyPermission(permissions: bigint, ...permissionFlags: bigint[]): boolean;
/**
 * Add a permission to a bitset
 */
export declare function addPermission(permissions: bigint, permission: bigint): bigint;
/**
 * Remove a permission from a bitset
 */
export declare function removePermission(permissions: bigint, permission: bigint): bigint;
/**
 * Toggle a permission in a bitset
 */
export declare function togglePermission(permissions: bigint, permission: bigint): bigint;
/**
 * Combine multiple permission bitsets (OR operation)
 */
export declare function combinePermissions(...permissionSets: bigint[]): bigint;
/**
 * Get the intersection of permission bitsets (AND operation)
 */
export declare function intersectPermissions(...permissionSets: bigint[]): bigint;
/**
 * All permissions constant (all bits set)
 */
export declare const ALL_PERMISSIONS: bigint;
/**
 * No permissions constant
 */
export declare const NO_PERMISSIONS = 0n;
//# sourceMappingURL=bitset.d.ts.map