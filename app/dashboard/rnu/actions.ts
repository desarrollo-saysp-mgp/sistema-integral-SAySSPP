"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type CreateGeneralEntryInput = {
  entryDate?: string;
  entryTime?: string;
  visitorCount?: number;
  provinceLocality?: string;
  transportType?: string;
  firstVisit: boolean | null;
  entryReasons?: string[];
  facilities?: string[];
  observations?: string;
};

type CreateInstitutionEntryInput = {
  institutionName?: string;
  provinceLocality?: string;
  visitorCount?: number;
  ages?: string;
  responsibleName?: string;
  responsiblePhone?: string;
  entryDate?: string;
  entryTime?: string;
  estimatedExitTime?: string;
  hasVisitRequest: boolean | null;
  facilities?: string[];
  activities?: string[];
  behavior?: string;
  observations?: string;
};

function normalizeRole(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function getCurrentDate() {
  return new Date().toLocaleDateString("en-CA");
}

function getCurrentTime() {
  return new Date().toTimeString().slice(0, 5);
}

function nullableText(value: unknown): string | null {
  const normalizedValue = String(value || "").trim();

  return normalizedValue || null;
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim().toUpperCase())
    .filter(Boolean);
}

async function getAuthorizedRnuUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("No hay una sesión activa.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error(
      "Error al verificar el perfil del usuario RNU:",
      profileError,
    );

    throw new Error("No se pudo verificar el perfil del usuario.");
  }

  const userRole = normalizeRole(profile.role);
  const allowedRoles = ["admin", "rnu"];

  if (!allowedRoles.includes(userRole)) {
    throw new Error("No tenés permiso para registrar ingresos RNU.");
  }

  return {
    supabase,
    user,
  };
}

export async function createGeneralRnuEntry(
  input: CreateGeneralEntryInput,
) {
  const { supabase, user } = await getAuthorizedRnuUser();

  const entryDate = input.entryDate?.trim() || getCurrentDate();
  const entryTime = input.entryTime?.trim() || getCurrentTime();

  const visitorCount =
    Number.isInteger(input.visitorCount) &&
    Number(input.visitorCount) > 0
      ? Number(input.visitorCount)
      : 1;

  const provinceLocality = nullableText(input.provinceLocality);
  const observations = nullableText(input.observations);

  const transportType =
    nullableText(input.transportType)?.toUpperCase() || null;

  const entryReasons = normalizeArray(input.entryReasons);
  const facilities = normalizeArray(input.facilities);

  const validTransportTypes = [
    "AUTO",
    "MOTO",
    "BICICLETA",
    "CAMINANDO_CORRIENDO",
  ];

  if (
    transportType !== null &&
    !validTransportTypes.includes(transportType)
  ) {
    throw new Error("El medio de ingreso seleccionado no es válido.");
  }

  const validEntryReasons = [
    "PESCA",
    "RECREACION",
    "PAMPA_WAKE",
    "ACTIVIDAD_PROGRAMADA",
    "FOTOGRAFIA_AVISTAJE",
    "KAYAK",
    "ACAMPE",
  ];

  const hasInvalidReason = entryReasons.some(
    (reason) => !validEntryReasons.includes(reason),
  );

  if (hasInvalidReason) {
    throw new Error("Uno de los motivos seleccionados no es válido.");
  }

  const validFacilities = [
    "SUM",
    "CENTRO_INTERPRETATIVO",
  ];

  const hasInvalidFacility = facilities.some(
    (facility) => !validFacilities.includes(facility),
  );

  if (hasInvalidFacility) {
    throw new Error(
      "Una de las instalaciones seleccionadas no es válida.",
    );
  }

  const firstVisit =
    typeof input.firstVisit === "boolean"
      ? input.firstVisit
      : null;

  const { error: insertError } = await supabase
    .from("rnu_entries")
    .insert({
      entry_type: "GENERAL",
      entry_date: entryDate,
      entry_time: entryTime,
      visitor_count: visitorCount,
      province_locality: provinceLocality,
      transport_type: transportType,
      first_visit: firstVisit,
      entry_reasons: entryReasons,
      facilities,
      observations,
      created_by: user.id,
    });

  if (insertError) {
    console.error(
      "Error al crear el ingreso general RNU:",
      insertError,
    );

    throw new Error(
      `No se pudo guardar el ingreso: ${insertError.message}`,
    );
  }

  revalidatePath("/dashboard/rnu");
  revalidatePath("/dashboard/rnu/registros");

  redirect("/dashboard/rnu?created=general");
}

export async function createInstitutionRnuEntry(
  input: CreateInstitutionEntryInput,
) {
  const { supabase, user } = await getAuthorizedRnuUser();

  const entryDate = input.entryDate?.trim() || getCurrentDate();
  const entryTime = input.entryTime?.trim() || getCurrentTime();

  const visitorCount =
    Number.isInteger(input.visitorCount) &&
    Number(input.visitorCount) > 0
      ? Number(input.visitorCount)
      : 1;

  const institutionName = nullableText(input.institutionName);
  const provinceLocality = nullableText(input.provinceLocality);
  const ages = nullableText(input.ages);
  const responsibleName = nullableText(input.responsibleName);
  const responsiblePhone = nullableText(input.responsiblePhone);
  const estimatedExitTime = nullableText(input.estimatedExitTime);
  const observations = nullableText(input.observations);

  const behavior =
    nullableText(input.behavior)?.toUpperCase() || null;

  const facilities = normalizeArray(input.facilities);
  const activities = normalizeArray(input.activities);

  const hasVisitRequest =
    typeof input.hasVisitRequest === "boolean"
      ? input.hasVisitRequest
      : null;

  const validFacilities = [
    "SUM",
    "CENTRO_INTERPRETATIVO",
  ];

  const hasInvalidFacility = facilities.some(
    (facility) => !validFacilities.includes(facility),
  );

  if (hasInvalidFacility) {
    throw new Error(
      "Una de las instalaciones seleccionadas no es válida.",
    );
  }

  const validActivities = [
    "KAYAK",
    "AVISTAJE",
    "CENTRO_ATENCION_VISITANTE",
  ];

  const hasInvalidActivity = activities.some(
    (activity) => !validActivities.includes(activity),
  );

  if (hasInvalidActivity) {
    throw new Error(
      "Una de las actividades seleccionadas no es válida.",
    );
  }

  const validBehaviors = ["BUENO", "REGULAR", "MALO"];

  if (
    behavior !== null &&
    !validBehaviors.includes(behavior)
  ) {
    throw new Error("El comportamiento seleccionado no es válido.");
  }

  const { error: insertError } = await supabase
    .from("rnu_entries")
    .insert({
      entry_type: "INSTITUCION",
      entry_date: entryDate,
      entry_time: entryTime,
      visitor_count: visitorCount,
      province_locality: provinceLocality,
      observations,
      institution_name: institutionName,
      ages,
      responsible_name: responsibleName,
      responsible_phone: responsiblePhone,
      estimated_exit_time: estimatedExitTime,
      has_visit_request: hasVisitRequest,
      facilities,
      activities,
      behavior,
      created_by: user.id,
    });

  if (insertError) {
    console.error(
      "Error al crear ingreso institucional RNU:",
      insertError,
    );

    throw new Error(
      `No se pudo guardar la institución: ${insertError.message}`,
    );
  }

  revalidatePath("/dashboard/rnu");
  revalidatePath("/dashboard/rnu/registros");

  redirect("/dashboard/rnu?created=institution");
}