/**
 * Temporary strict Database types for the 21 Blaze online schema.
 *
 * Generate authoritative types after the project is linked:
 *   npx supabase gen types typescript --project-id <project-ref> > src/lib/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OnlineMatchStatus = 'active' | 'completed' | 'abandoned' | 'rejected';

export type VerifiedGameOverReason = 'timeExpired' | 'busts' | 'deckEmpty';

export type LiveMatchStatus =
  | 'waiting'
  | 'ready'
  | 'countdown'
  | 'running'
  | 'awaiting_results'
  | 'completed'
  | 'cancelled'
  | 'forfeited'
  | 'expired';

export type LivePlayerResult =
  | 'pending'
  | 'win'
  | 'loss'
  | 'draw'
  | 'forfeit_win'
  | 'forfeit_loss';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_seed: number;
          created_at: string;
          updated_at: string;
          ranked_suspended_until: string | null;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_seed?: number;
          created_at?: string;
          updated_at?: string;
          ranked_suspended_until?: string | null;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_seed?: number;
          created_at?: string;
          updated_at?: string;
          ranked_suspended_until?: string | null;
        };
        Relationships: [];
      };
      online_matches: {
        Row: {
          id: string;
          user_id: string;
          seed: number;
          status: OnlineMatchStatus;
          started_at: string;
          expires_at: string;
          completed_at: string | null;
          client_version: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          seed: number;
          status?: OnlineMatchStatus;
          started_at: string;
          expires_at: string;
          completed_at?: string | null;
          client_version?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          seed?: number;
          status?: OnlineMatchStatus;
          started_at?: string;
          expires_at?: string;
          completed_at?: string | null;
          client_version?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      verified_scores: {
        Row: {
          id: string;
          match_id: string;
          user_id: string;
          score: number;
          lanes_cleared: number;
          cards_played: number;
          busts: number;
          time_remaining_seconds: number;
          game_over_reason: VerifiedGameOverReason;
          move_log: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          user_id: string;
          score: number;
          lanes_cleared: number;
          cards_played: number;
          busts: number;
          time_remaining_seconds: number;
          game_over_reason: VerifiedGameOverReason;
          move_log: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          user_id?: string;
          score?: number;
          lanes_cleared?: number;
          cards_played?: number;
          busts?: number;
          time_remaining_seconds?: number;
          game_over_reason?: VerifiedGameOverReason;
          move_log?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      live_matches: {
        Row: {
          id: string;
          room_code: string;
          mode: string;
          status: LiveMatchStatus;
          seed: number;
          host_user_id: string;
          starts_at: string | null;
          ends_at: string | null;
          expires_at: string;
          winner_user_id: string | null;
          finish_reason: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          room_code: string;
          mode?: string;
          status: LiveMatchStatus;
          seed: number;
          host_user_id: string;
          starts_at?: string | null;
          ends_at?: string | null;
          expires_at: string;
          winner_user_id?: string | null;
          finish_reason?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          room_code?: string;
          mode?: string;
          status?: LiveMatchStatus;
          seed?: number;
          host_user_id?: string;
          starts_at?: string | null;
          ends_at?: string | null;
          expires_at?: string;
          winner_user_id?: string | null;
          finish_reason?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      live_match_players: {
        Row: {
          match_id: string;
          user_id: string;
          seat: number;
          ready_at: string | null;
          joined_at: string;
          last_seen_at: string | null;
          disconnected_at: string | null;
          submitted_at: string | null;
          verified_score: number | null;
          verified_lanes_cleared: number | null;
          verified_cards_played: number | null;
          verified_busts: number | null;
          verified_time_remaining_seconds: number | null;
          verified_move_log: Json | null;
          display_name_snapshot: string | null;
          result: LivePlayerResult;
        };
        Insert: {
          match_id: string;
          user_id: string;
          seat: number;
          ready_at?: string | null;
          joined_at?: string;
          last_seen_at?: string | null;
          disconnected_at?: string | null;
          submitted_at?: string | null;
          verified_score?: number | null;
          verified_lanes_cleared?: number | null;
          verified_cards_played?: number | null;
          verified_busts?: number | null;
          verified_time_remaining_seconds?: number | null;
          verified_move_log?: Json | null;
          display_name_snapshot?: string | null;
          result?: LivePlayerResult;
        };
        Update: {
          match_id?: string;
          user_id?: string;
          seat?: number;
          ready_at?: string | null;
          joined_at?: string;
          last_seen_at?: string | null;
          disconnected_at?: string | null;
          submitted_at?: string | null;
          verified_score?: number | null;
          verified_lanes_cleared?: number | null;
          verified_cards_played?: number | null;
          verified_busts?: number | null;
          verified_time_remaining_seconds?: number | null;
          verified_move_log?: Json | null;
          display_name_snapshot?: string | null;
          result?: LivePlayerResult;
        };
        Relationships: [];
      };
      matchmaking_queue: {
        Row: {
          id: string;
          user_id: string;
          mode: string;
          status: string;
          region: string | null;
          game_rules_version: string;
          queued_at: string;
          matched_at: string | null;
          expires_at: string;
          match_id: string | null;
          cancelled_at: string | null;
          last_check_at: string | null;
          created_at: string;
          season_id: string | null;
          rating_snapshot: number | null;
          placement_status: string | null;
          rating_range_at_join: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode?: string;
          status?: string;
          region?: string | null;
          game_rules_version: string;
          queued_at?: string;
          matched_at?: string | null;
          expires_at: string;
          match_id?: string | null;
          cancelled_at?: string | null;
          last_check_at?: string | null;
          created_at?: string;
          season_id?: string | null;
          rating_snapshot?: number | null;
          placement_status?: string | null;
          rating_range_at_join?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: string;
          status?: string;
          region?: string | null;
          game_rules_version?: string;
          queued_at?: string;
          matched_at?: string | null;
          expires_at?: string;
          match_id?: string | null;
          cancelled_at?: string | null;
          last_check_at?: string | null;
          created_at?: string;
          season_id?: string | null;
          rating_snapshot?: number | null;
          placement_status?: string | null;
          rating_range_at_join?: number | null;
        };
        Relationships: [];
      };
      ranked_seasons: {
        Row: {
          id: string;
          name: string;
          slug: string;
          status: string;
          starts_at: string;
          ends_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          status: string;
          starts_at: string;
          ends_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          status?: string;
          starts_at?: string;
          ends_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      player_rankings: {
        Row: {
          user_id: string;
          season_id: string;
          rating: number;
          placement_matches_completed: number;
          ranked_matches_played: number;
          wins: number;
          losses: number;
          draws: number;
          current_win_streak: number;
          longest_win_streak: number;
          peak_rating: number;
          current_division: string;
          peak_division: string;
          last_ranked_match_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          season_id: string;
          rating?: number;
          placement_matches_completed?: number;
          ranked_matches_played?: number;
          wins?: number;
          losses?: number;
          draws?: number;
          current_win_streak?: number;
          longest_win_streak?: number;
          peak_rating?: number;
          current_division?: string;
          peak_division?: string;
          last_ranked_match_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          season_id?: string;
          rating?: number;
          placement_matches_completed?: number;
          ranked_matches_played?: number;
          wins?: number;
          losses?: number;
          draws?: number;
          current_win_streak?: number;
          longest_win_streak?: number;
          peak_rating?: number;
          current_division?: string;
          peak_division?: string;
          last_ranked_match_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ranked_match_results: {
        Row: {
          id: string;
          match_id: string;
          season_id: string;
          player_one_user_id: string;
          player_two_user_id: string;
          winner_user_id: string | null;
          result_type: string;
          player_one_rating_before: number;
          player_one_rating_after: number;
          player_one_rating_change: number;
          player_two_rating_before: number;
          player_two_rating_after: number;
          player_two_rating_change: number;
          player_one_verified_score: number;
          player_two_verified_score: number;
          rating_processed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          season_id: string;
          player_one_user_id: string;
          player_two_user_id: string;
          winner_user_id?: string | null;
          result_type: string;
          player_one_rating_before: number;
          player_one_rating_after: number;
          player_one_rating_change: number;
          player_two_rating_before: number;
          player_two_rating_after: number;
          player_two_rating_change: number;
          player_one_verified_score: number;
          player_two_verified_score: number;
          rating_processed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          season_id?: string;
          player_one_user_id?: string;
          player_two_user_id?: string;
          winner_user_id?: string | null;
          result_type?: string;
          player_one_rating_before?: number;
          player_one_rating_after?: number;
          player_one_rating_change?: number;
          player_two_rating_before?: number;
          player_two_rating_after?: number;
          player_two_rating_change?: number;
          player_one_verified_score?: number;
          player_two_verified_score?: number;
          rating_processed_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      ranked_integrity_flags: {
        Row: {
          id: string;
          match_id: string | null;
          user_id: string | null;
          flag_type: string;
          severity: string;
          metadata: Json;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id?: string | null;
          user_id?: string | null;
          flag_type: string;
          severity: string;
          metadata?: Json;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string | null;
          user_id?: string | null;
          flag_type?: string;
          severity?: string;
          metadata?: Json;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      quick_match_acceptances: {
        Row: {
          match_id: string;
          user_id: string;
          accepted_at: string | null;
          declined_at: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          match_id: string;
          user_id: string;
          accepted_at?: string | null;
          declined_at?: string | null;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          match_id?: string;
          user_id?: string;
          accepted_at?: string | null;
          declined_at?: string | null;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      player_wallets: {
        Row: {
          user_id: string;
          blaze_coins: number;
          lifetime_coins_earned: number;
          lifetime_coins_spent: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          blaze_coins?: number;
          lifetime_coins_earned?: number;
          lifetime_coins_spent?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          blaze_coins?: number;
          lifetime_coins_earned?: number;
          lifetime_coins_spent?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      player_entitlements: {
        Row: {
          user_id: string;
          entitlement_key: string;
          source: string;
          revenuecat_product_id: string | null;
          granted_at: string;
          expires_at: string | null;
          revoked_at: string | null;
          metadata: Json;
        };
        Insert: {
          user_id: string;
          entitlement_key: string;
          source: string;
          revenuecat_product_id?: string | null;
          granted_at?: string;
          expires_at?: string | null;
          revoked_at?: string | null;
          metadata?: Json;
        };
        Update: {
          user_id?: string;
          entitlement_key?: string;
          source?: string;
          revenuecat_product_id?: string | null;
          granted_at?: string;
          expires_at?: string | null;
          revoked_at?: string | null;
          metadata?: Json;
        };
        Relationships: [];
      };
      player_cosmetics: {
        Row: {
          user_id: string;
          cosmetic_key: string;
          category: string;
          unlocked_at: string;
          equipped_at: string | null;
          source: string;
        };
        Insert: {
          user_id: string;
          cosmetic_key: string;
          category: string;
          unlocked_at?: string;
          equipped_at?: string | null;
          source: string;
        };
        Update: {
          user_id?: string;
          cosmetic_key?: string;
          category?: string;
          unlocked_at?: string;
          equipped_at?: string | null;
          source?: string;
        };
        Relationships: [];
      };
      equipped_cosmetics: {
        Row: {
          user_id: string;
          card_theme: string;
          arena: string;
          profile_frame: string;
          player_title: string | null;
          victory_effect: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          card_theme?: string;
          arena?: string;
          profile_frame?: string;
          player_title?: string | null;
          victory_effect?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          card_theme?: string;
          arena?: string;
          profile_frame?: string;
          player_title?: string | null;
          victory_effect?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      wallet_transactions: {
        Row: {
          id: string;
          user_id: string;
          transaction_type: string;
          amount: number;
          balance_after: number;
          source_key: string;
          idempotency_key: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          transaction_type: string;
          amount: number;
          balance_after: number;
          source_key: string;
          idempotency_key: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          transaction_type?: string;
          amount?: number;
          balance_after?: number;
          source_key?: string;
          idempotency_key?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      player_progression: {
        Row: {
          user_id: string;
          level: number;
          total_xp: number;
          current_level_xp: number;
          highest_level_reached: number;
          daily_streak: number;
          longest_daily_streak: number;
          last_daily_claim_at: string | null;
          next_daily_claim_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          level?: number;
          total_xp?: number;
          current_level_xp?: number;
          highest_level_reached?: number;
          daily_streak?: number;
          longest_daily_streak?: number;
          last_daily_claim_at?: string | null;
          next_daily_claim_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          level?: number;
          total_xp?: number;
          current_level_xp?: number;
          highest_level_reached?: number;
          daily_streak?: number;
          longest_daily_streak?: number;
          last_daily_claim_at?: string | null;
          next_daily_claim_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      progression_transactions: {
        Row: {
          id: string;
          user_id: string;
          transaction_type: string;
          xp_amount: number;
          level_before: number;
          level_after: number;
          total_xp_after: number;
          source_type: string;
          source_id: string | null;
          idempotency_key: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          transaction_type: string;
          xp_amount: number;
          level_before: number;
          level_after: number;
          total_xp_after: number;
          source_type: string;
          source_id?: string | null;
          idempotency_key: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          transaction_type?: string;
          xp_amount?: number;
          level_before?: number;
          level_after?: number;
          total_xp_after?: number;
          source_type?: string;
          source_id?: string | null;
          idempotency_key?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      purchase_events: {
        Row: {
          id: string;
          user_id: string | null;
          revenuecat_event_id: string;
          event_type: string;
          product_id: string | null;
          entitlement_ids: string[];
          store: string | null;
          environment: string | null;
          event_timestamp: string | null;
          raw_event: Json;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          revenuecat_event_id: string;
          event_type: string;
          product_id?: string | null;
          entitlement_ids?: string[];
          store?: string | null;
          environment?: string | null;
          event_timestamp?: string | null;
          raw_event: Json;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          revenuecat_event_id?: string;
          event_type?: string;
          product_id?: string | null;
          entitlement_ids?: string[];
          store?: string | null;
          environment?: string | null;
          event_timestamp?: string | null;
          raw_event?: Json;
          processed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ad_reward_claims: {
        Row: {
          id: string;
          user_id: string;
          reward_type: string;
          reward_amount: number;
          match_id: string | null;
          client_reward_id: string;
          status: string;
          ad_network: string;
          created_at: string;
          verified_at: string | null;
          claimed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          reward_type: string;
          reward_amount: number;
          match_id?: string | null;
          client_reward_id: string;
          status?: string;
          ad_network: string;
          created_at?: string;
          verified_at?: string | null;
          claimed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          reward_type?: string;
          reward_amount?: number;
          match_id?: string | null;
          client_reward_id?: string;
          status?: string;
          ad_network?: string;
          created_at?: string;
          verified_at?: string | null;
          claimed_at?: string | null;
        };
        Relationships: [];
      };
      app_configuration: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      global_leaderboard: {
        Row: {
          user_id: string;
          display_name: string;
          score: number;
          lanes_cleared: number;
          cards_played: number;
          busts: number;
          time_remaining_seconds: number;
          game_over_reason: VerifiedGameOverReason;
          created_at: string;
          rank: number;
        };
        Relationships: [];
      };
      live_match_history: {
        Row: {
          match_id: string;
          mode: string;
          status: string;
          winner_user_id: string | null;
          finish_reason: string | null;
          completed_at: string | null;
          created_at: string;
          viewer_user_id: string;
          viewer_display_name: string | null;
          viewer_score: number | null;
          viewer_lanes_cleared: number | null;
          viewer_cards_played: number | null;
          viewer_busts: number | null;
          viewer_time_remaining_seconds: number | null;
          viewer_result: string;
          opponent_user_id: string | null;
          opponent_display_name: string | null;
          opponent_score: number | null;
          opponent_lanes_cleared: number | null;
          opponent_cards_played: number | null;
          opponent_busts: number | null;
          opponent_time_remaining_seconds: number | null;
          opponent_result: string | null;
        };
        Relationships: [];
      };
      ranked_season_leaderboard: {
        Row: {
          rank: number;
          season_id: string;
          user_id: string;
          display_name: string;
          rating: number;
          current_division: string;
          placement_matches_completed: number;
          ranked_matches_played: number;
          wins: number;
          losses: number;
          draws: number;
          current_win_streak: number;
          peak_rating: number;
          peak_division: string;
          last_ranked_match_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      try_create_quick_match: {
        Args: {
          requesting_user_id: string;
          requesting_region: string;
          requesting_game_rules_version: string;
        };
        Returns: string | null;
      };
      try_create_ranked_match: {
        Args: {
          requesting_user_id: string;
          requesting_region: string;
          requesting_game_rules_version: string;
        };
        Returns: string | null;
      };
      finalize_ranked_match: {
        Args: {
          p_match_id: string;
        };
        Returns: Json;
      };
      ensure_player_ranking: {
        Args: {
          p_user_id: string;
          p_season_id: string;
        };
        Returns: Database['public']['Tables']['player_rankings']['Row'];
      };
      soft_reset_ranked_rating: {
        Args: {
          old_rating: number;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type ProfileRow = Tables<'profiles'>;
export type GlobalLeaderboardRow = Database['public']['Views']['global_leaderboard']['Row'];
