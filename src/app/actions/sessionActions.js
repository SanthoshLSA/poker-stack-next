// src/app/actions/sessionActions.js
'use server';

import { connectDB } from '../lib/db';
import Session from '../models/Session';
import User from '../models/User';
import Group from '../models/Group';
import PlayerResult from '../models/PlayerResult';

const AUTO_BUYIN_AMOUNT = 200;

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
    if (!groupId) {
      return { error: 'You must select a group to create a session' };
    }

    const creatorUser = await User.findById(userId);
    if (!creatorUser) return { error: 'User not found' };

    const group = await Group.findById(groupId);
    if (!group) return { error: 'Group not found' };
    if (!group.members.some(m => m.toString() === userId)) {
      return { error: 'You are not a member of this group' };
    }

    let roomCode;
    let exists = true;
    while (exists) {
      roomCode = generateRoomCode();
      exists = await Session.findOne({ roomCode, status: 'active' });
    }

    const startingBank = Number(initialBank) - AUTO_BUYIN_AMOUNT;

    const session = await Session.create({
      name: name.trim(),
      roomCode,
      admin: userId,
      adminUsername: creatorUser.username,
      group: groupId,
      initialBank: Number(initialBank),
      currentBank: startingBank,
      players: [{
        user: userId,
        username: creatorUser.username,
        avatarColor: creatorUser.avatarColor,
        totalBuyIn: AUTO_BUYIN_AMOUNT,
        joinedAt: new Date()
      }],
      transactions: [{
        type: 'buyin',
        fromType: 'bank',
        from: null,
        fromUsername: 'Bank',
        to: userId,
        toUsername: creatorUser.username,
        amount: AUTO_BUYIN_AMOUNT,
        note: 'Auto buy-in on join',
        timestamp: new Date()
      }]
    });

    await Group.findByIdAndUpdate(groupId, { $inc: { totalSessions: 1 } });

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

    const group = await Group.findById(session.group);
    if (!group) return { error: 'Session group not found' };
    if (!group.members.some(m => m.toString() === userId)) {
      return { error: 'You must be a member of this group to join this session' };
    }

    const userObj = await User.findById(userId);
    if (!userObj) return { error: 'User not found' };

    const alreadyIn = session.players.some(p => p.user.toString() === userId);
    if (alreadyIn) {
      return { session: JSON.parse(JSON.stringify(session)), message: 'Already in session' };
    }

    if (session.currentBank < AUTO_BUYIN_AMOUNT) {
      return { error: `Bank only has ₹${session.currentBank}, not enough for ₹${AUTO_BUYIN_AMOUNT} auto buy-in` };
    }

    session.players.push({
      user: userId,
      username: userObj.username,
      avatarColor: userObj.avatarColor,
      totalBuyIn: AUTO_BUYIN_AMOUNT,
      joinedAt: new Date()
    });

    session.currentBank -= AUTO_BUYIN_AMOUNT;

    session.transactions.push({
      type: 'buyin',
      fromType: 'bank',
      from: null,
      fromUsername: 'Bank',
      to: userId,
      toUsername: userObj.username,
      amount: AUTO_BUYIN_AMOUNT,
      note: 'Auto buy-in on join',
      timestamp: new Date()
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

    const group = await Group.findById(session.group);
    if (!group) return { error: 'Group not found' };
    if (!group.members.some(m => m.toString() === userId)) {
      return { error: 'You are not a member of this group' };
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

    if (!['buyin', 'rebuy', 'player_transfer', 'return_to_bank'].includes(type)) {
      return { error: 'Invalid transaction type' };
    }

    const txAmount = Number(amount);
    if (!txAmount || txAmount < 1) return { error: 'Valid amount is required' };

    const warnings = [];

    if (type === 'return_to_bank') {
      if (!fromUserId) return { error: 'Player is required for return to bank' };
      const fromPlayer = session.players.find(p => p.user.toString() === fromUserId);
      if (!fromPlayer) return { error: 'Player not found in session' };
      if (txAmount > fromPlayer.totalBuyIn) {
        warnings.push(`${fromPlayer.username} only has ₹${fromPlayer.totalBuyIn} in buy-in`);
      }
      fromPlayer.totalBuyIn -= txAmount;
      session.currentBank += txAmount;

      session.transactions.push({
        type: 'return_to_bank',
        fromType: 'player',
        from: fromPlayer.user,
        fromUsername: fromPlayer.username,
        to: null,
        toUsername: 'Bank',
        amount: txAmount,
        note: note || '',
        timestamp: new Date()
      });

    } else if (fromType === 'bank') {
      if (!toUserId) return { error: 'Recipient is required' };
      const toPlayer = session.players.find(p => p.user.toString() === toUserId);
      if (!toPlayer) return { error: 'Recipient player not found in session' };

      if (txAmount > session.currentBank) {
        warnings.push(`Bank only has ₹${session.currentBank} but transaction is ₹${txAmount}`);
      }
      session.currentBank -= txAmount;
      toPlayer.totalBuyIn += txAmount;

      const txType = toPlayer.totalBuyIn === txAmount ? 'buyin' : 'rebuy';

      session.transactions.push({
        type: txType,
        fromType: 'bank',
        from: null,
        fromUsername: 'Bank',
        to: toPlayer.user,
        toUsername: toPlayer.username,
        amount: txAmount,
        note: note || '',
        timestamp: new Date()
      });

    } else {
      if (!fromUserId) return { error: 'Source player is required for player transfer' };
      if (!toUserId) return { error: 'Recipient is required' };
      const fromPlayer = session.players.find(p => p.user.toString() === fromUserId);
      const toPlayer = session.players.find(p => p.user.toString() === toUserId);
      if (!fromPlayer) return { error: 'Source player not found in session' };
      if (!toPlayer) return { error: 'Recipient player not found in session' };
      if (fromPlayer.user.toString() === toPlayer.user.toString()) {
        return { error: 'Cannot transfer to the same player' };
      }

      fromPlayer.totalBuyIn -= txAmount;
      toPlayer.totalBuyIn += txAmount;

      session.transactions.push({
        type: 'player_transfer',
        fromType: 'player',
        from: fromPlayer.user,
        fromUsername: fromPlayer.username,
        to: toPlayer.user,
        toUsername: toPlayer.username,
        amount: txAmount,
        note: note || '',
        timestamp: new Date()
      });
    }

    await session.save();
    return { session: JSON.parse(JSON.stringify(session)), warnings };
  } catch (err) {
    console.error('Transaction action error:', err);
    return { error: 'Server error recording transaction' };
  }
}

export async function editTransactionAction(userId, roomCode, transactionId, data) {
  try {
    await connectDB();
    const session = await Session.findOne({ roomCode: roomCode.toUpperCase() });
    if (!session) return { error: 'Session not found' };
    if (session.status === 'ended') return { error: 'Session has ended' };
    if (session.admin.toString() !== userId) {
      return { error: 'Only the session admin can edit transactions' };
    }

    const tx = session.transactions.id(transactionId);
    if (!tx || tx.isDeleted) return { error: 'Transaction not found' };

    const oldAmount = tx.amount;
    const newAmount = Number(data.amount);
    if (!newAmount || newAmount < 1) return { error: 'Valid amount is required' };

    const diff = newAmount - oldAmount;

    if (tx.type === 'return_to_bank') {
      const fromPlayer = session.players.find(p => p.user.toString() === tx.from.toString());
      if (fromPlayer) fromPlayer.totalBuyIn -= diff;
      session.currentBank += diff;
    } else if (tx.fromType === 'bank') {
      const toPlayer = session.players.find(p => p.user.toString() === tx.to.toString());
      if (toPlayer) toPlayer.totalBuyIn += diff;
      session.currentBank -= diff;
    } else {
      const fromPlayer = session.players.find(p => p.user.toString() === tx.from.toString());
      const toPlayer = session.players.find(p => p.user.toString() === tx.to.toString());
      if (fromPlayer) fromPlayer.totalBuyIn -= diff;
      if (toPlayer) toPlayer.totalBuyIn += diff;
    }

    tx.amount = newAmount;
    if (data.note !== undefined) tx.note = data.note;

    await session.save();
    return { session: JSON.parse(JSON.stringify(session)) };
  } catch (err) {
    console.error('Edit transaction error:', err);
    return { error: 'Server error editing transaction' };
  }
}

export async function deleteTransactionAction(userId, roomCode, transactionId) {
  try {
    await connectDB();
    const session = await Session.findOne({ roomCode: roomCode.toUpperCase() });
    if (!session) return { error: 'Session not found' };
    if (session.status === 'ended') return { error: 'Session has ended' };
    if (session.admin.toString() !== userId) {
      return { error: 'Only the session admin can delete transactions' };
    }

    const tx = session.transactions.id(transactionId);
    if (!tx || tx.isDeleted) return { error: 'Transaction not found' };

    if (tx.type === 'return_to_bank') {
      const fromPlayer = session.players.find(p => p.user.toString() === tx.from.toString());
      if (fromPlayer) fromPlayer.totalBuyIn += tx.amount;
      session.currentBank -= tx.amount;
    } else if (tx.fromType === 'bank') {
      const toPlayer = session.players.find(p => p.user.toString() === tx.to.toString());
      if (toPlayer) toPlayer.totalBuyIn -= tx.amount;
      session.currentBank += tx.amount;
    } else {
      const fromPlayer = session.players.find(p => p.user.toString() === tx.from.toString());
      const toPlayer = session.players.find(p => p.user.toString() === tx.to.toString());
      if (fromPlayer) fromPlayer.totalBuyIn += tx.amount;
      if (toPlayer) toPlayer.totalBuyIn -= tx.amount;
    }

    tx.isDeleted = true;
    await session.save();
    return { session: JSON.parse(JSON.stringify(session)) };
  } catch (err) {
    console.error('Delete transaction error:', err);
    return { error: 'Server error deleting transaction' };
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
      const finalStack = finalStacks[pId] !== undefined ? Number(finalStacks[pId]) : 0;
      player.finalStack = finalStack;
      const profit = finalStack - player.totalBuyIn;

      const userDoc = await User.findById(player.user);
      if (userDoc) {
        userDoc.totalProfit = (userDoc.totalProfit || 0) + profit;
        userDoc.sessionsPlayed = (userDoc.sessionsPlayed || 0) + 1;
        if (profit > 0) userDoc.sessionsWon = (userDoc.sessionsWon || 0) + 1;
        if (profit > (userDoc.highestWin || 0)) userDoc.highestWin = profit;
        if (profit < 0 && Math.abs(profit) > (userDoc.highestLoss || 0)) userDoc.highestLoss = Math.abs(profit);
        await userDoc.save();
      }

      if (session.group) {
        const group = await Group.findById(session.group);
        if (group) {
          let memberStat = group.memberStats.find(s => s.user.toString() === pId);
          if (!memberStat) {
            group.memberStats.push({
              user: player.user,
              sessionsPlayed: 0,
              sessionsWon: 0,
              totalProfit: 0,
              highestWin: 0,
              highestLoss: 0
            });
            memberStat = group.memberStats[group.memberStats.length - 1];
          }
          memberStat.sessionsPlayed += 1;
          if (profit > 0) memberStat.sessionsWon += 1;
          memberStat.totalProfit += profit;
          if (profit > memberStat.highestWin) memberStat.highestWin = profit;
          if (profit < 0 && Math.abs(profit) > memberStat.highestLoss) memberStat.highestLoss = Math.abs(profit);
          await group.save();
        }
      }

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