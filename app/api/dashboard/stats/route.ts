import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json(
        { error: "No se pudo validar el usuario" },
        { status: 500 },
      );
    }


    const { data: serviceRoles } = await supabase
      .from("services")
      .select("id, name")
      .or("name.ilike.%Arbolado%,name.ilike.%Zoonosis%,name.ilike.%Vectores%");

    const arboladoServiceIds =
      serviceRoles
        ?.filter((s) => s.name.toLowerCase().includes("arbolado"))
        .map((s) => s.id) ?? [];

    const zyvServiceIds =
      serviceRoles
        ?.filter((s) => {
          const name = s.name.toLowerCase();
          return name.includes("zoonosis") || name.includes("vectores");
        })
        .map((s) => s.id) ?? [];


    const applyRoleFilter = <T>(query: T): T => {
      if (currentUser.role === "ReclamosArbolado") {
        return (query as any).eq("form_variant", "arbolado");
      }

      if (currentUser.role === "Reclamos") {
        return (query as any).or(
          "form_variant.eq.general,form_variant.eq.import_excel,form_variant.is.null",
        );
      }

      if (currentUser.role === "ReclamosZyV") {
        return (query as any).or(
          [
            "form_variant.eq.zyv",
            zyvServiceIds.length
              ? `service_id.in.(${zyvServiceIds.join(",")})`
              : null,
          ]
            .filter(Boolean)
            .join(","),
        );
      }

      return query;
    };

    const totalQuery = applyRoleFilter(
      supabase.from("complaints").select("*", { count: "exact", head: true }),
    );

    const inProgressQuery = applyRoleFilter(
      supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("status", "En proceso"),
    );

    const resolvedQuery = applyRoleFilter(
      supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("status", "Resuelto"),
    );

    const unresolvedQuery = applyRoleFilter(
      supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("status", "No resuelto"),
    );

    const recentQuery = applyRoleFilter(
      supabase
        .from("complaints")
        .select(
          `
          id,
          complaint_number,
          arbolado_number,
          complaint_date,
          complainant_name,
          status,
          details,
          form_variant,
          extra_data,
          created_at,
          service:services(id, name),
          cause:causes(id, name)
        `,
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(5),
    );

    const [
      totalResult,
      inProgressResult,
      resolvedResult,
      unresolvedResult,
      recentResult,
    ] = await Promise.all([
      totalQuery,
      inProgressQuery,
      resolvedQuery,
      unresolvedQuery,
      recentQuery,
    ]);

    if (totalResult.error) {
      console.error("Error fetching total count:", totalResult.error);
      return NextResponse.json(
        { error: "Error al cargar estadísticas" },
        { status: 500 },
      );
    }

    if (inProgressResult.error) {
      console.error("Error fetching in progress count:", inProgressResult.error);
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