import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: privateHeaders });
    }

    const { data: access, error: accessError } = await supabase
      .from("complaint_map_access")
      .select("area")
      .eq("user_id", user.id)
      .maybeSingle();

    if (accessError || !access) {
      return NextResponse.json(
        { error: "Sin permiso para consultar estadísticas del mapa" },
        { status: accessError ? 500 : 403, headers: privateHeaders },
      );
    }

    const { data, error } = await supabase.rpc("get_complaint_map_stats");
    if (error) {
      console.error("Error loading map statistics:", error);
      return NextResponse.json({ error: "No se pudieron cargar las estadísticas" }, { status: 500, headers: privateHeaders });
    }

    const stats = Array.isArray(data) ? data[0] : data;
    if (!stats) {
      return NextResponse.json({ error: "No se encontraron estadísticas" }, { status: 500, headers: privateHeaders });
    }
    return NextResponse.json({ data: stats }, { headers: privateHeaders });
  } catch (error) {
    console.error("Unexpected error loading map stats:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500, headers: privateHeaders });
  }
}
