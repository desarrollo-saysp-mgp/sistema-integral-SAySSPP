import { createClient } from "@/lib/supabase/server";

type AlertSeverity = "high" | "medium" | "low";

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
};

function getServiceName(service: ServiceRelation) {
  if (Array.isArray(service)) return service[0]?.name ?? "Sin servicio";
  return service?.name ?? "Sin servicio";
}

function getVisibleComplaintNumber(complaint: ComplaintNumberFields) {
  return complaint.arbolado_number ?? complaint.complaint_number ?? complaint.id;
}

function isResolvedStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() === "resuelto";
}

export async function getAlerts() {
  const supabase = await createClient();

  const alerts: AlertItem[] = [];

  /*
    Detectamos usuario actual para saber si está logueado
    con una cuenta específica de Reclamos Arbolado.
  */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUserRole: string | null = null;

  if (user?.id) {
    const { data: userProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    currentUserRole = userProfile?.role ?? null;
  }

  const isArboladoUser = currentUserRole === "ReclamosArbolado";

  /*
    Si el usuario es ReclamosArbolado, buscamos el id del servicio Arbolado.
    Así las alertas solo se calculan sobre reclamos de ese servicio.
  */
  let arboladoServiceIds: number[] = [];

  if (isArboladoUser) {
    const { data: arboladoServices, error: arboladoServicesError } =
      await supabase
        .from("services")
        .select("id, name")
        .ilike("name", "%Arbol%");

    if (arboladoServicesError) {
      throw new Error(arboladoServicesError.message);
    }

    arboladoServiceIds = arboladoServices?.map((service) => service.id) ?? [];

    if (arboladoServiceIds.length === 0) {
      return {
        total: 0,
        alerts: [],
      };
    }
  }

  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  const todayString = todayStart.toISOString().split("T")[0];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  /*
    ALERTA 1:
    Reclamo en estado "En proceso" por más de 7 días.
    Esta alerta ya excluye resueltos porque filtra directamente por "En proceso".
  */
  let overdueQuery = supabase
    .from("complaints")
    .select(`
      id,
      complaint_number,
      arbolado_number,
      complainant_name,
      complaint_date,
      status,
      address,
      street_number,
      zone,
      service_id,
      services (
        id,
        name
      )
    `)
    .eq("status", "En proceso")
    .lte("complaint_date", sevenDaysAgo.toISOString().split("T")[0])
    .order("complaint_date", { ascending: true });

  if (isArboladoUser) {
    overdueQuery = overdueQuery.in(
      "service_id",
      arboladoServiceIds
    ) as typeof overdueQuery;
  }

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

  /*
    ALERTA 2:
    Más de 3 reclamos en el día para un mismo servicio.

    Corrección importante:
    Ahora NO se cuentan reclamos resueltos.
    Si un reclamo ya está "Resuelto", no debe generar alerta.
  */
  let todayQuery = supabase
    .from("complaints")
    .select(`
      id,
      complaint_number,
      arbolado_number,
      complainant_name,
      complaint_date,
      status,
      service_id,
      services (
        id,
        name
      )
    `)
    .gte("complaint_date", todayString)
    .neq("status", "Resuelto");

  if (isArboladoUser) {
    todayQuery = todayQuery.in(
      "service_id",
      arboladoServiceIds
    ) as typeof todayQuery;
  }

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
    Más de 5 reclamos abiertos en una misma zona,
    solamente para Rec. Domiciliaria o Rec. Especial.

    Importante:
    Si el usuario es ReclamosArbolado, esta alerta no aplica,
    porque esa regla es para reclamos generales.
  */
  if (!isArboladoUser) {
    const openStatuses = ["Pendiente", "En proceso", "Derivado"];

    const allowedZoneAlertServices = ["Rec. Domiciliaria", "Rec. Especial"];

    const { data: openComplaints, error: openError } = await supabase
      .from("complaints")
      .select(`
        id,
        zone,
        status,
        service_id,
        services (
          id,
          name
        )
      `)
      .in("status", openStatuses)
      .not("zone", "is", null);

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