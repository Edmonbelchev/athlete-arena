export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ExerciseType = 'push_ups' | 'squats' | 'pull_ups' | 'dips' | 'burpees' | 'half_burpees' | 'jumping_jacks' | 'jumping_squats';
export type ChallengeStatus = 'pending' | 'in_progress' | 'completed' | 'declined' | 'expired';
export type FriendshipStatus = 'pending' | 'accepted' | 'declined';
export type SpinRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type GoalPeriod = 'daily' | 'weekly';
export type GoalStatus = 'active' | 'completed' | 'cancelled';

export interface FriendChallengeRpcRow {
  participant_id: string;
  challenge_id: string;
  challenge_kind: 'exercise' | 'workout';
  exercise_type: ExerciseType | null;
  target_reps: number;
  xp_reward: number;
  message: string | null;
  time_limit_seconds: number | null;
  deadline_at: string | null;
  status: ChallengeStatus;
  completed_reps: number;
  completed_at: string | null;
  started_at: string | null;
  xp_earned: number | null;
  coins_earned: number | null;
  elapsed_seconds: number | null;
  completed_rounds: number | null;
  workout_total_reps: number | null;
  created_at: string;
  creator_id: string;
  creator_username: string;
  creator_display_name: string | null;
  is_creator: boolean;
  opponent_id: string;
  opponent_username: string;
  opponent_display_name: string | null;
  opponent_status: ChallengeStatus;
  opponent_completed_reps: number;
  opponent_completed_at: string | null;
  opponent_started_at: string | null;
  opponent_elapsed_seconds: number | null;
  opponent_completed_rounds: number | null;
  opponent_workout_total_reps: number | null;
  winner_user_id: string | null;
  resolved_at: string | null;
  creator_emote_id: string | null;
  creator_emote_emoji: string | null;
  template_id: string | null;
  catalog_workout_id: string | null;
  workout_title: string | null;
  workout_type: 'amrap' | 'for_time' | 'emom' | null;
  structure_config: unknown;
  workout_exercises: unknown;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          total_xp: number;
          level: number;
          current_streak: number;
          longest_streak: number;
          coin_balance: number;
          coin_multiplier_expires_at: string | null;
          weekly_mission_streak: number;
          weekly_mission_streak_last_date: string | null;
          preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          total_xp?: number;
          level?: number;
          current_streak?: number;
          longest_streak?: number;
          coin_balance?: number;
          coin_multiplier_expires_at?: string | null;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          total_xp?: number;
          level?: number;
          current_streak?: number;
          longest_streak?: number;
          coin_balance?: number;
          coin_multiplier_expires_at?: string | null;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shop_items: {
        Row: {
          id: string;
          item_type: string;
          title: string;
          description: string;
          image_url: string | null;
          price_coins: number;
          is_active: boolean;
          sort_order: number;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id: string;
          item_type: string;
          title: string;
          description?: string;
          image_url?: string | null;
          price_coins?: number;
          is_active?: boolean;
          sort_order?: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          item_type?: string;
          title?: string;
          description?: string;
          image_url?: string | null;
          price_coins?: number;
          is_active?: boolean;
          sort_order?: number;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      user_inventory: {
        Row: {
          user_id: string;
          item_id: string;
          acquired_at: string;
          source: string;
        };
        Insert: {
          user_id: string;
          item_id: string;
          acquired_at?: string;
          source?: string;
        };
        Update: {
          user_id?: string;
          item_id?: string;
          acquired_at?: string;
          source?: string;
        };
        Relationships: [];
      };
      user_equipped_items: {
        Row: {
          user_id: string;
          slot: string;
          item_id: string;
          equipped_at: string;
        };
        Insert: {
          user_id: string;
          slot: string;
          item_id: string;
          equipped_at?: string;
        };
        Update: {
          user_id?: string;
          slot?: string;
          item_id?: string;
          equipped_at?: string;
        };
        Relationships: [];
      };
      daily_challenge_catalog: {
        Row: {
          slot: number;
          exercise_type: ExerciseType;
          target_reps: number;
          xp_reward: number;
        };
        Insert: {
          slot: number;
          exercise_type: ExerciseType;
          target_reps: number;
          xp_reward: number;
        };
        Update: {
          slot?: number;
          exercise_type?: ExerciseType;
          target_reps?: number;
          xp_reward?: number;
        };
        Relationships: [];
      };
      daily_challenge_templates: {
        Row: {
          id: string;
          challenge_date: string;
          exercise_type: ExerciseType;
          target_reps: number;
          xp_reward: number;
          catalog_slot: number | null;
          mission_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          challenge_date: string;
          exercise_type: ExerciseType;
          target_reps: number;
          xp_reward: number;
          catalog_slot?: number | null;
          mission_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          challenge_date?: string;
          exercise_type?: ExerciseType;
          target_reps?: number;
          xp_reward?: number;
          catalog_slot?: number | null;
          mission_index?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      daily_challenges: {
        Row: {
          id: string;
          user_id: string;
          exercise_type: ExerciseType;
          target_reps: number;
          completed_reps: number;
          xp_reward: number;
          challenge_date: string;
          mission_index: number;
          status: ChallengeStatus;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_type: ExerciseType;
          target_reps: number;
          completed_reps?: number;
          xp_reward: number;
          challenge_date: string;
          mission_index?: number;
          status?: ChallengeStatus;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          exercise_type?: ExerciseType;
          target_reps?: number;
          completed_reps?: number;
          xp_reward?: number;
          challenge_date?: string;
          mission_index?: number;
          status?: ChallengeStatus;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'daily_challenges_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: FriendshipStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: FriendshipStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          requester_id?: string;
          addressee_id?: string;
          status?: FriendshipStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      friend_challenges: {
        Row: {
          id: string;
          creator_id: string;
          exercise_type: ExerciseType;
          target_reps: number;
          xp_reward: number;
          message: string | null;
          time_limit_seconds: number | null;
          deadline_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          exercise_type: ExerciseType;
          target_reps: number;
          xp_reward: number;
          message?: string | null;
          time_limit_seconds?: number | null;
          deadline_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          exercise_type?: ExerciseType;
          target_reps?: number;
          xp_reward?: number;
          message?: string | null;
          time_limit_seconds?: number | null;
          deadline_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      friend_challenge_participants: {
        Row: {
          id: string;
          challenge_id: string;
          user_id: string;
          status: ChallengeStatus;
          completed_reps: number;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          challenge_id: string;
          user_id: string;
          status?: ChallengeStatus;
          completed_reps?: number;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          challenge_id?: string;
          user_id?: string;
          status?: ChallengeStatus;
          completed_reps?: number;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      achievements: {
        Row: {
          id: string;
          title: string;
          description: string;
          image_url: string | null;
          icon: string;
          requirements: Json;
          xp_reward: number;
          coin_reward: number;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          title: string;
          description: string;
          image_url?: string | null;
          icon?: string;
          requirements: Json;
          xp_reward?: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          image_url?: string | null;
          icon?: string;
          requirements?: Json;
          xp_reward?: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      user_achievements: {
        Row: {
          user_id: string;
          achievement_id: string;
          unlocked_at: string;
        };
        Insert: {
          user_id: string;
          achievement_id: string;
          unlocked_at?: string;
        };
        Update: {
          user_id?: string;
          achievement_id?: string;
          unlocked_at?: string;
        };
        Relationships: [];
      };
      xp_events: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          source_type: string;
          source_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          source_type: string;
          source_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          source_type?: string;
          source_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      account_deletion_feedback: {
        Row: {
          id: string;
          user_id: string;
          username: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          username: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          username?: string;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      daily_spins: {
        Row: {
          id: string;
          user_id: string;
          spin_date: string;
          reward_id: string;
          rarity: SpinRarity;
          coins_awarded: number;
          multiplier_granted: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          spin_date: string;
          reward_id: string;
          rarity: SpinRarity;
          coins_awarded?: number;
          multiplier_granted?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          spin_date?: string;
          reward_id?: string;
          rarity?: SpinRarity;
          coins_awarded?: number;
          multiplier_granted?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      goal_activity_catalog: {
        Row: {
          id: string;
          kind: string;
          label: string;
          unit_singular: string;
          unit_plural: string;
          exercise_type: ExerciseType | null;
          tracking_mode: string;
          decimal_places: number;
          sort_order: number;
          enabled: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          kind: string;
          label: string;
          unit_singular: string;
          unit_plural: string;
          exercise_type?: ExerciseType | null;
          tracking_mode?: string;
          decimal_places?: number;
          sort_order?: number;
          enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          kind?: string;
          label?: string;
          unit_singular?: string;
          unit_plural?: string;
          exercise_type?: ExerciseType | null;
          tracking_mode?: string;
          decimal_places?: number;
          sort_order?: number;
          enabled?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      user_goals: {
        Row: {
          id: string;
          user_id: string;
          activity_id: string;
          period: GoalPeriod;
          target_value: number;
          current_value: number;
          period_start: string;
          status: GoalStatus;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          activity_id: string;
          period: GoalPeriod;
          target_value: number;
          current_value?: number;
          period_start: string;
          status?: GoalStatus;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          activity_id?: string;
          period?: GoalPeriod;
          target_value?: number;
          current_value?: number;
          period_start?: string;
          status?: GoalStatus;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_daily_challenge_home: {
        Args: Record<string, never>;
        Returns: {
          mission_index: number;
          template_id: string;
          challenge_date: string;
          exercise_type: ExerciseType;
          target_reps: number;
          xp_reward: number;
          catalog_slot: number | null;
          user_challenge_id: string | null;
          user_status: ChallengeStatus | null;
          completed_reps: number;
          completed_at: string | null;
        }[];
      };
      get_or_create_daily_challenge: {
        Args: {
          p_mission_index?: number;
        };
        Returns: Database['public']['Tables']['daily_challenges']['Row'];
      };
      start_challenge: {
        Args: {
          p_challenge_id: string;
        };
        Returns: Database['public']['Tables']['daily_challenges']['Row'];
      };
      complete_challenge: {
        Args: {
          p_challenge_id: string;
          p_completed_reps: number;
        };
        Returns: Database['public']['Tables']['daily_challenges']['Row'];
      };
      search_users_by_username: {
        Args: { p_query: string };
        Returns: {
          id: string;
          username: string;
          display_name: string | null;
        }[];
      };
      is_username_available: {
        Args: {
          p_username: string;
          p_exclude_user_id?: string | null;
        };
        Returns: boolean;
      };
      is_email_registered: {
        Args: { p_email: string };
        Returns: boolean;
      };
      send_friend_request: {
        Args: { p_username: string };
        Returns: Database['public']['Tables']['friendships']['Row'];
      };
      respond_friend_request: {
        Args: { p_friendship_id: string; p_accept: boolean };
        Returns: Database['public']['Tables']['friendships']['Row'];
      };
      get_friends_list: {
        Args: Record<string, never>;
        Returns: {
          friendship_id: string;
          friend_id: string;
          username: string;
          display_name: string | null;
          level: number;
          current_streak: number;
          avatar_url: string | null;
          avatar_icon: string | null;
          avatar_background: string | null;
          frame_border_color: string | null;
          frame_border_width: number | null;
        }[];
      };
      get_friend_profile: {
        Args: { p_user_id: string };
        Returns: {
          user_id: string;
          username: string;
          display_name: string | null;
          level: number;
          total_xp: number;
          current_streak: number;
          longest_streak: number;
          avatar_url: string | null;
          avatar_icon: string | null;
          avatar_background: string | null;
          frame_border_color: string | null;
          frame_border_width: number | null;
        }[];
      };
      get_friend_achievements: {
        Args: { p_user_id: string };
        Returns: {
          id: string;
          title: string;
          description: string;
          image_url: string | null;
          icon: string;
          xp_reward: number;
          coin_reward: number;
          sort_order: number;
          unlocked_at: string;
        }[];
      };
      get_incoming_friend_requests: {
        Args: Record<string, never>;
        Returns: {
          friendship_id: string;
          requester_id: string;
          username: string;
          display_name: string | null;
          created_at: string;
        }[];
      };
      create_friend_challenge: {
        Args: {
          p_friend_id: string;
          p_exercise: ExerciseType;
          p_target_reps: number;
          p_message?: string | null;
          p_time_limit_seconds?: number | null;
          p_emote_id?: string | null;
        };
        Returns: string;
      };
      get_shop_catalog: {
        Args: { p_item_type?: string | null };
        Returns: {
          id: string;
          item_type: string;
          title: string;
          description: string;
          image_url: string | null;
          price_coins: number;
          sort_order: number;
          metadata: Json;
          owned: boolean;
          equipped: boolean;
        }[];
      };
      get_my_shop_summary: {
        Args: Record<string, never>;
        Returns: Json;
      };
      purchase_shop_item: {
        Args: { p_item_id: string };
        Returns: 'purchased' | 'already_owned';
      };
      equip_shop_item: {
        Args: { p_item_id: string };
        Returns: 'equipped';
      };
      create_support_ticket: {
        Args: {
          p_category: 'bug_report' | 'feedback';
          p_subject: string;
          p_message: string;
          p_app_version?: string | null;
        };
        Returns: {
          id: string;
          user_id: string;
          category: 'bug_report' | 'feedback';
          subject: string;
          message: string;
          status: 'open' | 'in_progress' | 'resolved' | 'closed';
          app_version: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      get_my_support_tickets: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          category: 'bug_report' | 'feedback';
          subject: string;
          message: string;
          status: 'open' | 'in_progress' | 'resolved' | 'closed';
          app_version: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      get_my_friend_challenges: {
        Args: Record<string, never>;
        Returns: FriendChallengeRpcRow[];
      };
      get_active_friend_challenge_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_friends_with_active_friend_challenges: {
        Args: Record<string, never>;
        Returns: {
          friend_id: string;
          friend_username: string;
          friend_display_name: string | null;
          active_count: number;
          latest_created_at: string;
        }[];
      };
      get_friend_challenges_with_user: {
        Args: { p_friend_id: string };
        Returns: FriendChallengeRpcRow[];
      };
      get_friend_challenge_detail: {
        Args: { p_participant_id: string };
        Returns: FriendChallengeRpcRow[];
      };
      accept_friend_challenge: {
        Args: { p_participant_id: string };
        Returns: Database['public']['Tables']['friend_challenge_participants']['Row'];
      };
      decline_friend_challenge: {
        Args: { p_participant_id: string };
        Returns: Database['public']['Tables']['friend_challenge_participants']['Row'];
      };
      start_friend_challenge: {
        Args: { p_participant_id: string };
        Returns: Database['public']['Tables']['friend_challenge_participants']['Row'];
      };
      complete_friend_challenge: {
        Args: { p_participant_id: string; p_completed_reps: number };
        Returns: Database['public']['Tables']['friend_challenge_participants']['Row'];
      };
      create_friend_workout_challenge: {
        Args: {
          p_friend_id: string;
          p_template_id: string;
          p_message?: string | null;
          p_emote_id?: string | null;
        };
        Returns: string;
      };
      create_friend_catalog_workout_challenge: {
        Args: {
          p_friend_id: string;
          p_catalog_workout_id: string;
          p_message?: string | null;
          p_emote_id?: string | null;
        };
        Returns: string;
      };
      complete_friend_workout_challenge: {
        Args: {
          p_participant_id: string;
          p_started_at: string;
          p_completed_rounds: number;
          p_total_reps: number;
          p_elapsed_seconds?: number | null;
        };
        Returns: Database['public']['Tables']['friend_challenge_participants']['Row'];
      };
      get_challenge_history: {
        Args: { p_limit?: number };
        Returns: {
          entry_id: string;
          kind: string;
          exercise_type: ExerciseType;
          target_reps: number;
          completed_reps: number;
          xp_reward: number;
          status: ChallengeStatus;
          result_at: string;
          opponent_username: string | null;
          opponent_display_name: string | null;
          opponent_completed_reps: number | null;
          opponent_status: ChallengeStatus | null;
          race_seconds: number | null;
          opponent_race_seconds: number | null;
          winner_user_id: string | null;
          xp_earned: number | null;
        }[];
      };
      get_quest_log: {
        Args: { p_completed: boolean; p_limit?: number; p_offset?: number };
        Returns: {
          entry_id: string;
          exercise_type: ExerciseType;
          target_reps: number;
          completed_reps: number;
          xp_reward: number;
          status: ChallengeStatus;
          challenge_date: string;
          result_at: string;
        }[];
      };
      sync_user_achievements: {
        Args: { p_user_id?: string };
        Returns: number;
      };
      get_my_achievements: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          title: string;
          description: string;
          image_url: string | null;
          icon: string;
          requirements: Json;
          xp_reward: number;
          coin_reward: number;
          sort_order: number;
          unlocked: boolean;
          unlocked_at: string | null;
        }[];
      };
      get_my_achievement_preview: {
        Args: {
          p_limit?: number;
        };
        Returns: Json;
      };
      get_xp_leaderboard: {
        Args: {
          p_period?: string;
          p_limit?: number;
        };
        Returns: {
          rank: number;
          user_id: string;
          username: string;
          display_name: string | null;
          level: number;
          xp_amount: number;
          avatar_url: string | null;
          avatar_icon: string | null;
          avatar_background: string | null;
          frame_border_color: string | null;
          frame_border_width: number | null;
          is_current_user: boolean;
        }[];
      };
      get_friends_xp_leaderboard: {
        Args: {
          p_period?: string;
          p_limit?: number;
        };
        Returns: {
          rank: number;
          user_id: string;
          username: string;
          display_name: string | null;
          level: number;
          xp_amount: number;
          avatar_url: string | null;
          avatar_icon: string | null;
          avatar_background: string | null;
          frame_border_color: string | null;
          frame_border_width: number | null;
          is_current_user: boolean;
        }[];
      };
      create_custom_workout_template: {
        Args: {
          p_title: string;
          p_time_limit_seconds: number;
          p_exercises: Json;
          p_workout_type?: string;
          p_structure_config?: Json | null;
        };
        Returns: string;
      };
      update_custom_workout_template: {
        Args: {
          p_template_id: string;
          p_title: string;
          p_time_limit_seconds: number;
          p_exercises: Json;
          p_workout_type?: string;
          p_structure_config?: Json | null;
        };
        Returns: undefined;
      };
      get_my_custom_workout_templates: {
        Args: Record<string, never>;
        Returns: {
          template_id: string;
          title: string;
          workout_type: 'amrap' | 'for_time' | 'emom';
          time_limit_seconds: number;
          exercise_count: number;
          created_at: string;
          is_owner: boolean;
          creator_username: string | null;
          creator_display_name: string | null;
          shared_at: string | null;
        }[];
      };
      get_workout_catalog: {
        Args: Record<string, never>;
        Returns: {
          catalog_workout_id: string;
          title: string;
          description: string | null;
          workout_type: 'amrap' | 'for_time' | 'emom';
          time_limit_seconds: number;
          leaderboard_metric: 'most_rounds' | 'fastest_time' | null;
          exercise_count: number;
          sort_order: number;
        }[];
      };
      get_workout_catalog_detail: {
        Args: {
          p_catalog_workout_id: string;
        };
        Returns: {
          catalog_workout_id: string;
          title: string;
          description: string | null;
          workout_type: 'amrap' | 'for_time' | 'emom';
          time_limit_seconds: number;
          leaderboard_metric: 'most_rounds' | 'fastest_time' | null;
          structure_config: Json | null;
          exercise_id: string;
          sort_order: number;
          exercise_type: Database['public']['Enums']['exercise_type'];
          target_reps: number;
          my_best_rounds: number | null;
          my_best_reps: number | null;
          my_best_elapsed_seconds: number | null;
          my_session_count: number;
        }[];
      };
      get_my_workout_sessions: {
        Args: {
          p_catalog_workout_id?: string | null;
          p_template_id?: string | null;
          p_limit?: number;
        };
        Returns: {
          session_id: string;
          title: string;
          workout_type: 'amrap' | 'for_time' | 'emom';
          time_limit_seconds: number;
          completed_rounds: number;
          total_reps: number;
          elapsed_seconds: number | null;
          exercise_breakdown: Json;
          started_at: string;
          completed_at: string;
        }[];
      };
      get_catalog_workout_leaderboard: {
        Args: {
          p_catalog_workout_id: string;
          p_period?: string;
          p_limit?: number;
        };
        Returns: {
          rank: number;
          user_id: string;
          username: string;
          display_name: string | null;
          level: number;
          score_amount: number;
          tiebreak_amount: number;
          avatar_url: string | null;
          avatar_icon: string | null;
          avatar_background: string | null;
          frame_border_color: string | null;
          frame_border_width: number | null;
          is_current_user: boolean;
        }[];
      };
      get_custom_workout_template_detail: {
        Args: {
          p_template_id: string;
        };
        Returns: {
          template_id: string;
          title: string;
          workout_type: 'amrap' | 'for_time' | 'emom';
          time_limit_seconds: number;
          structure_config: Json | null;
          creator_id: string;
          creator_username: string;
          creator_display_name: string | null;
          is_owner: boolean;
          exercise_id: string;
          sort_order: number;
          exercise_type: Database['public']['Enums']['exercise_type'];
          target_reps: number;
        }[];
      };
      share_custom_workout_template: {
        Args: {
          p_template_id: string;
          p_friend_id: string;
        };
        Returns: undefined;
      };
      dismiss_shared_workout_template: {
        Args: {
          p_template_id: string;
        };
        Returns: undefined;
      };
      soft_delete_custom_workout_template: {
        Args: {
          p_template_id: string;
        };
        Returns: undefined;
      };
      save_custom_workout_session: {
        Args: {
          p_template_id: string | null;
          p_catalog_workout_id?: string | null;
          p_title: string;
          p_time_limit_seconds: number;
          p_completed_rounds: number;
          p_total_reps: number;
          p_exercise_breakdown: Json;
          p_started_at: string;
          p_elapsed_seconds?: number | null;
        };
        Returns: string;
      };
      delete_my_account: {
        Args: {
          p_reason?: string | null;
        };
        Returns: undefined;
      };
      get_daily_spin_status: {
        Args: Record<string, never>;
        Returns: Json;
      };
      spin_daily_wheel: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_goal_activity_catalog: {
        Args: Record<string, never>;
        Returns: Database['public']['Tables']['goal_activity_catalog']['Row'][];
      };
      get_user_goals: {
        Args: {
          p_include_completed?: boolean;
        };
        Returns: {
          id: string;
          activity_id: string;
          activity_label: string;
          activity_kind: string;
          unit_singular: string;
          unit_plural: string;
          tracking_mode: string;
          decimal_places: number;
          period: GoalPeriod;
          target_value: number;
          current_value: number;
          period_start: string;
          period_end: string;
          status: GoalStatus;
          completed_at: string | null;
          created_at: string;
        }[];
      };
      create_user_goal: {
        Args: {
          p_activity_id: string;
          p_period: GoalPeriod;
          p_target_value: number;
        };
        Returns: Database['public']['Tables']['user_goals']['Row'];
      };
      cancel_user_goal: {
        Args: {
          p_goal_id: string;
        };
        Returns: Database['public']['Tables']['user_goals']['Row'];
      };
      log_goal_progress: {
        Args: {
          p_goal_id: string;
          p_amount: number;
        };
        Returns: Database['public']['Tables']['user_goals']['Row'];
      };
      get_user_goal_history: {
        Args: {
          p_limit?: number;
        };
        Returns: {
          id: string;
          activity_id: string;
          activity_label: string;
          activity_kind: string;
          unit_singular: string;
          unit_plural: string;
          decimal_places: number;
          period: GoalPeriod;
          target_value: number;
          current_value: number;
          period_start: string;
          period_end: string;
          completed_at: string | null;
          created_at: string;
        }[];
      };
      get_user_movement_stats: {
        Args: Record<string, never>;
        Returns: {
          total_push_ups: number;
          total_squats: number;
          total_pull_ups: number;
          total_dips: number;
          total_burpees: number;
          total_half_burpees: number;
          total_jumping_jacks: number;
          total_jumping_squats: number;
          total_steps: number;
          total_run_km: number;
          total_run_mi: number;
          daily_missions_completed: number;
          friend_races_completed: number;
          goals_completed: number;
          goals_completed_daily: number;
          goals_completed_weekly: number;
        }[];
      };
      get_weekly_mission_streak_status: {
        Args: Record<string, never>;
        Returns: {
          streak_days: number;
          target_days: number;
          today_completed: boolean;
          reward_xp: number;
          reward_coins: number;
        }[];
      };
    };
    Enums: {
      exercise_type: ExerciseType;
      challenge_status: ChallengeStatus;
      friendship_status: FriendshipStatus;
      goal_period: GoalPeriod;
      goal_status: GoalStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
