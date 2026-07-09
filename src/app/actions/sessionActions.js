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

// ─── Create Session (group required, auto configured defaultBuyIn to admin) ──
export async function createSessionAction(userId, data) {
  try {
    await connectDB();
    const { name, initialBank, groupId, defaultBuyIn } = data;

    if (!name || name.trim().length < 2) {
       return { error: 'Session name must be at least 2 characters' };
    }
    if (!initialBank || initialBank < 1) {
       return { error: 'Initial bank must be at least ₹1' };
    }
    if (!groupId) {
       return { error: 'You must select a group to create a session' };
    }

    const buyinAmt = Number(defaultBuyIn || 200);
    if (buyinAmt < 1) {
       return { error: 'Default buy-in must be at least ₹1' };
    }
    if (Number(initialBank) < buyinAmt) {
       return { error: `Initial bank must be at least default buy-in amount (₹${buyinAmt})` };
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

    const initBank = Number(initialBank);

    // Admin gets auto buy-in configured amount
    const session = await Session.create({
      name: name.trim(),
      roomCode,
      admin: userId,
      adminUsername: creatorUser.username,
      group: groupId,
      initialBank: initBank,
      defaultBuyIn: buyinAmt,
      currentBank: initBank - buyinAmt,
      players: [{
        user: userId,
        username: creatorUser.username,
        avatarColor: creatorUser.avatarColor,
        totalBuyIn: buyinAmt
      }],
      transactions: [{
        type: 'buyin',
        fromType: 'bank',
        from: null,
        fromUsername: 'Bank',
        to: userId,
        toUsername: creatorUser.username,
        amount: buyinAmt,
        note: 'Auto buy-in'
      }]
    });

    await Group.findByIdAndUpdate(groupId, { $inc: { totalSessions: 1 } });

    // Ensure admin is in memberStats
    await _ensureMemberStat(groupId, userId, creatorUser.username, creatorUser.avatarColor);

    return { session: JSON.parse(JSON.stringify(session)) };
  } catch (err) {
    console.error('Create session error:', err);
    return { error: 'Server error creating session' };
  }
}

// ─── Join Session (auto ₹200 buyin from bank) ─────────────────────────────────
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

    // Check group membership
    const group = await Group.findById(session.group);
    if (!group || !group.members.some(m => m.toString() === userId)) {
      return { error: 'You must be a member of the group to join this session' };
    }

    // Auto buyin based on session configuration
    const buyinTarget = session.defaultBuyIn || 200;
    const warnings = [];
    if (buyinTarget > session.currentBank) {
      warnings.push(`Bank only has ₹${session.currentBank} — auto buy-in reduced to bank balance`);
    }
    const buyinAmount = Math.min(buyinTarget, session.currentBank);

    session.players.push({
      user: userId,
      username: userObj.username,
      avatarColor: userObj.avatarColor,
      totalBuyIn: buyinAmount
    });

    session.currentBank -= buyinAmount;

    session.transactions.push({
      type: 'buyin',
      fromType: 'bank',
      from: null,
      fromUsername: 'Bank',
      to: userId,
      toUsername: userObj.username,
      amount: buyinAmount,
      note: 'Auto buy-in'
    });

    await session.save();

    // Ensure in memberStats
    await _ensureMemberStat(session.group.toString(), userId, userObj.username, userObj.avatarColor);

    return { session: JSON.parse(JSON.stringify(session)), warnings };
  } catch (err) {
    console.error('Join session error:', err);
    return { error: 'Server error joining session' };
  }
}

// ─── Get My Sessions ──────────────────────────────────────────────────────────
export async function getMySessionsAction(userId) {
  try {
    await connectDB();
    const sessions = await Session.find({ 'players.user': userId })
      .select('name roomCode status admin adminUsername initialBank currentBank players startedAt endedAt group')
      .populate('group', 'name')
      .sort({ createdAt: -1 })
      .limit(30);

    return { sessions: JSON.parse(JSON.stringify(sessions)) };
  } catch (err) {
    return { error: 'Server error fetching sessions' };
  }
}

// ─── Get Session Detail ───────────────────────────────────────────────────────
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

// ─── Record Transaction ───────────────────────────────────────────────────────
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
      // Player returns chips to bank
      if (!fromUserId) return { error: 'Source player is required for return to bank' };
      const fromPlayer = session.players.find(p => p.user.toString() === fromUserId);
      if (!fromPlayer) return { error: 'Source player not found' };
      if (txAmount > fromPlayer.totalBuyIn) {
        warnings.push(`${fromPlayer.username} only has ₹${fromPlayer.totalBuyIn} buy-in remaining`);
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
        note: note || ''
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
      // player_transfer
      if (!fromUserId || !toUserId) return { error: 'Source and recipient are required for transfer' };
      const fromPlayer = session.players.find(p => p.user.toString() === fromUserId);
      const toPlayer = session.players.find(p => p.user.toString() === toUserId);
      if (!fromPlayer) return { error: 'Source player not found' };
      if (!toPlayer) return { error: 'Recipient player not found' };
      if (fromPlayer.user.toString() === toPlayer.user.toString()) {
        return { error: 'Cannot transfer to the same player' };
      }
      if (txAmount > fromPlayer.totalBuyIn) {
        warnings.push(`${fromPlayer.username} only has ₹${fromPlayer.totalBuyIn} — buy-in will go negative`);
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

// ─── Edit Transaction ─────────────────────────────────────────────────────────
export async function editTransactionAction(userId, roomCode, txId, newAmount, newNote) {
  try {
    await connectDB();
    const session = await Session.findOne({ roomCode: roomCode.toUpperCase() });
    if (!session) return { error: 'Session not found' };
    if (session.status === 'ended') return { error: 'Session has ended' };
    if (session.admin.toString() !== userId) return { error: 'Only admin can edit transactions' };

    const tx = session.transactions.id(txId);
    if (!tx || tx.isDeleted) return { error: 'Transaction not found' };

    const oldAmount = tx.amount;
    const diff = Number(newAmount) - oldAmount;

    if (Number(newAmount) < 1) return { error: 'Amount must be at least ₹1' };

    // Reverse and reapply
    if (tx.type === 'return_to_bank') {
      const fromPlayer = session.players.find(p => p.user.toString() === tx.from.toString());
      if (fromPlayer) fromPlayer.totalBuyIn -= diff;
      session.currentBank += diff;
    } else if (tx.fromType === 'bank') {
      const toPlayer = session.players.find(p => tx.to && p.user.toString() === tx.to.toString());
      if (toPlayer) toPlayer.totalBuyIn += diff;
      session.currentBank -= diff;
    } else {
      const fromPlayer = session.players.find(p => tx.from && p.user.toString() === tx.from.toString());
      const toPlayer = session.players.find(p => tx.to && p.user.toString() === tx.to.toString());
      if (fromPlayer) fromPlayer.totalBuyIn -= diff;
      if (toPlayer) toPlayer.totalBuyIn += diff;
    }

    tx.amount = Number(newAmount);
    if (newNote !== undefined) tx.note = newNote;

    await session.save();
    return { session: JSON.parse(JSON.stringify(session)) };
  } catch (err) {
    console.error('Edit transaction error:', err);
    return { error: 'Server error editing transaction' };
  }
}

// ─── Delete Transaction ───────────────────────────────────────────────────────
export async function deleteTransactionAction(userId, roomCode, txId) {
  try {
    await connectDB();
    const session = await Session.findOne({ roomCode: roomCode.toUpperCase() });
    if (!session) return { error: 'Session not found' };
    if (session.status === 'ended') return { error: 'Session has ended' };
    if (session.admin.toString() !== userId) return { error: 'Only admin can delete transactions' };

    const tx = session.transactions.id(txId);
    if (!tx || tx.isDeleted) return { error: 'Transaction not found' };

    // Reverse the transaction's effect
    if (tx.type === 'return_to_bank') {
      const fromPlayer = session.players.find(p => tx.from && p.user.toString() === tx.from.toString());
      if (fromPlayer) fromPlayer.totalBuyIn += tx.amount;
      session.currentBank -= tx.amount;
    } else if (tx.fromType === 'bank') {
      const toPlayer = session.players.find(p => tx.to && p.user.toString() === tx.to.toString());
      if (toPlayer) toPlayer.totalBuyIn -= tx.amount;
      session.currentBank += tx.amount;
    } else {
      const fromPlayer = session.players.find(p => tx.from && p.user.toString() === tx.from.toString());
      const toPlayer = session.players.find(p => tx.to && p.user.toString() === tx.to.toString());
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

// ─── End Session ──────────────────────────────────────────────────────────────
export async function endSessionAction(userId, roomCode, finalStacks) {
  try {
    await connectDB();
    const session = await Session.findOne({ roomCode: roomCode.toUpperCase() });
    if (!session) return { error: 'Session not found' };
    if (session.status === 'ended') return { error: 'Session already ended' };
    if (session.admin.toString() !== userId) {
      return { error: 'Only the session admin can end the session' };
    }

    // 1. Apply final stacks
    for (const player of session.players) {
      const pId = player.user.toString();
      player.finalStack = finalStacks[pId] !== undefined ? Number(finalStacks[pId]) : 0;
    }

    session.status = 'ended';
    session.endedAt = new Date();
    await session.save();

    // 2. Update user stats + create PlayerResult (catch per-player errors so one bad player doesn't kill all)
    for (const player of session.players) {
      const profit = (player.finalStack ?? 0) - (player.totalBuyIn || 0);

      try {
        const userDoc = await User.findById(player.user);
        if (userDoc) {
          const incUpdate = { totalProfit: profit, sessionsPlayed: 1, sessionsWon: profit > 0 ? 1 : 0 };
          const setUpdate = {};
          if (profit > 0 && profit > (userDoc.highestWin || 0)) setUpdate.highestWin = profit;
          if (profit < 0 && profit < (userDoc.highestLoss || 0)) setUpdate.highestLoss = profit;
          const op = { $inc: incUpdate };
          if (Object.keys(setUpdate).length) op.$set = setUpdate;
          await User.findByIdAndUpdate(player.user, op);
        }
      } catch (e) { console.error('User stat update error:', player.username, e.message); }

      try {
        await PlayerResult.create({
          user: player.user,
          username: player.username,
          session: session._id,
          sessionName: session.name,
          group: session.group || null,
          buyIn: player.totalBuyIn || 0,
          cashOut: player.finalStack ?? 0,
          profit
        });
      } catch (e) { console.error('PlayerResult create error:', player.username, e.message); }
    }

    // 3. Update group memberStats — fetch once, update all, save once
    if (session.group) {
      try {
        const group = await Group.findById(session.group);
        if (group) {
          for (const player of session.players) {
            const pId = player.user.toString();
            const profit = (player.finalStack ?? 0) - (player.totalBuyIn || 0);
            const idx = group.memberStats.findIndex(s => s.user && s.user.toString() === pId);

            if (idx >= 0) {
              const ms = group.memberStats[idx];
              ms.sessionsPlayed = (ms.sessionsPlayed || 0) + 1;
              ms.totalProfit = (ms.totalProfit || 0) + profit;
              if (profit > 0) {
                ms.sessionsWon = (ms.sessionsWon || 0) + 1;
                if (profit > (ms.highestWin || 0)) ms.highestWin = profit;
              }
              if (profit < 0 && profit < (ms.highestLoss || 0)) ms.highestLoss = profit;
              // mark modified so Mongoose saves it
              group.markModified('memberStats');
            } else {
              group.memberStats.push({
                user: player.user,
                username: player.username,
                avatarColor: player.avatarColor || '#c9a84c',
                sessionsPlayed: 1,
                sessionsWon: profit > 0 ? 1 : 0,
                totalProfit: profit,
                highestWin: profit > 0 ? profit : 0,
                highestLoss: profit < 0 ? profit : 0
              });
            }
          }
          await group.save();
        }
      } catch (e) { console.error('Group stat update error:', e.message); }
    }

    return { session: JSON.parse(JSON.stringify(session)) };
  } catch (err) {
    console.error('End session error:', err.message, err.stack);
    return { error: `Server error ending session: ${err.message}` };
  }
}

// ─── Helper: ensure member stat entry exists in group ─────────────────────────
async function _ensureMemberStat(groupId, userId, username, avatarColor) {
  const group = await Group.findById(groupId);
  if (!group) return;
  const exists = group.memberStats.some(s => s.user.toString() === userId);
  if (!exists) {
    group.memberStats.push({ user: userId, username, avatarColor });
    await group.save();
  }
}