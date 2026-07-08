'use server';

import { connectDB } from '../lib/db';
import PlayerResult from '../models/PlayerResult';

// Per-user session result history (used on Profile page)
export async function getUserStatsAction(requesterId, targetUserId) {
  try {
    await connectDB();
    const results = await PlayerResult.find({ user: targetUserId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('group', 'name');

    return {
      results: JSON.parse(JSON.stringify(
        results.map(r => ({
          _id: r._id.toString(),
          sessionName: r.sessionName,
          groupName: r.group?.name || null,
          buyIn: r.buyIn,
          cashOut: r.cashOut,
          profit: r.profit,
          createdAt: r.createdAt
        }))
      ))
    };
  } catch (err) {
    console.error('getUserStatsAction error:', err);
    return { error: 'Server error fetching stats' };
  }
}
