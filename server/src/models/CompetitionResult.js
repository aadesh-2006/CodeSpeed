import mongoose from 'mongoose';

const competitionResultSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: [true, 'Room code is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompetitionRoom',
      required: [true, 'Room ID is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
    },
    wpm: {
      type: Number,
      required: [true, 'WPM is required'],
      min: 0,
    },
    accuracy: {
      type: Number,
      required: [true, 'Accuracy is required'],
      min: 0,
      max: 100,
    },
    completionTimeSeconds: {
      type: Number,
      required: [true, 'Completion time in seconds is required'],
      min: 0,
    },
    rank: {
      type: Number,
      required: [true, 'Rank is required'],
      min: 1,
    },
    completedSnippet: {
      type: Boolean,
      default: false,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : undefined;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

competitionResultSchema.index({ roomCode: 1, rank: 1 });
competitionResultSchema.index({ userId: 1, submittedAt: -1 });

export const CompetitionResult = mongoose.model('CompetitionResult', competitionResultSchema);
export default CompetitionResult;
