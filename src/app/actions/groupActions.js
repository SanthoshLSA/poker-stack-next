'use server';

import { connectDB } from '../lib/db';
import Group from '../models/Group';
import User from '../models/User';

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

    const user = await User.findById(userId);
    if (!user) return { error: 'User not found' };

    const group = await Group.create({
      name: name.trim(),
      description: description?.trim(),
      inviteCode,
      creator: userId,
      members: [userId],
      memberStats: [{
        user: userId,
        username: user.username,
        avatarColor: user.avatarColor
      }]
    });

    return { group: JSON.parse(JSON.stringify(group)) };
  } catch (err) {
    console.error('Create group error:', err);
    return { error: 'Server error creating group' };
  }
}

export async function getMyGroupsAction(userId) {
  try {
    await connectDB();
    const groups = await Group.find({ members: userId })
      .sort({ createdAt: -1 });
    return { groups: JSON.parse(JSON.stringify(groups)) };
  } catch (err) {
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
      return { message: 'Already a member', group: JSON.parse(JSON.stringify(group)) };
    }

    const user = await User.findById(userId);
    if (!user) return { error: 'User not found' };

    group.members.push(userId);

    const statExists = group.memberStats.some(s => s.user.toString() === userId);
    if (!statExists) {
      group.memberStats.push({
        user: userId,
        username: user.username,
        avatarColor: user.avatarColor
      });
    }

    await group.save();
    return { group: JSON.parse(JSON.stringify(group)), message: `Joined ${group.name}!` };
  } catch (err) {
    return { error: 'Server error joining group' };
  }
}

export async function getGroupDetailAction(userId, groupId) {
  try {
    await connectDB();
    const group = await Group.findById(groupId).populate('memberStats.user', 'isPrivate');
    if (!group) return { error: 'Group not found' };

    const isMember = group.members.some(m => m.toString() === userId);
    if (!isMember) return { error: 'You are not a member of this group' };

    const groupObj = group.toObject();
    groupObj.memberStats = groupObj.memberStats
      .filter(s => {
        const isPrivate = s.user?.isPrivate || false;
        const isSelf = s.user?._id?.toString() === userId;
        // Keep in the array only if they are not private OR if they are the current user
        return !isPrivate || isSelf;
      })
      .map(s => {
        return {
          ...s,
          user: s.user?._id?.toString() || s.user
        };
      });

    return { group: JSON.parse(JSON.stringify(groupObj)) };
  } catch (err) {
    console.error('getGroupDetailAction error:', err);
    return { error: 'Server error fetching group' };
  }
}

export async function leaveGroupAction(userId, groupId) {
  try {
    await connectDB();
    const group = await Group.findById(groupId);
    if (!group) return { error: 'Group not found' };
    if (group.creator.toString() === userId) {
      return { error: 'Creator cannot leave the group' };
    }
    group.members = group.members.filter(m => m.toString() !== userId);
    await group.save();
    return { success: true };
  } catch (err) {
    return { error: 'Server error leaving group' };
  }
}
