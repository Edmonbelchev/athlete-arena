export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ExerciseType = 'push_ups' | 'squats' | 'pull_ups' | 'dips';
export type ChallengeStatus = 'pending' | 'in_progress' | 'completed' | 'declined' | 'expired';
export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface FriendChallengeRpcRow {
  participant_id: string;
  challenge_id: string;
  exercise_type: ExerciseType;
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
  winner_user_id: string | null;
  resolved_at: string | null;
  creator_emote_id: string | null;
  creator_emote_emoji: string | null;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          challenge_date: string;
          exercise_type: ExerciseType;
          target_reps: number;
          xp_reward: number;
          catalog_slot?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          challenge_date?: string;
          exercise_type?: ExerciseType;
          target_reps?: number;
          xp_reward?: number;
          catalog_slot?: number | null;
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
    };
    Views: Record<string, never>;
    Functions: {
      get_daily_challenge_home: {
        Args: Record<string, never>;
        Returns: {
          template_id: string;
          challenge_date: string;
          exercise_type: ExerciseType;
          target_reps: number;
          xp_reward: number;
          catalog_slot: number;
          user_challenge_id: string | null;
          user_status: ChallengeStatus | null;
          completed_reps: number;
          completed_at: string | null;
        }[];
      };
      get_or_create_daily_challenge: {
        Args: Record<string, never>;
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
          sort_order: number;
          unlocked: boolean;
          unlocked_at: string | null;
        }[];
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
    };
    Enums: {
      exercise_type: ExerciseType;
      challenge_status: ChallengeStatus;
      friendship_status: FriendshipStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
