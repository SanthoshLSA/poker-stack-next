'use server';

import { connectDB } from '../lib/db';
import Group from '../models/Group';
import User from '../models/User';
import PlayerResult from '../models/PlayerResult';

// Helper to generate a 6-character random code
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createGroupAction(userId, data) {
  try {
    await connectDB();
    const { name, description } = data;
    if (!name || name.trim().length < 2) {
      return { error: 'Group name must be at least 2 characters' };
    }

    let inviteCode;
    let exists = true;
    while (exists) {
      inviteCode = generateInviteCode();
      exists = await Group.findOne({ inviteCode });
    }

    const group = await Group.create({
      name: name.trim(),
      description: description?.trim(),
      inviteCode,
      creator: userId,
      members: [userId]
    });

    const populated = await Group.findById(group._id).populate('creator', 'username avatarColor');
    return { group: JSON.parse(JSON.stringify(populated)) };
  } catch (err) {
    console.error('Create group action error:', err);
    return { error: 'Server error creating group' };
  }
}

export async function getMyGroupsAction(userId) {
  try {
    await connectDB();
    const groups = await Group.find({ members: userId })
      .populate('creator', 'username avatarColor')
      .populate('members', 'username avatarColor')
      .sort({ createdAt: -1 });
    return { groups: JSON.parse(JSON.stringify(groups)) };
  } catch (err) {
    console.error(err);
    return { error: 'Server error fetching groups' };
  }
}

export async function joinGroupAction(userId, inviteCode) {
  try {
    await connectDB();
    if (!inviteCode) return { error: 'Invite code is required' };

    const group = await Group.findOne({ inviteCode: inviteCode.toUpperCase().trim() });
    if (!group) return { error: 'Invalid invite code. No group found.' };

    if (group.members.some(m => m.toString() === userId)) {
      return { error: 'You are already a member of this group' };
    }

    group.members.push(userId);
    await group.save();

    const populated = await Group.findById(group._id)
      .populate('creator', 'username avatarColor')
      .populate('members', 'username avatarColor');

    return { group: JSON.parse(JSON.stringify(populated)) };
  } catch (err) {
    return { error: 'Server error joining group' };
  }
}

export async function getGroupDetailAction(userId, groupId) {
  try {
    await connectDB();
    const group = await Group.findById(groupId)
      .populate('creator', 'username avatarColor')
      .populate('members', 'username avatarColor totalProfit sessionsPlayed isPrivate');

    if (!group) return { error: 'Group not found' };

    const isMember = group.members.some(m => m._id.toString() === userId);
    if (!isMember) return { error: 'You are not a member of this group' };

    return { group: JSON.parse(JSON.stringify(group)) };
  } catch (err) {
    return { error: 'Server error fetching group details' };
  }
}

export async function getGroupLeaderboardAction(userId, groupId) {
  try {
    await connectDB();
    const group = await Group.findById(groupId).populate('members', '_id username');
    if (!group) return { error: 'Group not found' };

    const isMember = group.members.some(m => m._id.toString() === userId);
    if (!isMember) return { error: 'Not a member of this group' };

    const memberIds = group.members.map(m => m._id);

    const stats = await PlayerResult.aggregate([
      { $match: { group: group._id, user: { $in: memberIds } } },
      {
        $group: {
          _id: '$user',
          username: { $first: '$username' },
          totalProfit: { $sum: '$profit' },
          sessionsPlayed: { $sum: 1 },
          sessionsWon: { $sum: { $cond: [{ $gt: ['$profit', 0] }, 1, 0] } },
          totalBuyIn: { $sum: '$buyIn' },
          totalCashOut: { $sum: '$cashOut' }
        }
      },
      { $sort: { totalProfit: -1 } }
    ]);

    const users = await User.find({ _id: { $in: memberIds } }).select('_id isPrivate avatarColor');
    const privacyMap = {};
    users.forEach(u => {
      privacyMap[u._id.toString()] = { isPrivate: u.isPrivate, avatarColor: u.avatarColor };
    });

    const leaderboard = stats.map((s, i) => {
      const priv = privacyMap[s._id.toString()] || {};
      return {
        rank: i + 1,
        userId: s._id.toString(),
        username: s.username,
        avatarColor: priv.avatarColor,
        totalProfit: priv.isPrivate && s._id.toString() !== userId ? null : s.totalProfit,
        sessionsPlayed: s.sessionsPlayed,
        sessionsWon: s.sessionsWon,
        isPrivate: priv.isPrivate
      };
    });

    return { leaderboard, groupName: group.name };
  } catch (err) {
    console.error(err);
    return { error: 'Server error fetching group leaderboard' };
  }
}

export async function leaveGroupAction(userId, groupId) {
  try {
    await connectDB();
    const group = await Group.findById(groupId);
    if (!group) return { error: 'Group not found' };
    if (group.creator.toString() === userId) {
      return { error: 'Creator cannot leave the group.' };
    }
    group.members = group.members.filter(m => m.toString() !== userId);
    await group.save();
    return { success: true };
  } catch (err) {
    return { error: 'Server error leaving group' };
  }
}
