import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { UserInsert } from "@/types";

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

    if (!currentUser || currentUser.role !== "Admin") {
      return NextResponse.json(
        { error: "No autorizado. Solo administradores pueden ver usuarios" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const role = searchParams.get("role") as "Admin" | "Reclamos" | null;

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
    const { full_name, email, role, password } = body;

    if (!full_name || !email || !role || !password) {
      return NextResponse.json(
        {
          error:
            "Todos los campos son requeridos: full_name, email, role, password",
        },
        { status: 400 },
      );
    }

    if (role !== "Admin" && role !== "Reclamos") {
      return NextResponse.json(
        { error: 'Rol inválido. Debe ser "Admin" o "Reclamos"' },
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

    const userInsert: UserInsert = {
      id: newAuthUser.user.id,
      full_name,
      email,
      role,
    };

    const { data: newUser, error: dbError } = await supabase
      .from("users")
      .insert(userInsert)
      .select()
      .single();

    if (dbError) {
      console.error("Error creating user in database:", dbError);
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