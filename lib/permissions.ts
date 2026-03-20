import type { UserRole } from "@/types";

export const isAdmin = (role?: UserRole | null) =>
  role === "Admin" || role === "AdminLectura";

export const isReadOnly = (role?: UserRole | null) =>
  role === "AdminLectura";

export const canEdit = (role?: UserRole | null) =>
  role === "Admin" || role === "Reclamos";

export const canManageUsers = (role?: UserRole | null) =>
  role === "Admin";