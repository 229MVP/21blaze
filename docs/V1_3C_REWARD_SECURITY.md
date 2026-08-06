# Version 1.3C — Reward Security

- Participation/placement/streak RPCs: `SECURITY DEFINER`, service_role for grants; authenticated for status/claim with `auth.uid()` or Edge-passed `p_user_id`
- Clients cannot insert `wallet_transactions` or `challenge_reward_claims` directly (no INSERT policies)
- Reward amounts defined in SQL/Edge only — not client-supplied
- Practice attempts excluded at verification layer — no participation RPC path
- Placement uses finalized `daily_rank` only
- Weekly uses summed `challenge_points` from verified leaderboard view
- RLS: `challenge_reward_claims` SELECT own rows only
