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

  const securityScore = Math.max(
    0,
    Math.round((100 - statePercent) / 20),
  );

  return {
    rawScore,
    statePercent,
    securityScore,
  };
};

export async function GET() {
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

    if (profileError || !profile || !canAccessTaller(profile)) {
      return NextResponse.json(
        { error: "No autorizado para ver estado general vehicular" },
        { status: 403 },
      );
    }

    const { data, error } = await supabase
      .from("vehicle_security_inspections")
      .select("*")
      .order("inspection_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching vehicle inspections:", error);
      return NextResponse.json(
        { error: "Error al cargar inspecciones vehiculares" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("Unexpected error in GET /api/taller/estado-general:", error);

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

    if (profileError || !profile || !canAccessTaller(profile)) {
      return NextResponse.json(
        { error: "No autorizado para crear checklist vehicular" },
        { status: 403 },
      );
    }

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

    const { rawScore, statePercent, securityScore } =
      calculateSecurity(body);

    const inspectionPayload: Record<string, any> = {
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

      created_by: user.id,
      updated_at: new Date().toISOString(),
    };

    CHECKLIST_FIELDS.forEach((field) => {
      inspectionPayload[field] = body[field] || null;
    });

    const { data: inspection, error: inspectionError } = await supabase
      .from("vehicle_security_inspections")
      .insert(inspectionPayload)
      .select("*")
      .single();

    if (inspectionError || !inspection) {
      console.error("Error creating vehicle inspection:", inspectionError);
      return NextResponse.json(
        { error: "Error al guardar checklist vehicular" },
        { status: 500 },
      );
    }

    const scorePayload = {
      vehicle_code: body.vehicle_code,
      vehicle: body.vehicle || null,
      vehicle_type: body.vehicle_type || null,
      license_plate: body.license_plate || null,
      area: body.area || null,

      last_inspection_id: inspection.id,
      last_inspection_date: body.inspection_date,

      raw_score: rawScore,
      state_percent: statePercent,
      security_score: securityScore,

      observations: body.observations || null,
      updated_at: new Date().toISOString(),
    };

    const { error: scoreError } = await supabase
      .from("vehicle_security_scores")
      .upsert(scorePayload, {
        onConflict: "vehicle_code",
      });

    if (scoreError) {
      console.error("Error updating vehicle security score:", scoreError);
      return NextResponse.json(
        { error: "El checklist se guardó, pero no se actualizó seguridad" },
        { status: 500 },
      );
    }

    const { error: criticalityError } = await supabase
      .from("vehicle_criticality_settings")
      .update({
        security_score: securityScore,
        updated_at: new Date().toISOString(),
      })
      .eq("vehicle_code", body.vehicle_code);

    if (criticalityError) {
      console.error("Error updating criticality security:", criticalityError);
    }

    return NextResponse.json(
      {
        data: inspection,
        result: {
          raw_score: rawScore,
          state_percent: statePercent,
          security_score: securityScore,
        },
        message: "Checklist vehicular guardado correctamente",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/taller/estado-general:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}