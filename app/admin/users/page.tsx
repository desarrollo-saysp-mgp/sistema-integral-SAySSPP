"use client";

import { useState } from "react";
import { useUsers } from "@/hooks/useUsers";
import { UserTable } from "@/components/tables/UserTable";
import { UserForm } from "@/components/forms/UserForm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import type { User, UserFormData } from "@/types";

export default function UsersPage() {
  const {
    users,
    loading,
    error,
    createUser,
    updateUser,
    deleteUser,
    setFilters,
  } = useUsers();

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreateUser = async (data: UserFormData) => {
    const result = await createUser(data);

    if (result.success) {
      toast.success("Usuario creado exitosamente");
      return { success: true };
    } else {
      toast.error(result.error || "Error al crear usuario");
      return { success: false, error: result.error };
    }
  };

  const handleUpdateUser = async (data: UserFormData) => {
    if (!selectedUser)
      return { success: false, error: "No hay usuario seleccionado" };

    const result = await updateUser(selectedUser.id, data);

    if (result.success) {
      toast.success("Usuario actualizado exitosamente");
      return { success: true };
    } else {
      toast.error(result.error || "Error al actualizar usuario");
      return { success: false, error: result.error };
    }
  };

  const handleDeleteUser = async (user: User) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    const result = await deleteUser(userToDelete.id);
    setIsDeleting(false);

    if (result.success) {
      toast.success("Usuario eliminado exitosamente");
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    } else {
      toast.error(result.error || "Error al eliminar usuario");
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsFormOpen(true);
  };

  const handleNewUser = () => {
    setSelectedUser(null);
    setIsFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setSelectedUser(null);
    }
  };

  const handleSearchChange = (search: string) => {
    setFilters({ search });
  };

  const handleRoleFilter = (role: string | undefined) => {
    setFilters({ role: role as "Admin" | "Administrative" | undefined });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Gestión de Usuarios
          </h1>
          <p className="text-muted-foreground mt-2">
            Administra los usuarios del sistema y sus roles
          </p>
        </div>
        <Button onClick={handleNewUser}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Users table */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios del sistema</CardTitle>
          <CardDescription>
            Lista de todos los usuarios registrados con sus roles y permisos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserTable
            users={users}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDeleteUser}
            onSearchChange={handleSearchChange}
            onRoleFilter={handleRoleFilter}
          />
        </CardContent>
      </Card>

      {/* User form dialog */}
      <UserForm
        user={selectedUser}
        open={isFormOpen}
        onOpenChange={handleFormClose}
        onSubmit={selectedUser ? handleUpdateUser : handleCreateUser}
      />

      {/* Delete confirmation dialog */}
      {isDeleteDialogOpen && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Confirmar eliminación</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              ¿Estás seguro de que deseas eliminar al usuario{" "}
              <span className="font-semibold">{userToDelete.full_name}</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setUserToDelete(null);
                }}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
