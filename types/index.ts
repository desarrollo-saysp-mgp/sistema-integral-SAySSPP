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

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: "Admin" | "Administrative";
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
  role?: "Admin" | "Administrative";
}

export interface UserFormData {
  full_name: string;
  email: string;
  role: "Admin" | "Administrative";
}
