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

type OsmNode = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

type OsmWay = {
  type: "way";
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
};

type Elemento = OsmNode | OsmWay;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mismaCalle(a: string, b: string): boolean {
  const limpiar = (texto: string) =>
    normalizar(texto).replace(/^calle /, "");

  return limpiar(a) === limpiar(b);
}

function numero(texto?: string): number | null {
  if (!texto || !/^\d+$/.test(texto.trim())) {
    return null;
  }

  return Number(texto);
}

function distancia(
  a: OsmNode,
  b: OsmNode,
): number {
  const latMedia = ((a.lat + b.lat) / 2) * Math.PI / 180;
  const dx = (b.lon - a.lon) * 111320 * Math.cos(latMedia);
  const dy = (b.lat - a.lat) * 111320;

  return Math.hypot(dx, dy);
}

function interpolar(
  puntos: OsmNode[],
  proporcion: number,
): { lat: number; lon: number } | null {
  if (puntos.length < 2) return null;

  const distancias: number[] = [];
  let total = 0;

  for (let i = 1; i < puntos.length; i++) {
    const d = distancia(puntos[i - 1], puntos[i]);
    distancias.push(d);
    total += d;
  }

  // Solo tramos acotados: evita interpolar
  // a lo largo de una calle completa.
  if (total < 1 || total > 240) return null;

  let recorrido = Math.max(0, Math.min(1, proporcion)) * total;

  for (let i = 1; i < puntos.length; i++) {
    const tramo = distancias[i - 1];

    if (recorrido <= tramo || i === puntos.length - 1) {
      const t = tramo > 0 ? recorrido / tramo : 0;

      return {
        lat: puntos[i - 1].lat +
          (puntos[i].lat - puntos[i - 1].lat) * t,
        lon: puntos[i - 1].lon +
          (puntos[i].lon - puntos[i - 1].lon) * t,
      };
    }

    recorrido -= tramo;
  }

  return null;
}

function calcularCandidatos(
  trabajos: Trabajo[],
  elementos: Elemento[],
) {
  const nodos = new Map<number, OsmNode>();
  const vias: OsmWay[] = [];

  for (const elemento of elementos) {
    if (elemento.type === "node") {
      nodos.set(elemento.id, elemento);
    } else {
      vias.push(elemento);
    }
  }

  const propuestas = new Map<
    number,
    Array<{ lat: number; lon: number; via: number }>
  >();

  for (const via of vias) {
    const tipo = via.tags?.["addr:interpolation"];

    if (!["all", "even", "odd"].includes(tipo ?? "")) {
      continue;
    }

    const puntos = via.nodes
      .map((id) => nodos.get(id))
      .filter((n): n is OsmNode => Boolean(n));

    if (puntos.length !== via.nodes.length || puntos.length < 2) {
      continue;
    }

    const inicio = puntos[0];
    const fin = puntos[puntos.length - 1];

    const desde = numero(inicio.tags?.["addr:housenumber"]);
    const hasta = numero(fin.tags?.["addr:housenumber"]);

    if (desde === null || hasta === null || desde === hasta) {
      continue;
    }

    // La numeración debe corresponder a un tramo corto.
    if (Math.abs(hasta - desde) > 200) continue;

    // Exigimos denominación explícita de calle en ambos extremos
    // o en la propia vía de interpolación.
    const calleInicio =
      inicio.tags?.["addr:street"] ?? via.tags?.["addr:street"];
    const calleFin =
      fin.tags?.["addr:street"] ?? via.tags?.["addr:street"];

    if (!calleInicio || !calleFin) continue;
    if (!mismaCalle(calleInicio, calleFin)) continue;

    // Si hay otros números de puerta dentro del tramo,
    // evitamos simplificar una interpolación más compleja.
    if (
      puntos.slice(1, -1).some(
        (p) => p.tags?.["addr:housenumber"],
      )
    ) {
      continue;
    }

    for (const trabajo of trabajos) {
      if (!mismaCalle(trabajo.calle, calleInicio)) continue;

      const altura = numero(trabajo.altura);
      if (altura === null) continue;

      const minimo = Math.min(desde, hasta);
      const maximo = Math.max(desde, hasta);

      if (altura < minimo || altura > maximo) continue;

      if (
        tipo === "even" &&
        (altura % 2 !== 0 ||
          desde % 2 !== 0 ||
          hasta % 2 !== 0)
      ) {
        continue;
      }

      if (
        tipo === "odd" &&
        (altura % 2 !== 1 ||
          desde % 2 !== 1 ||
          hasta % 2 !== 1)
      ) {
        continue;
      }

      const proporcion =
        (altura - desde) / (hasta - desde);

      const ubicacion = interpolar(puntos, proporcion);

      if (!ubicacion) continue;

      if (
        ubicacion.lat < -35.9 ||
        ubicacion.lat > -35.4 ||
        ubicacion.lon < -64.1 ||
        ubicacion.lon > -63.45
      ) {
        continue;
      }

      const anteriores = propuestas.get(trabajo.trabajo_id) ?? [];

      anteriores.push({
        ...ubicacion,
        via: via.id,
      });

      propuestas.set(trabajo.trabajo_id, anteriores);
    }
  }

  return propuestas;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Origen no permitido" },
      { status: 403 },
    );
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 },
    );
  }

  const { data: perfil } = await supabase
    .from("users")
    .select("role,is_readonly")
    .eq("id", user.id)
    .single();

  if (
    !perfil ||
    normalizar(String(perfil.role)).replace(/\s/g, "") !== "admin" ||
    perfil.is_readonly === true
  ) {
    return NextResponse.json(
      { error: "Solo Admin" },
      { status: 403 },
    );
  }

  const { data, error: errorLista } = await supabase.rpc(
    "intervenciones_geo_listar_revision",
  );

  if (errorLista) {
    return NextResponse.json(
      { error: errorLista.message },
      { status: 500 },
    );
  }

  const trabajos = (data ?? []) as Trabajo[];

  if (!trabajos.length) {
    return NextResponse.json({
      ok: true,
      examinadas: 0,
      georreferenciadas: 0,
      solicitudesActualizadas: 0,
      mensaje: "No hay direcciones en revisión.",
    });
  }

  // Una consulta regional de tramos de numeración.
  // Nunca hacemos una consulta por cada dirección.
const overpassQuery = `
  [out:json][timeout:25];
  (
    way["addr:interpolation"](-35.70,-63.82,-35.60,-63.70);
  );
  out body;
  >;
  out body qt;
`;

  let elementos: Elemento[];

  try {
    const respuesta = await fetch(
      "https://overpass.private.coffee/api/interpreter",
      {
        method: "POST",
        body: new URLSearchParams({
          data: overpassQuery,
        }),
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent":
            "SAySSPP-General-Pico-Intervenciones/1.0",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(35000),
      },
    );

    if (!respuesta.ok) {
      return NextResponse.json(
        {
          error:
            `OpenStreetMap/Overpass respondió HTTP ${respuesta.status}. ` +
            "No se modificó ninguna solicitud.",
        },
        { status: 502 },
      );
    }

    const json: unknown = await respuesta.json();

    if (
      !json ||
      typeof json !== "object" ||
      !("elements" in json) ||
      !Array.isArray(json.elements)
    ) {
      throw new Error("Respuesta OSM inválida");
    }

    elementos = json.elements as Elemento[];
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "No se pudieron consultar los tramos OSM: " +
          (error instanceof Error
            ? error.message
            : "Error desconocido"),
      },
      { status: 502 },
    );
  }

  const propuestas = calcularCandidatos(trabajos, elementos);

  let direccionesAplicadas = 0;
  let solicitudesActualizadas = 0;
  let ambiguas = 0;
  const errores: string[] = [];

  for (const trabajo of trabajos) {
    const candidatos = propuestas.get(trabajo.trabajo_id) ?? [];

    // Nunca elegir arbitrariamente entre dos tramos posibles.
    if (candidatos.length > 1) {
      ambiguas++;
      continue;
    }

    if (candidatos.length !== 1) continue;

    const punto = candidatos[0];

    const { data: cantidad, error } = await supabase.rpc(
      "intervenciones_geo_aplicar_osm",
      {
        p_id: trabajo.trabajo_id,
        p_latitud: punto.lat,
        p_longitud: punto.lon,
      },
    );

    if (error) {
      errores.push(
        `${trabajo.calle} ${trabajo.altura}: ${error.message}`,
      );
      continue;
    }

    if (Number(cantidad) > 0) {
      direccionesAplicadas++;
      solicitudesActualizadas += Number(cantidad);
    }
  }

  return NextResponse.json({
    ok: errores.length === 0,
    direccionesExaminadas: trabajos.length,
    tramosOsmConsultados: elementos.filter(
      (elemento) => elemento.type === "way",
    ).length,
    direccionesAplicadas,
    solicitudesActualizadas,
    ambiguas,
    sinTramoVerificable:
      trabajos.length - direccionesAplicadas - ambiguas,
    errores,
  });
}