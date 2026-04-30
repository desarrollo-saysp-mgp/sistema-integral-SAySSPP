import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { UserUpdate } from "@/types";

type SupportedRole =
  | "Admin"
  | "Reclamos"
  | "ReclamosArbolado"
  | "ReclamosZyV"
  | "AdminLectura"
  | "FC_RRHH"
  | "FC_SECTOR";

function getRoleConfig(role: SupportedRole, email?: string) {
  const normalizedEmail = (email || "").trim().toLowerCase();

  switch (role) {
    case "Admin":
      return {
        modules: [
          "complaints",
          "purchase_requests",
          "rrhh",
          "fleet",
          "work_orders",
          "fuel",
          "kilometers",
          "tires",
          "apu",
          "zv",
          "girsu",
          "public_services",
        ],
        is_readonly: false,
        default_module: null,
        fc_sectors: ["all"],
      };

    case "AdminLectura":
      return {
        modules: [
          "complaints",
          "purchase_requests",
          "rrhh",
          "fleet",
          "work_orders",
          "fuel",
          "kilometers",
          "tires",
          "apu",
          "zv",
          "girsu",
          "public_services",
        ],
        is_readonly: true,
        default_module: null,
        fc_sectors: ["all"],
      };

    case "Reclamos":
      return {
        modules: ["complaints"],
        is_readonly: false,
        default_module: "complaints",
        fc_sectors: [],
      };

    case "ReclamosArbolado":
      return {
        modules: ["complaints"],
        is_readonly: false,
        default_module: "complaints",
        fc_sectors: [],
      };

    case "ReclamosZyV":
      return {
        modules: ["complaints"],
        is_readonly: false,
        default_module: "complaints",
        fc_sectors: [],
      };
    case "FC_RRHH":
      return {
        modules: ["purchase_requests", "rrhh"],
        is_readonly: false,
        default_module: null,
        fc_sectors: ["all"],
      };

    case "FC_SECTOR": {
      const sectorMap: Record<string, string[]> = {
        "arqbelliardolucas@gmail.com": ["arbolado"],
        "yonafigueroa2016@gmail.com": ["arbolado"],
        "dir.arboladoyparquesurbanos@gmail.com": ["arbolado"],
        "reservanaturaldelfinperez@gmail.com": ["arbolado"],

        "suministros.mgp@gmail.com": ["suministros"],
        "suministroscorralon@gmail.com": ["suministros"],
        "comprasyactivos.gp@gmail.com": ["suministros"],

        "direcciondezoonosismgp@gmail.com": ["zv"],

        "adm.serviciospublicos.mgp@gmail.com": ["sp"],
        "direccionspgralpico@gmail.com": ["sp"],
      };

      return {
        modules: ["purchase_requests"],
        is_readonly: false,
        default_module: "purchase_requests",
        fc_sectors: sectorMap[normalizedEmail] ?? [],
      };
    }

    default:
      return {
        modules: [],
        is_readonly: false,
        default_module: null,
        fc_sectors: [],
      };
  }
}

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
    const { full_name, email, role, password } = body as {
      full_name?: string;
      email?: string;
      role?: SupportedRole;
      password?: string;
    };

    if (
      role &&
      role !== "Admin" &&
      role !== "Reclamos" &&
      role !== "ReclamosArbolado" &&
      role !== "ReclamosZyV" &&
      role !== "AdminLectura" &&
      role !== "FC_RRHH" &&
      role !== "FC_SECTOR"
    ) {
      return NextResponse.json(
        {
          error:
            'Rol inválido. Debe ser "Admin", "Reclamos", "AdminLectura", "FC_RRHH" o "FC_SECTOR"',
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

    if (role) {
      userUpdate.role = role;
      const config = getRoleConfig(role, email);
      userUpdate.modules = config.modules;
      userUpdate.is_readonly = config.is_readonly;
      userUpdate.default_module = config.default_module;
      userUpdate.fc_sectors = config.fc_sectors;
    }

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