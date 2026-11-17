
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { STREETS } from "@/lib/constants/streets";
import { obtenerLatLon } from "@/lib/geocoding";
import {
  getInterventionAccess,
  INTERVENTIONS_BASE,
} from "./_access";

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

const val = (f: FormData, key: string, max = 300) =>
  String(f.get(key) ?? "").trim().slice(0, max);

const nullable = (s: string) => s || null;

const validDate = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;

  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
};

const originalDate = (v: string) =>
  `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`;

function fail(target: string, message: string): never {
  redirect(`${target}?error=${encodeURIComponent(message)}`);
}

// =====================================================
// VALIDACIÓN DE COORDENADAS
// =====================================================

type GeoPoint = {
  latitud: number;
  longitud: number;
};

function parseCoordinates(raw: string): GeoPoint | null {
  if (
    !raw ||
    raw.trim().toLowerCase() === "no encontrado"
  ) {
    return null;
  }

  const parts = raw.split(",").map((part) => part.trim());

  if (parts.length !== 2) return null;

  const [latitud, longitud] = parts.map(Number);

  if (
    !parts[0] ||
    !parts[1] ||
    !Number.isFinite(latitud) ||
    !Number.isFinite(longitud) ||
    latitud < -90 ||
    latitud > 90 ||
    longitud < -180 ||
    longitud > 180
  ) {
    return null;
  }

  return { latitud, longitud };
}

// =====================================================
// VALIDACIÓN Y NORMALIZACIÓN DEL FORMULARIO
// =====================================================

function parse(
  f: FormData,
  target: string,
  creating: boolean,
) {
  const expediente = val(f, "expediente", 80);
  const fecha = val(f, "fecha", 10);
  const nombre_apellido = val(f, "nombre_apellido", 250);
  const tipo = val(f, "tipo", 120);

  const cantidadRaw = val(f, "cantidad", 20).replace(
    ",",
    ".",
  );

  const especie = val(f, "especie", 250);
  const ubicacion_calle = val(f, "ubicacion_calle", 350);
  const estado = val(f, "estado", 120);
  const derivacion = val(f, "derivacion", 120);
  const retirado = val(f, "retirado", 40);

  // Los datos estructurados solo se aceptan
  // si coinciden con una calle real del catálogo.

  const modo = val(f, "direccion_modo", 10);

  const calle =
    modo === "street" ? val(f, "calle", 250) : "";

  const altura =
    modo === "street" ? val(f, "altura", 60) : "";

  const calleValida = (
    STREETS as readonly string[]
  ).includes(calle);

  // =====================================================
  // VALIDACIONES
  // =====================================================

  if (!expediente) {
    fail(target, "Ingresá el número de expediente.");
  }

  if (creating && !fecha) {
    fail(target, "Ingresá la fecha de la solicitud.");
  }

  if (fecha && !validDate(fecha)) {
    fail(target, "La fecha ingresada no es válida.");
  }

  if (!nombre_apellido) {
    fail(target, "Ingresá nombre y apellido.");
  }

  if (!tipo) {
    fail(target, "Ingresá el tipo de intervención.");
  }

  if (
    !cantidadRaw ||
    !Number.isInteger(Number(cantidadRaw)) ||
    Number(cantidadRaw) <= 0 ||
    Number(cantidadRaw) > 100000
  ) {
    fail(
      target,
      "La cantidad debe ser un número entero mayor que cero.",
    );
  }

  if (
    modo === "street" &&
    !calleValida &&
    (calle || altura || ubicacion_calle)
  ) {
    fail(
      target,
      "Seleccioná una calle válida del listado o utilizá Dirección libre.",
    );
  }

  if (
    modo === "street" &&
    calleValida &&
    !altura
  ) {
    fail(
      target,
      "Ingresá la altura para ubicar la intervención.",
    );
  }

  const direccion =
    modo === "street" && calleValida
      ? `${calle} ${altura}`.trim()
      : ubicacion_calle;

  return {
    expediente,
    nombre_apellido,
    tipo,
    cantidad: Number(cantidadRaw),
    especie: nullable(especie),
    ubicacion_calle: nullable(direccion),

    calle:
      modo === "street" && calleValida
        ? calle
        : null,

    altura:
      modo === "street" && calleValida
        ? altura
        : null,

    estado: nullable(estado),
    derivacion: nullable(derivacion),
    retirado: nullable(retirado),

    ...(fecha
      ? {
          fecha,
          fecha_original: originalDate(fecha),
          anio_original: fecha.slice(0, 4),
        }
      : {}),
  };
}

// =====================================================
// GEORREFERENCIACIÓN AUTOMÁTICA
// =====================================================

async function geocodificar(
  calle: string | null,
  altura: string | null,
): Promise<GeoPoint | null> {
  if (!calle || !altura) return null;

  try {
    return parseCoordinates(
      await obtenerLatLon(calle, altura, {
        timeoutMs: 2500,
      }),
    );
  } catch (error) {
    console.error(
      "No se pudo geocodificar la intervención:",
      error,
    );

    return null;
  }
}

// =====================================================
// CREAR SOLICITUD
// =====================================================

export async function crearSolicitud(
  formData: FormData,
) {
  const { supabase, user } =
    await getInterventionAccess(true);

  const target = `${INTERVENTIONS_BASE}/nueva`;

  const data = parse(formData, target, true);

  // Si la dirección es libre, o no se puede ubicar,
  // geo será null.
  const geo = await geocodificar(
    data.calle,
    data.altura,
  );

  const { error } = await supabase
    .from("solicitudes_intervencion")
    .insert({
      ...data,

      latitud: geo?.latitud ?? null,
      longitud: geo?.longitud ?? null,

      precision_geocodificacion: geo
        ? "estimada"
        : null,

      creado_por: user.id,
      actualizado_por: user.id,

      estado_original: data.estado,
      derivacion_original: data.derivacion,
    });

  if (error) {
    fail(
      target,
      `No se pudo guardar: ${error.message}`,
    );
  }

  revalidatePath(INTERVENTIONS_BASE);

  revalidatePath(`${INTERVENTIONS_BASE}/mapa`);

  redirect(
    `${INTERVENTIONS_BASE}?guardado=creado`,
  );
}

// =====================================================
// EDITAR SOLICITUD
// =====================================================

export async function editarSolicitud(
  id: string,
  formData: FormData,
) {
  const { supabase, user } =
    await getInterventionAccess(true);

  if (
    !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id)
  ) {
    redirect(INTERVENTIONS_BASE);
  }

  const target =
    `${INTERVENTIONS_BASE}/${id}/editar`;

  const data = parse(formData, target, false);

  // Consultamos la dirección actual y sus coordenadas.
  // Esto permite conservar ubicaciones manuales.

  const {
    data: previous,
    error: previousError,
  } = await supabase
    .from("solicitudes_intervencion")
    .select(
      "ubicacion_calle, calle, altura, latitud, longitud",
    )
    .eq("id", id)
    .single();

  if (previousError || !previous) {
    fail(
      target,
      "No se pudo consultar la solicitud original.",
    );
  }

  const currentAddress =
    (previous.ubicacion_calle ?? "").trim();

  const nextAddress =
    (data.ubicacion_calle ?? "").trim();

  const addressChanged =
    currentAddress !== nextAddress;

  const hasStructuredLocation = Boolean(
    data.calle && data.altura,
  );

  const missingGeo =
    previous.latitud == null ||
    previous.longitud == null;

  // Si cambia la dirección o faltan coordenadas,
  // intentamos georreferenciar nuevamente.
  //
  // Si la dirección no cambia y ya tiene coordenadas,
  // conservamos su ubicación, incluso si fue manual.

  const shouldGeocode =
    hasStructuredLocation &&
    (addressChanged || missingGeo);

  const geo = shouldGeocode
    ? await geocodificar(
        data.calle,
        data.altura,
      )
    : null;

  const shouldUpdateCoordinates =
    shouldGeocode || addressChanged;

  const updatePayload = {
    ...data,

    actualizado_por: user.id,

    ...(shouldUpdateCoordinates
      ? {
          latitud: geo?.latitud ?? null,
          longitud: geo?.longitud ?? null,

          precision_geocodificacion: geo
            ? "estimada"
            : null,
        }
      : {}),
  };

  const {
    data: updated,
    error,
  } = await supabase
    .from("solicitudes_intervencion")
    .update(updatePayload)
    .eq("id", id)
    .select("id")
    .single();

  if (error || !updated) {
    fail(
      target,
      `No se pudo editar: ${
        error?.message ?? "registro no disponible"
      }`,
    );
  }

  revalidatePath(INTERVENTIONS_BASE);
  revalidatePath(target);
  revalidatePath(`${INTERVENTIONS_BASE}/mapa`);

  redirect(
    `${INTERVENTIONS_BASE}?guardado=editado`,
  );
}

// =====================================================
// ELIMINAR SOLICITUD
// =====================================================

/**
 * Borrado definitivo.
 * Valida el usuario en servidor y aplica RLS en Supabase.
 */

export async function eliminarSolicitud(
  id: string,
): Promise<{
  ok: boolean;
  error?: string;
}> {
  const { supabase } =
    await getInterventionAccess(true);

  if (
    !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id)
  ) {
    return {
      ok: false,
      error: "Identificador de solicitud inválido.",
    };
  }

  const { data, error } = await supabase
    .from("solicitudes_intervencion")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: "No se pudo eliminar la solicitud.",
    };
  }

  if (!data) {
    return {
      ok: false,
      error:
        "No se encontró la solicitud o no tenés permiso para eliminarla.",
    };
  }

  revalidatePath(INTERVENTIONS_BASE);
  revalidatePath(`${INTERVENTIONS_BASE}/mapa`);

  return { ok: true };
}
