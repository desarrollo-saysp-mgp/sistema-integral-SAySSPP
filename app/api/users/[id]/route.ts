import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { UserUpdate } from "@/types";

type SupportedRole =
  | "Admin"
  | "Reclamos"
  | "ReclamosArbolado"
  | "ReclamosZyV"
  | "AdminLectura"
  | "SecretariaPrivada"
  | "FC_RRHH"
  | "FC_SECTOR"
  | "Taller"
  | "Suministros"
  | "RNU";

const VALID_ROLES: SupportedRole[] = [
  "Admin",
  "Reclamos",
  "ReclamosArbolado",
  "ReclamosZyV",
  "AdminLectura",
  "SecretariaPrivada",
  "FC_RRHH",
  "FC_SECTOR",
  "Taller",
  "Suministros",
  "RNU",
];

function getRoleConfig(role: SupportedRole, email?: string) {
  const normalizedEmail = (email || "").trim().toLowerCase();

  switch (role) {
    case "Admin":
      return {
        modules: [
          "complaints",
          "purchase_requests",
          "rrhh",
          "personnel",
          "fleet",
          "work_orders",
          "fuel",
          "kilometers",
          "tires",
          "apu",
          "zv",
          "girsu",
          "public_services",
          "stock_inventory",
          "rnu",
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
          "stock_inventory",
          "rnu",
        ],
        is_readonly: true,
        default_module: null,
        fc_sectors: ["all"],
      };

    case "SecretariaPrivada":
      return {
        modules: ["personnel"],
        is_readonly: false,
        default_module: "personnel",
        fc_sectors: [],
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

    case "Taller":
      return {
        modules: ["work_orders"],
        is_readonly: false,
        default_module: "work_orders",
        fc_sectors: [],
      };

    case "Suministros":
      return {
        modules: ["stock_inventory"],
        is_readonly: false,
        default_module: "stock_inventory",
        fc_sectors: [],
      };

    case "RNU":
      return {
        modules: ["rnu"],
        is_readonly: false,
        default_module: "rnu",
        fc_sectors: [],
      };

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
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 },
      );
    }

    const { data: currentUser, error: currentUserError } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (currentUserError || !currentUser) {
      return NextResponse.json(
        { error: "No se pudo obtener el perfil del usuario" },
        { status: 403 },
      );
    }

    if (
      currentUser.role !== "Admin" &&
      currentUser.role !== "AdminLectura"
    ) {
      return NextResponse.json(
        {
          error:
            "No autorizado. Solo administradores y administradores de lectura pueden ver usuarios",
        },
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
    console.error(
      "Unexpected error in GET /api/users/[id]:",
      error,
    );

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
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 },
      );
    }

    const { data: currentUser, error: currentUserError } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (
      currentUserError ||
      !currentUser ||
      currentUser.role !== "Admin"
    ) {
      return NextResponse.json(
        {
          error:
            "No autorizado. Solo administradores pueden editar usuarios",
        },
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

    const normalizedFullName = full_name?.trim();
    const normalizedEmail = email?.trim().toLowerCase();

    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        {
          error:
            'Rol inválido. Debe ser "Admin", "Reclamos", "ReclamosArbolado", "ReclamosZyV", "AdminLectura", "SecretariaPrivada", "FC_RRHH", "FC_SECTOR", "Taller", "Suministros" o "RNU"',
        },
        { status: 400 },
      );
    }

    if (password && password.length < 6) {
      return NextResponse.json(
        {
          error: "La contraseña debe tener al menos 6 caracteres",
        },
        { status: 400 },
      );
    }

    const adminClient = await createAdminClient();

    /*
     * Actualizar email en Supabase Auth
     */
    if (normalizedEmail) {
      const { error: authUpdateError } =
        await adminClient.auth.admin.updateUserById(id, {
          email: normalizedEmail,
        });

      if (authUpdateError) {
        console.error(
          "Error updating auth user email:",
          authUpdateError,
        );

        return NextResponse.json(
          {
            error:
              "Error al actualizar email en autenticación",
          },
          { status: 500 },
        );
      }
    }

    /*
     * Actualizar contraseña
     */
    if (password) {
      const { error: passwordError } =
        await adminClient.auth.admin.updateUserById(id, {
          password,
        });

      if (passwordError) {
        console.error(
          "Error updating user password:",
          passwordError,
        );

        return NextResponse.json(
          {
            error: "Error al actualizar contraseña",
          },
          { status: 500 },
        );
      }
    }

    /*
     * Obtener el usuario actual.
     *
     * Esto permite conservar el email existente cuando se cambia solamente
     * el rol. Es importante especialmente para el rol FC_SECTOR, porque sus
     * permisos dependen del correo electrónico.
     */
    const { data: userToUpdate, error: userToUpdateError } = await supabase
      .from("users")
      .select("email")
      .eq("id", id)
      .single();

    if (userToUpdateError || !userToUpdate) {
      return NextResponse.json(
        { error: "No se pudo obtener el usuario a actualizar" },
        { status: 404 },
      );
    }

    /*
     * Actualizar perfil en tabla users
     */
    const userUpdate: UserUpdate = {};

    if (normalizedFullName) {
      userUpdate.full_name = normalizedFullName;
    }

    if (normalizedEmail) {
      userUpdate.email = normalizedEmail;
    }

    if (role) {
      userUpdate.role = role;

      const roleEmail = normalizedEmail || userToUpdate.email;
      const config = getRoleConfig(role, roleEmail);

      userUpdate.modules = config.modules;
      userUpdate.is_readonly = config.is_readonly;
      userUpdate.default_module = config.default_module;
      userUpdate.fc_sectors = config.fc_sectors;
    }

    if (Object.keys(userUpdate).length === 0 && !password) {
      return NextResponse.json(
        { error: "No se enviaron cambios para actualizar" },
        { status: 400 },
      );
    }

    /*
     * Si solamente se modificó la contraseña, no hace falta ejecutar un
     * UPDATE vacío sobre public.users.
     */
    if (Object.keys(userUpdate).length === 0) {
      return NextResponse.json({
        message: "Contraseña actualizada exitosamente",
      });
    }

    const { data: updatedUser, error: dbError } = await supabase
      .from("users")
      .update(userUpdate)
      .eq("id", id)
      .select()
      .single();

    if (dbError) {
      console.error(
        "Error updating user in database:",
        dbError,
      );

      return NextResponse.json(
        {
          error: "Error al actualizar usuario",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: updatedUser,
      message: "Usuario actualizado exitosamente",
    });
  } catch (error) {
    console.error(
      "Unexpected error in PATCH /api/users/[id]:",
      error,
    );

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
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 },
      );
    }

    const { data: currentUser, error: currentUserError } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (
      currentUserError ||
      !currentUser ||
      currentUser.role !== "Admin"
    ) {
      return NextResponse.json(
        {
          error:
            "No autorizado. Solo administradores pueden eliminar usuarios",
        },
        { status: 403 },
      );
    }

    if (authUser.id === id) {
      return NextResponse.json(
        {
          error: "No puedes eliminar tu propio usuario",
        },
        { status: 400 },
      );
    }

    /*
     * Primero eliminar de la tabla public.users
     */
    const { error: dbError } = await supabase
      .from("users")
      .delete()
      .eq("id", id);

    if (dbError) {
      console.error(
        "Error deleting user from database:",
        dbError,
      );

      return NextResponse.json(
        {
          error:
            "Error al eliminar usuario de la base de datos",
        },
        { status: 500 },
      );
    }

    /*
     * Después eliminar de Supabase Auth
     */
    const adminClient = await createAdminClient();

    const { error: authDeleteError } =
      await adminClient.auth.admin.deleteUser(id);

    if (authDeleteError) {
      console.error(
        "Error deleting auth user:",
        authDeleteError,
      );

      return NextResponse.json(
        {
          error:
            "El perfil fue eliminado, pero ocurrió un error al eliminar el usuario de autenticación",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "Usuario eliminado exitosamente",
    });
  } catch (error) {
    console.error(
      "Unexpected error in DELETE /api/users/[id]:",
      error,
    );

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}