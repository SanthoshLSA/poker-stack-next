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

    // Predictions / Scenarios (Up to 10 busts)
    const scenarios = [];
    if (remainingSessions > 0 && remainingToRecover > 0) {
      const maxBustsToCalculate = Math.min(10, remainingSessions - 1);
      for (let busts = 0; busts <= maxBustsToCalculate; busts++) {
        const remainingWinningSessions = remainingSessions - busts;
        if (remainingWinningSessions <= 0) break;

        const totalNeeded = remainingToRecover + (MAX_SESSION_LOSS * busts);
        const reqAvg = Math.ceil(totalNeeded / remainingWinningSessions);

        let desc = '';
        if (busts === 0) {
          desc = `0 additional busts: Need an average profit of ₹${reqAvg.toLocaleString('en-IN')}/session across your remaining ${remainingWinningSessions} session${remainingWinningSessions !== 1 ? 's' : ''}.`;
        } else {
          desc = `${busts} additional bust${busts > 1 ? 's' : ''} (-₹${(MAX_SESSION_LOSS * busts).toLocaleString('en-IN')}): Remaining ${remainingWinningSessions} session${remainingWinningSessions !== 1 ? 's' : ''} will require an average profit of ₹${reqAvg.toLocaleString('en-IN')}/session.`;
        }

        scenarios.push({
          additionalBusts: busts,
          remainingWinsNeeded: remainingWinningSessions,
          requiredAvg: reqAvg,
          description: desc
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
