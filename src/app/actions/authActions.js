'use server';

import { connectDB } from '../lib/db';
import User from '../models/User';

const AVATAR_COLORS = [
  '#c9a84c', '#e05252', '#52a8e0', '#52e09a',
  '#e052c9', '#e0a052', '#8052e0', '#52e0e0'
];

export async function registerAction(username, password) {
  try {
    await connectDB();

    if (!username || !password) {
      return { error: 'Username and password are required' };
    }
    if (username.length < 3) return { error: 'Username must be at least 3 characters' };
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return { error: 'Username: letters, numbers, underscores only' };
    if (password.length < 4) return { error: 'Password must be at least 4 characters' };

    const existing = await User.findOne({ username });
    if (existing) return { error: 'Username already taken' };

    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const user = await User.create({
      username,
      passwordHash: password,
      avatarColor
    });

    return { user: user.toPublicJSON() };
  } catch (err) {
    console.error('Registration error:', err);
    return { error: 'Server error during registration' };
  }
}

export async function loginAction(username, password) {
  try {
    await connectDB();

    if (!username || !password) {
      return { error: 'Username and password are required' };
    }

    const user = await User.findOne({ username });
    if (!user || user.passwordHash !== password) {
      return { error: 'Invalid username or password' };
    }

    return { user: user.toPublicJSON() };
  } catch (err) {
    console.error('Login error:', err);
    return { error: 'Server error during login' };
  }
}

export async function getMeAction(userId) {
  try {
    await connectDB();
    const user = await User.findById(userId);
    if (!user) return { error: 'User not found' };
    return { user: user.toPublicJSON() };
  } catch (err) {
    return { error: 'Server error' };
  }
}

export async function updateProfileAction(userId, data) {
  try {
    await connectDB();
    const { isPrivate, avatarColor } = data;
    const update = {};
    if (typeof isPrivate === 'boolean') update.isPrivate = isPrivate;
    if (avatarColor) update.avatarColor = avatarColor;

    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true });
    if (!user) return { error: 'User not found' };
    return { user: user.toPublicJSON() };
  } catch (err) {
    return { error: 'Server error' };
  }
}

export async function changePasswordAction(userId, currentPassword, newPassword) {
  try {
    await connectDB();
    if (!currentPassword || !newPassword) return { error: 'Both passwords required' };

    const user = await User.findById(userId);
    if (!user || user.passwordHash !== currentPassword) {
      return { error: 'Current password is incorrect' };
    }

    user.passwordHash = newPassword;
    await user.save();
    return { success: true };
  } catch (err) {
    return { error: 'Server error' };
  }
}
