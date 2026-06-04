import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type RelatedItem = {
  id: number;
  name: string;
};

type ComplaintRow = {
  id: number;
  complaint_number: number | null;
  address: string | null;
  zone: string | null;
  status: string;
  complaint_date: string;
  form_variant: string | null;
  service_id?: number | null;
  service: RelatedItem | RelatedItem[] | null;
  cause: RelatedItem | RelatedItem[] | null;
};

const PAGE_SIZE = 1000;

const SERVICIOS_PUBLICOS_EMAIL = "adm.serviciospublicos.mgp@gmail.com";
const GIRSU_EMAIL = "direccióngirsupico@gmail.com";

const normalizeText = (value?: string | null) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeValue = (value?: string | null) => {
  const clean = value?.trim();
  return clean ? clean : "Sin dato";
};

const getRelatedName = (
  value: RelatedItem | RelatedItem[] | null,
): string | null => {
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value?.name ?? null;
};

const isServiciosPublicosService = (serviceName?: string | null) => {
  const name = normalizeText(serviceName);

  return (
    name.includes("barrido") ||
    name.includes("riego") ||
    name.includes("motonivelacion") ||
    name.includes("canales y desagues")
  );
};

const isGirsuService = (serviceName?: string | null) => {
  const name = normalizeText(serviceName);

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

const getGroupKey = (complaint: ComplaintRow, groupByParam: string) => {
  switch (groupByParam) {
    case "street":
      return normalizeValue(complaint.address);

    case "service":
      return normalizeValue(getRelatedName(complaint.service));

    case "cause":
      return normalizeValue(getRelatedName(complaint.cause));

    case "zone":
      return normalizeValue(complaint.zone);

    case "status":
      return normalizeValue(complaint.status);

    default:
      return normalizeValue(complaint.address);
  }
};

const groupBy = (
  complaints: ComplaintRow[],
  getKey: (complaint: ComplaintRow) => string,
) => {
  const map = new Map<string, number>();

  complaints.forEach((complaint) => {
    const key = getKey(complaint);
    map.set(key, (map.get(key) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

const getGroupedStats = (complaints: ComplaintRow[], groupByParam: string) => {
  switch (groupByParam) {
    case "street":
      return groupBy(complaints, (item) => getGroupKey(item, "street")).slice(
        0,
        15,
      );

    case "service":
      return groupBy(complaints, (item) => getGroupKey(item, "service")).slice(
        0,
        15,
      );

    case "cause":
      return groupBy(complaints, (item) => getGroupKey(item, "cause")).slice(
        0,
        15,
      );

    case "zone":
      return groupBy(complaints, (item) => getGroupKey(item, "zone")).slice(
        0,
        16,
      );

    case "status":
      return groupBy(complaints, (item) => getGroupKey(item, "status"));

    default:
      return groupBy(complaints, (item) => getGroupKey(item, "street")).slice(
        0,
        15,
      );
  }
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("role, email")
      .eq("id", authUser.id)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json(
        { error: "No se pudo validar el usuario" },
        { status: 500 },
      );
    }

    const currentUserEmail = normalizeText(currentUser.email);
    const isServiciosPublicosAccount =
      currentUserEmail === normalizeText(SERVICIOS_PUBLICOS_EMAIL);

    const isGirsuAccount = currentUserEmail === normalizeText(GIRSU_EMAIL);

    const { searchParams } = new URL(request.url);

    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const status = searchParams.get("status");
    const serviceId = searchParams.get("service_id");
    const serviceIdsParam = searchParams.get("service_ids");
    const zone = searchParams.get("zone");
    const groupByParam = searchParams.get("group_by") || "street";

    /*
      Estos dos parámetros son para el modal interactivo.
      Ejemplos:
      /api/complaints/stats?group_by=street&detail_group=street&detail_value=Calle 302
      /api/complaints/stats?group_by=service&detail_group=service&detail_value=Barrido
    */
    const detailGroup = searchParams.get("detail_group");
    const detailValue = searchParams.get("detail_value");

    const serviceIds = serviceIdsParam
      ? serviceIdsParam
          .split(",")
          .map((id) => Number(id.trim()))
          .filter((id) => Number.isFinite(id))
      : [];

    let zyvServiceIds: number[] = [];
    let arboladoServiceIds: number[] = [];
    let serviciosPublicosServiceIds: number[] = [];
    let girsuServiceIds: number[] = [];

    if (
      currentUser.role === "ReclamosZyV" ||
      currentUser.role === "ReclamosArbolado" ||
      isServiciosPublicosAccount ||
      isGirsuAccount
    ) {
      const { data: roleServices, error: roleServicesError } = await supabase
        .from("services")
        .select("id, name");

      if (roleServicesError) {
        console.error("Error fetching role services:", roleServicesError);
        return NextResponse.json(
          { error: "Error al cargar servicios" },
          { status: 500 },
        );
      }

      zyvServiceIds =
        roleServices
          ?.filter((service) => {
            const name = normalizeText(service.name);
            return name.includes("zoonosis") || name.includes("vectores");
          })
          .map((service) => service.id) ?? [];

      arboladoServiceIds =
        roleServices
          ?.filter((service) => normalizeText(service.name).includes("arbol"))
          .map((service) => service.id) ?? [];

      serviciosPublicosServiceIds =
        roleServices
          ?.filter((service) => isServiciosPublicosService(service.name))
          .map((service) => service.id) ?? [];

      girsuServiceIds =
        roleServices
          ?.filter((service) => isGirsuService(service.name))
          .map((service) => service.id) ?? [];
    }

    const allComplaints: ComplaintRow[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from("complaints")
        .select(
          `
          id,
          complaint_number,
          address,
          zone,
          status,
          complaint_date,
          form_variant,
          service_id,
          service:services(id, name),
          cause:causes(id, name)
        `,
        )
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      /*
        FILTRO POR ROL / CUENTA:

        - Cuenta Servicios Públicos:
          solo Barrido, Riego, Motonivelación, Canales y Desagües.

        - ReclamosArbolado:
          solo Arbolado.

        - ReclamosZyV:
          solo Zoonosis / Vectores.

        - Reclamos:
          reclamos generales/importados normales.

        - Admin / AdminLectura:
          todo.
      */

      if (isServiciosPublicosAccount) {
        if (serviciosPublicosServiceIds.length > 0) {
          query = query.in("service_id", serviciosPublicosServiceIds);
        } else {
          query = query.eq("service_id", -999999);
        }
      } else if (isGirsuAccount) {
        if (girsuServiceIds.length > 0) {
          query = query.in("service_id", girsuServiceIds);
        } else {
          query = query.eq("service_id", -999999);
        }
      } else if (currentUser.role === "ReclamosArbolado") {
        if (arboladoServiceIds.length > 0) {
          query = query.or(
            `form_variant.eq.arbolado,service_id.in.(${arboladoServiceIds.join(
              ",",
            )})`,
          );
        } else {
          query = query.eq("form_variant", "arbolado");
        }
      } else if (currentUser.role === "ReclamosZyV") {
        if (zyvServiceIds.length > 0) {
          query = query.or(
            `form_variant.eq.zyv,service_id.in.(${zyvServiceIds.join(",")})`,
          );
        } else {
          query = query.eq("form_variant", "zyv");
        }
      } else if (currentUser.role === "Reclamos") {
        query = query.or(
          "form_variant.eq.general,form_variant.eq.import_excel,form_variant.is.null",
        );
      }

      if (dateFrom) {
        query = query.gte("complaint_date", dateFrom);
      }

      if (dateTo) {
        query = query.lte("complaint_date", dateTo);
      }

      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      /*
        FILTRO DE SERVICIO:
        - service_id: un solo servicio.
        - service_ids: varios servicios.
      */

      if (serviceId && serviceId !== "all") {
        query = query.eq("service_id", Number(serviceId));
      } else if (serviceIds.length > 0) {
        query = query.in("service_id", serviceIds);
      }

      if (zone && zone !== "all") {
        query = query.eq("zone", zone);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching complaint stats:", error);
        return NextResponse.json(
          { error: "Error al cargar estadísticas" },
          { status: 500 },
        );
      }

      const page = (data || []) as unknown as ComplaintRow[];

      allComplaints.push(...page);

      if (page.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        from += PAGE_SIZE;
      }
    }

    const byStreet = groupBy(allComplaints, (item) =>
      getGroupKey(item, "street"),
    ).slice(0, 15);

    const byService = groupBy(allComplaints, (item) =>
      getGroupKey(item, "service"),
    ).slice(0, 15);

    const byCause = groupBy(allComplaints, (item) =>
      getGroupKey(item, "cause"),
    ).slice(0, 15);

    const byStatus = groupBy(allComplaints, (item) =>
      getGroupKey(item, "status"),
    );

    const byZone = groupBy(allComplaints, (item) =>
      getGroupKey(item, "zone"),
    ).slice(0, 16);

    const grouped = getGroupedStats(allComplaints, groupByParam);

    const detailRows =
      detailGroup && detailValue
        ? allComplaints
            .filter(
              (complaint) =>
                getGroupKey(complaint, detailGroup) === normalizeValue(detailValue),
            )
            .sort((a, b) => {
              const dateA = new Date(a.complaint_date).getTime();
              const dateB = new Date(b.complaint_date).getTime();

              if (dateA !== dateB) return dateB - dateA;

              const numberA = a.complaint_number ?? a.id;
              const numberB = b.complaint_number ?? b.id;

              return numberB - numberA;
            })
        : [];

    const detailItems = detailRows.map((complaint) => ({
      id: complaint.id,
      complaint_number: complaint.complaint_number,
      complaint_date: complaint.complaint_date,
      address: normalizeValue(complaint.address),
      zone: normalizeValue(complaint.zone),
      status: normalizeValue(complaint.status),
      service: normalizeValue(getRelatedName(complaint.service)),
      cause: normalizeValue(getRelatedName(complaint.cause)),
    }));

    return NextResponse.json({
      data: {
        total: allComplaints.length,
        groupBy: groupByParam,
        grouped,
        byStreet,
        byService,
        byCause,
        byStatus,
        byZone,
        detail: {
          group: detailGroup,
          value: detailValue,
          total: detailRows.length,
          items: detailItems,
        },
      },
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/complaints/stats:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}