import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { UserUpdate } from "@/types";

/**
 * GET /api/users/[id]
 * Get a single user by ID
 * Requires: Admin role
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Check if user is Admin
    const { data: currentUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (!currentUser || currentUser.role !== "Admin") {
      return NextResponse.json(
        { error: "No autorizado. Solo administradores pueden ver usuarios" },
        { status: 403 },
      );
    }

    // Fetch user
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 404 },
        );
      }
      console.error("Error fetching user:", error);
      return NextResponse.json(
        { error: "Error al cargar usuario" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error("Unexpected error in GET /api/users/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/users/[id]
 * Update a user
 * Requires: Admin role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Check if user is Admin
    const { data: currentUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (!currentUser || currentUser.role !== "Admin") {
      return NextResponse.json(
        { error: "No autorizado. Solo administradores pueden editar usuarios" },
        { status: 403 },
      );
    }

    // Parse request body
    const body = await request.json();
    const { full_name, email, role, password } = body;

    // Validate role if provided
    if (role && role !== "Admin" && role !== "Administrative") {
      return NextResponse.json(
        { error: 'Rol inválido. Debe ser "Admin" o "Administrative"' },
        { status: 400 },
      );
    }

    // Update email in Auth if email changed
    if (email) {
      const { error: authUpdateError } =
        await supabase.auth.admin.updateUserById(id, { email });

      if (authUpdateError) {
        console.error("Error updating auth user email:", authUpdateError);
        return NextResponse.json(
          { error: "Error al actualizar email en autenticación" },
          { status: 500 },
        );
      }
    }

    // Update password if provided
    if (password) {
      const { error: passwordError } = await supabase.auth.admin.updateUserById(
        id,
        { password },
      );

      if (passwordError) {
        console.error("Error updating user password:", passwordError);
        return NextResponse.json(
          { error: "Error al actualizar contraseña" },
          { status: 500 },
        );
      }
    }

    // Build update object for database
    const userUpdate: UserUpdate = {};
    if (full_name) userUpdate.full_name = full_name;
    if (email) userUpdate.email = email;
    if (role) userUpdate.role = role;

    // Update user in database
    const { data: updatedUser, error: dbError } = await supabase
      .from("users")
      .update(userUpdate)
      .eq("id", id)
      .select()
      .single();

    if (dbError) {
      console.error("Error updating user in database:", dbError);
      return NextResponse.json(
        { error: "Error al actualizar usuario" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: updatedUser,
      message: "Usuario actualizado exitosamente",
    });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/users/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/users/[id]
 * Delete a user
 * Requires: Admin role
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Check if user is Admin
    const { data: currentUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (!currentUser || currentUser.role !== "Admin") {
      return NextResponse.json(
        {
          error: "No autorizado. Solo administradores pueden eliminar usuarios",
        },
        { status: 403 },
      );
    }

    // Prevent self-deletion
    if (authUser.id === id) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propio usuario" },
        { status: 400 },
      );
    }

    // Delete from database first (will cascade due to foreign keys)
    const { error: dbError } = await supabase
      .from("users")
      .delete()
      .eq("id", id);

    if (dbError) {
      console.error("Error deleting user from database:", dbError);
      return NextResponse.json(
        { error: "Error al eliminar usuario de la base de datos" },
        { status: 500 },
      );
    }

    // Delete from Auth
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(id);

    if (authDeleteError) {
      console.error("Error deleting auth user:", authDeleteError);
      // User was deleted from DB but not from Auth - this is acceptable
      // The Auth user will be orphaned but can't log in without a DB record
    }

    return NextResponse.json({ message: "Usuario eliminado exitosamente" });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/users/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
