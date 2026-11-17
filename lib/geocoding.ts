const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const LOCATIONIQ_BASE_URL = "https://us1.locationiq.com/v1/search";

const buildQuery = (address: string, streetNumber: string) => {
  const direccion = `${address?.trim() || ""} ${streetNumber?.trim() || ""}`.trim();
  if (!direccion) return "";
  return `${direccion}, General Pico, La Pampa, Argentina`;
};

type GeocodingOptions = {
  /** Tiempo máximo por proveedor. No afecta a los consumidores que omiten esta opción. */
  timeoutMs?: number;
};

const signalFor = (options?: GeocodingOptions): AbortSignal | undefined => {
  const timeout = options?.timeoutMs;
  return typeof timeout === "number" && Number.isFinite(timeout) && timeout > 0
    ? AbortSignal.timeout(Math.max(200, Math.min(timeout, 15000)))
    : undefined;
};

export async function obtenerLatLon(
  address: string,
  streetNumber: string,
  options?: GeocodingOptions,
): Promise<string> {
  const query = buildQuery(address, streetNumber);
  if (!query) return "No encontrado";

  // 1. Nominatim: una llamada por solicitud, sin consultas en paralelo.
  try {
    const urlNominatim =
      `${NOMINATIM_BASE_URL}?q=${encodeURIComponent(query)}` +
      `&format=json&limit=1&countrycodes=ar`;

    const response = await fetch(urlNominatim, {
      method: "GET",
      cache: "no-store",
      signal: signalFor(options),
      headers: {
        "User-Agent": "gestion-reclamos/1.0",
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const data: unknown = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = data[0]?.lat;
        const lon = data[0]?.lon;
        if (lat && lon) return `${lat}, ${lon}`;
      }
    } else {
      console.error("Nominatim HTTP error:", response.status);
    }
  } catch (error) {
    console.error("Nominatim error:", error);
  }

  // 2. LocationIQ: respaldo si Nominatim falló o excedió el tiempo máximo.
  try {
    const apiKey = process.env.LOCATIONIQ_API_KEY;
    if (!apiKey) {
      console.error("Falta LOCATIONIQ_API_KEY en variables de entorno");
      return "No encontrado";
    }

    const urlLocationIQ =
      `${LOCATIONIQ_BASE_URL}?key=${apiKey}` +
      `&q=${encodeURIComponent(query)}` +
      `&format=json&limit=1&countrycodes=ar`;

    const response = await fetch(urlLocationIQ, {
      method: "GET",
      cache: "no-store",
      signal: signalFor(options),
      headers: { Accept: "application/json" },
    });

    if (response.ok) {
      const data: unknown = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = data[0]?.lat;
        const lon = data[0]?.lon;
        if (lat && lon) return `${lat}, ${lon}`;
      }
    } else {
      console.error("LocationIQ HTTP error:", response.status);
    }
  } catch (error) {
    console.error("LocationIQ error:", error);
  }

  return "No encontrado";
}
