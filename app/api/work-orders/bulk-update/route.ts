import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const VALID_STATUSES = [
  "INICIADO",
  "PRESUPUESTOS",
  "COMPRAS",
  "TALLER",
  "TALLER TERCERIZADO",
  "CERRADO",
];

const canAccessWorkOrders = (profile: {
  role: string;
  modules: string[] | null;
}) => {
  return (
    profile.role === "Admin" ||
    profile.role === "Taller" ||
    profile.modules?.includes("work_orders")
  );
};

const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export async function PATCH(request: NextRequest) {
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
        { error: "No autorizado para actualizar órdenes de trabajo" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const ids = Array.isArray(body.ids)
      ? body.ids.map((id: unknown) => String(id || "").trim()).filter(Boolean)
      : [];
    const status = String(body.status || "").trim().toUpperCase();

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Seleccioná al menos una OT" },
        { status: 400 },
      );
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Estado inválido" },
        { status: 400 },
      );
    }

    const updatePayload: Record<string, string> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "CERRADO") {
      updatePayload.closed_date = getTodayDate();
    }

    const { data, error } = await supabase
      .from("work_orders")
      .update(updatePayload)
      .in("id", ids)
      .select("id");

    if (error) {
      console.error("Error bulk updating work orders:", error);
      return NextResponse.json(
        { error: "Error al actualizar órdenes de trabajo" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: data || [],
      count: data?.length || 0,
      message: "Órdenes de trabajo actualizadas correctamente",
    });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/work-orders/bulk-update:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
