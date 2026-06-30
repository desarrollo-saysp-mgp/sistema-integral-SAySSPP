import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { WorkOrderInsert } from "@/types";

const PAGE_SIZE = 1000;

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

export async function GET(request: NextRequest) {
  try {
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
        { error: "No autorizado para ver órdenes de trabajo" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    let allWorkOrders: unknown[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from("work_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (search) {
        query = query.or(
          `order_number.ilike.%${search}%,vehicle_code.ilike.%${search}%,vehicle.ilike.%${search}%,license_plate.ilike.%${search}%,driver.ilike.%${search}%`,
        );
      }

      if (status && status !== "Todos") {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching work orders:", error);
        return NextResponse.json(
          { error: "Error al cargar órdenes de trabajo" },
          { status: 500 },
        );
      }

      const currentBatch = data || [];
      allWorkOrders = [...allWorkOrders, ...currentBatch];

      if (currentBatch.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        from += PAGE_SIZE;
      }
    }

    return NextResponse.json({ data: allWorkOrders });
  } catch (error) {
    console.error("Unexpected error in GET /api/work-orders:", error);
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
        { error: "No autorizado para crear órdenes de trabajo" },
        { status: 403 },
      );
    }

    const body = await request.json();

    const payload: WorkOrderInsert & { supplies_needed: SupplyNeeded[] } = {
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
      status: body.status || "INICIADO",
      created_by: user.id,
      supplies_needed: normalizeSuppliesNeeded(body.supplies_needed),
    };

    const { data, error } = await supabase
      .from("work_orders")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("Error creating work order:", error);
      return NextResponse.json(
        { error: "Error al crear orden de trabajo" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { data, message: "Orden de trabajo creada correctamente" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/work-orders:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}