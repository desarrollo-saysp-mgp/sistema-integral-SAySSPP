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

type Direccion = {
  calle?: { nombre?: string };
  altura?: { valor?: number | null };
  ubicacion?: {
    lat?: number | null;
    lon?: number | null;
  };
  provincia?: { nombre?: string };
  departamento?: { nombre?: string };
  localidad?: { nombre?: string };
  localidad_censal?: { nombre?: string };
};

type ResultadoConsulta = {
  direcciones?: Direccion[];
  cantidad?: number;
};

type RespuestaLotes = {
  resultados?: ResultadoConsulta[];
};

type Punto = {
  lat: number;
  lon: number;
};

const API =
  "https://apis.datos.gob.ar/georef/api/v2.0/direcciones";

const MAX_LOTE = 30;

function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCalle(valor: unknown): string {
  return normalizar(valor)
    .replace(/^calle\s+/, "")
    .replace(/^(av|avenida)\s+/, "")
    .replace(/^diagonal\s+/, "diag ")
    .trim();
}

function mismaCalle(a: string, b: string): boolean {
  const x = normalizarCalle(a);
  const y = normalizarCalle(b);

  if (x === y) return true;

  // Alias confirmado en OSM.
  return (
    (x === "15 bis" && y === "cabo 2 jorge d pardou") ||
    (y === "15 bis" && x === "cabo 2 jorge d pardou")
  );
}

function validar(
  direccion: Direccion,
  trabajo: Trabajo,
): Punto | null {
  const lat = direccion.ubicacion?.lat;
  const lon = direccion.ubicacion?.lon;

  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return null;
  }

  if (
    lat < -35.75 ||
    lat > -35.57 ||
    lon < -63.87 ||
    lon > -63.66
  ) {
    return null;
  }

  const altura = Number(trabajo.altura);

  if (
    !Number.isSafeInteger(altura) ||
    direccion.altura?.valor !== altura
  ) {
    return null;
  }

  if (
    !mismaCalle(
      direccion.calle?.nombre ?? "",
      trabajo.calle,
    )
  ) {
    return null;
  }

  if (
    normalizar(direccion.provincia?.nombre) !==
    "la pampa"
  ) {
    return null;
  }

  if (
    normalizar(direccion.departamento?.nombre) !==
    "maraco"
  ) {
    return null;
  }

  const localidades = [
    direccion.localidad?.nombre,
    direccion.localidad_censal?.nombre,
  ].filter(
    (v): v is string => Boolean(v),
  );

  if (
    localidades.length &&
    !localidades.some(
      (v) => normalizar(v) === "general pico",
    )
  ) {
    return null;
  }

  return { lat, lon };
}

function elegir(
  resultado: ResultadoConsulta,
  trabajo: Trabajo,
): Punto | null {
  const candidatos = Array.isArray(resultado.direcciones)
    ? resultado.direcciones
    : [];

  const unicos = new Map<string, Punto>();

  for (const candidato of candidatos) {
    const punto = validar(candidato, trabajo);

    if (!punto) continue;

    const clave =
      `${punto.lat.toFixed(6)}|${punto.lon.toFixed(6)}`;

    unicos.set(clave, punto);
  }

  // Nunca elegir arbitrariamente entre distintos puntos.
  return unicos.size === 1
    ? [...unicos.values()][0]
    : null;
}

async function consultarLote(
  trabajos: Trabajo[],
): Promise<ResultadoConsulta[]> {
  const cuerpo = {
    direcciones: trabajos.map((trabajo) => ({
      direccion: `${trabajo.calle} ${trabajo.altura}`,
      provincia: "La Pampa",
      departamento: "Maraco",
      max: 5,
    })),
  };

  const respuesta = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(cuerpo),
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });

  if (respuesta.status === 429) {
    throw new Error(
      "Georef está limitando las consultas (HTTP 429). " +
      "No se guardó este lote. No vuelvas a ejecutar " +
      "hasta que el servicio permita nuevas consultas.",
    );
  }

  if (!respuesta.ok) {
    throw new Error(
      `Georef respondió HTTP ${respuesta.status}.`,
    );
  }

  const json: unknown = await respuesta.json();

  if (
    !json ||
    typeof json !== "object" ||
    !("resultados" in json) ||
    !Array.isArray(json.resultados)
  ) {
    throw new Error(
      "Georef devolvió un formato de respuesta inesperado.",
    );
  }

  const resultados =
    (json as RespuestaLotes).resultados ?? [];

  if (resultados.length !== trabajos.length) {
    throw new Error(
      "La cantidad de resultados no coincide con " +
      "las direcciones consultadas. No se guardó el lote.",
    );
  }

  return resultados;
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

  const { data: perfil, error: perfilError } =
    await supabase
      .from("users")
      .select("role,is_readonly")
      .eq("id", user.id)
      .single();

  if (
    perfilError ||
    !perfil ||
    normalizar(perfil.role).replace(/\s/g, "") !==
      "admin" ||
    perfil.is_readonly === true
  ) {
    return NextResponse.json(
      {
        error:
          "Solo Admin con escritura puede georreferenciar.",
      },
      { status: 403 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Datos inválidos." },
      { status: 400 },
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("ids" in body) ||
    !Array.isArray(body.ids) ||
    body.ids.length < 1 ||
    body.ids.length > MAX_LOTE ||
    !body.ids.every(
      (id: unknown) =>
        typeof id === "number" &&
        Number.isSafeInteger(id) &&
        id > 0,
    )
  ) {
    return NextResponse.json(
      {
        error: `Enviá entre 1 y ${MAX_LOTE} IDs válidos.`,
      },
      { status: 400 },
    );
  }

  const ids = body.ids as number[];

  if (new Set(ids).size !== ids.length) {
    return NextResponse.json(
      { error: "Hay IDs duplicados." },
      { status: 400 },
    );
  }

  const aplicar =
    "aplicar" in body && body.aplicar === true;

  const { data, error: listaError } =
    await supabase.rpc(
      "intervenciones_geo_listar_revision",
    );

  if (listaError) {
    return NextResponse.json(
      { error: listaError.message },
      { status: 500 },
    );
  }

  const lista = (data ?? []) as Trabajo[];
  const porId = new Map(
    lista.map((t) => [t.trabajo_id, t]),
  );

  const trabajos = ids.map((id) => porId.get(id));

  if (trabajos.some((t) => !t)) {
    return NextResponse.json(
      {
        error:
          "Una dirección ya no está pendiente de revisión.",
      },
      { status: 409 },
    );
  }

  const lote = trabajos as Trabajo[];

  let resultados: ResultadoConsulta[];

  try {
    resultados = await consultarLote(lote);
  } catch (e) {
    const mensaje =
      e instanceof Error
        ? e.message
        : "Error consultando Georef.";

    return NextResponse.json(
      {
        ok: false,
        error: mensaje,
        detalles: [],
        candidatas: 0,
        incorporadas: 0,
        solicitudesActualizadas: 0,
      },
      { status: 502 },
    );
  }

  const detalles: Array<{
    id: number;
    direccion: string;
    estado: string;
    solicitudes: number;
    lat: number | null;
    lon: number | null;
  }> = [];

  let incorporadas = 0;
  let solicitudesActualizadas = 0;
  let candidatas = 0;

  for (let i = 0; i < lote.length; i++) {
    const trabajo = lote[i];
    const punto = elegir(resultados[i], trabajo);

    if (punto) candidatas++;

    let estado = punto
      ? "candidata"
      : "sin_coincidencia";

    let solicitudes = 0;

    if (punto && aplicar) {
      const { data: cantidad, error } =
        await supabase.rpc(
          "intervenciones_geo_guardar_georef",
          {
            p_id: trabajo.trabajo_id,
            p_latitud: punto.lat,
            p_longitud: punto.lon,
          },
        );

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error:
              `Error guardando ${trabajo.calle} ` +
              `${trabajo.altura}: ${error.message}`,
            detalles,
            candidatas,
            incorporadas,
            solicitudesActualizadas,
          },
          { status: 409 },
        );
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
      lat: punto?.lat ?? null,
      lon: punto?.lon ?? null,
    });
  }

  return NextResponse.json({
    ok: true,
    modo: aplicar ? "guardar" : "vista_previa",
    examinadas: lote.length,
    candidatas,
    incorporadas,
    solicitudesActualizadas,
    detalles,
  });
}