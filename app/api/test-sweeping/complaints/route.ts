
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const BARRIDO_SERVICE_ID = 5;

const FULL_ACCESS_EMAILS = new Set([
  "waldaquin84@gmail.com",
  "adm.serviciospublicos.mgp@gmail.com",
  "martincornejo.gp@gmail.com",
]);

type ComplaintRow = {
  id: number;
  complaint_number: number | string | null;
  complainant_name: string | null;
  complaint_date: string;
  address: string | null;
  street_number: string | null;
  status: string | null;
  details: string | null;
  latlon: string | null;
  created_at: string | null;
};

function isValidYmd(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseLatLon(
  value: unknown
): {
  lat: number;
  lng: number;
} | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parts = value
    .split(",")
    .map((part) => Number(part.trim()));

  if (
    parts.length !== 2 ||
    !Number.isFinite(parts[0]) ||
    !Number.isFinite(parts[1])
  ) {
    return null;
  }

  const lat = parts[0];
  const lng = parts[1];

  if (
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { lat, lng };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Validar autenticación.
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // 2. Consultar rol del usuario.
    const {
      data: currentUser,
      error: userError,
    } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json(
        { error: "No se pudo validar el usuario" },
        { status: 500 }
      );
    }

    // 3. Mantener permisos existentes.
    const email = (authUser.email ?? "")
      .trim()
      .toLowerCase();

    const hasAccess =
      currentUser.role === "Admin" ||
      currentUser.role === "AdminLectura" ||
      FULL_ACCESS_EMAILS.has(email);

    if (!hasAccess) {
      return NextResponse.json(
        {
          error:
            "No autorizado para consultar el mapa de barrido",
        },
        { status: 403 }
      );
    }

    // 4. Validar rango de fechas.
    const { searchParams } = new URL(request.url);

    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!isValidYmd(from) || !isValidYmd(to)) {
      return NextResponse.json(
        {
          error: "Indicá un rango de fechas válido.",
        },
        { status: 400 }
      );
    }

    if (from > to) {
      return NextResponse.json(
        {
          error:
            "La fecha desde no puede ser posterior a la fecha hasta.",
        },
        { status: 400 }
      );
    }

    // 5. Cargar reclamos de barrido con paginación.
    const pageSize = 1000;
    let offset = 0;

    const complaints: ComplaintRow[] = [];

    while (true) {
      const { data, error } = await supabase
        .from("complaints")
        .select(
          `
            id,
            complaint_number,
            complainant_name,
            complaint_date,
            address,
            street_number,
            status,
            details,
            latlon,
            created_at
          `
        )
        .eq("service_id", BARRIDO_SERVICE_ID)
        .gte("complaint_date", from)
        .lte("complaint_date", to)
        .order("complaint_date", {
          ascending: false,
        })
        .order("id", {
          ascending: false,
        })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error(
          "Error cargando reclamos de barrido:",
          error
        );

        return NextResponse.json(
          {
            error:
              "No se pudieron cargar los reclamos de barrido.",
          },
          { status: 500 }
        );
      }

      if (!data || data.length === 0) {
        break;
      }

      complaints.push(...(data as ComplaintRow[]));

      if (data.length < pageSize) {
        break;
      }

      offset += pageSize;
    }

    // 6. Preparar reclamos con coordenadas válidas.
    const mapped = complaints
      .map((complaint) => {
        const location = parseLatLon(
          complaint.latlon
        );

        if (!location) {
          return null;
        }

        return {
          // Identificador interno. Se conserva.
          id: complaint.id,

          // Número real visible en el Sistema Integral.
          complaint_number:
            complaint.complaint_number,

          // Nombre del reclamante.
          complainant_name:
            complaint.complainant_name,

          // Datos existentes.
          complaint_date:
            complaint.complaint_date,
          address: complaint.address,
          street_number:
            complaint.street_number,
          status: complaint.status,
          details: complaint.details,
          created_at: complaint.created_at,

          // Ubicación geográfica.
          lat: location.lat,
          lng: location.lng,
        };
      })
      .filter(
        (
          complaint
        ): complaint is NonNullable<typeof complaint> =>
          complaint !== null
      );

    // 7. Responder manteniendo el formato original.
    return NextResponse.json({
      data: mapped,
      total: complaints.length,
      georeferenced: mapped.length,
      without_georeference:
        complaints.length - mapped.length,
    });
  } catch (error) {
    console.error(
      "Unexpected error in GET /api/test-sweeping/complaints:",
      error
    );

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
