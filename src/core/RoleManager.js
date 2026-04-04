/**
 * RoleManager - Manages role assignment on verification success/failure
 * Handles role assignments, removals, and temporary roles
 */
export class RoleManager {
  constructor(client) {
    this.client = client;
    this.temporaryRoles = new Map(); // userId -> { roleId, expiresAt }
  }

  /**
   * Assign role on verification success
   */
  async assignSuccessRole(member, roleId) {
    if (!roleId) {
      return { success: false, reason: 'No success role configured' };
    }

    try {
      const role = await member.guild.roles.fetch(roleId);
      if (!role) {
        return { success: false, reason: 'Success role not found' };
      }

      await member.roles.add(role, 'Verification successful');
      return { success: true, role };
    } catch (error) {
      console.error(`[RoleManager] Failed to assign success role:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Assign role on verification failure
   */
  async assignFailureRole(member, roleId) {
    if (!roleId) {
      return { success: false, reason: 'No failure role configured' };
    }

    try {
      const role = await member.guild.roles.fetch(roleId);
      if (!role) {
        return { success: false, reason: 'Failure role not found' };
      }

      await member.roles.add(role, 'Verification failed');
      return { success: true, role };
    } catch (error) {
      console.error(`[RoleManager] Failed to assign failure role:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove role from member
   */
  async removeRole(member, roleId) {
    if (!roleId) {
      return { success: false, reason: 'No role specified' };
    }

    try {
      const role = await member.guild.roles.fetch(roleId);
      if (!role) {
        return { success: false, reason: 'Role not found' };
      }

      await member.roles.remove(role, 'Role removal via verification system');
      return { success: true, role };
    } catch (error) {
      console.error(`[RoleManager] Failed to remove role:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Assign temporary role (auto-remove after time)
   */
  async assignTemporaryRole(member, roleId, durationMs = 24 * 60 * 60 * 1000) {
    const result = await this.assignSuccessRole(member, roleId);

    if (result.success) {
      const expiresAt = Date.now() + durationMs;

      this.temporaryRoles.set(`${member.id}:${roleId}`, {
        memberId: member.id,
        roleId,
        guildId: member.guild.id,
        expiresAt,
      });

      // Setup removal timeout
      this.setupRoleRemovalTimeout(`${member.id}:${roleId}`, member.guild.id, durationMs);
    }

    return result;
  }

  /**
   * Setup timeout for temporary role removal
   */
  setupRoleRemovalTimeout(key, guildId, durationMs) {
    setTimeout(async () => {
      const roleData = this.temporaryRoles.get(key);
      if (!roleData) return;

      try {
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return;

        const member = await guild.members.fetch(roleData.memberId).catch(() => null);
        if (!member) return;

        await this.removeRole(member, roleData.roleId);
        console.log(
          `[RoleManager] Removed temporary role ${roleData.roleId} from ${member.user.tag}`
        );

        this.temporaryRoles.delete(key);
      } catch (error) {
        console.error(`[RoleManager] Failed to remove temporary role:`, error);
        this.temporaryRoles.delete(key);
      }
    }, durationMs);
  }

  /**
   * Check if member has role
   */
  async hasMemberRole(member, roleId) {
    try {
      const role = await member.guild.roles.fetch(roleId);
      return member.roles.cache.has(roleId);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all member roles
   */
  getMemberRoles(member) {
    return Array.from(member.roles.cache.values()).map(role => ({
      id: role.id,
      name: role.name,
      color: role.color,
    }));
  }

  /**
   * Cleanup expired temporary roles
   */
  async cleanupExpiredRoles() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, roleData] of this.temporaryRoles.entries()) {
      if (now >= roleData.expiresAt) {
        try {
          const guild = this.client.guilds.cache.get(roleData.guildId);
          if (guild) {
            const member = await guild.members.fetch(roleData.memberId).catch(() => null);
            if (member) {
              await this.removeRole(member, roleData.roleId);
              cleaned++;
            }
          }

          this.temporaryRoles.delete(key);
        } catch (error) {
          console.error(`[RoleManager] Cleanup error:`, error);
          this.temporaryRoles.delete(key);
        }
      }
    }

    return cleaned;
  }

  /**
   * Get temporary role info
   */
  getTemporaryRoleInfo(key) {
    const roleData = this.temporaryRoles.get(key);
    if (!roleData) return null;

    return {
      ...roleData,
      expiresIn: Math.max(0, roleData.expiresAt - Date.now()),
      expiresInMinutes: Math.ceil(Math.max(0, roleData.expiresAt - Date.now()) / 60000),
    };
  }

  /**
   * Get all active temporary roles
   */
  getAllTemporaryRoles() {
    return Array.from(this.temporaryRoles.entries()).map(([key, data]) => ({
      key,
      ...data,
      expiresInMinutes: Math.ceil(Math.max(0, data.expiresAt - Date.now()) / 60000),
    }));
  }

  /**
   * Clear all temporary roles (for testing)
   */
  clearTemporaryRoles() {
    this.temporaryRoles.clear();
  }
}
