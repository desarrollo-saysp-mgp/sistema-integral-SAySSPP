import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Trabajo = {
  trabajo_id: number;
  calle: string;
  altura: string;
};

type Modo = "normal" | "revision";

type Candidato = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    road?: string;
    street?: string;
    pedestrian?: string;
    residential?: string;
    house_number?: string;
    city?: string;
    town?: string;
    municipality?: string;
    state?: string;
    country_code?: string;
  };
  matchquality?: {
    matchcode?: string;
    matchtype?: string;
    matchlevel?: string;
  };
};

type EstadoGeo =
  | "validada"
  | "requiere_revision"
  | "sin_resultado"
  | "error";

type ResultadoTrabajo = {
  estado: EstadoGeo;
  lat: number | null;
  lon: number | null;
  precision: string | null;
  direccionEncontrada: string | null;
  mensajeError: string | null;
  consultadas: number;
  detenerLote: boolean;
};

const API_LOCATIONIQ =
  "https://us1.locationiq.com/v1/search";

const API_ESTRUCTURADA =
  "https://us1.locationiq.com/v1/search/structured";

const PAUSA_MS = 1200;
const TIMEOUT_MS = 8000;

const dormir = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function normalizar(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCalle(value: string): string {
  return normalizar(value)
    .replace(/^calle\s+/, "")
    .replace(/^avenida\s+/, "av ")
    .replace(/^av\s+/, "")
    .replace(/^diagonal\s+/, "diag ")
    .replace(/^diag\s+/, "")
    .trim();
}

function mismaAltura(a: string, b: string): boolean {
  if (!/^\d+$/.test(a.trim()) || !/^\d+$/.test(b.trim())) {
    return false;
  }

  return Number(a) === Number(b);
}

// Solo equivalencias verificadas.
// Nunca eliminar "bis", "Norte" u "Oeste".
function variantesCalle(calle: string): string[] {
  const variantes = new Set<string>([calle]);

  if (/^Calle /i.test(calle)) {
    variantes.add(calle.replace(/^Calle /i, ""));
  }

  if (/^Av\. /i.test(calle)) {
    variantes.add(calle.replace(/^Av\. /i, "Avenida "));
  }

  if (calle === "Av. Grl. José de San Martín") {
    variantes.add("Avenida San Martín");
    variantes.add("Avenida General José de San Martín");
  }

  if (calle === "Calle Diag. Mocovi") {
    variantes.add("Diagonal Mocoví");
  }

  // Alias aportado por OSM para esta calle.
  if (calle === "Calle 15 bis") {
    variantes.add("Cabo 2 Jorge D. Pardou");
  }

  return [...variantes];
}

function calleCoincide(
  encontrada: string,
  trabajo: Trabajo,
): boolean {
  return variantesCalle(trabajo.calle).some(
    (variante) =>
      normalizarCalle(variante) ===
      normalizarCalle(encontrada),
  );
}

function coordenadasValidas(item: Candidato): boolean {
  if (!item.lat || !item.lon) return false;

  const lat = Number(item.lat);
  const lon = Number(item.lon);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -35.9 &&
    lat <= -35.4 &&
    lon >= -64.1 &&
    lon <= -63.45
  );
}

function direccionCoincide(
  item: Candidato,
  trabajo: Trabajo,
): boolean {
  if (!coordenadasValidas(item)) return false;

  const a = item.address;
  if (!a) return false;

  const localidad = [
    a.city,
    a.town,
    a.municipality,
  ].some(
    (valor) => normalizar(valor) === "general pico",
  );

  if (!localidad) return false;
  if (normalizar(a.state) !== "la pampa") return false;
  if (normalizar(a.country_code) !== "ar") return false;

  const calleEncontrada =
    a.road ??
    a.street ??
    a.pedestrian ??
    a.residential ??
    "";

  if (!calleCoincide(calleEncontrada, trabajo)) {
    return false;
  }

  return mismaAltura(
    a.house_number ?? "",
    trabajo.altura,
  );
}

function esExacta(
  item: Candidato,
  trabajo: Trabajo,
): boolean {
  if (!direccionCoincide(item, trabajo)) {
    return false;
  }

  const calidad = item.matchquality;

  return (
    calidad?.matchcode === "exact" &&
    calidad.matchtype === "point" &&
    calidad.matchlevel === "building"
  );
}

function describirPrecision(
  item: Candidato,
): string {
  const q = item.matchquality;

  return [
    q?.matchcode ?? "desconocido",
    q?.matchtype ?? "desconocido",
    q?.matchlevel ?? "desconocido",
  ].join("/");
}

function resultadoError(
  mensaje: string,
  detenerLote = false,
  consultadas = 0,
): ResultadoTrabajo {
  return {
    estado: "error",
    lat: null,
    lon: null,
    precision: null,
    direccionEncontrada: null,
    mensajeError: mensaje,
    consultadas,
    detenerLote,
  };
}

function queryLibre(
  trabajo: Trabajo,
  apiKey: string,
  revision: boolean,
): { url: string; descripcion: string } {
  const variantes = variantesCalle(trabajo.calle);

  const calle = revision
    ? variantes.find(
      (v) => v !== trabajo.calle,
    ) ?? trabajo.calle
    : trabajo.calle;

  const direccion = revision
    ? `${trabajo.altura} ${calle}, General Pico, La Pampa, Argentina`
    : `${calle} ${trabajo.altura}, General Pico, La Pampa, Argentina`;

  const params = new URLSearchParams({
    key: apiKey,
    q: direccion,
    format: "json",
    countrycodes: "ar",
    addressdetails: "1",
    normalizeaddress: "1",
    normalizecity: "1",
    matchquality: "1",
    source: revision ? "v1n" : "",
    limit: "10",
  });

  if (!revision) {
    params.delete("source");
  }

  return {
    url: `${API_LOCATIONIQ}?${params.toString()}`,
    descripcion: "búsqueda libre",
  };
}

function queryEstructurada(
  trabajo: Trabajo,
  apiKey: string,
): { url: string; descripcion: string } {
  const calle =
    variantesCalle(trabajo.calle)[0];

  const params = new URLSearchParams({
    key: apiKey,
    street: `${trabajo.altura} ${calle}`,
    city: "General Pico",
    state: "La Pampa",
    country: "Argentina",
    format: "json",
    countrycodes: "ar",
    addressdetails: "1",
    normalizeaddress: "1",
    matchquality: "1",
    limit: "5",
  });

  return {
    url: `${API_ESTRUCTURADA}?${params.toString()}`,
    descripcion: "búsqueda estructurada",
  };
}

async function consultar(
  url: string,
): Promise<{
  candidatos: Candidato[];
  error: string | null;
  detener: boolean;
}> {
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 404) {
      return {
        candidatos: [],
        error: null,
        detener: false,
      };
    }

    if (response.status === 429) {
      return {
        candidatos: [],
        error: "LocationIQ alcanzó su límite de solicitudes.",
        detener: true,
      };
    }

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      return {
        candidatos: [],
        error: `LocationIQ rechazó el acceso: HTTP ${response.status}.`,
        detener: true,
      };
    }

    if (!response.ok) {
      return {
        candidatos: [],
        error: `LocationIQ respondió HTTP ${response.status}.`,
        detener: response.status >= 500,
      };
    }

    const data: unknown = await response.json();

    return {
      candidatos: Array.isArray(data)
        ? (data as Candidato[])
        : [],
      error: null,
      detener: false,
    };
  } catch (error) {
    return {
      candidatos: [],
      error:
        error instanceof Error
          ? error.message
          : "Error desconocido al consultar LocationIQ.",
      detener: false,
    };
  }
}

function evaluar(
  candidatos: Candidato[],
  trabajo: Trabajo,
  consultas: number,
): ResultadoTrabajo {
  // Evita aceptar dos resultados repetidos
  // de la misma coordenada como si fueran distintos.
  const coincidencias = new Map<string, Candidato>();

  for (const candidato of candidatos) {
    if (!esExacta(candidato, trabajo)) continue;

    const lat = Number(candidato.lat);
    const lon = Number(candidato.lon);

    const clave =
      `${lat.toFixed(7)}|${lon.toFixed(7)}`;

    coincidencias.set(clave, candidato);
  }

  if (coincidencias.size === 1) {
    const elegido = [...coincidencias.values()][0];

    return {
      estado: "validada",
      lat: Number(elegido.lat),
      lon: Number(elegido.lon),
      precision: "exact/point/building",
      direccionEncontrada:
        elegido.display_name ?? null,
      mensajeError: null,
      consultadas: consultas,
      detenerLote: false,
    };
  }

  if (coincidencias.size > 1) {
    return {
      estado: "requiere_revision",
      lat: null,
      lon: null,
      precision: null,
      direccionEncontrada: null,
      mensajeError:
        "Existen varias ubicaciones exactas distintas.",
      consultadas: consultas,
      detenerLote: false,
    };
  }

  // Guardamos solamente una candidata que coincida
  // en localidad, calle y altura.
  // NO se copia a solicitudes_intervencion.
  const compatibles = candidatos.filter(
    (c) => direccionCoincide(c, trabajo),
  );

  if (compatibles.length === 1) {
    const candidato = compatibles[0];

    return {
      estado: "requiere_revision",
      lat: Number(candidato.lat),
      lon: Number(candidato.lon),
      precision: describirPrecision(candidato),
      direccionEncontrada:
        candidato.display_name ?? null,
      mensajeError:
        "Calle y altura coinciden, pero la precisión geográfica requiere revisión.",
      consultadas: consultas,
      detenerLote: false,
    };
  }

  return {
    estado:
      candidatos.length > 0
        ? "requiere_revision"
        : "sin_resultado",
    lat: null,
    lon: null,
    precision: null,
    direccionEncontrada: null,
    mensajeError:
      candidatos.length > 0
        ? "No se encontró una coincidencia exacta y única de calle y altura."
        : null,
    consultadas: consultas,
    detenerLote: false,
  };
}

async function buscarDireccion(
  trabajo: Trabajo,
  apiKey: string,
  modo: Modo,
): Promise<ResultadoTrabajo> {
  const consultas =
    modo === "revision"
      ? [
        queryEstructurada(trabajo, apiKey),
        queryLibre(trabajo, apiKey, true),
      ]
      : [queryLibre(trabajo, apiKey, false)];

  const candidatos: Candidato[] = [];
  let realizadas = 0;

  for (let i = 0; i < consultas.length; i++) {
    const consulta = consultas[i];

    const respuesta = await consultar(consulta.url);

    realizadas++;

    if (respuesta.error) {
      return resultadoError(
        `${consulta.descripcion}: ${respuesta.error}`,
        respuesta.detener,
        realizadas,
      );
    }

    candidatos.push(...respuesta.candidatos);

    if (i < consultas.length - 1) {
      await dormir(PAUSA_MS);
    }
  }

  return evaluar(
    candidatos,
    trabajo,
    realizadas,
  );
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Origen no permitido." },
      { status: 403 },
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401 },
    );
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("users")
      .select("role,is_readonly")
      .eq("id", user.id)
      .single();

  if (
    profileError ||
    !profile ||
    normalizar(profile.role).replace(/\s/g, "") !==
    "admin" ||
    profile.is_readonly === true
  ) {
    return NextResponse.json(
      {
        error:
          "Solo Admin con permisos de escritura puede realizar esta operación.",
      },
      { status: 403 },
    );
  }

  const apiKey = process.env.LOCATIONIQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Falta LOCATIONIQ_API_KEY en el servidor.",
      },
      { status: 503 },
    );
  }

  let body: unknown = null;

  try {
    body = await request.json();
  } catch {
    // Compatible con las llamadas anteriores sin body.
  }

  const modo: Modo =
    body &&
      typeof body === "object" &&
      "modo" in body &&
      body.modo === "revision"
      ? "revision"
      : "normal";

  const funcion =
    modo === "revision"
      ? "intervenciones_geo_tomar_revision"
      : "intervenciones_geo_tomar_lote";

  const { data, error: loteError } =
    await supabase.rpc(funcion);

  if (loteError) {
    return NextResponse.json(
      {
        error:
          "No se pudo iniciar el lote: " +
          loteError.message,
      },
      { status: 409 },
    );
  }

  const trabajos = (data ?? []) as Trabajo[];

  const resumen = {
    consultadas: 0,
    direccionesValidadas: 0,
    solicitudesGeorreferenciadas: 0,
    pendientesRevision: 0,
    sinResultado: 0,
    errores: 0,
  };

  const detalles: Array<{
    direccion: string;
    estado: string;
    solicitudes: number;
    precision?: string | null;
  }> = [];

  let errorCritico: string | null = null;
  let detenerConsultas = false;

  for (let i = 0; i < trabajos.length; i++) {
    const trabajo = trabajos[i];

    const direccion =
      `${trabajo.calle} ${trabajo.altura}, ` +
      "General Pico, La Pampa, Argentina";

    const resultado = detenerConsultas
      ? resultadoError(
        "No consultada por interrupción del lote.",
      )
      : await buscarDireccion(
        trabajo,
        apiKey,
        modo,
      );

    resumen.consultadas += resultado.consultadas;

    if (resultado.detenerLote) {
      detenerConsultas = true;
      errorCritico =
        resultado.mensajeError ??
        "Se interrumpieron las consultas.";
    }

    const { data: aplicadas, error: guardarError } =
      await supabase.rpc(
        "intervenciones_geo_finalizar_trabajo",
        {
          p_id: trabajo.trabajo_id,
          p_estado: resultado.estado,
          p_latitud: resultado.lat,
          p_longitud: resultado.lon,
          p_direccion:
            resultado.direccionEncontrada,
          p_precision: resultado.precision,
          p_error: resultado.mensajeError,
        },
      );

    if (guardarError) {
      resumen.errores++;
      detenerConsultas = true;

      errorCritico =
        "No se pudieron guardar todos los resultados en Supabase.";

      console.error(
        "Error al guardar georreferenciación:",
        trabajo.trabajo_id,
        guardarError,
      );

      detalles.push({
        direccion,
        estado: "error_al_guardar",
        solicitudes: 0,
      });
    } else {
      const cantidad = Number(aplicadas ?? 0);

      if (resultado.estado === "validada") {
        resumen.direccionesValidadas++;

        resumen.solicitudesGeorreferenciadas +=
          cantidad;
      } else if (
        resultado.estado === "requiere_revision"
      ) {
        resumen.pendientesRevision++;
      } else if (
        resultado.estado === "sin_resultado"
      ) {
        resumen.sinResultado++;
      } else {
        resumen.errores++;
      }

      detalles.push({
        direccion,
        estado: resultado.estado,
        solicitudes: cantidad,
        precision: resultado.precision,
      });
    }

    if (
      resultado.consultadas > 0 &&
      i < trabajos.length - 1
    ) {
      await dormir(PAUSA_MS);
    }
  }

  const {
    data: liberado,
    error: liberarError,
  } = await supabase.rpc(
    "intervenciones_geo_liberar_lote",
  );

  if (liberarError || liberado !== true) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No se pudo liberar el lote. Revisá los trabajos en estado procesando.",
        trabajos: trabajos.length,
        resumen,
        detalles,
      },
      { status: 409 },
    );
  }

  if (errorCritico) {
    return NextResponse.json(
      {
        ok: false,
        error: errorCritico,
        trabajos: trabajos.length,
        resumen,
        detalles,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    modo,
    trabajos: trabajos.length,
    resumen,
    detalles,
  });
}