'use server';

import { connectDB } from '../lib/db';
import Session from '../models/Session';
import User from '../models/User';
import Group from '../models/Group';
import PlayerResult from '../models/PlayerResult';

// Helper to generate a 6-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createSessionAction(userId, data) {
  try {
    await connectDB();
    const { name, initialBank, groupId } = data;

    if (!name || name.trim().length < 2) {
      return { error: 'Session name must be at least 2 characters' };
    }
    if (!initialBank || initialBank < 1) {
      return { error: 'Initial bank must be at least ₹1' };
    }

    const creatorUser = await User.findById(userId);
    if (!creatorUser) return { error: 'User not found' };

    if (groupId) {
      const group = await Group.findById(groupId);
      if (!group) return { error: 'Group not found' };
      if (!group.members.some(m => m.toString() === userId)) {
        return { error: 'You are not a member of this group' };
      }
    }

    let roomCode;
    let exists = true;
    while (exists) {
      roomCode = generateRoomCode();
      exists = await Session.findOne({ roomCode, status: 'active' });
    }

    const session = await Session.create({
      name: name.trim(),
      roomCode,
      admin: userId,
      adminUsername: creatorUser.username,
      group: groupId || null,
      initialBank: Number(initialBank),
      currentBank: Number(initialBank),
      players: [{
        user: userId,
        username: creatorUser.username,
        avatarColor: creatorUser.avatarColor,
        currentStack: 0,
        totalBuyIn: 0
      }]
    });

    if (groupId) {
      await Group.findByIdAndUpdate(groupId, { $inc: { totalSessions: 1 } });
    }

    return { session: JSON.parse(JSON.stringify(session)) };
  } catch (err) {
    console.error('Create session error:', err);
    return { error: 'Server error creating session' };
  }
}

export async function joinSessionAction(userId, roomCode) {
  try {
    await connectDB();
    if (!roomCode) return { error: 'Room code is required' };

    const session = await Session.findOne({ roomCode: roomCode.toUpperCase().trim(), status: 'active' });
    if (!session) return { error: 'Session not found or has ended' };

    const userObj = await User.findById(userId);
    if (!userObj) return { error: 'User not found' };

    const alreadyIn = session.players.some(p => p.user.toString() === userId);
    if (alreadyIn) {
      return { session: JSON.parse(JSON.stringify(session)), message: 'Already in session' };
    }

    session.players.push({
      user: userId,
      username: userObj.username,
      avatarColor: userObj.avatarColor,
      currentStack: 0,
      totalBuyIn: 0
    });

    await session.save();
    return { session: JSON.parse(JSON.stringify(session)) };
  } catch (err) {
    console.error('Join session error:', err);
    return { error: 'Server error joining session' };
  }
}

export async function getMySessionsAction(userId) {
  try {
    await connectDB();
    const sessions = await Session.find({
      'players.user': userId
    })
      .select('name roomCode status admin adminUsername initialBank currentBank players startedAt endedAt group')
      .populate('group', 'name')
      .sort({ createdAt: -1 })
      .limit(20);

    return { sessions: JSON.parse(JSON.stringify(sessions)) };
  } catch (err) {
    return { error: 'Server error fetching sessions' };
  }
}

export async function getSessionDetailAction(userId, roomCode) {
  try {
    await connectDB();
    const session = await Session.findOne({ roomCode: roomCode.toUpperCase() })
      .populate('group', 'name');

    if (!session) return { error: 'Session not found' };

    const isParticipant = session.players.some(p => p.user.toString() === userId);
    if (!isParticipant && session.admin.toString() !== userId) {
      return { error: 'You are not part of this session' };
    }

    return { session: JSON.parse(JSON.stringify(session)) };
  } catch (err) {
    return { error: 'Server error fetching session details' };
  }
}

export async function recordTransactionAction(userId, roomCode, data) {
  try {
    await connectDB();
    const session = await Session.findOne({ roomCode: roomCode.toUpperCase() });
    if (!session) return { error: 'Session not found' };
    if (session.status === 'ended') return { error: 'Session has ended' };
    if (session.admin.toString() !== userId) {
      return { error: 'Only the session admin can record transactions' };
    }

    const { type, fromType, fromUserId, toUserId, amount, note } = data;

    if (!['buyin', 'rebuy', 'player_transfer'].includes(type)) {
      return { error: 'Invalid transaction type' };
    }
    if (!['bank', 'player'].includes(fromType)) {
      return { error: 'Invalid fromType' };
    }
    if (!toUserId || !amount || amount < 1) {
      return { error: 'Recipient and valid amount are required' };
    }

    const toPlayer = session.players.find(p => p.user.toString() === toUserId);
    if (!toPlayer) return { error: 'Recipient player not found in session' };

    const txAmount = Number(amount);
    const warnings = [];

    if (fromType === 'bank') {
      if (txAmount > session.currentBank) {
        warnings.push(`Bank only has ₹${session.currentBank} but transaction is ₹${txAmount}`);
      }
      session.currentBank -= txAmount;
      toPlayer.currentStack += txAmount;
      toPlayer.totalBuyIn += txAmount;

      session.transactions.push({
        type,
        fromType: 'bank',
        from: null,
        fromUsername: 'Bank',
        to: toPlayer.user,
        toUsername: toPlayer.username,
        amount: txAmount,
        note: note || ''
      });
    } else {
      if (!fromUserId) return { error: 'Source player is required for player transfer' };
      const fromPlayer = session.players.find(p => p.user.toString() === fromUserId);
      if (!fromPlayer) return { error: 'Source player not found in session' };
      if (fromPlayer.user.toString() === toPlayer.user.toString()) {
        return { error: 'Cannot transfer to the same player' };
      }

      if (txAmount > fromPlayer.currentStack) {
        warnings.push(`${fromPlayer.username} only has ₹${fromPlayer.currentStack} but transfer is ₹${txAmount}. Stack will go negative.`);
      }

      fromPlayer.currentStack -= txAmount;
      toPlayer.currentStack += txAmount;
      toPlayer.totalBuyIn += txAmount;

      session.transactions.push({
        type: 'player_transfer',
        fromType: 'player',
        from: fromPlayer.user,
        fromUsername: fromPlayer.username,
        to: toPlayer.user,
        toUsername: toPlayer.username,
        amount: txAmount,
        note: note || ''
      });
    }

    await session.save();
    return { session: JSON.parse(JSON.stringify(session)), warnings };
  } catch (err) {
    console.error('Transaction action error:', err);
    return { error: 'Server error recording transaction' };
  }
}

export async function endSessionAction(userId, roomCode, finalStacks) {
  try {
    await connectDB();
    const session = await Session.findOne({ roomCode: roomCode.toUpperCase() });
    if (!session) return { error: 'Session not found' };
    if (session.status === 'ended') return { error: 'Session already ended' };
    if (session.admin.toString() !== userId) {
      return { error: 'Only the session admin can end the session' };
    }

    if (!finalStacks || typeof finalStacks !== 'object') {
      return { error: 'Final stacks are required' };
    }

    session.status = 'ended';
    session.endedAt = new Date();

    for (const player of session.players) {
      const pId = player.user.toString();
      const finalStack = finalStacks[pId] !== undefined ? Number(finalStacks[pId]) : player.currentStack;

      player.finalStack = finalStack;
      const profit = finalStack - player.totalBuyIn;

      await User.findByIdAndUpdate(player.user, {
        $inc: {
          totalProfit: profit,
          sessionsPlayed: 1,
          sessionsWon: profit > 0 ? 1 : 0
        }
      });

      await PlayerResult.create({
        user: player.user,
        username: player.username,
        session: session._id,
        sessionName: session.name,
        group: session.group,
        buyIn: player.totalBuyIn,
        cashOut: finalStack,
        profit
      });
    }

    await session.save();
    return { session: JSON.parse(JSON.stringify(session)) };
  } catch (err) {
    console.error('End session error:', err);
    return { error: 'Server error ending session' };
  }
}
