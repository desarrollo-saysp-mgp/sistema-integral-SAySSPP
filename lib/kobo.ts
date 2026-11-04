
import "server-only";

const DEFAULT_KOBO_URL = "https://kf.kobotoolbox.org";

export type KoboRespuesta = Record<string, unknown>;

export interface KoboFormulario {
  uid: string;
  name: string;
  deployment_status?: string;
  content?: {
    survey?: Array<Record<string, unknown>>;
    choices?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface KoboPagina {
  count: number;
  next: string | null;
  results: KoboRespuesta[];
}

function getKoboConfig() {
  const baseUrl = (
    process.env.KOBO_API_URL || DEFAULT_KOBO_URL
  ).replace(/\/+$/, "");

  const token = process.env.KOBO_API_TOKEN;
  const assetUid = process.env.KOBO_ASSET_UID;

  if (!token || !assetUid) {
    throw new Error(
      "Faltan KOBO_API_TOKEN o KOBO_ASSET_UID"
    );
  }

  const origin = new URL(baseUrl).origin;

  if (!origin.startsWith("https://")) {
    throw new Error("La API de Kobo requiere HTTPS");
  }

  return { baseUrl: origin, token, assetUid };
}

async function koboFetch<T>(url: string): Promise<T> {
  const { baseUrl, token } = getKoboConfig();

  if (new URL(url).origin !== new URL(baseUrl).origin) {
    throw new Error("Origen de Kobo no permitido");
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: "application/json",
    },
    next: {
      revalidate: 180,
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(
      `Error Kobo HTTP ${response.status}`
    );
  }

  return (await response.json()) as T;
}

export async function obtenerFormularioKobo() {
  const { baseUrl, assetUid } = getKoboConfig();

  return koboFetch<KoboFormulario>(
    `${baseUrl}/api/v2/assets/${encodeURIComponent(assetUid)}/`
  );
}

export async function obtenerRespuestasKobo() {
  const { baseUrl, assetUid } = getKoboConfig();

  const urlInicial =
    `${baseUrl}/api/v2/assets/` +
    `${encodeURIComponent(assetUid)}/data/`;

  let siguienteUrl: string | null = urlInicial;

  const respuestas: KoboRespuesta[] = [];
  const paginasVisitadas = new Set<string>();

  let cantidadReportada = 0;

  while (siguienteUrl) {
    const urlActual: string = siguienteUrl;

    if (paginasVisitadas.has(urlActual)) {
      throw new Error("Paginación circular en Kobo");
    }

    paginasVisitadas.add(urlActual);

    const pagina: KoboPagina =
      await koboFetch<KoboPagina>(urlActual);

    if (!Array.isArray(pagina.results)) {
      throw new Error("Formato de respuestas inesperado");
    }

    cantidadReportada = pagina.count;

    respuestas.push(...pagina.results);

    siguienteUrl = pagina.next;
  }

  return {
    total: respuestas.length,
    totalReportado: cantidadReportada,
    respuestas,
  };
}

export async function obtenerDatosEncuesta() {
  const [formulario, datos] = await Promise.all([
    obtenerFormularioKobo(),
    obtenerRespuestasKobo(),
  ]);

  return {
    formulario,
    ...datos,
    actualizadoEn: new Date().toISOString(),
  };
}
