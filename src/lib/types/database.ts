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

/** A single change request Leon noted in review — the dev ticks it off. */
export type ReviewItem = { id: string; text: string; done: boolean };

/** Review flow for the Review column. Leon lists what must be changed; the
 *  order bounces Review → Aktiv → Review until approved. Stored on orders.review. */
export type OrderReview = {
  items: ReviewItem[];
  decision: "approved" | "changes" | null;
  reviewed_at: string | null;
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
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
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
    Functions: Record<string, never>;
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
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type GrowthTaskRow =
  Database["public"]["Tables"]["growth_tasks"]["Row"];
export type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];
export type ToolRow = Database["public"]["Tables"]["tools"]["Row"];
export type ActivityLogRow = Database["public"]["Tables"]["activity_log"]["Row"];
