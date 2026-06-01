import { createClient } from "@/lib/supabase/server";

type AlertSeverity = "high" | "medium" | "low";

const SERVICIOS_PUBLICOS_EMAIL = "adm.serviciospublicos.mgp@gmail.com";

export type RelatedComplaintAlert = {
  id: number;
  complaintNumber: number | string | null;
  complainantName: string | null;
  complaintDate: string | null;
  status: string | null;
};

export type AlertItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  count?: number;
  complaintId?: number;
  complaintNumber?: number | string | null;
  complainantName?: string | null;
  serviceId?: number;
  serviceName?: string;
  zone?: string | null;
  createdAt?: string | null;
  relatedComplaints?: RelatedComplaintAlert[];
};

type ServiceRelation =
  | {
      id: number;
      name: string;
    }
  | {
      id: number;
      name: string;
    }[]
  | null;

type ComplaintNumberFields = {
  id: number;
  complaint_number: number | string | null;
  arbolado_number: number | null;
  zyv_number?: number | null;
};

function getServiceName(service: ServiceRelation) {
  if (Array.isArray(service)) return service[0]?.name ?? "Sin servicio";
  return service?.name ?? "Sin servicio";
}

function getVisibleComplaintNumber(complaint: ComplaintNumberFields) {
  return (
    complaint.zyv_number ??
    complaint.arbolado_number ??
    complaint.complaint_number ??
    complaint.id
  );
}

function isResolvedStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() === "resuelto";
}

const normalizeName = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function isServiciosPublicosService(serviceName?: string | null) {
  const name = normalizeName(serviceName);

  return (
    name.includes("barrido") ||
    name.includes("riego") ||
    name.includes("motonivelacion") ||
    name.includes("canales y desagues")
  );
}

export async function getAlerts() {
  const supabase = await createClient();

  const alerts: AlertItem[] = [];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUserRole: string | null = null;
  let currentUserEmail = user?.email?.toLowerCase() ?? "";

  if (user?.id) {
    const { data: userProfile } = await supabase
      .from("users")
      .select("role, email")
      .eq("id", user.id)
      .maybeSingle();

    currentUserRole = userProfile?.role ?? null;
    currentUserEmail =
      userProfile?.email?.toLowerCase() ?? user?.email?.toLowerCase() ?? "";
  }

  const isServiciosPublicosUser =
    currentUserEmail === SERVICIOS_PUBLICOS_EMAIL;

  const isArboladoUser = currentUserRole === "ReclamosArbolado";
  const isZyvUser = currentUserRole === "ReclamosZyV";
  const isGeneralClaimsUser =
    currentUserRole === "Reclamos" && !isServiciosPublicosUser;

  let arboladoServiceIds: number[] = [];
  let zyvServiceIds: number[] = [];
  let serviciosPublicosServiceIds: number[] = [];

  if (isArboladoUser || isZyvUser || isServiciosPublicosUser) {
    const { data: roleServices, error: roleServicesError } = await supabase
      .from("services")
      .select("id, name");

    if (roleServicesError) {
      throw new Error(roleServicesError.message);
    }

    arboladoServiceIds =
      roleServices
        ?.filter((service) => normalizeName(service.name).includes("arbol"))
        .map((service) => service.id) ?? [];

    zyvServiceIds =
      roleServices
        ?.filter((service) => {
          const name = normalizeName(service.name);
          return name.includes("zoonosis") || name.includes("vectores");
        })
        .map((service) => service.id) ?? [];

    serviciosPublicosServiceIds =
      roleServices
        ?.filter((service) => isServiciosPublicosService(service.name))
        .map((service) => service.id) ?? [];

    if (isArboladoUser && arboladoServiceIds.length === 0) {
      return {
        total: 0,
        alerts: [],
      };
    }

    if (isZyvUser && zyvServiceIds.length === 0) {
      return {
        total: 0,
        alerts: [],
      };
    }

    if (isServiciosPublicosUser && serviciosPublicosServiceIds.length === 0) {
      return {
        total: 0,
        alerts: [],
      };
    }
  }

  const applyUserScope = <T>(query: T): T => {
    if (isServiciosPublicosUser) {
      return (query as any).in(
        "service_id",
        serviciosPublicosServiceIds,
      ) as T;
    }

    if (isArboladoUser) {
      return (query as any).or(
        `form_variant.eq.arbolado,service_id.in.(${arboladoServiceIds.join(",")})`,
      ) as T;
    }

    if (isZyvUser) {
      return (query as any).or(
        `form_variant.eq.zyv,service_id.in.(${zyvServiceIds.join(",")})`,
      ) as T;
    }

    if (isGeneralClaimsUser) {
      return (query as any).or(
        "form_variant.eq.general,form_variant.eq.import_excel,form_variant.is.null",
      ) as T;
    }

    return query;
  };

  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  const todayString = todayStart.toISOString().split("T")[0];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  let overdueQuery = supabase
    .from("complaints")
    .select(`
      id,
      complaint_number,
      arbolado_number,
      zyv_number,
      complainant_name,
      complaint_date,
      status,
      address,
      street_number,
      zone,
      service_id,
      form_variant,
      services (
        id,
        name
      )
    `)
    .eq("status", "En proceso")
    .lte("complaint_date", sevenDaysAgo.toISOString().split("T")[0])
    .order("complaint_date", { ascending: true });

  overdueQuery = applyUserScope(overdueQuery);

  const { data: overdueComplaints, error: overdueError } = await overdueQuery;

  if (overdueError) {
    throw new Error(overdueError.message);
  }

  overdueComplaints?.forEach((complaint) => {
    const visibleComplaintNumber = getVisibleComplaintNumber(complaint);

    alerts.push({
      id: `overdue-${complaint.id}`,
      type: "overdue_complaint",
      title: "Reclamo demorado",
      description: `El reclamo ${visibleComplaintNumber} lleva más de 7 días en estado En proceso.`,
      severity: "high",
      complaintId: complaint.id,
      complaintNumber: visibleComplaintNumber,
      complainantName: complaint.complainant_name,
      serviceId: complaint.service_id,
      serviceName: getServiceName(complaint.services),
      zone: complaint.zone,
      createdAt: complaint.complaint_date,
    });
  });

  let todayQuery = supabase
    .from("complaints")
    .select(`
      id,
      complaint_number,
      arbolado_number,
      zyv_number,
      complainant_name,
      complaint_date,
      status,
      service_id,
      form_variant,
      services (
        id,
        name
      )
    `)
    .gte("complaint_date", todayString)
    .neq("status", "Resuelto");

  todayQuery = applyUserScope(todayQuery);

  const { data: todayComplaints, error: todayError } = await todayQuery;

  if (todayError) {
    throw new Error(todayError.message);
  }

  type ServiceGroup = {
    serviceId: number;
    serviceName: string;
    complaints: RelatedComplaintAlert[];
  };

  const serviceGroups = new Map<number, ServiceGroup>();

  todayComplaints?.forEach((complaint) => {
    if (!complaint.service_id) return;
    if (isResolvedStatus(complaint.status)) return;

    const serviceName = getServiceName(complaint.services);

    const currentGroup: ServiceGroup =
      serviceGroups.get(complaint.service_id) ?? {
        serviceId: complaint.service_id,
        serviceName,
        complaints: [],
      };

    currentGroup.complaints.push({
      id: complaint.id,
      complaintNumber: getVisibleComplaintNumber(complaint),
      complainantName: complaint.complainant_name,
      complaintDate: complaint.complaint_date,
      status: complaint.status,
    });

    serviceGroups.set(complaint.service_id, currentGroup);
  });

  serviceGroups.forEach((group) => {
    const count = group.complaints.length;

    if (count > 3) {
      alerts.push({
        id: `service-daily-${group.serviceId}`,
        type: "daily_service_volume",
        title: "Alta cantidad de reclamos por servicio",
        description: `Hoy ingresaron ${count} reclamos pendientes del servicio ${group.serviceName}.`,
        severity: "medium",
        count,
        serviceId: group.serviceId,
        serviceName: group.serviceName,
        createdAt: todayString,
        relatedComplaints: group.complaints,
      });
    }
  });

  /*
    ALERTA 3:
    Solo aplica a reclamos generales comunes.
    No aplica para Arbolado, ZyV ni Servicios Públicos.
  */
  if (!isArboladoUser && !isZyvUser && !isServiciosPublicosUser) {
    const openStatuses = ["Pendiente", "En proceso", "Derivado"];

    const allowedZoneAlertServices = ["Rec. Domiciliaria", "Rec. Especial"];

    let openQuery = supabase
      .from("complaints")
      .select(`
        id,
        zone,
        status,
        service_id,
        form_variant,
        services (
          id,
          name
        )
      `)
      .in("status", openStatuses)
      .not("zone", "is", null);

    if (isGeneralClaimsUser) {
      openQuery = openQuery.or(
        "form_variant.eq.general,form_variant.eq.import_excel,form_variant.is.null",
      ) as typeof openQuery;
    }

    const { data: openComplaints, error: openError } = await openQuery;

    if (openError) {
      throw new Error(openError.message);
    }

    const zoneCounter = new Map<string, number>();

    openComplaints?.forEach((complaint) => {
      if (!complaint.zone) return;

      const serviceName = getServiceName(complaint.services);

      if (!allowedZoneAlertServices.includes(serviceName)) return;

      const zone = complaint.zone.trim();

      if (!zone) return;

      zoneCounter.set(zone, (zoneCounter.get(zone) ?? 0) + 1);
    });

    zoneCounter.forEach((count, zone) => {
      if (count > 5) {
        alerts.push({
          id: `zone-open-${zone}`,
          type: "open_zone_volume",
          title: "Alta cantidad de reclamos abiertos por zona",
          description: `La zona ${zone} tiene ${count} reclamos abiertos de Rec. Domiciliaria o Rec. Especial.`,
          severity: "medium",
          count,
          zone,
          createdAt: new Date().toISOString(),
        });
      }
    });
  }

  const severityOrder: Record<AlertSeverity, number> = {
    high: 1,
    medium: 2,
    low: 3,
  };

  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    total: alerts.length,
    alerts,
  };
}
