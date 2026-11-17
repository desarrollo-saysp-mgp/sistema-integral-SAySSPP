import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

async function obtenerAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { supabase, permitido: false };
  }

  const { data: perfil, error } = await supabase
    .from("users")
    .select("role,is_readonly")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    permitido:
      !error &&
      normalizar(perfil?.role) === "admin" &&
      perfil?.is_readonly !== true,
  };
}

export async function GET() {
  const { supabase, permitido } = await obtenerAdmin();

  if (!permitido) {
    return NextResponse.json(
      { error: "Acceso no autorizado." },
      { status: 403 },
    );
  }

  const { data, error } = await supabase.rpc(
    "intervenciones_geo_listar_revision",
  );

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    trabajos: data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Origen no permitido." },
      { status: 403 },
    );
  }

  const { supabase, permitido } = await obtenerAdmin();

  if (!permitido) {
    return NextResponse.json(
      { error: "Acceso no autorizado." },
      { status: 403 },
    );
  }

  let body: {
    id?: number;
    latitud?: number;
    longitud?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 },
    );
  }

  const { id, latitud, longitud } = body;

  if (
    !Number.isSafeInteger(id) ||
    !Number.isFinite(latitud) ||
    !Number.isFinite(longitud)
  ) {
    return NextResponse.json(
      { error: "Datos de ubicación inválidos." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc(
    "intervenciones_geo_guardar_manual",
    {
      p_id: id,
      p_latitud: latitud,
      p_longitud: longitud,
    },
  );

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    solicitudesActualizadas: Number(data ?? 0),
  });
}