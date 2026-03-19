import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
 * Requires: Authenticated user
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const [
      totalResult,
      inProgressResult,
      resolvedResult,
      unresolvedResult,
      recentResult,
    ] = await Promise.all([
      supabase.from("complaints").select("*", { count: "exact", head: true }),

      supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("status", "En proceso"),

      supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("status", "Resuelto"),

      supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("status", "No resuelto"),

      supabase
        .from("complaints")
        .select(
          `
          id,
          complaint_number,
          complaint_date,
          complainant_name,
          status,
          service:services(id, name),
          cause:causes(id, name)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (totalResult.error) {
      console.error("Error fetching total count:", totalResult.error);
      return NextResponse.json(
        { error: "Error al cargar estadísticas" },
        { status: 500 },
      );
    }

    if (inProgressResult.error) {
      console.error(
        "Error fetching in progress count:",
        inProgressResult.error,
      );
      return NextResponse.json(
        { error: "Error al cargar estadísticas" },
        { status: 500 },
      );
    }

    if (resolvedResult.error) {
      console.error("Error fetching resolved count:", resolvedResult.error);
      return NextResponse.json(
        { error: "Error al cargar estadísticas" },
        { status: 500 },
      );
    }

    if (unresolvedResult.error) {
      console.error("Error fetching unresolved count:", unresolvedResult.error);
      return NextResponse.json(
        { error: "Error al cargar estadísticas" },
        { status: 500 },
      );
    }

    if (recentResult.error) {
      console.error("Error fetching recent complaints:", recentResult.error);
      return NextResponse.json(
        { error: "Error al cargar reclamos recientes" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: {
        total: totalResult.count || 0,
        inProgress: inProgressResult.count || 0,
        resolved: resolvedResult.count || 0,
        unresolved: unresolvedResult.count || 0,
        recentComplaints: recentResult.data || [],
      },
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/dashboard/stats:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}