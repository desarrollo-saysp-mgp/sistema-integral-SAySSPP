import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const canAccessTaller = (profile: {
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

const getAuthProfile = async () => {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      user: null,
      profile: null,
      error: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, modules")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !canAccessTaller(profile)) {
    return {
      supabase,
      user,
      profile: null,
      error: NextResponse.json(
        { error: "No autorizado para operar estado general vehicular" },
        { status: 403 },
      ),
    };
  }

  return {
    supabase,
    user,
    profile,
    error: null,
  };
};

const recalculateVehicleSecurity = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  vehicleCode: string,
) => {
  const { data: latestInspection, error: latestError } = await supabase
    .from("vehicle_security_inspections")
    .select("*")
    .eq("vehicle_code", vehicleCode)
    .order("inspection_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw latestError;
  }

  if (!latestInspection) {
    const { error: deleteScoreError } = await supabase
      .from("vehicle_security_scores")
      .delete()
      .eq("vehicle_code", vehicleCode);

    if (deleteScoreError) {
      throw deleteScoreError;
    }

    const { error: criticalityError } = await supabase
      .from("vehicle_criticality_settings")
      .update({
        security_score: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("vehicle_code", vehicleCode);

    if (criticalityError) {
      throw criticalityError;
    }

    return;
  }

  const scorePayload = {
    vehicle_code: latestInspection.vehicle_code,
    vehicle: latestInspection.vehicle || null,
    vehicle_type: latestInspection.vehicle_type || null,
    license_plate: latestInspection.license_plate || null,
    area: latestInspection.area || null,

    last_inspection_id: latestInspection.id,
    last_inspection_date: latestInspection.inspection_date,

    raw_score: latestInspection.raw_score || 0,
    state_percent: latestInspection.state_percent || 0,
    security_score: latestInspection.security_score || 0,

    observations: latestInspection.observations || null,
    updated_at: new Date().toISOString(),
  };

  const { error: scoreError } = await supabase
    .from("vehicle_security_scores")
    .upsert(scorePayload, {
      onConflict: "vehicle_code",
    });

  if (scoreError) {
    throw scoreError;
  }

  const { error: criticalityError } = await supabase
    .from("vehicle_criticality_settings")
    .update({
      security_score: latestInspection.security_score || 0,
      updated_at: new Date().toISOString(),
    })
    .eq("vehicle_code", vehicleCode);

  if (criticalityError) {
    throw criticalityError;
  }
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const { supabase, error } = await getAuthProfile();

    if (error) return error;

    const { data, error: inspectionError } = await supabase
      .from("vehicle_security_inspections")
      .select("*")
      .eq("id", id)
      .single();

    if (inspectionError || !data) {
      return NextResponse.json(
        { error: "Checklist no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error(
      "Unexpected error in GET /api/taller/estado-general/[id]:",
      error,
    );

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

const CHECKLIST_FIELDS = [
  "micas_del",
  "balizas_del",
  "altas_del",
  "bajas_del",
  "posicion_del",
  "ginios_del",
  "micas_tras",
  "balizas_tras",
  "ginios_tras",
  "posicion_tras",
  "stop_tras",
  "reversa_tras",
  "alarma_retro",
  "parabrisa_delantero",
  "parabrisa_trasero",
  "parabrisas_laterales",
  "limpia_parabrisas",
  "espejos",
  "anclaje_asientos",
  "cinturones_seguridad",
  "bocina",
  "espejo_ret_central",
  "freno_mano_bloqueo",
  "tablero_indicadores",
  "puerta_lado_conductor",
  "puerta_lado_acompanante",
  "baul_porton_trasero",
  "eje_delantero",
  "eje_trasero",
  "eje_dual",
  "documentacion_completa",
  "chapa_patente_delantera",
  "chapa_patente_trasera",
  "calcos_reflectivos",
  "extintor",
  "conos_balizas",
  "guardabarros_barreros",
  "botiquin",
  "calcos_municipio",
  "calco_codigo_vehiculo",
] as const;

type ChecklistValue = "ok" | "bad" | "obs" | "";

const getChecklistPoints = (value: ChecklistValue) => {
  if (value === "ok") return 10;
  if (value === "obs") return 5;
  if (value === "bad") return 0;

  return null;
};

const calculateSecurity = (body: Record<string, any>) => {
  let rawScore = 0;
  let completedItems = 0;

  CHECKLIST_FIELDS.forEach((field) => {
    const value = body[field] as ChecklistValue;
    const points = getChecklistPoints(value);

    if (points === null) return;

    rawScore += points;
    completedItems += 1;
  });

  const maxScore = completedItems * 10;

  const statePercent =
    maxScore > 0 ? Number(((rawScore / maxScore) * 100).toFixed(2)) : 0;

  const securityScore = Math.max(0, Math.round((100 - statePercent) / 20));

  return {
    rawScore,
    statePercent,
    securityScore,
  };
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const { supabase, error } = await getAuthProfile();

    if (error) return error;

    const body = await request.json();

    if (!body.inspection_date) {
      return NextResponse.json(
        { error: "La fecha es obligatoria" },
        { status: 400 },
      );
    }

    if (!body.vehicle_code) {
      return NextResponse.json(
        { error: "El código de vehículo es obligatorio" },
        { status: 400 },
      );
    }

    const { data: currentInspection, error: currentError } = await supabase
      .from("vehicle_security_inspections")
      .select("id, vehicle_code")
      .eq("id", id)
      .single();

    if (currentError || !currentInspection) {
      return NextResponse.json(
        { error: "Checklist no encontrado" },
        { status: 404 },
      );
    }

    const previousVehicleCode = currentInspection.vehicle_code;

    const { rawScore, statePercent, securityScore } = calculateSecurity(body);

    const payload: Record<string, any> = {
      inspection_date: body.inspection_date,
      vehicle_code: body.vehicle_code,
      vehicle: body.vehicle || null,
      vehicle_type: body.vehicle_type || null,
      license_plate: body.license_plate || null,
      area: body.area || null,
      observations: body.observations || null,

      raw_score: rawScore,
      state_percent: statePercent,
      security_score: securityScore,

      updated_at: new Date().toISOString(),
    };

    CHECKLIST_FIELDS.forEach((field) => {
      payload[field] = body[field] || null;
    });

    const { data: updatedInspection, error: updateError } = await supabase
      .from("vehicle_security_inspections")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError || !updatedInspection) {
      console.error("Error updating checklist:", updateError);

      return NextResponse.json(
        { error: "Error al actualizar checklist" },
        { status: 500 },
      );
    }

    await recalculateVehicleSecurity(supabase, previousVehicleCode);

    if (previousVehicleCode !== body.vehicle_code) {
      await recalculateVehicleSecurity(supabase, body.vehicle_code);
    }

    return NextResponse.json({
      data: updatedInspection,
      result: {
        raw_score: rawScore,
        state_percent: statePercent,
        security_score: securityScore,
      },
      message: "Checklist actualizado correctamente",
    });
  } catch (error) {
    console.error(
      "Unexpected error in PATCH /api/taller/estado-general/[id]:",
      error,
    );

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

    const { supabase, error } = await getAuthProfile();

    if (error) return error;

    const { data: inspection, error: findError } = await supabase
      .from("vehicle_security_inspections")
      .select("id, vehicle_code")
      .eq("id", id)
      .single();

    if (findError || !inspection) {
      return NextResponse.json(
        { error: "Checklist no encontrado" },
        { status: 404 },
      );
    }

    const vehicleCode = inspection.vehicle_code;

    const { data: deletedRows, error: deleteError } = await supabase
      .from("vehicle_security_inspections")
      .delete()
      .eq("id", id)
      .select("id");

    if (deleteError) {
      console.error("Error deleting inspection:", deleteError);

      return NextResponse.json(
        { error: "Error al eliminar checklist" },
        { status: 500 },
      );
    }

    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No se eliminó ningún checklist. Revisá las políticas RLS de Supabase.",
        },
        { status: 403 },
      );
    }

    await recalculateVehicleSecurity(supabase, vehicleCode);

    return NextResponse.json({
      data: deletedRows,
      message: "Checklist eliminado correctamente",
    });
  } catch (error) {
    console.error(
      "Unexpected error in DELETE /api/taller/estado-general/[id]:",
      error,
    );

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}