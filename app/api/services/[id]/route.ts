import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { ServiceUpdate } from "@/types";

/**
 * PATCH /api/services/[id]
 * Update a service
 * Requires: Admin role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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
        {
          error:
            "No autorizado. Solo administradores pueden actualizar servicios",
        },
        { status: 403 },
      );
    }

    // Parse service ID
    const serviceId = parseInt(params.id);
    if (isNaN(serviceId)) {
      return NextResponse.json(
        { error: "ID de servicio inválido" },
        { status: 400 },
      );
    }

    // Check if service exists
    const { data: existingService } = await supabase
      .from("services")
      .select("*")
      .eq("id", serviceId)
      .single();

    if (!existingService) {
      return NextResponse.json(
        { error: "Servicio no encontrado" },
        { status: 404 },
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, active } = body;

    // Validate at least one field is provided
    if (name === undefined && active === undefined) {
      return NextResponse.json(
        { error: "Debe proporcionar al menos un campo para actualizar" },
        { status: 400 },
      );
    }

    // If updating name, validate and check for duplicates
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json(
          { error: "El nombre del servicio no puede estar vacío" },
          { status: 400 },
        );
      }

      // Check if another service has this name
      const { data: duplicateService } = await supabase
        .from("services")
        .select("id")
        .eq("name", name.trim())
        .neq("id", serviceId)
        .single();

      if (duplicateService) {
        return NextResponse.json(
          { error: "Ya existe otro servicio con este nombre" },
          { status: 409 },
        );
      }
    }

    // Build update object
    const serviceUpdate: ServiceUpdate = {};
    if (name !== undefined) serviceUpdate.name = name.trim();
    if (active !== undefined) serviceUpdate.active = active;

    // Update service
    const { data: updatedService, error: dbError } = await supabase
      .from("services")
      .update(serviceUpdate)
      .eq("id", serviceId)
      .select()
      .single();

    if (dbError) {
      console.error("Error updating service:", dbError);
      return NextResponse.json(
        { error: "Error al actualizar servicio" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: updatedService,
      message: "Servicio actualizado exitosamente",
    });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/services/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/services/[id]
 * Soft delete a service by setting active = false
 * Requires: Admin role
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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
        {
          error: "No autorizado. Solo administradores pueden eliminar servicios",
        },
        { status: 403 },
      );
    }

    // Parse service ID
    const serviceId = parseInt(params.id);
    if (isNaN(serviceId)) {
      return NextResponse.json(
        { error: "ID de servicio inválido" },
        { status: 400 },
      );
    }

    // Check if service exists
    const { data: existingService } = await supabase
      .from("services")
      .select("*")
      .eq("id", serviceId)
      .single();

    if (!existingService) {
      return NextResponse.json(
        { error: "Servicio no encontrado" },
        { status: 404 },
      );
    }

    // Soft delete by setting active = false
    const { data: deletedService, error: dbError } = await supabase
      .from("services")
      .update({ active: false })
      .eq("id", serviceId)
      .select()
      .single();

    if (dbError) {
      console.error("Error deleting service:", dbError);
      return NextResponse.json(
        { error: "Error al eliminar servicio" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: deletedService,
      message: "Servicio eliminado exitosamente",
    });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/services/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
