// src/app/actions/leaderboardActions.js
'use server';

import { connectDB } from '../lib/db';
import User from '../models/User';

export async function getLeaderboardAction() {
  return { leaderboard: [] };
}

export async function getGlobalLeaderboardAction() {
  return { leaderboard: [] };
}

export async function getUserStatsAction(userId) {
  try {
    await connectDB();
    const user = await User.findById(userId).lean();
    if (!user) return { error: 'User not found' };
    
    return {
      stats: {
        sessionsPlayed: user.sessionsPlayed || 0,
        sessionsWon: user.sessionsWon || 0,
        totalProfit: user.totalProfit || 0,
        highestWin: user.highestWin || 0,
        highestLoss: user.highestLoss || 0
      }
    };
  } catch (err) {
    return { error: 'Server error' };
  }
}