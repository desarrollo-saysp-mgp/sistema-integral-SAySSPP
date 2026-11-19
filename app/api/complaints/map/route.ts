import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 500;
const MAX_ROWS = 20000;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const { data: access, error: accessError } = await supabase
      .from("complaint_map_access")
      .select("area")
      .eq("user_id", user.id)
      .maybeSingle();

    if (accessError) {
      console.error("Error checking map access:", accessError);
      return NextResponse.json(
        { error: "No se pudo verificar el permiso del mapa" },
        { status: 500, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    if (!access) {
      return NextResponse.json(
        { error: "No tenés acceso al Mapa de Reclamos" },
        { status: 403, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const complaints: unknown[] = [];

    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const { data, error } = await supabase.rpc("get_complaint_map_data").range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error("Error fetching complaint map:", error);
        return NextResponse.json(
          { error: "No se pudieron cargar los reclamos del mapa" },
          { status: 500, headers: { "Cache-Control": "private, no-store" } },
        );
      }

      const batch = data ?? [];
      complaints.push(...batch);

      if (batch.length < PAGE_SIZE) {
        return NextResponse.json(
          { area: access.area, data: complaints, updatedAt: new Date().toISOString() },
          { headers: { "Cache-Control": "private, no-store" } },
        );
      }
    }

    console.error("Complaint map exceeded configured MAX_ROWS");
    return NextResponse.json(
      { error: "El mapa supera el límite de registros configurado" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Unexpected error in GET /api/complaints/map:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
