"use client";

import { useState, useEffect, useCallback } from "react";
import type { User, UserFilters, UserFormData, ApiResponse } from "@/types";

interface UseUsersReturn {
  users: User[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createUser: (
    userData: UserFormData,
  ) => Promise<{ success: boolean; error?: string }>;
  updateUser: (
    id: string,
    userData: Partial<UserFormData>,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;
  setFilters: (filters: UserFilters) => void;
  filters: UserFilters;
}

export function useUsers(initialFilters: UserFilters = {}): UseUsersReturn {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UserFilters>(initialFilters);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params from filters
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.role) params.append("role", filters.role);

      const response = await fetch(`/api/users?${params.toString()}`);
      const result: ApiResponse<User[]> = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al cargar usuarios");
      }

      setUsers(result.data || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error desconocido";
      setError(errorMessage);
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const createUser = async (
    userData: UserFormData,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const result: ApiResponse<User> = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || "Error al crear usuario",
        };
      }

      // Refresh users list
      await fetchUsers();

      return { success: true };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error desconocido";
      return { success: false, error: errorMessage };
    }
  };

  const updateUser = async (
    id: string,
    userData: Partial<UserFormData>,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const result: ApiResponse<User> = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || "Error al actualizar usuario",
        };
      }

      // Refresh users list
      await fetchUsers();

      return { success: true };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error desconocido";
      return { success: false, error: errorMessage };
    }
  };

  const deleteUser = async (
    id: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });

      const result: ApiResponse<null> = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || "Error al eliminar usuario",
        };
      }

      // Refresh users list
      await fetchUsers();

      return { success: true };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error desconocido";
      return { success: false, error: errorMessage };
    }
  };

  // Fetch users when filters change
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    setFilters,
    filters,
  };
}
