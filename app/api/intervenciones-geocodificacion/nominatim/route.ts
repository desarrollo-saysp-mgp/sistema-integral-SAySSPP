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

type Candidato = {
  lat?: string | number;
  lon?: string | number;
  display_name?: string;
  address?: {
    house_number?: string;
    road?: string;
    street?: string;
    pedestrian?: string;
    residential?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country_code?: string;
  };
};

type Punto = { lat: number; lon: number };
type EstadoBusqueda =
  | "candidata"
  | "calle_encontrada_altura_no_verificada"
  | "calle_ambigua"
  | "sin_coincidencia";

type Busqueda = {
  estado: EstadoBusqueda;
  punto: Punto | null;
  calleDetectada: string | null;
  observacion: string;
};

const API = "https://us1.locationiq.com/v1/search";
const TIMEOUT_MS = 10000;
const PAUSA_MS = 1200;

const dormir = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function limpiarCalle(valor: unknown): string {
  return normalizar(valor)
    .replace(/^calle\s+/, "")
    .replace(/^av\s+/, "avenida ")
    .replace(/^grl\s+/, "general ")
    .replace(/\bgrl\b/g, "general")
    .replace(/\bgral\b/g, "general")
    .replace(/^diag\s+/, "diagonal ")
    .replace(/\s+/g, " ")
    .trim();
}

function nombresCompatibles(encontrada: string, solicitada: string): boolean {
  const a = limpiarCalle(encontrada);
  const b = limpiarCalle(solicitada);
  if (a === b) return true;

  const alias = new Map<string, string>([
    ["avenida san martin", "avenida general jose de san martin"],
    ["avenida general jose de san martin", "avenida general jose de san martin"],
    ["cabo 2 jorge d pardou", "15 bis"],
    ["15 bis", "15 bis"],
  ]);

  return (alias.get(a) ?? a) === (alias.get(b) ?? b);
}

function nombreCalle(item: Candidato): string {
  const a = item.address;
  return a?.road ?? a?.street ?? a?.pedestrian ?? a?.residential ?? "";
}

function enGeneralPico(item: Candidato): Punto | null {
  if (item.lat == null || item.lon == null) return null;
  const lat = Number(item.lat);
  const lon = Number(item.lon);
  if (
    !Number.isFinite(lat) || !Number.isFinite(lon) ||
    lat < -35.75 || lat > -35.57 ||
    lon < -63.87 || lon > -63.66
  ) return null;

  const a = item.address;
  if (!a || normalizar(a.country_code) !== "ar") return null;
  if (normalizar(a.state) !== "la pampa") return null;

  const localidad = [a.city, a.town, a.village, a.municipality].some(
    (valor) => {
      const n = normalizar(valor);
      return n === "general pico" || n === "municipio de general pico";
    },
  );

  if (!localidad && !normalizar(item.display_name).includes("general pico")) {
    return null;
  }

  return { lat, lon };
}

function clavePunto(p: Punto): string {
  return `${p.lat.toFixed(6)}|${p.lon.toFixed(6)}`;
}

function variantesCalle(calle: string): string[] {
  const nombres = new Set<string>([calle]);
  if (/^calle\s+/i.test(calle)) nombres.add(calle.replace(/^calle\s+/i, ""));
  if (limpiarCalle(calle) === "avenida general jose de san martin") {
    nombres.add("Avenida General José de San Martín");
    nombres.add("Avenida San Martín");
  }
  if (normalizar(calle) === "calle 15 bis") {
    nombres.add("Cabo 2 Jorge D. Pardou");
  }
  return [...nombres].slice(0, 3);
}

async function consultar(
  apiKey: string,
  texto: string,
): Promise<Candidato[]> {
  const params = new URLSearchParams({
    key: apiKey,
    q: texto,
    format: "json",
    source: "v1n",
    addressdetails: "1",
    countrycodes: "ar",
    limit: "10",
  });

  const respuesta = await fetch(`${API}?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  // 404 significa que este texto no tuvo resultados, no un error del lote.
  if (respuesta.status === 404) return [];
  if (respuesta.status === 429) {
    throw new Error("LocationIQ limitó las consultas (HTTP 429). Detené el proceso.");
  }
  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new Error(`LocationIQ rechazó el acceso (HTTP ${respuesta.status}).`);
  }
  if (!respuesta.ok) {
    throw new Error(`LocationIQ respondió HTTP ${respuesta.status}.`);
  }

  const json: unknown = await respuesta.json();
  if (!Array.isArray(json)) {
    throw new Error("LocationIQ devolvió un formato inesperado.");
  }
  return json as Candidato[];
}

async function buscar(trabajo: Trabajo, apiKey: string): Promise<Busqueda> {
  const variantes = variantesCalle(trabajo.calle);
  const altura = Number(trabajo.altura);
  const puntosExactos = new Map<string, Punto>();
  const puntosCalle = new Map<string, Punto>();
  let calleDetectada: string | null = null;
  let totalConsultas = 0;

  async function procesar(texto: string): Promise<void> {
    if (totalConsultas > 0) await dormir(PAUSA_MS);
    totalConsultas++;
    const candidatos = await consultar(apiKey, texto);

    for (const item of candidatos) {
      const punto = enGeneralPico(item);
      if (!punto) continue;
      const calle = nombreCalle(item);
      if (!calle || !nombresCompatibles(calle, trabajo.calle)) continue;

      calleDetectada ??= calle;
      puntosCalle.set(clavePunto(punto), punto);

      const casa = String(item.address?.house_number ?? "").trim();
      if (
        Number.isSafeInteger(altura) &&
        /^\d+$/.test(casa) &&
        Number(casa) === altura
      ) {
        puntosExactos.set(clavePunto(punto), punto);
      }
    }
  }

  // Primero buscamos el domicilio, como en la versión original.
  for (const calle of variantes) {
    await procesar(`${calle} ${trabajo.altura}, General Pico, La Pampa, Argentina`);
  }

  if (puntosExactos.size === 1) {
    return {
      estado: "candidata",
      punto: [...puntosExactos.values()][0],
      calleDetectada,
      observacion: "Calle y altura verificadas en el resultado del proveedor.",
    };
  }

  if (puntosExactos.size > 1) {
    return {
      estado: "calle_ambigua",
      punto: null,
      calleDetectada,
      observacion: "Hay varias coordenadas para el mismo número; no se elige una automáticamente.",
    };
  }

  // Si faltó el número, preguntamos por la calle sin altura,
  // pero NO guardamos el centro de esa vía como si fuera el domicilio.
  if (puntosCalle.size === 0) {
    for (const calle of variantes) {
      await procesar(`${calle}, General Pico, La Pampa, Argentina`);
    }
  }

  if (puntosCalle.size > 0) {
    return {
      estado: "calle_encontrada_altura_no_verificada",
      punto: null,
      calleDetectada,
      observacion:
        "Se identificó la calle en General Pico, pero no el número de puerta. Falta identificar la cuadra.",
    };
  }

  return {
    estado: "sin_coincidencia",
    punto: null,
    calleDetectada: null,
    observacion: "No hubo una coincidencia verificable de la calle en General Pico.",
  };
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: perfil, error: perfilError } = await supabase
    .from("users")
    .select("role,is_readonly")
    .eq("id", user.id)
    .single();

  if (
    perfilError || !perfil ||
    normalizar(perfil.role).replace(/\s/g, "") !== "admin" ||
    perfil.is_readonly === true
  ) {
    return NextResponse.json({ error: "Solo Admin con escritura." }, { status: 403 });
  }

  const apiKey = process.env.LOCATIONIQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Falta LOCATIONIQ_API_KEY." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  if (
    !body || typeof body !== "object" ||
    !("ids" in body) || !Array.isArray(body.ids) ||
    body.ids.length < 1 || body.ids.length > 3 ||
    !body.ids.every((id: unknown) =>
      typeof id === "number" && Number.isSafeInteger(id) && id > 0
    )
  ) {
    return NextResponse.json({ error: "Enviá entre 1 y 3 IDs válidos." }, { status: 400 });
  }

  const ids = body.ids as number[];
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "IDs duplicados." }, { status: 400 });
  }
  const aplicar = "aplicar" in body && body.aplicar === true;

  const { data, error: listaError } = await supabase.rpc(
    "intervenciones_geo_listar_revision",
  );
  if (listaError) {
    return NextResponse.json({ error: listaError.message }, { status: 500 });
  }

  const lista = (data ?? []) as Trabajo[];
  const porId = new Map(lista.map((t) => [t.trabajo_id, t]));
  const trabajos = ids.map((id) => porId.get(id));
  if (trabajos.some((t) => !t)) {
    return NextResponse.json(
      { error: "Hay direcciones que ya no están pendientes." },
      { status: 409 },
    );
  }

  const detalles: Array<{
    id: number;
    direccion: string;
    estado: string;
    solicitudes: number;
    lat: number | null;
    lon: number | null;
    calleDetectada: string | null;
    observacion: string;
  }> = [];

  let incorporadas = 0;
  let candidatas = 0;
  let solicitudesActualizadas = 0;
  let callesSinAltura = 0;
  let ambiguas = 0;
  let sinCoincidencia = 0;

  for (const trabajo of trabajos as Trabajo[]) {
    let resultado: Busqueda;
    try {
      resultado = await buscar(trabajo, apiKey);
    } catch (e) {
      return NextResponse.json({
        ok: false,
        error: e instanceof Error ? e.message : "Error consultando Nominatim.",
        detalles,
        incorporadas,
        candidatas,
        solicitudesActualizadas,
        callesSinAltura,
        ambiguas,
        sinCoincidencia,
      }, { status: 502 });
    }

    if (resultado.estado === "candidata") candidatas++;
    if (resultado.estado === "calle_encontrada_altura_no_verificada") callesSinAltura++;
    if (resultado.estado === "calle_ambigua") ambiguas++;
    if (resultado.estado === "sin_coincidencia") sinCoincidencia++;

    let estado: string = resultado.estado;
    let solicitudes = 0;

    // SOLO dirección con altura verificada. No se guarda un punto de calle.
    if (resultado.estado === "candidata" && resultado.punto && aplicar) {
      const { data: cantidad, error } = await supabase.rpc(
        "intervenciones_geo_guardar_nominatim",
        {
          p_id: trabajo.trabajo_id,
          p_latitud: resultado.punto.lat,
          p_longitud: resultado.punto.lon,
        },
      );
      if (error) {
        return NextResponse.json({
          ok: false,
          error: error.message,
          detalles,
          incorporadas,
          candidatas,
          solicitudesActualizadas,
          callesSinAltura,
          ambiguas,
          sinCoincidencia,
        }, { status: 409 });
      }
      solicitudes = Number(cantidad ?? 0);
      if (solicitudes > 0) {
        estado = "incorporada";
        incorporadas++;
        solicitudesActualizadas += solicitudes;
      } else {
        estado = "sin_solicitudes_pendientes";
      }
    }

    detalles.push({
      id: trabajo.trabajo_id,
      direccion: `${trabajo.calle} ${trabajo.altura}`,
      estado,
      solicitudes,
      lat: resultado.punto?.lat ?? null,
      lon: resultado.punto?.lon ?? null,
      calleDetectada: resultado.calleDetectada,
      observacion: resultado.observacion,
    });

    await dormir(PAUSA_MS);
  }

  return NextResponse.json({
    ok: true,
    examinadas: detalles.length,
    candidatas,
    incorporadas,
    solicitudesActualizadas,
    callesSinAltura,
    ambiguas,
    sinCoincidencia,
    detalles,
  });
}
