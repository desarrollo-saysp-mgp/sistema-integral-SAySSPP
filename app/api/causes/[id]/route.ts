import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { CauseUpdate } from "@/types";

/**
 * PATCH /api/causes/[id]
 * Update a cause
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
          error: "No autorizado. Solo administradores pueden actualizar causas",
        },
        { status: 403 },
      );
    }

    // Parse cause ID
    const causeId = parseInt(params.id);
    if (isNaN(causeId)) {
      return NextResponse.json(
        { error: "ID de causa inválido" },
        { status: 400 },
      );
    }

    // Check if cause exists
    const { data: existingCause } = await supabase
      .from("causes")
      .select("*")
      .eq("id", causeId)
      .single();

    if (!existingCause) {
      return NextResponse.json(
        { error: "Causa no encontrada" },
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
          { error: "El nombre de la causa no puede estar vacío" },
          { status: 400 },
        );
      }

      // Check if another cause for the same service has this name
      const { data: duplicateCause } = await supabase
        .from("causes")
        .select("id")
        .eq("service_id", existingCause.service_id)
        .eq("name", name.trim())
        .neq("id", causeId)
        .single();

      if (duplicateCause) {
        return NextResponse.json(
          { error: "Ya existe otra causa con este nombre para este servicio" },
          { status: 409 },
        );
      }
    }

    // Build update object
    const causeUpdate: CauseUpdate = {};
    if (name !== undefined) causeUpdate.name = name.trim();
    if (active !== undefined) causeUpdate.active = active;

    // Update cause
    const { data: updatedCause, error: dbError } = await supabase
      .from("causes")
      .update(causeUpdate)
      .eq("id", causeId)
      .select()
      .single();

    if (dbError) {
      console.error("Error updating cause:", dbError);
      return NextResponse.json(
        { error: "Error al actualizar causa" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: updatedCause,
      message: "Causa actualizada exitosamente",
    });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/causes/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/causes/[id]
 * Soft delete a cause by setting active = false
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
          error: "No autorizado. Solo administradores pueden eliminar causas",
        },
        { status: 403 },
      );
    }

    // Parse cause ID
    const causeId = parseInt(params.id);
    if (isNaN(causeId)) {
      return NextResponse.json(
        { error: "ID de causa inválido" },
        { status: 400 },
      );
    }

    // Check if cause exists
    const { data: existingCause } = await supabase
      .from("causes")
      .select("*")
      .eq("id", causeId)
      .single();

    if (!existingCause) {
      return NextResponse.json(
        { error: "Causa no encontrada" },
        { status: 404 },
      );
    }

    // Soft delete by setting active = false
    const { data: deletedCause, error: dbError } = await supabase
      .from("causes")
      .update({ active: false })
      .eq("id", causeId)
      .select()
      .single();

    if (dbError) {
      console.error("Error deleting cause:", dbError);
      return NextResponse.json(
        { error: "Error al eliminar causa" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: deletedCause,
      message: "Causa eliminada exitosamente",
    });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/causes/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
