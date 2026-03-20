import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { UserUpdate } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

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

    const body = await request.json();
    const { full_name, email, role, password } = body;

    if (
      role &&
      role !== "Admin" &&
      role !== "Reclamos" &&
      role !== "AdminLectura"
    ) {
      return NextResponse.json(
        {
          error:
            'Rol inválido. Debe ser "Admin", "Reclamos" o "AdminLectura"',
        },
        { status: 400 },
      );
    }

    const adminClient = await createAdminClient();

    if (email) {
      const { error: authUpdateError } =
        await adminClient.auth.admin.updateUserById(id, { email });

      if (authUpdateError) {
        console.error("Error updating auth user email:", authUpdateError);
        return NextResponse.json(
          { error: "Error al actualizar email en autenticación" },
          { status: 500 },
        );
      }
    }

    if (password) {
      const { error: passwordError } =
        await adminClient.auth.admin.updateUserById(id, { password });

      if (passwordError) {
        console.error("Error updating user password:", passwordError);
        return NextResponse.json(
          { error: "Error al actualizar contraseña" },
          { status: 500 },
        );
      }
    }

    const userUpdate: UserUpdate = {};
    if (full_name) userUpdate.full_name = full_name;
    if (email) userUpdate.email = email;
    if (role) userUpdate.role = role;

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

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

    if (authUser.id === id) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propio usuario" },
        { status: 400 },
      );
    }

    const { error: dbError } = await supabase.from("users").delete().eq("id", id);

    if (dbError) {
      console.error("Error deleting user from database:", dbError);
      return NextResponse.json(
        { error: "Error al eliminar usuario de la base de datos" },
        { status: 500 },
      );
    }

    const adminClient = await createAdminClient();

    const { error: authDeleteError } =
      await adminClient.auth.admin.deleteUser(id);

    if (authDeleteError) {
      console.error("Error deleting auth user:", authDeleteError);
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