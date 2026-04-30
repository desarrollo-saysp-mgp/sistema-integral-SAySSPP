import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type RelatedItem = {
  id: number;
  name: string;
};

type ComplaintRow = {
  id: number;
  address: string | null;
  zone: string | null;
  status: string;
  complaint_date: string;
  form_variant: string | null;
  service: RelatedItem | RelatedItem[] | null;
  cause: RelatedItem | RelatedItem[] | null;
};

const PAGE_SIZE = 1000;

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
      return groupBy(complaints, (item) => normalizeValue(item.address)).slice(
        0,
        15,
      );

    case "service":
      return groupBy(complaints, (item) =>
        normalizeValue(getRelatedName(item.service)),
      ).slice(0, 15);

    case "cause":
      return groupBy(complaints, (item) =>
        normalizeValue(getRelatedName(item.cause)),
      ).slice(0, 15);

    case "zone":
      return groupBy(complaints, (item) => normalizeValue(item.zone)).slice(
        0,
        16,
      );

    case "status":
      return groupBy(complaints, (item) => normalizeValue(item.status));

    default:
      return groupBy(complaints, (item) => normalizeValue(item.address)).slice(
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
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json(
        { error: "No se pudo validar el usuario" },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);

    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const status = searchParams.get("status");
    const serviceId = searchParams.get("service_id");
    const zone = searchParams.get("zone");
    const groupByParam = searchParams.get("group_by") || "street";

    const allComplaints: ComplaintRow[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from("complaints")
        .select(
          `
          id,
          address,
          zone,
          status,
          complaint_date,
          form_variant,
          service:services(id, name),
          cause:causes(id, name)
        `,
        )
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (currentUser.role === "ReclamosArbolado") {
        query = query.eq("form_variant", "arbolado");
      }

      if (currentUser.role === "Reclamos") {
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

      if (serviceId && serviceId !== "all") {
        query = query.eq("service_id", Number(serviceId));
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
      normalizeValue(item.address),
    ).slice(0, 15);

    const byService = groupBy(allComplaints, (item) =>
      normalizeValue(getRelatedName(item.service)),
    ).slice(0, 15);

    const byCause = groupBy(allComplaints, (item) =>
      normalizeValue(getRelatedName(item.cause)),
    ).slice(0, 15);

    const byStatus = groupBy(allComplaints, (item) =>
      normalizeValue(item.status),
    );

    const byZone = groupBy(allComplaints, (item) =>
      normalizeValue(item.zone),
    ).slice(0, 16);

    const grouped = getGroupedStats(allComplaints, groupByParam);

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