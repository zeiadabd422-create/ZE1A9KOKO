import mongoose from 'mongoose';

// Collection to persist jobs that need to run at a future time (e.g. timed auto roles)
const TimedJobSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    jobType: { type: String, required: true },
    runAt: { type: Date, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
    // optional fields for bookkeeping
    completed: { type: Boolean, default: false },
    result: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: false }
);

export default mongoose.model('TimedJob', TimedJobSchema);
