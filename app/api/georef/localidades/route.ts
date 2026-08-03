import { NextRequest, NextResponse } from "next/server";

type GeorefLocalidad = {
  id: string;
  nombre: string;
  provincia?: {
    id?: string;
    nombre?: string;
  };
};

type GeorefResponse = {
  cantidad?: number;
  localidades?: GeorefLocalidad[];
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get("q")?.trim() || "";

    if (query.length < 2) {
      return NextResponse.json({
        localidades: [],
      });
    }

    const params = new URLSearchParams({
      nombre: query,
      max: "15",
      campos: "id,nombre,provincia",
      orden: "nombre",
    });

    const response = await fetch(
      `https://apis.datos.gob.ar/georef/api/localidades?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
        },
        next: {
          revalidate: 86400,
        },
      },
    );

    if (!response.ok) {
      console.error(
        "Error Georef:",
        response.status,
        response.statusText,
      );

      return NextResponse.json(
        {
          error: "No se pudieron consultar las localidades.",
        },
        {
          status: 502,
        },
      );
    }

    const data = (await response.json()) as GeorefResponse;

    const localidades = (data.localidades ?? [])
      .filter(
        (localidad) =>
          localidad.nombre &&
          localidad.provincia?.nombre,
      )
      .map((localidad) => ({
        id: localidad.id,
        nombre: localidad.nombre,
        provincia: localidad.provincia?.nombre || "",
        label: `${localidad.nombre}, ${localidad.provincia?.nombre || ""}`,
      }));

    return NextResponse.json({
      localidades,
    });
  } catch (error) {
    console.error(
      "Error en /api/georef/localidades:",
      error,
    );

    return NextResponse.json(
      {
        error: "Error interno al consultar localidades.",
      },
      {
        status: 500,
      },
    );
  }
}