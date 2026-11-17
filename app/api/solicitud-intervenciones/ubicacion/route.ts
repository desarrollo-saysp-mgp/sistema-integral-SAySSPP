import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LUCAS_EMAIL = "arqbelliardolucas@gmail.com";
const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });

    const { data: profile, error: profileError } = await supabase.from("users")
      .select("role,email,is_readonly").eq("id", user.id).single();
    if (profileError || !profile) return NextResponse.json({ error: "Sin permisos." }, { status: 403 });

    const role = normalize(profile.role);
    const email = normalize(profile.email || user.email);
    const allowed = (role === "admin" || role === "reclamosarbolado" || email === normalize(LUCAS_EMAIL))
      && role !== "adminlectura" && profile.is_readonly !== true;
    if (!allowed) return NextResponse.json({ error: "No tenés permisos para ubicar solicitudes." }, { status: 403 });

    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Datos inválidos." }, { status: 400 }); }
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    const values = body as Record<string, unknown>;
    const id = values.id;
    const latitud = values.latitud;
    const longitud = values.longitud;
    if (typeof id !== "string" || !UUID.test(id) || typeof latitud !== "number" || typeof longitud !== "number" ||
      !Number.isFinite(latitud) || !Number.isFinite(longitud) ||
      latitud < -35.75 || latitud > -35.60 || longitud < -63.85 || longitud > -63.65) {
      return NextResponse.json({ error: "Seleccioná una ubicación válida dentro de la zona de General Pico." }, { status: 400 });
    }

    // Sólo completar solicitudes sin ninguna coordenada: evita reemplazos accidentales.
    // Supabase RLS debe autorizar este UPDATE al usuario autenticado.
    const { data, error } = await supabase.from("solicitudes_intervencion")
      .update({ latitud, longitud, precision_geocodificacion: "estimada" })
      .eq("id", id).is("latitud", null).is("longitud", null)
      .select("id,latitud,longitud").maybeSingle();
    if (error) return NextResponse.json({ error: "No se pudo guardar. Revisá los permisos RLS y el campo de precisión." }, { status: 500 });
    if (!data) return NextResponse.json({ error: "La solicitud ya fue ubicada, no existe o tu usuario no tiene permiso para modificarla." }, { status: 409 });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "No se pudo procesar la ubicación." }, { status: 500 });
  }
}
