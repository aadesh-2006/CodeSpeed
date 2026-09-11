import mongoose from 'mongoose';
import { SUPPORTED_LANGUAGES, DIFFICULTY_LEVELS, VALID_TIMERS } from './Performance.js';

export const ROOM_STATUSES = ['waiting', 'countdown', 'active', 'finished', 'cancelled'];
export const PARTICIPANT_STATUSES = ['joined', 'racing', 'finished', 'abandoned'];

const participantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
    },
    profilePhoto: {
      type: String,
      default: null,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: PARTICIPANT_STATUSES,
      default: 'joined',
    },
    progressPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    liveWpm: {
      type: Number,
      default: 0,
      min: 0,
    },
    wpm: {
      type: Number,
      default: 0,
      min: 0,
    },
    accuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    elapsedSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    rank: {
      type: Number,
      default: null,
    },
    completedSnippet: {
      type: Boolean,
      default: false,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const competitionRoomSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: [true, 'Room code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Host User ID is required'],
      index: true,
    },
    hostUsername: {
      type: String,
      required: [true, 'Host username is required'],
      trim: true,
    },
    config: {
      language: {
        type: String,
        required: [true, 'Language is required'],
        enum: SUPPORTED_LANGUAGES,
        lowercase: true,
        trim: true,
      },
      difficulty: {
        type: String,
        required: [true, 'Difficulty is required'],
        enum: DIFFICULTY_LEVELS,
        lowercase: true,
        trim: true,
      },
      timerSeconds: {
        type: Number,
        required: [true, 'Timer duration is required'],
        enum: VALID_TIMERS,
      },
    },
    snippet: {
      id: { type: String, required: true },
      title: { type: String, required: true },
      language: { type: String, required: true },
      difficulty: { type: String, required: true },
      code: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ROOM_STATUSES,
      default: 'waiting',
      index: true,
    },
    participants: [participantSchema],
    countdownStartsAt: {
      type: Date,
      default: null,
    },
    raceStartsAt: {
      type: Date,
      default: null,
    },
    raceEndsAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
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

competitionRoomSchema.index({ status: 1, createdAt: -1 });

export const CompetitionRoom = mongoose.model('CompetitionRoom', competitionRoomSchema);
export default CompetitionRoom;
