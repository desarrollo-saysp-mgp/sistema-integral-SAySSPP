"use server";

import { revalidatePath } from "next/cache";
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

type UpdateRnuEntryInput = {
  id: string;
  entryType: "GENERAL" | "INSTITUCION";

  entryDate?: string;
  entryTime?: string;
  visitorCount?: number;
  provinceLocality?: string;
  observations?: string;

  transportType?: string;
  firstVisit?: boolean | null;
  entryReasons?: string[];
  facilities?: string[];

  institutionName?: string;
  ages?: string;
  responsibleName?: string;
  responsiblePhone?: string;
  estimatedExitTime?: string;
  hasVisitRequest?: boolean | null;
  activities?: string[];
  behavior?: string;
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
    throw new Error("No tenés permiso para modificar registros RNU.");
  }

  return {
    supabase,
    user,
    userRole,
  };
}

/* =========================================================
   CREAR INGRESO GENERAL
========================================================= */

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

  const firstVisit =
    typeof input.firstVisit === "boolean"
      ? input.firstVisit
      : null;

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

  const { data: createdEntry, error: insertError } = await supabase
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
    })
    .select("id")
    .single();

  if (insertError || !createdEntry) {
    console.error(
      "Error al crear el ingreso general RNU:",
      insertError,
    );

    throw new Error(
      `No se pudo guardar el ingreso: ${
        insertError?.message || "No se recibió el registro creado."
      }`,
    );
  }

  revalidatePath("/dashboard/rnu");
  revalidatePath("/dashboard/rnu/registros");
  revalidatePath("/dashboard/rnu/estadisticas");

  return {
    success: true,
    id: createdEntry.id,
  };
}

/* =========================================================
   CREAR INSTITUCIÓN
========================================================= */

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

  const validBehaviors = [
    "BUENO",
    "REGULAR",
    "MALO",
  ];

  if (
    behavior !== null &&
    !validBehaviors.includes(behavior)
  ) {
    throw new Error(
      "El comportamiento seleccionado no es válido.",
    );
  }

  const { data: createdEntry, error: insertError } = await supabase
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
    })
    .select("id")
    .single();

  if (insertError || !createdEntry) {
    console.error(
      "Error al crear ingreso institucional RNU:",
      insertError,
    );

    throw new Error(
      `No se pudo guardar la institución: ${
        insertError?.message || "No se recibió el registro creado."
      }`,
    );
  }

  revalidatePath("/dashboard/rnu");
  revalidatePath("/dashboard/rnu/registros");
  revalidatePath("/dashboard/rnu/estadisticas");

  return {
    success: true,
    id: createdEntry.id,
  };
}

/* =========================================================
   EDITAR REGISTRO
========================================================= */

export async function updateRnuEntry(
  input: UpdateRnuEntryInput,
) {
  const { supabase } = await getAuthorizedRnuUser();

  const id = input.id?.trim();

  if (!id) {
    throw new Error("No se pudo identificar el registro.");
  }

  if (
    input.entryType !== "GENERAL" &&
    input.entryType !== "INSTITUCION"
  ) {
    throw new Error("El tipo de registro no es válido.");
  }

  const { data: existingEntry, error: existingError } =
    await supabase
      .from("rnu_entries")
      .select("id, entry_type")
      .eq("id", id)
      .maybeSingle();

  if (existingError) {
    console.error(
      "Error al verificar registro RNU:",
      existingError,
    );

    throw new Error(
      "No se pudo verificar el registro.",
    );
  }

  if (!existingEntry) {
    throw new Error(
      "El registro ya no existe o no está disponible.",
    );
  }

  const entryDate =
    input.entryDate?.trim() || getCurrentDate();

  const entryTime =
    input.entryTime?.trim() || getCurrentTime();

  const visitorCount =
    Number.isInteger(input.visitorCount) &&
      Number(input.visitorCount) > 0
      ? Number(input.visitorCount)
      : 1;

  const provinceLocality =
    nullableText(input.provinceLocality);

  const observations =
    nullableText(input.observations);

  const facilities =
    normalizeArray(input.facilities);

  const validFacilities = [
    "SUM",
    "CENTRO_INTERPRETATIVO",
  ];

  if (
    facilities.some(
      (facility) =>
        !validFacilities.includes(facility),
    )
  ) {
    throw new Error(
      "Una de las instalaciones seleccionadas no es válida.",
    );
  }

  if (input.entryType === "GENERAL") {
    const transportType =
      nullableText(input.transportType)?.toUpperCase() ||
      null;

    const firstVisit =
      typeof input.firstVisit === "boolean"
        ? input.firstVisit
        : null;

    const entryReasons =
      normalizeArray(input.entryReasons);

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
      throw new Error(
        "El medio de ingreso seleccionado no es válido.",
      );
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

    if (
      entryReasons.some(
        (reason) =>
          !validEntryReasons.includes(reason),
      )
    ) {
      throw new Error(
        "Uno de los motivos seleccionados no es válido.",
      );
    }

    const { error: updateError } = await supabase
      .from("rnu_entries")
      .update({
        entry_type: "GENERAL",

        entry_date: entryDate,
        entry_time: entryTime,
        visitor_count: visitorCount,
        province_locality: provinceLocality,
        observations,

        transport_type: transportType,
        first_visit: firstVisit,
        entry_reasons: entryReasons,
        facilities,

        institution_name: null,
        ages: null,
        responsible_name: null,
        responsible_phone: null,
        estimated_exit_time: null,
        has_visit_request: null,
        activities: [],
        behavior: null,
      })
      .eq("id", id);

    if (updateError) {
      console.error(
        "Error al actualizar ingreso general RNU:",
        updateError,
      );

      throw new Error(
        `No se pudo actualizar el registro: ${updateError.message}`,
      );
    }
  }

  if (input.entryType === "INSTITUCION") {
    const institutionName =
      nullableText(input.institutionName);

    const ages =
      nullableText(input.ages);

    const responsibleName =
      nullableText(input.responsibleName);

    const responsiblePhone =
      nullableText(input.responsiblePhone);

    const estimatedExitTime =
      nullableText(input.estimatedExitTime);

    const hasVisitRequest =
      typeof input.hasVisitRequest === "boolean"
        ? input.hasVisitRequest
        : null;

    const activities =
      normalizeArray(input.activities);

    const behavior =
      nullableText(input.behavior)?.toUpperCase() ||
      null;

    const validActivities = [
      "KAYAK",
      "AVISTAJE",
      "CENTRO_ATENCION_VISITANTE",
    ];

    if (
      activities.some(
        (activity) =>
          !validActivities.includes(activity),
      )
    ) {
      throw new Error(
        "Una de las actividades seleccionadas no es válida.",
      );
    }

    const validBehaviors = [
      "BUENO",
      "REGULAR",
      "MALO",
    ];

    if (
      behavior !== null &&
      !validBehaviors.includes(behavior)
    ) {
      throw new Error(
        "El comportamiento seleccionado no es válido.",
      );
    }

    const { error: updateError } = await supabase
      .from("rnu_entries")
      .update({
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

        transport_type: null,
        first_visit: null,
        entry_reasons: [],
      })
      .eq("id", id);

    if (updateError) {
      console.error(
        "Error al actualizar institución RNU:",
        updateError,
      );

      throw new Error(
        `No se pudo actualizar el registro: ${updateError.message}`,
      );
    }
  }

  revalidatePath("/dashboard/rnu");
  revalidatePath("/dashboard/rnu/registros");
  revalidatePath("/dashboard/rnu/estadisticas");
  revalidatePath(`/dashboard/rnu/registros/${id}`);
  revalidatePath(
    `/dashboard/rnu/registros/${id}/editar`,
  );

  return {
    success: true,
    id,
  };
}

/* =========================================================
   ELIMINAR REGISTRO
========================================================= */

export async function deleteRnuEntry(
  id: string,
) {
  const { supabase } = await getAuthorizedRnuUser();

  const entryId = id?.trim();

  if (!entryId) {
    throw new Error(
      "No se pudo identificar el registro.",
    );
  }

  const {
    data: existingEntry,
    error: findError,
  } = await supabase
    .from("rnu_entries")
    .select("id")
    .eq("id", entryId)
    .maybeSingle();

  if (findError) {
    console.error(
      "Error al buscar el registro RNU:",
      findError,
    );

    throw new Error(
      "No se pudo verificar el registro que querés eliminar.",
    );
  }

  if (!existingEntry) {
    throw new Error(
      "El registro ya no existe o no está disponible.",
    );
  }

  const { error: deleteError } = await supabase
    .from("rnu_entries")
    .delete()
    .eq("id", entryId);

  if (deleteError) {
    console.error(
      "Error al eliminar registro RNU:",
      deleteError,
    );

    throw new Error(
      `No se pudo eliminar el registro: ${deleteError.message}`,
    );
  }

  revalidatePath("/dashboard/rnu");
  revalidatePath("/dashboard/rnu/registros");
  revalidatePath("/dashboard/rnu/estadisticas");
}