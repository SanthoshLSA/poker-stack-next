'use server';

import { connectDB } from '../lib/db';
import ChallengeSession from '../models/Challenge';
import User from '../models/User';
import Session from '../models/Session';

const GOAL_LOSS_RECOVERY = 31000;
const MAX_CHALLENGE_SESSIONS = 30;
const MAX_SESSION_LOSS = 1500; // 500 initial + 1000 rebuy

export async function getChallengeAction(userId) {
  try {
    await connectDB();
    const user = await User.findById(userId);
    if (!user) return { error: 'User not found' };

    if (user.username.toLowerCase() !== 'sandeez') {
      return { error: 'Challenge tracker is exclusive to user sandeez' };
    }

    const entries = await ChallengeSession.find({ user: userId })
      .sort({ sessionDate: -1, createdAt: -1 });

    const entriesJSON = JSON.parse(JSON.stringify(entries));

    let totalRecovered = 0;
    let bustSessionsCount = 0;
    let profitSessionsCount = 0;
    let breakevenSessionsCount = 0;
    let lossSessionsCount = 0;
    let totalWinningProfit = 0;
    let totalLossAmount = 0;

    entriesJSON.forEach(entry => {
      const p = Number(entry.profit || 0);
      totalRecovered += p;

      if (p > 0) {
        profitSessionsCount++;
        totalWinningProfit += p;
      } else if (p === 0) {
        breakevenSessionsCount++;
      } else {
        lossSessionsCount++;
        totalLossAmount += Math.abs(p);
        if (p <= -MAX_SESSION_LOSS || p <= -1400) {
          bustSessionsCount++;
        }
      }
    });

    const sessionsCount = entriesJSON.length;
    const remainingSessions = Math.max(0, MAX_CHALLENGE_SESSIONS - sessionsCount);
    const remainingToRecover = Math.max(0, GOAL_LOSS_RECOVERY - totalRecovered);

    const avgWinningProfit = profitSessionsCount > 0 ? Math.round(totalWinningProfit / profitSessionsCount) : 0;
    const avgLossAmount = lossSessionsCount > 0 ? Math.round(totalLossAmount / lossSessionsCount) : 0;

    const requiredAvgProfit = remainingSessions > 0
      ? Math.ceil(remainingToRecover / remainingSessions)
      : 0;

    // Predictions / Scenarios
    const scenarios = [];
    if (remainingSessions > 0 && remainingToRecover > 0) {
      // 0 additional busts
      scenarios.push({
        additionalBusts: 0,
        remainingWinsNeeded: remainingSessions,
        requiredAvg: requiredAvgProfit,
        description: `If 0 more sessions bust, you need an average profit of ₹${requiredAvgProfit.toLocaleString('en-IN')}/session across your remaining ${remainingSessions} session${remainingSessions !== 1 ? 's' : ''}.`
      });

      // 1 additional bust
      if (remainingSessions > 1) {
        const req1 = Math.ceil((remainingToRecover + MAX_SESSION_LOSS) / (remainingSessions - 1));
        scenarios.push({
          additionalBusts: 1,
          remainingWinsNeeded: remainingSessions - 1,
          requiredAvg: req1,
          description: `If 1 more session busts (-₹${MAX_SESSION_LOSS}), your remaining ${remainingSessions - 1} session${remainingSessions - 1 !== 1 ? 's' : ''} will require an average profit of ₹${req1.toLocaleString('en-IN')}.`
        });
      }

      // 2 additional busts
      if (remainingSessions > 2) {
        const req2 = Math.ceil((remainingToRecover + (MAX_SESSION_LOSS * 2)) / (remainingSessions - 2));
        scenarios.push({
          additionalBusts: 2,
          remainingWinsNeeded: remainingSessions - 2,
          requiredAvg: req2,
          description: `If 2 more sessions bust (-₹${MAX_SESSION_LOSS * 2}), your remaining ${remainingSessions - 2} session${remainingSessions - 2 !== 1 ? 's' : ''} will require an average profit of ₹${req2.toLocaleString('en-IN')}.`
        });
      }
    }

    const summary = {
      goalAmount: GOAL_LOSS_RECOVERY,
      maxSessions: MAX_CHALLENGE_SESSIONS,
      maxSessionLoss: MAX_SESSION_LOSS,
      sessionsCount,
      remainingSessions,
      totalRecovered,
      remainingToRecover,
      bustSessionsCount,
      profitSessionsCount,
      breakevenSessionsCount,
      lossSessionsCount,
      avgWinningProfit,
      avgLossAmount,
      requiredAvgProfit,
      scenarios,
      progressPercent: Math.min(100, Math.max(0, Math.round((totalRecovered / GOAL_LOSS_RECOVERY) * 100)))
    };

    return { summary, entries: entriesJSON };
  } catch (err) {
    console.error('getChallengeAction error:', err);
    return { error: 'Server error fetching challenge data' };
  }
}

export async function addChallengeSessionAction(userId, data) {
  try {
    await connectDB();
    const user = await User.findById(userId);
    if (!user || user.username.toLowerCase() !== 'sandeez') {
      return { error: 'Challenge tracker is exclusive to user sandeez' };
    }

    const currentCount = await ChallengeSession.countDocuments({ user: userId });
    if (currentCount >= MAX_CHALLENGE_SESSIONS) {
      return { error: `Challenge limit reached (${MAX_CHALLENGE_SESSIONS} sessions max)` };
    }

    const { profit, sessionDate, note, linkedSessionId, buyIn, cashOut } = data;
    if (profit === undefined || profit === null || isNaN(Number(profit))) {
      return { error: 'Valid profit/loss amount is required' };
    }

    const numProfit = Number(profit);
    const numBuyIn = Number(buyIn || 500);
    const numCashOut = Number(cashOut || (numBuyIn + numProfit));

    const entry = await ChallengeSession.create({
      user: userId,
      profit: numProfit,
      buyIn: numBuyIn,
      cashOut: numCashOut,
      sessionDate: sessionDate ? new Date(sessionDate) : new Date(),
      note: note?.trim() || '',
      linkedSession: linkedSessionId || null
    });

    return { success: true, entry: JSON.parse(JSON.stringify(entry)) };
  } catch (err) {
    console.error('addChallengeSessionAction error:', err);
    return { error: 'Server error adding challenge session' };
  }
}

export async function deleteChallengeSessionAction(userId, entryId) {
  try {
    await connectDB();
    const user = await User.findById(userId);
    if (!user || user.username.toLowerCase() !== 'sandeez') {
      return { error: 'Challenge tracker is exclusive to user sandeez' };
    }

    const deleted = await ChallengeSession.findOneAndDelete({ _id: entryId, user: userId });
    if (!deleted) {
      return { error: 'Challenge session entry not found' };
    }

    return { success: true };
  } catch (err) {
    console.error('deleteChallengeSessionAction error:', err);
    return { error: 'Server error deleting challenge session' };
  }
}

export async function importSessionToChallengeAction(userId, sessionId) {
  try {
    await connectDB();
    const user = await User.findById(userId);
    if (!user || user.username.toLowerCase() !== 'sandeez') {
      return { error: 'Challenge tracker is exclusive to user sandeez' };
    }

    const session = await Session.findById(sessionId);
    if (!session) return { error: 'Session not found' };

    const player = session.players.find(p => p.user.toString() === userId);
    if (!player || player.finalStack == null) {
      return { error: 'No finalized stats found for you in this session' };
    }

    // Check if already imported
    const existing = await ChallengeSession.findOne({ user: userId, linkedSession: sessionId });
    if (existing) {
      return { error: 'This session has already been logged into your challenge tracker' };
    }

    const buyIn = player.totalBuyIn || 500;
    const cashOut = player.finalStack || 0;
    const profit = cashOut - buyIn;

    const entry = await ChallengeSession.create({
      user: userId,
      profit,
      buyIn,
      cashOut,
      sessionDate: session.endedAt || session.startedAt || new Date(),
      note: `Imported from session "${session.name}"`,
      linkedSession: session._id
    });

    return { success: true, entry: JSON.parse(JSON.stringify(entry)) };
  } catch (err) {
    console.error('importSessionToChallengeAction error:', err);
    return { error: 'Server error importing session' };
  }
}
