import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { WorkOrderUpdate } from "@/types";

type SupplyNeeded = {
  code: string;
  units: string;
  description: string;
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const canAccessWorkOrders = (profile: {
  role: string;
  modules: string[] | null;
}) => {
  const role = normalizeText(profile.role);

  return (
    role === "admin" ||
    role === "adminlectura" ||
    role === "taller" ||
    profile.modules?.includes("work_orders")
  );
};

const normalizeSuppliesNeeded = (value: unknown): SupplyNeeded[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const supply = item as {
        code?: unknown;
        units?: unknown;
        description?: unknown;
      };

      return {
        code: String(supply.code || "").trim(),
        units: String(supply.units || "").trim(),
        description: String(supply.description || "").trim(),
      };
    })
    .filter(
      (item) =>
        item.code.trim() || item.units.trim() || item.description.trim(),
    );
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role, modules")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !canAccessWorkOrders(profile)) {
      return NextResponse.json(
        { error: "No autorizado para ver esta orden de trabajo" },
        { status: 403 },
      );
    }

    const { data, error } = await supabase
      .from("work_orders")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Orden de trabajo no encontrada" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unexpected error in GET /api/work-orders/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role, modules")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !canAccessWorkOrders(profile)) {
      return NextResponse.json(
        { error: "No autorizado para editar esta orden de trabajo" },
        { status: 403 },
      );
    }

    const body = await request.json();

    const payload: WorkOrderUpdate & { supplies_needed: SupplyNeeded[] } = {
      order_number: body.order_number || null,
      entry_date: body.entry_date || null,
      requesting_area: body.requesting_area || null,
      failure_report: body.failure_report || null,
      repair_type: body.repair_type || null,
      vehicle_code: body.vehicle_code || null,
      criticality: body.criticality || null,
      failure_type: body.failure_type || null,
      failure_location: body.failure_location || null,
      requires_spare_part: body.requires_spare_part || null,
      vehicle: body.vehicle || null,
      license_plate: body.license_plate || null,
      exit_date: body.exit_date || null,
      workshop_entry_date: body.workshop_entry_date || null,
      closed_date: body.closed_date || null,
      spare_part_detail: body.spare_part_detail || null,
      spare_part_code: body.spare_part_code || null,
      units:
        body.units !== null && body.units !== undefined && body.units !== ""
          ? Number(body.units)
          : null,
      provider: body.provider || null,
      amount:
        body.amount !== null && body.amount !== undefined && body.amount !== ""
          ? Number(body.amount)
          : null,
      observations: body.observations || null,
      driver: body.driver || null,
      status: body.status || null,
      supplies_needed: normalizeSuppliesNeeded(body.supplies_needed),
    };

    const { data, error } = await supabase
      .from("work_orders")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      console.error("Error updating work order:", error);
      return NextResponse.json(
        { error: "Error al actualizar orden de trabajo" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data,
      message: "Orden de trabajo actualizada correctamente",
    });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/work-orders/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role, modules")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !canAccessWorkOrders(profile)) {
      return NextResponse.json(
        { error: "No autorizado para eliminar esta orden de trabajo" },
        { status: 403 },
      );
    }

    const { data: deletedRows, error } = await supabase
      .from("work_orders")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      console.error("Error deleting work order:", error);
      return NextResponse.json(
        { error: "Error al eliminar orden de trabajo" },
        { status: 500 },
      );
    }

    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No se eliminó ninguna orden. Revisá las políticas RLS de Supabase.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      data: null,
      message: "Orden de trabajo eliminada correctamente",
    });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/work-orders/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}