/**
 * Permission Cache & Version Consistency Layer (UAM-E9)
 * Tracks user permission / role version stamps to immediately invalidate stale authorizations.
 */

// In-memory version map across requests within the process
const userVersions = new Map<string, number>()

export const PermissionCache = {
  /**
   * Returns current permission version number for a user.
   */
  getUserVersion(userId: string): number {
    return userVersions.get(userId) ?? 1
  },

  /**
   * Bumps user permission version, instantly invalidating cached authorization evaluations.
   */
  bumpUserVersion(userId: string): number {
    const nextVersion = (userVersions.get(userId) ?? 1) + 1
    userVersions.set(userId, nextVersion)
    return nextVersion
  },

  /**
   * Resets or sets an explicit version.
   */
  setUserVersion(userId: string, version: number): void {
    userVersions.set(userId, version)
  },

  /**
   * Clears in-memory version cache.
   */
  clear(): void {
    userVersions.clear()
  },
}
