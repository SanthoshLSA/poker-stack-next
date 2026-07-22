import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectDB } from '../src/app/lib/db.js';
import User from '../src/app/models/User.js';
import Group from '../src/app/models/Group.js';
import Session from '../src/app/models/Session.js';

// Manually parse .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.trim().match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        // Remove quotes if present
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  }
} catch (e) {
  console.error("Error loading env file:", e);
}

async function migratePastSessions() {
  try {
    console.log("Connecting to database...");
    await connectDB();
    console.log("Connected. Fetching ended sessions...");

    const sessions = await Session.find({ status: 'ended' });
    console.log(`Found ${sessions.length} ended sessions. Re-calculating stats...`);

    const usersToUpdate = {}; // userId -> { sessionsPlayed: 0, sessionsWon: 0, totalProfit: 0, highestWin: 0, highestLoss: 0 }
    const groupStatsToUpdate = {}; // groupId -> { userId -> { sessionsPlayed: 0, sessionsWon: 0, totalProfit: 0, highestWin: 0, highestLoss: 0 } }

    for (const session of sessions) {
      const gId = session.group?.toString();
      if (gId && !groupStatsToUpdate[gId]) {
        groupStatsToUpdate[gId] = {};
      }

      for (const player of session.players) {
        const uId = player.user.toString();
        const profit = (player.finalStack ?? 0) - (player.totalBuyIn || 0);

        // Initialize user stats
        if (!usersToUpdate[uId]) {
          usersToUpdate[uId] = {
            sessionsPlayed: 0,
            sessionsWon: 0,
            totalProfit: 0,
            highestWin: 0,
            highestLoss: 0
          };
        }

        // Increment user stats
        usersToUpdate[uId].sessionsPlayed += 1;
        usersToUpdate[uId].totalProfit += profit;
        if (profit >= 0) {
          usersToUpdate[uId].sessionsWon += 1;
          if (profit > usersToUpdate[uId].highestWin) {
            usersToUpdate[uId].highestWin = profit;
          }
        } else {
          if (profit < usersToUpdate[uId].highestLoss) {
            usersToUpdate[uId].highestLoss = profit;
          }
        }

        // Increment group stats
        if (gId) {
          if (!groupStatsToUpdate[gId][uId]) {
            groupStatsToUpdate[gId][uId] = {
              sessionsPlayed: 0,
              sessionsWon: 0,
              totalProfit: 0,
              highestWin: 0,
              highestLoss: 0
            };
          }
          const gs = groupStatsToUpdate[gId][uId];
          gs.sessionsPlayed += 1;
          gs.totalProfit += profit;
          if (profit >= 0) {
            gs.sessionsWon += 1;
            if (profit > gs.highestWin) {
              gs.highestWin = profit;
            }
          } else {
            if (profit < gs.highestLoss) {
              gs.highestLoss = profit;
            }
          }
        }
      }
    }

    console.log("Recalculations completed. Applying to Users...");
    for (const [uId, stats] of Object.entries(usersToUpdate)) {
      await User.findByIdAndUpdate(uId, {
        $set: {
          sessionsPlayed: stats.sessionsPlayed,
          sessionsWon: stats.sessionsWon,
          totalProfit: stats.totalProfit,
          highestWin: stats.highestWin,
          highestLoss: stats.highestLoss
        }
      });
    }
    console.log("Users updated successfully.");

    console.log("Applying to Groups...");
    for (const [gId, memberStatsMap] of Object.entries(groupStatsToUpdate)) {
      const group = await Group.findById(gId);
      if (group) {
        // Reset and update memberStats array in Group
        for (const [uId, stats] of Object.entries(memberStatsMap)) {
          const idx = group.memberStats.findIndex(s => s.user && s.user.toString() === uId);
          if (idx >= 0) {
            group.memberStats[idx].sessionsPlayed = stats.sessionsPlayed;
            group.memberStats[idx].sessionsWon = stats.sessionsWon;
            group.memberStats[idx].totalProfit = stats.totalProfit;
            group.memberStats[idx].highestWin = stats.highestWin;
            group.memberStats[idx].highestLoss = stats.highestLoss;
          } else {
            const userDoc = await User.findById(uId);
            group.memberStats.push({
              user: uId,
              username: userDoc?.username || 'Unknown Player',
              avatarColor: userDoc?.avatarColor || '#c9a84c',
              sessionsPlayed: stats.sessionsPlayed,
              sessionsWon: stats.sessionsWon,
              totalProfit: stats.totalProfit,
              highestWin: stats.highestWin,
              highestLoss: stats.highestLoss
            });
          }
        }
        group.markModified('memberStats');
        await group.save();
      }
    }
    console.log("Groups updated successfully.");
    console.log("Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
}

migratePastSessions();
