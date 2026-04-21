import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { ComplaintUpdate, ComplaintHistoryInsert } from "@/types";
import { obtenerLatLon } from "@/lib/geocoding";

const validatePhone = (phone: string): boolean => {
  if (!phone || !phone.trim()) return true;
  const digitsOnly = /^\d+$/;
  return digitsOnly.test(phone.trim()) && phone.trim().length <= 50;
};

const validateEmail = (email: string): boolean => {
  if (!email || !email.trim()) return true;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email.trim()) && email.trim().length <= 100;
};

const validSinceWhenValues = [
  "En el día",
  "1 semana",
  "1 mes",
  "3 meses",
  "6 meses",
  "1 año",
];

const validStatuses = ["En proceso", "Resuelto", "No resuelto"];
const validContactMethods = [
  "Presencial",
  "Telefono",
  "Email",
  "WhatsApp",
];
const validArboladoLevels = ["Urgente", "Importante", "Orden de llegada"];

const normalizeValue = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const complaintId = parseInt(id);

    if (Number.isNaN(complaintId)) {
      return NextResponse.json(
        { error: "ID de reclamo inválido" },
        { status: 400 },
      );
    }

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
      .eq("id", complaintId)
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const { id } = await context.params;
    const complaintId = parseInt(id);

    if (Number.isNaN(complaintId)) {
      return NextResponse.json(
        { error: "ID de reclamo inválido" },
        { status: 400 },
      );
    }

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json(
        { error: "No se pudo validar el usuario" },
        { status: 500 },
      );
    }

    if (
      currentUser.role !== "Admin" &&
      currentUser.role !== "Reclamos" &&
      currentUser.role !== "ReclamosArbolado"
    ) {
      return NextResponse.json(
        { error: "No tenés permisos para guardar cambios" },
        { status: 403 },
      );
    }

    const body = await request.json();

    if (body.status !== undefined && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: "Estado inválido" },
        { status: 400 },
      );
    }

    if (
      body.contact_method !== undefined &&
      body.contact_method &&
      !validContactMethods.includes(body.contact_method)
    ) {
      return NextResponse.json(
        { error: "Método de contacto inválido" },
        { status: 400 },
      );
    }

    if (
      body.since_when !== undefined &&
      body.since_when &&
      !validSinceWhenValues.includes(body.since_when)
    ) {
      return NextResponse.json(
        { error: "Valor inválido para 'Desde Cuándo'" },
        { status: 400 },
      );
    }

    if (
      body.level !== undefined &&
      body.level &&
      !validArboladoLevels.includes(body.level)
    ) {
      return NextResponse.json(
        { error: "Nivel inválido para Arbolado" },
        { status: 400 },
      );
    }

    if (
      body.phone_number !== undefined &&
      body.phone_number &&
      !validatePhone(body.phone_number)
    ) {
      return NextResponse.json(
        {
          error:
            "Formato de teléfono inválido. Solo números, máximo 50 caracteres",
        },
        { status: 400 },
      );
    }

    if (body.email !== undefined && body.email && !validateEmail(body.email)) {
      return NextResponse.json(
        { error: "Formato de email inválido" },
        { status: 400 },
      );
    }

    const { data: currentComplaint, error: currentError } = await supabase
      .from("complaints")
      .select("*")
      .eq("id", complaintId)
      .single();

    if (currentError || !currentComplaint) {
      return NextResponse.json(
        { error: "Reclamo no encontrado" },
        { status: 404 },
      );
    }

    const formVariant = body.form_variant || currentComplaint.form_variant || "general";
    const updateData: ComplaintUpdate = {};

    if (body.complainant_name !== undefined) {
      updateData.complainant_name = body.complainant_name
        ? body.complainant_name.trim()
        : null;
    }

    if (body.address !== undefined) {
      updateData.address = body.address ? body.address.trim() : null;
    }

    if (body.street_number !== undefined) {
      updateData.street_number = body.street_number
        ? body.street_number.trim()
        : null;
    }

    if (body.dni !== undefined) {
      updateData.dni = body.dni ? body.dni.trim() : null;
    }

    if (body.phone_number !== undefined) {
      updateData.phone_number = body.phone_number
        ? body.phone_number.trim()
        : null;
    }

    if (body.email !== undefined) {
      updateData.email = body.email ? body.email.trim() : null;
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    if (body.referred !== undefined) {
      updateData.referred = body.referred;
    }

    if (body.complaint_date !== undefined) {
      updateData.complaint_date = body.complaint_date;
    }

    if (body.form_variant !== undefined) {
      updateData.form_variant = body.form_variant;
    }

    if (formVariant === "general") {
      if (body.service_id !== undefined) {
        updateData.service_id = body.service_id ? parseInt(body.service_id) : null;
      }

      if (body.cause_id !== undefined) {
        updateData.cause_id = body.cause_id ? parseInt(body.cause_id) : null;
      }

      if (body.zone !== undefined) {
        updateData.zone = body.zone ? body.zone.trim() : null;
      }

      if (body.since_when !== undefined) {
        updateData.since_when = body.since_when || null;
      }

      if (body.contact_method !== undefined) {
        updateData.contact_method = body.contact_method || null;
      }

      if (body.details !== undefined) {
        updateData.details = body.details ? body.details.trim() : null;
      }
    }

    if (formVariant === "arbolado") {
      if (body.contact_method !== undefined) {
        updateData.contact_method = body.contact_method
          ? body.contact_method.trim()
          : null;
      }

      if (body.description_type !== undefined) {
        updateData.details = body.description_type
          ? body.description_type.trim()
          : null;
      }

      const currentExtraData =
        currentComplaint.extra_data &&
        typeof currentComplaint.extra_data === "object"
          ? currentComplaint.extra_data
          : {};

      const nextExtraData = {
        ...currentExtraData,
      } as Record<string, unknown>;

      if (body.department !== undefined) {
        nextExtraData.department = body.department ? body.department.trim() : null;
      }

      if (body.level !== undefined) {
        nextExtraData.level = body.level ? body.level.trim() : null;
      }

      if (body.description_type !== undefined) {
        nextExtraData.description_type = body.description_type
          ? body.description_type.trim()
          : null;
      }

      if (body.observations !== undefined) {
        nextExtraData.observations = body.observations
          ? body.observations.trim()
          : null;
      }

      if (body.solution !== undefined) {
        nextExtraData.solution = body.solution ? body.solution.trim() : null;
      }

      if (body.resolution_date !== undefined) {
        nextExtraData.resolution_date = body.resolution_date || null;
      }

      if (body.agent !== undefined) {
        nextExtraData.agent = body.agent ? body.agent.trim() : null;
      }

      if (body.resolution_responsible !== undefined) {
        nextExtraData.resolution_responsible = body.resolution_responsible
          ? body.resolution_responsible.trim()
          : null;
      }

      updateData.extra_data = nextExtraData;
    }

    const addressChanged =
      body.address !== undefined &&
      (body.address ? body.address.trim() : "") !==
        (currentComplaint.address ?? "").trim();

    const streetNumberChanged =
      body.street_number !== undefined &&
      (body.street_number ? body.street_number.trim() : "") !==
        (currentComplaint.street_number ?? "").trim();

    const nextAddress =
      body.address !== undefined
        ? body.address?.trim() || null
        : currentComplaint.address;

    const nextStreetNumber =
      body.street_number !== undefined
        ? body.street_number?.trim() || null
        : currentComplaint.street_number;

    if (addressChanged || streetNumberChanged) {
      if (nextAddress && nextStreetNumber) {
        updateData.latlon = await obtenerLatLon(nextAddress, nextStreetNumber);
      } else {
        updateData.latlon = null;
      }
    }

    const updateKeys = Object.keys(updateData) as (keyof ComplaintUpdate)[];

    if (updateKeys.length === 0) {
      return NextResponse.json(
        { error: "No se enviaron cambios para actualizar" },
        { status: 400 },
      );
    }

    const changes: ComplaintHistoryInsert[] = [];

    for (const key of updateKeys) {
      if (key === "latlon") continue;

      const oldValue = normalizeValue(
        currentComplaint[key as keyof typeof currentComplaint],
      );
      const newValue = normalizeValue(updateData[key]);

      if (oldValue !== newValue) {
        changes.push({
          complaint_id: complaintId,
          field_name: key as string,
          old_value: oldValue,
          new_value: newValue,
          changed_by: authUser.id,
        });
      }
    }

    if (changes.length === 0) {
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
        .eq("id", complaintId)
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Error al cargar reclamo" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        data: complaint,
        message: "No hubo cambios para guardar",
      });
    }

    const { data: complaint, error } = await supabase
      .from("complaints")
      .update(updateData)
      .eq("id", complaintId)
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

    const { error: historyError } = await adminClient
      .from("complaint_history")
      .insert(changes);

    if (historyError) {
      console.error("Error saving complaint history:", historyError);
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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const { id } = await context.params;
    const complaintId = parseInt(id);

    if (Number.isNaN(complaintId)) {
      return NextResponse.json(
        { error: "ID de reclamo inválido" },
        { status: 400 },
      );
    }

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (userError) {
      return NextResponse.json(
        { error: "No se pudo validar el usuario" },
        { status: 500 },
      );
    }

    if (
      !currentUser ||
      (currentUser.role !== "Admin" &&
        currentUser.role !== "Reclamos" &&
        currentUser.role !== "ReclamosArbolado")
    ) {
      return NextResponse.json(
        {
          error:
            "No autorizado. Solo usuarios Admin, Reclamos o ReclamosArbolado pueden eliminar reclamos",
        },
        { status: 403 },
      );
    }

    const { data: deletedRows, error: deleteError } = await adminClient
      .from("complaints")
      .delete()
      .eq("id", complaintId)
      .select("id");

    if (deleteError) {
      console.error("Error deleting complaint:", deleteError);
      return NextResponse.json(
        { error: "Error al eliminar reclamo" },
        { status: 500 },
      );
    }

    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json(
        { error: "No se encontró el reclamo a eliminar" },
        { status: 404 },
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