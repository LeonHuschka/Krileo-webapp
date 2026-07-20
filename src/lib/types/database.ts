// Hand-written types for the Krileo schema.
// Regenerate from a real Supabase project with:
//   supabase gen types typescript --local > src/lib/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "owner" | "admin" | "member";

export type OrderStatus =
  | "angebot"
  | "aktiv"
  | "review"
  | "geliefert"
  | "archiv";

export type OrderType = "website" | "website_plus" | "automation" | "other";

export type OrderPriority = "low" | "medium" | "high";

export type ContactStatus =
  | "cold"
  | "contacted"
  | "qualified"
  | "won"
  | "lost";

export type GrowthStatus =
  | "ideen"
  | "todo"
  | "in_progress"
  | "done"
  | "archiv";

export type Subtask = { id: string; title: string; done: boolean };

/** AI-prepared brief that turns Leon's raw sales notes into a spec the
 *  build team can act on. Stored on orders.tech_brief. */
export type TechBrief = {
  summary: string;
  goals: string[];
  must_haves: string[];
  nice_to_haves: string[];
  constraints: string[];
  open_questions: string[];
  suggested_stack: string[];
  generated_at: string;
};

/** A prioritized technical requirement card in the Aktiv tab. List order =
 *  importance (drag to re-rank). */
export type DevItem = {
  id: string;
  text: string;
  priority: "high" | "medium" | "low";
  done: boolean;
};

/** An uploaded note/media attachment in the Aktiv tab. */
export type Attachment = {
  id: string;
  url: string;
  name: string;
  kind: "image" | "video" | "file";
  size: number;
};

export type ReviewCategory = "bug" | "design" | "text" | "other";

/** A piece of media pulled from Telegram (stored in the order-previews
 *  bucket). Shared by intake batches and review messages/suggestions. */
export type TgMedia = {
  id: string;
  url: string;
  name: string;
  kind: "image" | "video" | "file";
  size: number;
};

/** One concrete review point the engineer noted — the tech team ticks it off.
 *  `images` are optional reference screenshots (public URLs) so the point is
 *  visually clear — auto-filled from a Telegram suggestion's media, or attached
 *  manually (paste/upload). `image` is the legacy single-image field, folded
 *  into `images` on read. */
export type ReviewItem = {
  id: string;
  text: string;
  done: boolean;
  category: ReviewCategory;
  images?: string[];
  image?: string | null;
};

/** A review loop: a batch of points found in one pass. The order stays in
 *  Review; new rounds are opened until it is approved. */
export type ReviewRound = {
  id: string;
  items: ReviewItem[];
  created_at: string;
  closed_at: string | null;
};

/** Round-based review flow stored on orders.review. */
export type OrderReview = {
  rounds: ReviewRound[];
  decision: "approved" | null;
  approved_at: string | null;
};

export type BillingCycle =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "one_time";

export type ExpenseStatus = "active" | "paused" | "cancelled";

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          name: string;
          company: string | null;
          email: string | null;
          phone: string | null;
          status: ContactStatus;
          tags: string[];
          source: string | null;
          location: string | null;
          notes: string | null;
          demo_url: string | null;
          last_contacted_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          company?: string | null;
          email?: string | null;
          phone?: string | null;
          status?: ContactStatus;
          tags?: string[];
          source?: string | null;
          location?: string | null;
          notes?: string | null;
          demo_url?: string | null;
          last_contacted_at?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          company?: string | null;
          email?: string | null;
          phone?: string | null;
          status?: ContactStatus;
          tags?: string[];
          source?: string | null;
          location?: string | null;
          notes?: string | null;
          demo_url?: string | null;
          last_contacted_at?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          title: string;
          client_name: string | null;
          contact_id: string | null;
          order_type: OrderType;
          status: OrderStatus;
          priority: OrderPriority;
          value_cents: number | null;
          due_date: string | null;
          assigned_to: string | null;
          created_by: string;
          description: string | null;
          work_url: string | null;
          preview_desktop_url: string | null;
          preview_mobile_url: string | null;
          tech_brief: TechBrief | null;
          review: OrderReview | null;
          live_status: string | null;
          live_status_at: string | null;
          canceled_at: string | null;
          cancellation_reason: string | null;
          cancellation_type: "permanent" | "temporary" | null;
          dev_items: DevItem[] | null;
          attachments: Attachment[] | null;
          telegram_review_chat_id: number | null;
          invoice: Json | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          client_name?: string | null;
          contact_id?: string | null;
          order_type?: OrderType;
          status?: OrderStatus;
          priority?: OrderPriority;
          value_cents?: number | null;
          due_date?: string | null;
          assigned_to?: string | null;
          created_by: string;
          description?: string | null;
          work_url?: string | null;
          preview_desktop_url?: string | null;
          preview_mobile_url?: string | null;
          tech_brief?: TechBrief | null;
          review?: OrderReview | null;
          live_status?: string | null;
          live_status_at?: string | null;
          canceled_at?: string | null;
          cancellation_reason?: string | null;
          cancellation_type?: "permanent" | "temporary" | null;
          dev_items?: DevItem[] | null;
          attachments?: Attachment[] | null;
          telegram_review_chat_id?: number | null;
          invoice?: Json | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          client_name?: string | null;
          contact_id?: string | null;
          order_type?: OrderType;
          status?: OrderStatus;
          priority?: OrderPriority;
          value_cents?: number | null;
          due_date?: string | null;
          assigned_to?: string | null;
          created_by?: string;
          description?: string | null;
          work_url?: string | null;
          preview_desktop_url?: string | null;
          preview_mobile_url?: string | null;
          tech_brief?: TechBrief | null;
          review?: OrderReview | null;
          live_status?: string | null;
          live_status_at?: string | null;
          canceled_at?: string | null;
          cancellation_reason?: string | null;
          cancellation_type?: "permanent" | "temporary" | null;
          dev_items?: DevItem[] | null;
          attachments?: Attachment[] | null;
          telegram_review_chat_id?: number | null;
          invoice?: Json | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: { key: string; value: Json; updated_at: string };
        Insert: { key: string; value?: Json; updated_at?: string };
        Update: { key?: string; value?: Json; updated_at?: string };
        Relationships: [];
      };
      invoice_counters: {
        Row: { year: number; next_seq: number };
        Insert: { year: number; next_seq: number };
        Update: { year?: number; next_seq?: number };
        Relationships: [];
      };
      order_todos: {
        Row: {
          id: string;
          order_id: string;
          title: string;
          done: boolean;
          due_date: string | null;
          assigned_to: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          title: string;
          done?: boolean;
          due_date?: string | null;
          assigned_to?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          title?: string;
          done?: boolean;
          due_date?: string | null;
          assigned_to?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_events: {
        Row: {
          id: string;
          order_id: string;
          from_status: string | null;
          to_status: string;
          actor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          from_status?: string | null;
          to_status: string;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          from_status?: string | null;
          to_status?: string;
          actor_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      telegram_intake_batches: {
        Row: {
          id: string;
          chat_id: number;
          thread_id: number | null;
          status: "collecting" | "processing" | "done" | "error";
          media: TgMedia[];
          maps_url: string | null;
          note: string | null;
          control_message_id: number | null;
          order_id: string | null;
          started_by: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chat_id: number;
          thread_id?: number | null;
          status?: "collecting" | "processing" | "done" | "error";
          media?: TgMedia[];
          maps_url?: string | null;
          note?: string | null;
          control_message_id?: number | null;
          order_id?: string | null;
          started_by?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chat_id?: number;
          thread_id?: number | null;
          status?: "collecting" | "processing" | "done" | "error";
          media?: TgMedia[];
          maps_url?: string | null;
          note?: string | null;
          control_message_id?: number | null;
          order_id?: string | null;
          started_by?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      telegram_review_messages: {
        Row: {
          id: string;
          chat_id: number;
          order_id: string | null;
          tg_message_id: number | null;
          from_name: string | null;
          body: string | null;
          media: TgMedia[];
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id: number;
          order_id?: string | null;
          tg_message_id?: number | null;
          from_name?: string | null;
          body?: string | null;
          media?: TgMedia[];
          created_at?: string;
        };
        Update: {
          id?: string;
          chat_id?: number;
          order_id?: string | null;
          tg_message_id?: number | null;
          from_name?: string | null;
          body?: string | null;
          media?: TgMedia[];
          created_at?: string;
        };
        Relationships: [];
      };
      telegram_review_suggestions: {
        Row: {
          id: string;
          order_id: string;
          chat_id: number;
          body: string;
          category: ReviewCategory;
          media: TgMedia[];
          source_excerpt: string | null;
          status: "pending" | "accepted" | "dismissed";
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          chat_id: number;
          body: string;
          category?: ReviewCategory;
          media?: TgMedia[];
          source_excerpt?: string | null;
          status?: "pending" | "accepted" | "dismissed";
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          chat_id?: number;
          body?: string;
          category?: ReviewCategory;
          media?: TgMedia[];
          source_excerpt?: string | null;
          status?: "pending" | "accepted" | "dismissed";
          created_at?: string;
        };
        Relationships: [];
      };
      telegram_review_bots: {
        Row: {
          chat_id: number;
          order_id: string | null;
          bot_id: number;
          token: string;
          label: string | null;
          created_at: string;
        };
        Insert: {
          chat_id: number;
          order_id?: string | null;
          bot_id: number;
          token: string;
          label?: string | null;
          created_at?: string;
        };
        Update: {
          chat_id?: number;
          order_id?: string | null;
          bot_id?: number;
          token?: string;
          label?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      growth_tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          status: GrowthStatus;
          priority: OrderPriority;
          category: string | null;
          tags: string[];
          subtasks: Subtask[];
          due_date: string | null;
          assigned_to: string | null;
          created_by: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          status?: GrowthStatus;
          priority?: OrderPriority;
          category?: string | null;
          tags?: string[];
          subtasks?: Subtask[];
          due_date?: string | null;
          assigned_to?: string | null;
          created_by: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          status?: GrowthStatus;
          priority?: OrderPriority;
          category?: string | null;
          tags?: string[];
          subtasks?: Subtask[];
          due_date?: string | null;
          assigned_to?: string | null;
          created_by?: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          name: string;
          vendor: string | null;
          category: string | null;
          amount_cents: number;
          billing_cycle: BillingCycle;
          status: ExpenseStatus;
          next_billing_date: string | null;
          started_at: string | null;
          url: string | null;
          notes: string | null;
          paid_by: string | null;
          payment_method: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          vendor?: string | null;
          category?: string | null;
          amount_cents: number;
          billing_cycle?: BillingCycle;
          status?: ExpenseStatus;
          next_billing_date?: string | null;
          started_at?: string | null;
          url?: string | null;
          notes?: string | null;
          paid_by?: string | null;
          payment_method?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          vendor?: string | null;
          category?: string | null;
          amount_cents?: number;
          billing_cycle?: BillingCycle;
          status?: ExpenseStatus;
          next_billing_date?: string | null;
          started_at?: string | null;
          url?: string | null;
          notes?: string | null;
          paid_by?: string | null;
          payment_method?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tools: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          url: string | null;
          login_email: string | null;
          login_username: string | null;
          login_password: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category?: string | null;
          url?: string | null;
          login_email?: string | null;
          login_username?: string | null;
          login_password?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string | null;
          url?: string | null;
          login_email?: string | null;
          login_username?: string | null;
          login_password?: string | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      activity_log: {
        Row: {
          id: string;
          actor_id: string;
          entity_type: string;
          entity_id: string;
          action: string;
          meta: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          entity_type: string;
          entity_id: string;
          action: string;
          meta?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string;
          entity_type?: string;
          entity_id?: string;
          action?: string;
          meta?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      tg_intake_append: {
        Args: {
          p_chat_id: number;
          p_thread_id: number | null;
          p_media: Json;
          p_maps_url: string | null;
          p_started_by: number | null;
        };
        Returns: {
          id: string;
          chat_id: number;
          thread_id: number | null;
          status: "collecting" | "processing" | "done" | "error";
          media: TgMedia[];
          maps_url: string | null;
          note: string | null;
          control_message_id: number | null;
          order_id: string | null;
          started_by: number | null;
          created_at: string;
          updated_at: string;
        };
      };
      next_invoice_number: {
        Args: { p_year: number };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      order_status: OrderStatus;
      order_type: OrderType;
      order_priority: OrderPriority;
      contact_status: ContactStatus;
      growth_status: GrowthStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type UserProfileRow = Database["public"]["Tables"]["user_profiles"]["Row"];
export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
export type OrderTodoRow = Database["public"]["Tables"]["order_todos"]["Row"];
export type OrderEventRow = Database["public"]["Tables"]["order_events"]["Row"];
export type TelegramIntakeBatchRow =
  Database["public"]["Tables"]["telegram_intake_batches"]["Row"];
export type TelegramReviewMessageRow =
  Database["public"]["Tables"]["telegram_review_messages"]["Row"];
export type TelegramReviewSuggestionRow =
  Database["public"]["Tables"]["telegram_review_suggestions"]["Row"];
export type TelegramReviewBotRow =
  Database["public"]["Tables"]["telegram_review_bots"]["Row"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type GrowthTaskRow =
  Database["public"]["Tables"]["growth_tasks"]["Row"];
export type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];
export type ToolRow = Database["public"]["Tables"]["tools"]["Row"];
export type ActivityLogRow = Database["public"]["Tables"]["activity_log"]["Row"];
