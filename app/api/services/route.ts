import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { ServiceInsert } from "@/types";

/**
 * GET /api/services
 * List all services with optional active filter
 * Requires: Authentication
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Parse filters from query params
    const { searchParams } = new URL(request.url);
    const activeFilter = searchParams.get("active");

    // Build query
    let query = supabase
      .from("services")
      .select("*")
      .order("name", { ascending: true });

    // Apply active filter if provided
    if (activeFilter !== null) {
      query = query.eq("active", activeFilter === "true");
    }

    const { data: services, error } = await query;

    if (error) {
      console.error("Error fetching services:", error);
      return NextResponse.json(
        { error: "Error al cargar servicios" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: services });
  } catch (error) {
    console.error("Unexpected error in GET /api/services:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/services
 * Create a new service
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
        { error: "No autorizado. Solo administradores pueden crear servicios" },
        { status: 403 },
      );
    }

    // Parse request body
    const body = await request.json();
    const { name } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "El nombre del servicio es requerido" },
        { status: 400 },
      );
    }

    // Check if service name already exists
    const { data: existingService } = await supabase
      .from("services")
      .select("id")
      .eq("name", name.trim())
      .single();

    if (existingService) {
      return NextResponse.json(
        { error: "Ya existe un servicio con este nombre" },
        { status: 409 },
      );
    }

    // Create service
    const serviceInsert: ServiceInsert = {
      name: name.trim(),
    };

    const { data: newService, error: dbError } = await supabase
      .from("services")
      .insert(serviceInsert)
      .select()
      .single();

    if (dbError) {
      console.error("Error creating service:", dbError);
      return NextResponse.json(
        { error: "Error al crear servicio" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { data: newService, message: "Servicio creado exitosamente" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/services:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
