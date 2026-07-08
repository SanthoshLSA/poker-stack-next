import mongoose from 'mongoose';

const playerResultSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  sessionName: {
    type: String,
    required: true
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null
  },
  buyIn: {
    type: Number,
    required: true
  },
  cashOut: {
    type: Number,
    required: true
  },
  profit: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export default mongoose.models.PlayerResult || mongoose.model('PlayerResult', playerResultSchema);
