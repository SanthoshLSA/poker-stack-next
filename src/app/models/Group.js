import mongoose from 'mongoose';

const memberStatSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: { type: String, required: true },
  avatarColor: { type: String, default: '#c9a84c' },
  sessionsPlayed: { type: Number, default: 0 },
  sessionsWon: { type: Number, default: 0 },
  totalProfit: { type: Number, default: 0 },
  highestWin: { type: Number, default: 0 },
  highestLoss: { type: Number, default: 0 }  // stored negative e.g. -500
}, { _id: false });

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    trim: true,
    maxlength: 200
  },
  inviteCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  memberStats: [memberStatSchema],
  totalSessions: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

export default mongoose.models.Group || mongoose.model('Group', groupSchema);
