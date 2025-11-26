import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { CauseInsert } from "@/types";

/**
 * GET /api/causes
 * List all causes with optional service_id and active filters
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
    const serviceId = searchParams.get("service_id");
    const activeFilter = searchParams.get("active");

    // Build query
    let query = supabase
      .from("causes")
      .select("*")
      .order("name", { ascending: true });

    // Apply service filter if provided
    if (serviceId) {
      const parsedServiceId = parseInt(serviceId);
      if (!isNaN(parsedServiceId)) {
        query = query.eq("service_id", parsedServiceId);
      }
    }

    // Apply active filter if provided
    if (activeFilter !== null) {
      query = query.eq("active", activeFilter === "true");
    }

    const { data: causes, error } = await query;

    if (error) {
      console.error("Error fetching causes:", error);
      return NextResponse.json(
        { error: "Error al cargar causas" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: causes });
  } catch (error) {
    console.error("Unexpected error in GET /api/causes:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/causes
 * Create a new cause
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
        { error: "No autorizado. Solo administradores pueden crear causas" },
        { status: 403 },
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, service_id } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "El nombre de la causa es requerido" },
        { status: 400 },
      );
    }

    if (!service_id) {
      return NextResponse.json(
        { error: "El ID del servicio es requerido" },
        { status: 400 },
      );
    }

    // Verify service exists
    const { data: service } = await supabase
      .from("services")
      .select("id")
      .eq("id", service_id)
      .single();

    if (!service) {
      return NextResponse.json(
        { error: "El servicio especificado no existe" },
        { status: 404 },
      );
    }

    // Check if cause name already exists for this service (unique constraint)
    const { data: existingCause } = await supabase
      .from("causes")
      .select("id")
      .eq("service_id", service_id)
      .eq("name", name.trim())
      .single();

    if (existingCause) {
      return NextResponse.json(
        { error: "Ya existe una causa con este nombre para este servicio" },
        { status: 409 },
      );
    }

    // Create cause
    const causeInsert: CauseInsert = {
      name: name.trim(),
      service_id,
    };

    const { data: newCause, error: dbError } = await supabase
      .from("causes")
      .insert(causeInsert)
      .select()
      .single();

    if (dbError) {
      console.error("Error creating cause:", dbError);
      return NextResponse.json(
        { error: "Error al crear causa" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { data: newCause, message: "Causa creada exitosamente" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/causes:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
