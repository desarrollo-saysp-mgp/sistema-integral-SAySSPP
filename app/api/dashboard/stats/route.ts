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

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Get total complaints count
    const { count: totalCount, error: totalError } = await supabase
      .from("complaints")
      .select("*", { count: "exact", head: true });

    if (totalError) {
      console.error("Error fetching total count:", totalError);
      return NextResponse.json(
        { error: "Error al cargar estadísticas" },
        { status: 500 },
      );
    }

    // Get counts by status
    const { data: statusCounts, error: statusError } = await supabase
      .from("complaints")
      .select("status");

    if (statusError) {
      console.error("Error fetching status counts:", statusError);
      return NextResponse.json(
        { error: "Error al cargar estadísticas" },
        { status: 500 },
      );
    }

    // Calculate status counts
    const inProgressCount = statusCounts.filter(
      (c) => c.status === "En proceso",
    ).length;
    const resolvedCount = statusCounts.filter(
      (c) => c.status === "Resuelto",
    ).length;
    const unresolvedCount = statusCounts.filter(
      (c) => c.status === "No resuelto",
    ).length;

    // Get recent complaints (last 5)
    const { data: recentComplaints, error: recentError } = await supabase
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
      .limit(5);

    if (recentError) {
      console.error("Error fetching recent complaints:", recentError);
      return NextResponse.json(
        { error: "Error al cargar reclamos recientes" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: {
        total: totalCount || 0,
        inProgress: inProgressCount,
        resolved: resolvedCount,
        unresolved: unresolvedCount,
        recentComplaints: recentComplaints || [],
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
