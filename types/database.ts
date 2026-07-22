export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          role:
          | "Admin"
          | "Reclamos"
          | "ReclamosArbolado"
          | "ReclamosZyV"
          | "AdminLectura"
          | "FC_RRHH"
          | "FC_SECTOR"
          | "Taller"
          | "Suministros";
          modules: string[] | null;
          is_readonly: boolean | null;
          default_module: string | null;
          fc_sectors: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          role:
          | "Admin"
          | "Reclamos"
          | "ReclamosArbolado"
          | "ReclamosZyV"
          | "AdminLectura"
          | "FC_RRHH"
          | "FC_SECTOR"
          | "Taller"
          | "Suministros";
          modules?: string[] | null;
          is_readonly?: boolean | null;
          default_module?: string | null;
          fc_sectors?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          role?:
          | "Admin"
          | "Reclamos"
          | "ReclamosArbolado"
          | "ReclamosZyV"
          | "AdminLectura"
          | "FC_RRHH"
          | "FC_SECTOR"
          | "Taller"
          | "Suministros";
          modules?: string[] | null;
          is_readonly?: boolean | null;
          default_module?: string | null;
          fc_sectors?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      complaints: {
        Row: {
          id: number;
          complaint_number: string | null;
          arbolado_number: number | null;
          complaint_date: string;
          resolution_date: string | null;
          complainant_name: string | null;
          address: string | null;
          street_number: string | null;
          dni: string | null;
          phone_number: string | null;
          email: string | null;
          service_id: number | null;
          cause_id: number | null;
          zone: string | null;
          since_when: string | null;
          contact_method:
          | "Presencial"
          | "Telefono"
          | "Email"
          | "WhatsApp"
          | "Nota"
          | null;
          details: string | null;
          status: "En proceso" | "Resuelto" | "No resuelto";
          referred: boolean;
          loaded_by: string;
          latlon: string | null;
          form_variant: string | null;
          extra_data: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          complaint_number?: string | null;
          arbolado_number?: number | null;
          complaint_date?: string;
          resolution_date?: string | null;
          complainant_name?: string | null;
          address?: string | null;
          street_number?: string | null;
          dni?: string | null;
          phone_number?: string | null;
          email?: string | null;
          service_id?: number | null;
          cause_id?: number | null;
          zone?: string | null;
          since_when?: string | null;
          contact_method?:
          | "Presencial"
          | "Telefono"
          | "Email"
          | "WhatsApp"
          | "Nota"
          | null;
          details?: string | null;
          status?: "En proceso" | "Resuelto" | "No resuelto";
          referred?: boolean;
          loaded_by: string;
          latlon?: string | null;
          form_variant?: string | null;
          extra_data?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          complaint_number?: string | null;
          arbolado_number?: number | null;
          complaint_date?: string;
          resolution_date?: string | null;
          complainant_name?: string | null;
          address?: string | null;
          street_number?: string | null;
          dni?: string | null;
          phone_number?: string | null;
          email?: string | null;
          service_id?: number | null;
          cause_id?: number | null;
          zone?: string | null;
          since_when?: string | null;
          contact_method?:
          | "Presencial"
          | "Telefono"
          | "Email"
          | "WhatsApp"
          | "Nota"
          | null;
          details?: string | null;
          status?: "En proceso" | "Resuelto" | "No resuelto";
          referred?: boolean;
          loaded_by?: string;
          latlon?: string | null;
          form_variant?: string | null;
          extra_data?: Record<string, unknown> | null;
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

      work_orders: {
        Row: {
          id: string;
          order_number: string | null;
          entry_date: string | null;
          requesting_area: string | null;
          failure_report: string | null;
          repair_type: string | null;
          vehicle_code: string | null;
          criticality: string | null;
          failure_type: string | null;
          failure_location: string | null;
          requires_spare_part: string | null;
          vehicle: string | null;
          license_plate: string | null;
          exit_date: string | null;
          spare_part_code: string | null;
          units: number | null;
          provider: string | null;
          amount: number | null;
          observations: string | null;
          driver: string | null;
          status: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          workshop_entry_date: string | null;
          closed_date: string | null;
          year_month: string | null;
          spare_part_detail: string | null;
        };
        Insert: {
          id?: string;
          order_number?: string | null;
          entry_date?: string | null;
          requesting_area?: string | null;
          failure_report?: string | null;
          repair_type?: string | null;
          vehicle_code?: string | null;
          criticality?: string | null;
          failure_type?: string | null;
          failure_location?: string | null;
          requires_spare_part?: string | null;
          vehicle?: string | null;
          license_plate?: string | null;
          exit_date?: string | null;
          spare_part_code?: string | null;
          units?: number | null;
          provider?: string | null;
          amount?: number | null;
          observations?: string | null;
          driver?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          workshop_entry_date?: string | null;
          closed_date?: string | null;
          year_month?: string | null;
          spare_part_detail?: string | null;
        };
        Update: {
          id?: string;
          order_number?: string | null;
          entry_date?: string | null;
          requesting_area?: string | null;
          failure_report?: string | null;
          repair_type?: string | null;
          vehicle_code?: string | null;
          criticality?: string | null;
          failure_type?: string | null;
          failure_location?: string | null;
          requires_spare_part?: string | null;
          vehicle?: string | null;
          license_plate?: string | null;
          exit_date?: string | null;
          spare_part_code?: string | null;
          units?: number | null;
          provider?: string | null;
          amount?: number | null;
          observations?: string | null;
          driver?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          workshop_entry_date?: string | null;
          closed_date?: string | null;
          year_month?: string | null;
          spare_part_detail?: string | null;
        };
      };


      supply_categories: {
        Row: {
          id: string;
          name: string;
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      supply_products: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          unit: string;
          minimum_stock: number;
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          unit?: string;
          minimum_stock?: number;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          unit?: string;
          minimum_stock?: number;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      supply_recipients: {
        Row: {
          id: string;
          full_name: string;
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      supply_areas: {
        Row: {
          id: string;
          name: string;
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      supply_movements: {
        Row: {
          id: string;
          movement_date: string;
          movement_type:
            | "INITIAL"
            | "ENTRY"
            | "DELIVERY"
            | "ADJUSTMENT_IN"
            | "ADJUSTMENT_OUT";
          product_id: string;
          quantity: number;
          recipient_id: string | null;
          area_id: string | null;
          reference: string | null;
          observations: string | null;
          legacy_destination: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          movement_date?: string;
          movement_type:
            | "INITIAL"
            | "ENTRY"
            | "DELIVERY"
            | "ADJUSTMENT_IN"
            | "ADJUSTMENT_OUT";
          product_id: string;
          quantity: number;
          recipient_id?: string | null;
          area_id?: string | null;
          reference?: string | null;
          observations?: string | null;
          legacy_destination?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          movement_date?: string;
          movement_type?:
            | "INITIAL"
            | "ENTRY"
            | "DELIVERY"
            | "ADJUSTMENT_IN"
            | "ADJUSTMENT_OUT";
          product_id?: string;
          quantity?: number;
          recipient_id?: string | null;
          area_id?: string | null;
          reference?: string | null;
          observations?: string | null;
          legacy_destination?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };

    Views: {
      supply_current_stock: {
        Row: {
          product_id: string;
          product_name: string;
          unit: string;
          minimum_stock: number;
          product_active: boolean;
          category_id: string;
          category_name: string;
          category_active: boolean;
          current_stock: number;
          initial_stock: number;
          total_entries: number;
          total_deliveries: number;
          total_adjustments_in: number;
          total_adjustments_out: number;
          low_stock: boolean;
        };
      };
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

export type WorkOrder = Database["public"]["Tables"]["work_orders"]["Row"];
export type WorkOrderInsert =
  Database["public"]["Tables"]["work_orders"]["Insert"];
export type WorkOrderUpdate =
  Database["public"]["Tables"]["work_orders"]["Update"];


export type SupplyCategory =
  Database["public"]["Tables"]["supply_categories"]["Row"];
export type SupplyCategoryInsert =
  Database["public"]["Tables"]["supply_categories"]["Insert"];
export type SupplyCategoryUpdate =
  Database["public"]["Tables"]["supply_categories"]["Update"];

export type SupplyProduct =
  Database["public"]["Tables"]["supply_products"]["Row"];
export type SupplyProductInsert =
  Database["public"]["Tables"]["supply_products"]["Insert"];
export type SupplyProductUpdate =
  Database["public"]["Tables"]["supply_products"]["Update"];

export type SupplyRecipient =
  Database["public"]["Tables"]["supply_recipients"]["Row"];
export type SupplyRecipientInsert =
  Database["public"]["Tables"]["supply_recipients"]["Insert"];
export type SupplyRecipientUpdate =
  Database["public"]["Tables"]["supply_recipients"]["Update"];

export type SupplyArea =
  Database["public"]["Tables"]["supply_areas"]["Row"];
export type SupplyAreaInsert =
  Database["public"]["Tables"]["supply_areas"]["Insert"];
export type SupplyAreaUpdate =
  Database["public"]["Tables"]["supply_areas"]["Update"];

export type SupplyMovement =
  Database["public"]["Tables"]["supply_movements"]["Row"];
export type SupplyMovementInsert =
  Database["public"]["Tables"]["supply_movements"]["Insert"];
export type SupplyMovementUpdate =
  Database["public"]["Tables"]["supply_movements"]["Update"];

export type SupplyCurrentStock =
  Database["public"]["Views"]["supply_current_stock"]["Row"];

export type SupplyMovementType =
  | "INITIAL"
  | "ENTRY"
  | "DELIVERY"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT";

export type ComplaintWithDetails = Complaint & {
  service: Service | null;
  cause: Cause | null;
  loaded_by_user: User;
};

export type ComplaintHistoryWithUser = ComplaintHistory & {
  user: Pick<User, "full_name"> | null;
};

export type ComplaintStatus = "En proceso" | "Resuelto" | "No resuelto";
export type ContactMethod = "Presencial" | "Telefono" | "Email" | "WhatsApp" | "Nota";

export type UserRole =
  | "Admin"
  | "Reclamos"
  | "ReclamosArbolado"
  | "ReclamosZyV"
  | "AdminLectura"
  | "FC_RRHH"
  | "FC_SECTOR"
  | "Taller"
  | "Suministros";