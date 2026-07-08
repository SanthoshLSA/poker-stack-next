'use server';

import { connectDB } from '../lib/db';
import User from '../models/User';
import PlayerResult from '../models/PlayerResult';

export async function getGlobalLeaderboardAction(currentUserId) {
  try {
    await connectDB();
    const users = await User.find({})
      .select('username avatarColor totalProfit sessionsPlayed sessionsWon isPrivate createdAt')
      .sort({ totalProfit: -1 })
      .limit(100);

    const leaderboard = users.map((u, i) => ({
      rank: i + 1,
      userId: u._id.toString(),
      username: u.username,
      avatarColor: u.avatarColor,
      totalProfit: u.isPrivate && u._id.toString() !== currentUserId ? null : u.totalProfit,
      sessionsPlayed: u.sessionsPlayed,
      sessionsWon: u.sessionsWon,
      isPrivate: u.isPrivate,
      memberSince: u.createdAt
    }));

    return { leaderboard };
  } catch (err) {
    console.error(err);
    return { error: 'Server error fetching leaderboard' };
  }
}

export async function getUserStatsAction(currentUserId, targetUserId) {
  try {
    await connectDB();
    const user = await User.findById(targetUserId);
    if (!user) return { error: 'User not found' };

    const isOwnProfile = user._id.toString() === currentUserId;

    const results = isOwnProfile || !user.isPrivate
      ? await PlayerResult.find({ user: user._id })
          .populate('session', 'name startedAt')
          .populate('group', 'name')
          .sort({ date: -1 })
          .limit(50)
      : [];

    return {
      user: user.toPublicJSON(),
      results: isOwnProfile || !user.isPrivate ? JSON.parse(JSON.stringify(results)) : null,
      isPrivate: user.isPrivate
    };
  } catch (err) {
    console.error(err);
    return { error: 'Server error fetching user stats' };
  }
}
