/**
 * KS Bot - Roblox Group Verification
 * 
 * Handles verification of Roblox group ownership by checking group description
 * for a unique verification code.
 */

const db = require('../../data/db_handler');
const robloxAPI = require('./roblox_api');
const encryption = require('./encryption');
const { PATHS } = require('../../shared/constants');
const { roblox: logger } = require('../../shared/utils/logger');

class RobloxVerification {
  /**
   * Get all pending verifications
   * @returns {Promise<Object>}
   */
  async getAllVerifications() {
    try {
      const verifications = await db.read(PATHS.ROBLOX.VERIFICATIONS);
      return verifications || {};
    } catch (error) {
      logger.error('Failed to read verifications', { error });
      return {};
    }
  }

  /**
   * Get verification for a server
   * @param {string} serverId - Discord server ID
   * @returns {Promise<Object|null>}
   */
  async getVerification(serverId) {
    try {
      const verifications = await this.getAllVerifications();
      return verifications[serverId] || null;
    } catch (error) {
      logger.error('Failed to get verification', { serverId, error });
      return null;
    }
  }

  /**
   * Start verification process
   * @param {string} serverId - Discord server ID
   * @param {string} groupId - Roblox group ID
   * @param {string} userId - Discord user ID who initiated
   * @returns {Promise<Object>}
   */
  async startVerification(serverId, groupId, userId) {
    try {
      // Generate verification code
      const code = this.generateVerificationCode();
      const formattedCode = `KS_VERIFY_${code}`;

      // Get group info to verify it exists
      const groupInfo = await robloxAPI.getGroupInfo(groupId);

      if (!groupInfo) {
        throw new Error('Group not found');
      }

      const verification = {
        serverId,
        groupId,
        groupName: groupInfo.name,
        code: formattedCode,
        initiatedBy: userId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        verified: false,
        attempts: 0,
        maxAttempts: 5
      };

      // Save verification
      await db.modify(PATHS.ROBLOX.VERIFICATIONS, (verifications) => {
        verifications[serverId] = verification;
        return verifications;
      });

      logger.info('Verification started', { serverId, groupId, code: formattedCode });

      return verification;
    } catch (error) {
      logger.error('Failed to start verification', { serverId, groupId, error });
      throw error;
    }
  }

  /**
   * Check verification status
   * @param {string} serverId - Discord server ID
   * @returns {Promise<Object>}
   */
  async checkVerification(serverId) {
    try {
      const verification = await this.getVerification(serverId);

      if (!verification) {
        return {
          success: false,
          error: 'No verification in progress'
        };
      }

      // Check if expired
      if (new Date() > new Date(verification.expiresAt)) {
        await this.cancelVerification(serverId);
        return {
          success: false,
          error: 'Verification expired'
        };
      }

      // Check if max attempts reached
      if (verification.attempts >= verification.maxAttempts) {
        await this.cancelVerification(serverId);
        return {
          success: false,
          error: 'Maximum verification attempts reached'
        };
      }

      // Increment attempts
      verification.attempts++;
      await this.updateVerification(serverId, { attempts: verification.attempts });

      // Get current group description
      const description = await robloxAPI.getGroupDescription(verification.groupId);

      // Check if verification code is present
      if (description.includes(verification.code)) {
        // Verification successful!
        await this.completeVerification(serverId);

        logger.verification(serverId, verification.groupId, true);

        return {
          success: true,
          message: 'Group ownership verified successfully!'
        };
      }

      return {
        success: false,
        error: 'Verification code not found in group description',
        attemptsRemaining: verification.maxAttempts - verification.attempts
      };
    } catch (error) {
      logger.error('Failed to check verification', { serverId, error });
      return {
        success: false,
        error: 'Failed to verify group ownership'
      };
    }
  }

  /**
   * Complete verification
   * @param {string} serverId - Discord server ID
   * @returns {Promise<void>}
   */
  async completeVerification(serverId) {
    try {
      await db.modify(PATHS.ROBLOX.VERIFICATIONS, (verifications) => {
        if (verifications[serverId]) {
          verifications[serverId].verified = true;
          verifications[serverId].verifiedAt = new Date().toISOString();
        }
        return verifications;
      });

      logger.info('Verification completed', { serverId });
    } catch (error) {
      logger.error('Failed to complete verification', { serverId, error });
      throw error;
    }
  }

  /**
   * Update verification data
   * @param {string} serverId - Discord server ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<void>}
   */
  async updateVerification(serverId, updates) {
    try {
      await db.modify(PATHS.ROBLOX.VERIFICATIONS, (verifications) => {
        if (verifications[serverId]) {
          verifications[serverId] = {
            ...verifications[serverId],
            ...updates
          };
        }
        return verifications;
      });
    } catch (error) {
      logger.error('Failed to update verification', { serverId, error });
      throw error;
    }
  }

  /**
   * Cancel verification
   * @param {string} serverId - Discord server ID
   * @returns {Promise<void>}
   */
  async cancelVerification(serverId) {
    try {
      await db.modify(PATHS.ROBLOX.VERIFICATIONS, (verifications) => {
        delete verifications[serverId];
        return verifications;
      });

      logger.info('Verification cancelled', { serverId });
    } catch (error) {
      logger.error('Failed to cancel verification', { serverId, error });
      throw error;
    }
  }

  /**
   * Clean expired verifications
   * @returns {Promise<number>} Number of cleaned verifications
   */
  async cleanExpiredVerifications() {
    try {
      let cleanedCount = 0;
      const now = new Date();

      await db.modify(PATHS.ROBLOX.VERIFICATIONS, (verifications) => {
        const entries = Object.entries(verifications);

        for (const [serverId, verification] of entries) {
          if (new Date(verification.expiresAt) < now) {
            delete verifications[serverId];
            cleanedCount++;
          }
        }

        return verifications;
      });

      if (cleanedCount > 0) {
        logger.info('Cleaned expired verifications', { count: cleanedCount });
      }

      return cleanedCount;
    } catch (error) {
      logger.error('Failed to clean expired verifications', { error });
      return 0;
    }
  }

  /**
   * Generate verification code
   * @returns {string}
   */
  generateVerificationCode() {
    return encryption.generateVerificationCode(8);
  }

  /**
   * Get verification instructions
   * @param {Object} verification - Verification object
   * @returns {string}
   */
  getVerificationInstructions(verification) {
    return `
**Group Verification Instructions:**

1. Go to your Roblox group: https://www.roblox.com/groups/${verification.groupId}
2. Click "Configure Group" (you must be the group owner)
3. Add the following code **anywhere** in your group description:

\`\`\`
${verification.code}
\`\`\`

4. Save the description
5. Return to Discord and click "Verify" to complete the process

**Important Notes:**
- You can remove the code after verification is complete
- The code expires in 10 minutes
- You have ${verification.maxAttempts} verification attempts
- Only the group owner can complete this verification
    `.trim();
  }

  /**
   * Verify user owns the group
   * @param {string} groupId - Roblox group ID
   * @param {string} userId - Roblox user ID to check
   * @returns {Promise<boolean>}
   */
  async verifyGroupOwnership(groupId, userId) {
    try {
      const groupInfo = await robloxAPI.getGroupInfo(groupId);

      if (!groupInfo) {
        return false;
      }

      // Check if user is the group owner
      return groupInfo.owner && groupInfo.owner.userId.toString() === userId.toString();
    } catch (error) {
      logger.error('Failed to verify group ownership', { groupId, userId, error });
      return false;
    }
  }

  /**
   * Get group ownership info
   * @param {string} groupId - Roblox group ID
   * @returns {Promise<Object|null>}
   */
  async getGroupOwnerInfo(groupId) {
    try {
      const groupInfo = await robloxAPI.getGroupInfo(groupId);

      if (!groupInfo || !groupInfo.owner) {
        return null;
      }

      return {
        userId: groupInfo.owner.userId,
        username: groupInfo.owner.username,
        displayName: groupInfo.owner.displayName
      };
    } catch (error) {
      logger.error('Failed to get group owner info', { groupId, error });
      return null;
    }
  }

  /**
   * Validate group for linking
   * @param {string} groupId - Roblox group ID
   * @returns {Promise<Object>}
   */
  async validateGroup(groupId) {
    try {
      const groupInfo = await robloxAPI.getGroupInfo(groupId);

      if (!groupInfo) {
        return {
          valid: false,
          error: 'Group not found'
        };
      }

      if (!groupInfo.owner) {
        return {
          valid: false,
          error: 'Group has no owner'
        };
      }

      if (groupInfo.isLocked) {
        return {
          valid: false,
          error: 'Group is locked'
        };
      }

      return {
        valid: true,
        groupInfo: {
          id: groupInfo.id,
          name: groupInfo.name,
          description: groupInfo.description,
          memberCount: groupInfo.memberCount,
          owner: groupInfo.owner,
          isPublic: groupInfo.publicEntryAllowed
        }
      };
    } catch (error) {
      logger.error('Failed to validate group', { groupId, error });
      return {
        valid: false,
        error: 'Failed to validate group'
      };
    }
  }

  /**
   * Check if group description can be modified
   * @param {string} groupId - Roblox group ID
   * @returns {Promise<boolean>}
   */
  async canModifyDescription(groupId) {
    try {
      // Try to get current description
      const description = await robloxAPI.getGroupDescription(groupId);
      
      // If we can read it with auth, we should be able to modify it
      return description !== null;
    } catch (error) {
      logger.error('Failed to check description permissions', { groupId, error });
      return false;
    }
  }

  /**
   * Get verification status for display
   * @param {string} serverId - Discord server ID
   * @returns {Promise<Object>}
   */
  async getVerificationStatus(serverId) {
    try {
      const verification = await this.getVerification(serverId);

      if (!verification) {
        return {
          active: false,
          status: 'No verification in progress'
        };
      }

      const now = new Date();
      const expiresAt = new Date(verification.expiresAt);
      const timeRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000));

      return {
        active: true,
        verified: verification.verified,
        groupId: verification.groupId,
        groupName: verification.groupName,
        code: verification.code,
        attempts: verification.attempts,
        maxAttempts: verification.maxAttempts,
        attemptsRemaining: verification.maxAttempts - verification.attempts,
        timeRemaining, // seconds
        expired: timeRemaining === 0,
        createdAt: verification.createdAt
      };
    } catch (error) {
      logger.error('Failed to get verification status', { serverId, error });
      return {
        active: false,
        status: 'Error retrieving verification status'
      };
    }
  }

  /**
   * Resend verification instructions
   * @param {string} serverId - Discord server ID
   * @returns {Promise<Object>}
   */
  async resendInstructions(serverId) {
    try {
      const verification = await this.getVerification(serverId);

      if (!verification) {
        return {
          success: false,
          error: 'No verification in progress'
        };
      }

      if (verification.verified) {
        return {
          success: false,
          error: 'Group is already verified'
        };
      }

      // Check if expired
      if (new Date() > new Date(verification.expiresAt)) {
        await this.cancelVerification(serverId);
        return {
          success: false,
          error: 'Verification expired. Please start a new verification.'
        };
      }

      return {
        success: true,
        verification,
        instructions: this.getVerificationInstructions(verification)
      };
    } catch (error) {
      logger.error('Failed to resend instructions', { serverId, error });
      return {
        success: false,
        error: 'Failed to resend instructions'
      };
    }
  }

  /**
   * Extend verification time
   * @param {string} serverId - Discord server ID
   * @param {number} additionalMinutes - Minutes to add
   * @returns {Promise<Object>}
   */
  async extendVerification(serverId, additionalMinutes = 10) {
    try {
      const verification = await this.getVerification(serverId);

      if (!verification) {
        return {
          success: false,
          error: 'No verification in progress'
        };
      }

      if (verification.verified) {
        return {
          success: false,
          error: 'Group is already verified'
        };
      }

      const newExpiresAt = new Date(Date.now() + additionalMinutes * 60 * 1000);

      await this.updateVerification(serverId, {
        expiresAt: newExpiresAt.toISOString()
      });

      logger.info('Verification extended', { serverId, additionalMinutes });

      return {
        success: true,
        newExpiresAt: newExpiresAt.toISOString()
      };
    } catch (error) {
      logger.error('Failed to extend verification', { serverId, error });
      return {
        success: false,
        error: 'Failed to extend verification time'
      };
    }
  }
}

// Export singleton instance
module.exports = new RobloxVerification();