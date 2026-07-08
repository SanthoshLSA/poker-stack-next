'use server';

// Global leaderboard has been removed.
// Per-group stats are now tracked in Group.memberStats
// and displayed inside each group's detail page.

export async function getLeaderboardAction() {
  return { error: 'Global leaderboard has been removed. View stats inside your group.' };
}