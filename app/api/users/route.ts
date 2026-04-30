import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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

export async function GET(request: NextRequest) {
  try {
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

    if (
      !currentUser ||
      (currentUser.role !== "Admin" &&
        currentUser.role !== "AdminLectura")
    ) {
      return NextResponse.json(
        {
          error:
            "No autorizado. Solo administradores y administradores de lectura pueden ver usuarios",
        },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const role = searchParams.get("role") as SupportedRole | null;

    let query = supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (role) {
      query = query.eq("role", role);
    }

    const { data: users, error } = await query;

    if (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json(
        { error: "Error al cargar usuarios" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error("Unexpected error in GET /api/users:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
        { error: "No autorizado. Solo administradores pueden crear usuarios" },
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

    if (!full_name || !email || !role || !password) {
      return NextResponse.json(
        {
          error:
            "Todos los campos son requeridos: full_name, email, role, password",
        },
        { status: 400 },
      );
    }

    if (
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

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 },
      );
    }

    const adminClient = await createAdminClient();

    const { data: newAuthUser, error: authCreateError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
        },
      });

    if (authCreateError || !newAuthUser.user) {
      console.error("Error creating auth user:", authCreateError);
      return NextResponse.json(
        {
          error:
            authCreateError?.message ||
            "Error al crear usuario en autenticación",
        },
        { status: 500 },
      );
    }

    const roleConfig = getRoleConfig(role, email);

    const { data: newUser, error: dbError } = await supabase
      .from("users")
      .update({
        full_name,
        email,
        role,
        modules: roleConfig.modules,
        is_readonly: roleConfig.is_readonly,
        default_module: roleConfig.default_module,
        fc_sectors: roleConfig.fc_sectors,
      })
      .eq("id", newAuthUser.user.id)
      .select("*")
      .single();

    if (dbError || !newUser) {
      console.error("Error updating created user in database:", dbError);

      await adminClient.auth.admin.deleteUser(newAuthUser.user.id);

      return NextResponse.json(
        { error: "Error al crear usuario en la base de datos" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { data: newUser, message: "Usuario creado exitosamente" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/users:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}