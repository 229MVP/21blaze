/** Edge/shared helpers for Version 1.3C challenge rewards. */

const STREAK_MILESTONES = [3, 7, 14, 30] as const;

type AdminClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export async function grantParticipationReward(
  admin: AdminClient,
  userId: string,
  challengeId: string,
): Promise<{
  granted: boolean;
  blazeCoins: number;
  xp: number;
}> {
  const { data, error } = await admin.rpc('grant_daily_challenge_participation_reward', {
    p_user_id: userId,
    p_challenge_id: challengeId,
  });

  if (error) {
    throw new Error(error.message ?? 'Unable to grant participation reward.');
  }

  const payload = data as Record<string, unknown>;
  return {
    granted: Boolean(payload.granted),
    blazeCoins: Number(payload.blaze_coins ?? 0),
    xp: Number(payload.xp ?? 0),
  };
}

export async function grantStreakMilestones(
  admin: AdminClient,
  userId: string,
  currentStreak: number,
): Promise<Array<{ milestone: number; granted: boolean }>> {
  const results: Array<{ milestone: number; granted: boolean }> = [];

  for (const milestone of STREAK_MILESTONES) {
    if (currentStreak !== milestone) {
      continue;
    }
    const { data, error } = await admin.rpc('grant_challenge_streak_milestone', {
      p_user_id: userId,
      p_milestone: milestone,
    });
    if (error) {
      continue;
    }
    const payload = data as Record<string, unknown>;
    results.push({ milestone, granted: Boolean(payload.granted) });
  }

  return results;
}
