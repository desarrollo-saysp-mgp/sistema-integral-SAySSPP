import { createClient } from "@/lib/supabase/server";
import { getGradingAccess } from "../_access";
import { NextRequest, NextResponse } from "next/server";

// Se conserva la identificación dinámica del servicio y los permisos existentes.
async function getGradingServiceId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number> {
  const { data, error } = await supabase
    .from("services")
    .select("id, name")
    .ilike("name", "Motonivelación")
    .limit(1)
    .maybeSingle();

  if (error || data?.id == null) {
    throw new Error(
      "No se encontró el servicio Motonivelación en public.services (columnas id, name). Verificar el esquema de servicios antes de usar esta API."
    );
  }

  return Number(data.id);
}

type GradingComplaintRow = {
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
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d;
}

function parseLatLon(value: unknown): { lat: number; lng: number } | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 2 || !parts.every(Number.isFinite)) return null;
  const [lat, lng] = parts;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export async function GET(request: NextRequest) {
  try {
    const access = await getGradingAccess();
    if (!access.authenticated) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!access.canView) {
      return NextResponse.json(
        { error: "No autorizado para consultar Motonivelación" },
        { status: 403 }
      );
    }

    const supabase = access.supabase;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!isValidYmd(from) || !isValidYmd(to)) {
      return NextResponse.json(
        { error: "Indicá un rango de fechas válido." },
        { status: 400 }
      );
    }
    if (from > to) {
      return NextResponse.json(
        { error: "La fecha desde no puede ser posterior a la fecha hasta." },
        { status: 400 }
      );
    }

    let gradingServiceId: number;
    try {
      gradingServiceId = await getGradingServiceId(supabase);
    } catch (serviceError) {
      console.error("No se pudo identificar el servicio Motonivelación:", serviceError);
      return NextResponse.json(
        { error: "No se pudo identificar el servicio Motonivelación. Verificá las columnas de public.services y el nombre registrado del servicio." },
        { status: 500 }
      );
    }

    const pageSize = 1000;
    let offset = 0;
    const complaints: GradingComplaintRow[] = [];

    while (true) {
      const { data, error } = await supabase
        .from("complaints")
        .select(`
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
        `)
        .eq("service_id", gradingServiceId)
        .gte("complaint_date", from)
        .lte("complaint_date", to)
        .order("complaint_date", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error("Error cargando reclamos de motonivelación:", error);
        return NextResponse.json(
          { error: "No se pudieron cargar los reclamos de motonivelación." },
          { status: 500 }
        );
      }
      if (!data || data.length === 0) break;
      complaints.push(...(data as GradingComplaintRow[]));
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    const mapped = complaints
      .map((complaint) => {
        const location = parseLatLon(complaint.latlon);
        if (!location) return null;
        return {
          id: complaint.id, // ID técnico, no mostrar como número de reclamo
          complaint_number: complaint.complaint_number,
          complainant_name: complaint.complainant_name,
          complaint_date: complaint.complaint_date,
          address: complaint.address,
          street_number: complaint.street_number,
          status: complaint.status,
          details: complaint.details,
          created_at: complaint.created_at,
          lat: location.lat,
          lng: location.lng,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json({
      data: mapped,
      total: complaints.length,
      georeferenced: mapped.length,
      without_georeference: complaints.length - mapped.length,
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/test-grading/complaints:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
