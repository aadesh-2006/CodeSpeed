import mongoose from 'mongoose';
import Performance from '../src/models/Performance.js';

/**
 * One-time idempotent migration function to normalize legacy M0–M8 performance records.
 * Classifies all existing records missing a `mode` field as 'practice'.
 *
 * @param {typeof mongoose} mongooseInstance
 * @returns {Promise<{ matchedCount: number, modifiedCount: number }>}
 */
export async function migrateModes(mongooseInstance = mongoose) {
  const query = { mode: { $exists: false } };
  const countToMigrate = await Performance.countDocuments(query);

  if (countToMigrate === 0) {
    console.log('[Migration] No legacy records without mode found. Database is already up to date.');
    return { matchedCount: 0, modifiedCount: 0 };
  }

  const result = await Performance.updateMany(query, { $set: { mode: 'practice' } });
  console.log(`[Migration] Successfully migrated ${result.modifiedCount} legacy records to 'practice' mode.`);
  return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
}

// Standalone execution entry point
async function runStandalone() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/codespeed';
  console.log(`[Migration] Connecting to MongoDB: ${mongoUri}`);
  try {
    await mongoose.connect(mongoUri);
    await migrateModes(mongoose);
  } catch (err) {
    console.error('[Migration] Failed to execute migration script:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[Migration] Database connection closed.');
  }
}

// Check if run directly from CLI
if (process.argv[1] && process.argv[1].endsWith('migrate-modes.js')) {
  runStandalone();
}
