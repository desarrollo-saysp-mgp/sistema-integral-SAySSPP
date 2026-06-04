import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const SERVICIOS_PUBLICOS_EMAIL = "adm.serviciospublicos.mgp@gmail.com";
const GIRSU_EMAIL = "direccióngirsupico@gmail.com";

const normalizeName = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const buildRoleOrFilter = (items: Array<string | null>) =>
  items.filter(Boolean).join(",");

const isServiciosPublicosService = (serviceName?: string | null) => {
  const name = normalizeName(serviceName);

  return (
    name.includes("barrido") ||
    name.includes("riego") ||
    name.includes("motonivelacion") ||
    name.includes("canales y desagues")
  );
};

const isGirsuService = (serviceName?: string | null) => {
  const name = normalizeName(serviceName);

  return (
    name.includes("rec. domiciliaria") ||
    name.includes("rec domiciliaria") ||
    name.includes("rec. especial") ||
    name.includes("rec especial") ||
    name.includes("inspeccion") ||
    name.includes("rec. contenedores") ||
    name.includes("rec contenedores")
  );
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("role, email")
      .eq("id", user.id)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json(
        { error: "No se pudo validar el usuario" },
        { status: 500 },
      );
    }

    const userEmail = normalizeName(currentUser.email || user.email || "");

    const isServiciosPublicosUser =
      userEmail === normalizeName(SERVICIOS_PUBLICOS_EMAIL) ||
      scope === "servicios-publicos";

    const isGirsuUser = userEmail === normalizeName(GIRSU_EMAIL) || scope === "girsu";

    const { data: serviceRoles } = await supabase
      .from("services")
      .select("id, name");

    const arboladoServiceIds =
      serviceRoles
        ?.filter((service) => normalizeName(service.name).includes("arbolado"))
        .map((service) => service.id) ?? [];

    const zyvServiceIds =
      serviceRoles
        ?.filter((service) => {
          const name = normalizeName(service.name);
          return name.includes("zoonosis") || name.includes("vectores");
        })
        .map((service) => service.id) ?? [];

    const serviciosPublicosServiceIds =
      serviceRoles
        ?.filter((service) => isServiciosPublicosService(service.name))
        .map((service) => service.id) ?? [];

    const girsuServiceIds =
      serviceRoles
        ?.filter((service) => isGirsuService(service.name))
        .map((service) => service.id) ?? [];

    const applyRoleFilter = <T>(query: T): T => {
      if (isServiciosPublicosUser) {
        if (!serviciosPublicosServiceIds.length) {
          return (query as any).eq("service_id", -1);
        }

        return (query as any).in("service_id", serviciosPublicosServiceIds);
      }

      if (isGirsuUser) {
        if (!girsuServiceIds.length) {
          return (query as any).eq("service_id", -1);
        }

        return (query as any).in("service_id", girsuServiceIds);
      }

      if (currentUser.role === "ReclamosArbolado") {
        return (query as any).or(
          buildRoleOrFilter([
            "form_variant.eq.arbolado",
            arboladoServiceIds.length
              ? `service_id.in.(${arboladoServiceIds.join(",")})`
              : null,
          ]),
        );
      }

      if (currentUser.role === "ReclamosZyV") {
        return (query as any).or(
          buildRoleOrFilter([
            "form_variant.eq.zyv",
            zyvServiceIds.length
              ? `service_id.in.(${zyvServiceIds.join(",")})`
              : null,
          ]),
        );
      }

      if (currentUser.role === "Reclamos") {
        return (query as any).or(
          "form_variant.eq.general,form_variant.eq.import_excel,form_variant.is.null",
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
        .order("complaint_date", { ascending: false, nullsFirst: false })
        .order("arbolado_number", { ascending: false, nullsFirst: false })
        .order("complaint_number", { ascending: false, nullsFirst: false })
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