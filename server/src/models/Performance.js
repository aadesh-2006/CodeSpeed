import mongoose from 'mongoose';

export const SUPPORTED_LANGUAGES = [
  'javascript',
  'python',
  'java',
  'cpp',
  'c',
  'html',
  'css',
  'sql',
];

export const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'];

export const VALID_TIMERS = [30, 60, 120, 180, 240, 300, 600];

export const PERFORMANCE_MODES = ['practice', 'ranked'];

const performanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    mode: {
      type: String,
      required: [true, 'Performance mode is required'],
      enum: {
        values: PERFORMANCE_MODES,
        message: '{VALUE} is not a valid performance mode',
      },
      default: 'practice',
      lowercase: true,
      trim: true,
      index: true,
    },
    language: {
      type: String,
      required: [true, 'Programming language is required'],
      enum: {
        values: SUPPORTED_LANGUAGES,
        message: '{VALUE} is not a supported programming language',
      },
      lowercase: true,
      trim: true,
    },
    difficulty: {
      type: String,
      required: [true, 'Difficulty level is required'],
      enum: {
        values: DIFFICULTY_LEVELS,
        message: '{VALUE} is not a valid difficulty level',
      },
      lowercase: true,
      trim: true,
    },
    timerSeconds: {
      type: Number,
      required: [true, 'Timer duration is required'],
      enum: {
        values: VALID_TIMERS,
        message: '{VALUE} is not a valid timer duration',
      },
    },
    wpm: {
      type: Number,
      required: [true, 'WPM is required'],
      min: [0, 'WPM cannot be negative'],
    },
    accuracy: {
      type: Number,
      required: [true, 'Accuracy percentage is required'],
      min: [0, 'Accuracy cannot be less than 0%'],
      max: [100, 'Accuracy cannot exceed 100%'],
    },
    correctChars: {
      type: Number,
      required: [true, 'Correct characters count is required'],
      min: [0, 'Correct characters cannot be negative'],
    },
    incorrectChars: {
      type: Number,
      required: [true, 'Incorrect characters count is required'],
      min: [0, 'Incorrect characters cannot be negative'],
    },
    elapsedSeconds: {
      type: Number,
      required: [true, 'Elapsed seconds is required'],
      min: [0, 'Elapsed seconds cannot be negative'],
    },
    snippetId: {
      type: String,
      required: [true, 'Snippet ID is required'],
      trim: true,
    },
    createdAt: {
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

// Compound indexes for mode-filtered queries
performanceSchema.index({ userId: 1, mode: 1, createdAt: -1 });
performanceSchema.index({ userId: 1, mode: 1, createdAt: 1 });

export const Performance = mongoose.model('Performance', performanceSchema);
export default Performance;
