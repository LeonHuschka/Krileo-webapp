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
      growth_tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          status: GrowthStatus;
          priority: OrderPriority;
          category: string | null;
          tags: string[];
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
          due_date?: string | null;
          assigned_to?: string | null;
          created_by?: string;
          position?: number;
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
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type GrowthTaskRow =
  Database["public"]["Tables"]["growth_tasks"]["Row"];
export type ActivityLogRow = Database["public"]["Tables"]["activity_log"]["Row"];
