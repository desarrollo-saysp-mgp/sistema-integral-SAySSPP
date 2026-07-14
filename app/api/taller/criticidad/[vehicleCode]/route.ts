import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const canEditTaller = (profile: {
  role: string;
  modules: string[] | null;
}) => {
  const role = normalizeText(profile.role);

  return (
    role === "admin" ||
    role === "taller" ||
    profile.modules?.includes("work_orders")
  );
};

const parseScore = (value: unknown) => {
  if (value === null || value === undefined || value === "") return 0;

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return 0;

  return Math.max(0, numberValue);
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ vehicleCode: string }> },
) {
  try {
    const { vehicleCode } = await params;
    const decodedVehicleCode = decodeURIComponent(vehicleCode);

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

    if (profileError || !profile || !canEditTaller(profile)) {
      return NextResponse.json(
        { error: "No autorizado para editar criticidad vehicular" },
        { status: 403 },
      );
    }

    const body = await request.json();

    const payload = {
      service_criticality: parseScore(body.service_criticality),
      replacement_score: parseScore(body.replacement_score),
      security_score: parseScore(body.security_score),
      notes: body.notes ? String(body.notes).trim() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("vehicle_criticality_settings")
      .update(payload)
      .eq("vehicle_code", decodedVehicleCode)
      .select(
        "id, vehicle_code, vehicle, license_plate, service_criticality, replacement_score, security_score, notes, created_at, updated_at",
      )
      .single();

    if (error || !data) {
      console.error("Error updating vehicle criticality:", error);
      return NextResponse.json(
        { error: "Error al actualizar criticidad vehicular" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data,
      message: "Criticidad vehicular actualizada correctamente",
    });
  } catch (error) {
    console.error(
      "Unexpected error in PATCH /api/taller/criticidad/[vehicleCode]:",
      error,
    );
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
