import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { ComplaintInsert, SearchFilters } from "@/types";

/**
 * GET /api/complaints
 * List all complaints with optional filters
 * Requires: Authenticated user
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

    // Parse filters from query params
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const service_id = searchParams.get("service_id");
    const date_from = searchParams.get("date_from");
    const date_to = searchParams.get("date_to");

    // Build query with related data
    let query = supabase
      .from("complaints")
      .select(
        `
        *,
        service:services(id, name),
        cause:causes(id, name),
        loaded_by_user:users!loaded_by(id, full_name)
      `,
      )
      .order("created_at", { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(
        `complaint_number.ilike.%${search}%,complainant_name.ilike.%${search}%,address.ilike.%${search}%`,
      );
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (service_id) {
      query = query.eq("service_id", parseInt(service_id));
    }

    if (date_from) {
      query = query.gte("complaint_date", date_from);
    }

    if (date_to) {
      query = query.lte("complaint_date", date_to);
    }

    const { data: complaints, error } = await query;

    if (error) {
      console.error("Error fetching complaints:", error);
      return NextResponse.json(
        { error: "Error al cargar reclamos" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: complaints });
  } catch (error) {
    console.error("Unexpected error in GET /api/complaints:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/complaints
 * Create a new complaint
 * Requires: Authenticated user
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

    // Parse request body
    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      "complainant_name",
      "address",
      "street_number",
      "service_id",
      "cause_id",
      "zone",
      "since_when",
      "contact_method",
      "details",
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `El campo ${field} es requerido` },
          { status: 400 },
        );
      }
    }

    // Validate contact method
    const validContactMethods = ["Presencial", "Telefono", "Email", "WhatsApp"];
    if (!validContactMethods.includes(body.contact_method)) {
      return NextResponse.json(
        { error: "Método de contacto inválido" },
        { status: 400 },
      );
    }

    // Validate status if provided
    const validStatuses = ["En proceso", "Resuelto", "No resuelto"];
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: "Estado inválido" },
        { status: 400 },
      );
    }

    // Prepare complaint data
    const complaintData: ComplaintInsert = {
      complainant_name: body.complainant_name.trim(),
      address: body.address.trim(),
      street_number: body.street_number.trim(),
      dni: body.dni?.trim() || null,
      service_id: parseInt(body.service_id),
      cause_id: parseInt(body.cause_id),
      zone: body.zone.trim(),
      since_when: body.since_when,
      contact_method: body.contact_method,
      details: body.details.trim(),
      status: body.status || "En proceso",
      referred: body.referred || false,
      loaded_by: authUser.id,
      complaint_date: body.complaint_date || new Date().toISOString().split("T")[0],
    };

    // Insert complaint
    const { data: complaint, error } = await supabase
      .from("complaints")
      .insert(complaintData)
      .select(
        `
        *,
        service:services(id, name),
        cause:causes(id, name),
        loaded_by_user:users!loaded_by(id, full_name)
      `,
      )
      .single();

    if (error) {
      console.error("Error creating complaint:", error);
      return NextResponse.json(
        { error: "Error al crear reclamo" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { data: complaint, message: "Reclamo creado exitosamente" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/complaints:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
