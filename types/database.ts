export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          role: "Admin" | "Reclamos";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          role: "Admin" | "Reclamos";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          role?: "Admin" | "Reclamos";
          created_at?: string;
          updated_at?: string;
        };
      };

      complaints: {
        Row: {
          id: number;
          complaint_number: string | null;
          complaint_date: string;
          complainant_name: string;
          address: string;
          street_number: string;
          dni: string | null;
          phone_number: string | null;
          email: string | null;
          service_id: number;
          cause_id: number;
          zone: string;
          since_when: string;
          contact_method: "Presencial" | "Telefono" | "Email" | "WhatsApp";
          details: string;
          status: "En proceso" | "Resuelto" | "No resuelto";
          referred: boolean;
          loaded_by: string;
          latlon: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          complaint_number?: string | null;
          complaint_date?: string;
          complainant_name: string;
          address: string;
          street_number: string;
          dni?: string | null;
          phone_number?: string | null;
          email?: string | null;
          service_id: number;
          cause_id: number;
          zone: string;
          since_when: string;
          contact_method: "Presencial" | "Telefono" | "Email" | "WhatsApp";
          details: string;
          status?: "En proceso" | "Resuelto" | "No resuelto";
          referred?: boolean;
          loaded_by: string;
          latlon?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          complaint_number?: string | null;
          complaint_date?: string;
          complainant_name?: string;
          address?: string;
          street_number?: string;
          dni?: string | null;
          phone_number?: string | null;
          email?: string | null;
          service_id?: number;
          cause_id?: number;
          zone?: string;
          since_when?: string;
          contact_method?: "Presencial" | "Telefono" | "Email" | "WhatsApp";
          details?: string;
          status?: "En proceso" | "Resuelto" | "No resuelto";
          referred?: boolean;
          loaded_by?: string;
          latlon?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      complaint_history: {
        Row: {
          id: number;
          complaint_id: number;
          field_name: string;
          old_value: string | null;
          new_value: string | null;
          changed_by: string | null;
          changed_at: string;
        };
        Insert: {
          id?: number;
          complaint_id: number;
          field_name: string;
          old_value?: string | null;
          new_value?: string | null;
          changed_by?: string | null;
          changed_at?: string;
        };
        Update: {
          id?: number;
          complaint_id?: number;
          field_name?: string;
          old_value?: string | null;
          new_value?: string | null;
          changed_by?: string | null;
          changed_at?: string;
        };
      };

      causes: {
        Row: {
          id: number;
          service_id: number;
          name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          service_id: number;
          name: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          service_id?: number;
          name?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      services: {
        Row: {
          id: number;
          name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };

    Views: {
      [_ in never]: never;
    };

    Functions: {
      [_ in never]: never;
    };

    Enums: {
      [_ in never]: never;
    };

    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenience type aliases
export type User = Database["public"]["Tables"]["users"]["Row"];
export type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
export type UserUpdate = Database["public"]["Tables"]["users"]["Update"];

export type Complaint = Database["public"]["Tables"]["complaints"]["Row"];
export type ComplaintInsert =
  Database["public"]["Tables"]["complaints"]["Insert"];
export type ComplaintUpdate =
  Database["public"]["Tables"]["complaints"]["Update"];

export type ComplaintHistory =
  Database["public"]["Tables"]["complaint_history"]["Row"];
export type ComplaintHistoryInsert =
  Database["public"]["Tables"]["complaint_history"]["Insert"];
export type ComplaintHistoryUpdate =
  Database["public"]["Tables"]["complaint_history"]["Update"];

export type Service = Database["public"]["Tables"]["services"]["Row"];
export type ServiceInsert = Database["public"]["Tables"]["services"]["Insert"];
export type ServiceUpdate = Database["public"]["Tables"]["services"]["Update"];

export type Cause = Database["public"]["Tables"]["causes"]["Row"];
export type CauseInsert = Database["public"]["Tables"]["causes"]["Insert"];
export type CauseUpdate = Database["public"]["Tables"]["causes"]["Update"];

// Additional types for forms and API responses
export type ComplaintWithDetails = Complaint & {
  service: Service;
  cause: Cause;
  loaded_by_user: User;
};

export type ComplaintHistoryWithUser = ComplaintHistory & {
  user: Pick<User, "full_name"> | null;
};

export type ComplaintStatus = "En proceso" | "Resuelto" | "No resuelto";
export type ContactMethod = "Presencial" | "Telefono" | "Email" | "WhatsApp";
export type UserRole = "Admin" | "Reclamos";