import User from '../models/User.js';

/**
 * Migration helper to ensure existing users created prior to the email verification
 * requirement are not locked out.
 *
 * Marks all accounts with `emailVerified: false` (or missing) created before this migration as verified.
 */
export const migrateLegacyUsers = async () => {
  try {
    const result = await User.updateMany(
      {
        $or: [
          { emailVerified: { $exists: false } },
          { emailVerified: null },
          // Any user whose verificationTokenHash was never set (i.e. created pre-verification)
          { emailVerified: false, verificationTokenHash: null },
        ],
      },
      {
        $set: {
          emailVerified: true,
          verificationTokenHash: null,
          verificationTokenExpires: null,
        },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[Migration] Migrated ${result.modifiedCount} legacy user accounts to emailVerified: true.`);
    }
    return result;
  } catch (error) {
    console.error('[Migration] Failed to migrate legacy user email verification status:', error.message);
    return null;
  }
};

export default migrateLegacyUsers;
