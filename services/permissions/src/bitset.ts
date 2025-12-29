/**
 * Permission Bitset Utilities
 *
 * Provides bitwise operations for permission management.
 * Requirements: 7.1, 7.2
 */

import { Permissions } from '@discord-clone/types';

/**
 * Check if a permission bitset has a specific permission
 */
export function hasPermission(permissions: bigint, permission: bigint): boolean {
  // Administrator has all permissions
  if ((permissions & Permissions.ADMINISTRATOR) !== 0n) {
    return true;
  }
  return (permissions & permission) === permission;
}

/**
 * Check if a permission bitset has any of the specified permissions
 */
export function hasAnyPermission(permissions: bigint, ...permissionFlags: bigint[]): boolean {
  if ((permissions & Permissions.ADMINISTRATOR) !== 0n) {
    return true;
  }
  for (const flag of permissionFlags) {
    if ((permissions & flag) === flag) {
      return true;
    }
  }
  return false;
}

/**
 * Add a permission to a bitset
 */
export function addPermission(permissions: bigint, permission: bigint): bigint {
  return permissions | permission;
}

/**
 * Remove a permission from a bitset
 */
export function removePermission(permissions: bigint, permission: bigint): bigint {
  return permissions & ~permission;
}

/**
 * Toggle a permission in a bitset
 */
export function togglePermission(permissions: bigint, permission: bigint): bigint {
  return permissions ^ permission;
}

/**
 * Combine multiple permission bitsets (OR operation)
 */
export function combinePermissions(...permissionSets: bigint[]): bigint {
  return permissionSets.reduce((acc, p) => acc | p, 0n);
}

/**
 * Get the intersection of permission bitsets (AND operation)
 */
export function intersectPermissions(...permissionSets: bigint[]): bigint {
  if (permissionSets.length === 0) return 0n;
  return permissionSets.reduce((acc, p) => acc & p);
}

/**
 * All permissions constant (all bits set)
 */
export const ALL_PERMISSIONS = ~0n;

/**
 * No permissions constant
 */
export const NO_PERMISSIONS = 0n;
