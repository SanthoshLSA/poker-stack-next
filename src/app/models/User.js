import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  passwordHash: {
    type: String,
    required: true
  },
  avatarColor: {
    type: String,
    default: () => {
      const colors = ['#c9a84c', '#e05252', '#52a8e0', '#52e09a', '#e052c9', '#e0a052', '#8052e0', '#52e0e0'];
      return colors[Math.floor(Math.random() * colors.length)];
    }
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  totalProfit: {
    type: Number,
    default: 0
  },
  sessionsPlayed: {
    type: Number,
    default: 0
  },
  sessionsWon: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

userSchema.methods.comparePassword = function(password) {
  return this.passwordHash === password;
};

userSchema.methods.toPublicJSON = function() {
  return {
    _id: this._id.toString(),
    username: this.username,
    avatarColor: this.avatarColor,
    isPrivate: this.isPrivate,
    totalProfit: this.totalProfit,
    sessionsPlayed: this.sessionsPlayed,
    sessionsWon: this.sessionsWon,
    createdAt: this.createdAt
  };
};

export default mongoose.models.User || mongoose.model('User', userSchema);
