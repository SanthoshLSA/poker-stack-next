import mongoose from 'mongoose';

const challengeSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionDate: {
    type: Date,
    default: Date.now
  },
  profit: {
    type: Number,
    required: true
  },
  buyIn: {
    type: Number,
    default: 500
  },
  cashOut: {
    type: Number,
    default: 0
  },
  note: {
    type: String,
    default: ''
  },
  linkedSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    default: null
  }
}, { timestamps: true });

export default mongoose.models.ChallengeSession || mongoose.model('ChallengeSession', challengeSessionSchema);
