import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { ComplaintUpdate } from "@/types";

/**
 * GET /api/complaints/[id]
 * Get a single complaint by ID
 * Requires: Authenticated user
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    // Check authentication
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Fetch complaint with related data
    const { data: complaint, error } = await supabase
      .from("complaints")
      .select(
        `
        *,
        service:services(id, name),
        cause:causes(id, name),
        loaded_by_user:users!loaded_by(id, full_name)
      `,
      )
      .eq("id", parseInt(id))
      .single();

    if (error) {
      console.error("Error fetching complaint:", error);
      return NextResponse.json(
        { error: "Error al cargar reclamo" },
        { status: 500 },
      );
    }

    if (!complaint) {
      return NextResponse.json(
        { error: "Reclamo no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: complaint });
  } catch (error) {
    console.error("Unexpected error in GET /api/complaints/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/complaints/[id]
 * Update a complaint
 * Requires: Authenticated user
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

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

    // Validate status if provided
    if (body.status) {
      const validStatuses = ["En proceso", "Resuelto", "No resuelto"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: "Estado inválido" },
          { status: 400 },
        );
      }
    }

    // Validate contact method if provided
    if (body.contact_method) {
      const validContactMethods = [
        "Presencial",
        "Telefono",
        "Email",
        "WhatsApp",
      ];
      if (!validContactMethods.includes(body.contact_method)) {
        return NextResponse.json(
          { error: "Método de contacto inválido" },
          { status: 400 },
        );
      }
    }

    // Prepare update data
    const updateData: ComplaintUpdate = {};

    // Only include fields that are provided in the request
    if (body.complainant_name !== undefined)
      updateData.complainant_name = body.complainant_name.trim();
    if (body.address !== undefined) updateData.address = body.address.trim();
    if (body.street_number !== undefined)
      updateData.street_number = body.street_number.trim();
    if (body.dni !== undefined)
      updateData.dni = body.dni ? body.dni.trim() : null;
    if (body.service_id !== undefined)
      updateData.service_id = parseInt(body.service_id);
    if (body.cause_id !== undefined)
      updateData.cause_id = parseInt(body.cause_id);
    if (body.zone !== undefined) updateData.zone = body.zone.trim();
    if (body.since_when !== undefined) updateData.since_when = body.since_when;
    if (body.contact_method !== undefined)
      updateData.contact_method = body.contact_method;
    if (body.details !== undefined) updateData.details = body.details.trim();
    if (body.status !== undefined) updateData.status = body.status;
    if (body.referred !== undefined) updateData.referred = body.referred;
    if (body.complaint_date !== undefined)
      updateData.complaint_date = body.complaint_date;

    // Update complaint
    const { data: complaint, error } = await supabase
      .from("complaints")
      .update(updateData)
      .eq("id", parseInt(id))
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
      console.error("Error updating complaint:", error);
      return NextResponse.json(
        { error: "Error al actualizar reclamo" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: complaint,
      message: "Reclamo actualizado exitosamente",
    });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/complaints/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/complaints/[id]
 * Delete a complaint
 * Requires: Admin role
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

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
        { error: "No autorizado. Solo administradores pueden eliminar reclamos" },
        { status: 403 },
      );
    }

    // Delete complaint
    const { error } = await supabase
      .from("complaints")
      .delete()
      .eq("id", parseInt(id));

    if (error) {
      console.error("Error deleting complaint:", error);
      return NextResponse.json(
        { error: "Error al eliminar reclamo" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "Reclamo eliminado exitosamente",
    });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/complaints/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
