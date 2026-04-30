export * from "./database";

// Additional shared types for the application
export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface SearchFilters {
  search?: string;
  status?: string;
  service_id?: number;
  date_from?: string;
  date_to?: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
  message?: string;
}

export type UserRole =
  | "Admin"
  | "Reclamos"
  | "ReclamosArbolado"
  | "ReclamosZyV"
  | "AdminLectura"
  | "FC_RRHH"
  | "FC_SECTOR";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}

export interface DashboardStats {
  total_complaints: number;
  in_progress: number;
  resolved: number;
  unresolved: number;
  recent_complaints: number;
}

export interface UserFilters {
  search?: string;
  role?: UserRole;
}

export interface UserFormData {
  full_name: string;
  email: string;
  role: UserRole;
  password?: string;
}

// Dropdown values for "since_when" field (UI only - database stores calculated date)
export type SinceWhenPeriod =
  | "En el día"
  | "1 semana"
  | "1 mes"
  | "3 meses"
  | "6 meses"
  | "1 año";

export const SINCE_WHEN_OPTIONS: { value: SinceWhenPeriod; label: string }[] =
  [
    { value: "En el día", label: "En el día" },
    { value: "1 semana", label: "1 semana" },
    { value: "1 mes", label: "1 mes" },
    { value: "3 meses", label: "3 meses" },
    { value: "6 meses", label: "6 meses" },
    { value: "1 año", label: "1 año" },
  ];