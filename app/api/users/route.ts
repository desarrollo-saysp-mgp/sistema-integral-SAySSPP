import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { UserInsert, UserFilters } from "@/types";

/**
 * GET /api/users
 * List all users with optional filters
 * Requires: Admin role
 */
export async function GET(request: NextRequest) {
  try {
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

    // Parse filters from query params
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const role = searchParams.get("role") as "Admin" | "Administrative" | null;

    // Build query
    let query = supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    // Apply filters
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

/**
 * POST /api/users
 * Create a new user
 * Requires: Admin role
 */
export async function POST(request: NextRequest) {
  try {
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
        { error: "No autorizado. Solo administradores pueden crear usuarios" },
        { status: 403 },
      );
    }

    // Parse request body
    const body = await request.json();
    const { full_name, email, role } = body;

    // Validate required fields
    if (!full_name || !email || !role) {
      return NextResponse.json(
        {
          error: "Todos los campos son requeridos: full_name, email, role",
        },
        { status: 400 },
      );
    }

    // Validate role
    if (role !== "Admin" && role !== "Administrative") {
      return NextResponse.json(
        { error: 'Rol inválido. Debe ser "Admin" o "Administrative"' },
        { status: 400 },
      );
    }

    // Invite user via email - this sends an invitation email automatically
    const { data: newAuthUser, error: authCreateError } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/dashboard`,
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

    // Create user in users table
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
      // Rollback: delete auth user if database insert fails
      await supabase.auth.admin.deleteUser(newAuthUser.user.id);
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
