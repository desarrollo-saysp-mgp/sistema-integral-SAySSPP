const OPENCAGE_BASE_URL = "https://api.opencagedata.com/geocode/v1/json";

export async function obtenerLatLon(
  address: string,
  streetNumber: string,
): Promise<string | null> {
  const apiKey = process.env.OPENCAGE_API_KEY;

  if (!apiKey) {
    console.error("Falta OPENCAGE_API_KEY en variables de entorno");
    return null;
  }

  if (!address?.trim() || !streetNumber?.trim()) {
    return null;
  }

  const direccionCompleta = `${address.trim()} ${streetNumber.trim()}, General Pico, La Pampa, Argentina`;

  const url = `${OPENCAGE_BASE_URL}?q=${encodeURIComponent(direccionCompleta)}&key=${apiKey}&language=es&limit=1`;

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Error HTTP geocoding:", response.status);
      return null;
    }

    const data = await response.json();

    if (data?.results?.length > 0) {
      const { lat, lng } = data.results[0].geometry;
      return `${lat}, ${lng}`;
    }

    return null;
  } catch (error) {
    console.error("Error geocodificando dirección:", error);
    return null;
  }
}