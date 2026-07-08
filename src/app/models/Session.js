import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['buyin', 'rebuy', 'player_transfer'],
    required: true
  },
  fromType: {
    type: String,
    enum: ['bank', 'player'],
    required: true
  },
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  fromUsername: {
    type: String,
    default: 'Bank'
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUsername: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  note: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const playerInSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  avatarColor: {
    type: String,
    default: '#c9a84c'
  },
  totalBuyIn: {
    type: Number,
    default: 0
  },
  finalStack: {
    type: Number,
    default: null
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
});

const sessionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },
  roomCode: {
    type: String,
    required: true,
    index: true,
    uppercase: true
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  adminUsername: {
    type: String,
    required: true
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null
  },
  initialBank: {
    type: Number,
    required: true,
    min: 1
  },
  currentBank: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active'
  },
  players: [playerInSessionSchema],
  transactions: [transactionSchema],
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

sessionSchema.virtual('totalInPlay').get(function() {
  return this.players.reduce((sum, p) => sum + p.totalBuyIn, 0) + this.currentBank;
});

export default mongoose.models.Session || mongoose.model('Session', sessionSchema);