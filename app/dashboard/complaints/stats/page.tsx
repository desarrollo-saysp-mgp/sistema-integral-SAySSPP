"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Clock3,
  Download,
  ExternalLink,
  FilterX,
  Loader2,
  MousePointerClick,
  RefreshCcw,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { useUser } from "@/hooks/useUser";

type StatItem = {
  name: string;
  count: number;
};

type DetailComplaintItem = {
  id: number;
  complaint_number: number | string | null;
  complaint_date: string | null;
  address: string;
  zone: string;
  status: string;
  service: string;
  cause: string;
  delay_days?: number;
};

type StatsData = {
  total: number;
  groupBy: string;
  grouped: StatItem[];
  byStreet: StatItem[];
  byService: StatItem[];
  byCause: StatItem[];
  byStatus: StatItem[];
  byZone: StatItem[];
  byContactMethod: StatItem[];
  oldestInProgress: DetailComplaintItem[];
  detail?: {
    group: string | null;
    value: string | null;
    total: number;
    items: DetailComplaintItem[];
  };
};

type Service = {
  id: number;
  name: string;
  active?: boolean;
};

type CurrentUser = {
  id?: string;
  full_name?: string;
  email?: string;
  role?: string;
  default_module?: string;
  module?: string;
};

type DetailGroup =
  | "street"
  | "service"
  | "cause"
  | "zone"
  | "status"
  | "contact_method"
  | "delay";

const SERVICIOS_PUBLICOS_EMAIL = "adm.serviciospublicos.mgp@gmail.com";
const GIRSU_EMAIL = "direccióngirsupico@gmail.com";
const DETAIL_PAGE_SIZE = 20;
const STATS_RETURN_STATE_KEY = "stats-detail-return-state";

const normalizeText = (value?: string | null) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const formatDate = (value?: string | null) => {
  if (!value) return "-";

  const [year, month, day] = value.split("-").map(Number);

  if (year && month && day) {
    return `${String(day).padStart(2, "0")}/${String(month).padStart(
      2,
      "0",
    )}/${year}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getFilterLabel = ({
  dateFrom,
  dateTo,
  status,
  serviceName,
  zone,
}: {
  dateFrom: string;
  dateTo: string;
  status: string;
  serviceName: string;
  zone: string;
}) => {
  const filters: string[] = [];

  if (dateFrom) filters.push(`Desde: ${formatDate(dateFrom)}`);
  if (dateTo) filters.push(`Hasta: ${formatDate(dateTo)}`);
  if (status !== "all") filters.push(`Estado: ${status}`);
  if (serviceName !== "Todos") filters.push(`Servicio: ${serviceName}`);
  if (zone !== "all") filters.push(`Zona: ${zone}`);

  return filters.length > 0 ? filters.join(" · ") : "Sin filtros aplicados";
};

const getDetailGroupLabel = (group: DetailGroup) => {
  if (group === "street") return "calle";
  if (group === "service") return "servicio";
  if (group === "cause") return "causa";
  if (group === "zone") return "zona";
  if (group === "contact_method") return "medio de contacto";
  if (group === "delay") return "demora";
  return "estado";
};

function StatBars({
  title,
  data,
  emptyText = "Sin datos",
  group,
  onItemClick,
}: {
  title: string;
  data: StatItem[];
  emptyText?: string;
  group: DetailGroup;
  onItemClick: (group: DetailGroup, item: StatItem) => void;
}) {
  const max = useMemo(
    () => Math.max(...data.map((item) => item.count), 1),
    [data],
  );

  return (
    <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-bold text-foreground">
            {title}
          </CardTitle>

          {data.length > 0 && (
            <div className="hidden items-center gap-1 rounded-full bg-[#00A27F]/10 px-2.5 py-1 text-xs font-medium text-[#00A27F] sm:flex">
              <MousePointerClick className="h-3.5 w-3.5" />
              Click para ver
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <div className="space-y-3">
            {data.map((item) => {
              const percentage = Math.max((item.count / max) * 100, 4);

              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => onItemClick(group, item)}
                  className="group w-full rounded-xl p-2 text-left transition hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-[#00A27F]/25"
                  title={`Ver reclamos de ${item.name}`}
                >
                  <div className="mb-1 flex items-center justify-between gap-4 text-sm">
                    <span className="truncate font-medium text-foreground group-hover:text-[#00A27F]">
                      {item.name}
                    </span>

                    <span className="shrink-0 font-bold text-[#00A27F]">
                      {item.count}
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[#00A27F] transition-all group-hover:bg-[#008568]"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function StatsPage() {
  const router = useRouter();
  const { profile } = useUser();

  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("all");
  const [serviceId, setServiceId] = useState("all");
  const [zone, setZone] = useState("all");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailGroup, setDetailGroup] = useState<DetailGroup | null>(null);
  const [detailValue, setDetailValue] = useState("");
  const [detailItems, setDetailItems] = useState<DetailComplaintItem[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailPage, setDetailPage] = useState(1);
  const [pendingRestoreDetail, setPendingRestoreDetail] = useState<{
    group: DetailGroup;
    value: string;
    page: number;
    scrollY: number;
  } | null>(null);

  const isArboladoAccount = useMemo(() => {
    const role = normalizeText(profile?.role || currentUser?.role);
    const defaultModule = normalizeText(currentUser?.default_module);
    const module = normalizeText(currentUser?.module);

    return (
      role.includes("arbolado") ||
      defaultModule.includes("arbolado") ||
      module.includes("arbolado")
    );
  }, [profile, currentUser]);

  const isZyvAccount = useMemo(() => {
    const role = normalizeText(profile?.role || currentUser?.role);
    const defaultModule = normalizeText(currentUser?.default_module);
    const module = normalizeText(currentUser?.module);

    return (
      role.includes("reclamoszyv") ||
      role.includes("zyv") ||
      role.includes("zoonosis") ||
      role.includes("vectores") ||
      defaultModule.includes("zyv") ||
      defaultModule.includes("zoonosis") ||
      defaultModule.includes("vectores") ||
      module.includes("zyv") ||
      module.includes("zoonosis") ||
      module.includes("vectores")
    );
  }, [profile, currentUser]);

  const isServiciosPublicosAccount = useMemo(() => {
    const email = normalizeText(profile?.email || currentUser?.email);

    return email === SERVICIOS_PUBLICOS_EMAIL;
  }, [profile?.email, currentUser?.email]);

  const isGirsuAccount = useMemo(() => {
    const email = normalizeText(profile?.email || currentUser?.email);

    return email === normalizeText(GIRSU_EMAIL);
  }, [profile?.email, currentUser?.email]);

  const arboladoService = useMemo(() => {
    return services.find((service) =>
      normalizeText(service.name).includes("arbol"),
    );
  }, [services]);

  const zyvServices = useMemo(() => {
    return services.filter((service) => {
      const name = normalizeText(service.name);
      return name.includes("zoonosis") || name.includes("vectores");
    });
  }, [services]);

  const serviciosPublicosServices = useMemo(() => {
    return services.filter((service) => {
      const name = normalizeText(service.name);

      return (
        name.includes("barrido") ||
        name.includes("riego") ||
        name.includes("motonivelacion") ||
        name.includes("canales y desagues")
      );
    });
  }, [services]);

  const girsuServices = useMemo(() => {
    return services.filter((service) => {
      const name = normalizeText(service.name);

      return (
        name.includes("rec. domiciliaria") ||
        name.includes("rec domiciliaria") ||
        name.includes("rec. especial") ||
        name.includes("rec especial") ||
        name.includes("inspeccion") ||
        name.includes("rec. contenedores") ||
        name.includes("rec contenedores")
      );
    });
  }, [services]);

  const visibleServices = useMemo(() => {
    if (isArboladoAccount) {
      return arboladoService ? [arboladoService] : [];
    }

    if (isServiciosPublicosAccount) {
      return serviciosPublicosServices;
    }

    if (isZyvAccount) {
      return zyvServices;
    }

    if (isGirsuAccount) {
      return girsuServices;
    }

    return services;
  }, [
    isArboladoAccount,
    isServiciosPublicosAccount,
    isZyvAccount,
    isGirsuAccount,
    arboladoService,
    serviciosPublicosServices,
    zyvServices,
    girsuServices,
    services,
  ]);

  const effectiveServiceId = useMemo(() => {
    if (isArboladoAccount && arboladoService) {
      return String(arboladoService.id);
    }

    return serviceId;
  }, [isArboladoAccount, arboladoService, serviceId]);

  const selectedServiceName = useMemo(() => {
    if (isArboladoAccount) return "Arbolado";

    if (isServiciosPublicosAccount && serviceId === "all") {
      return "Servicios Públicos";
    }

    if (isZyvAccount && serviceId === "all") {
      return "Zoonosis y Vectores";
    }

    if (isGirsuAccount && serviceId === "all") {
      return "GIRSU";
    }

    if (effectiveServiceId === "all") return "Todos";

    return (
      services.find((service) => String(service.id) === effectiveServiceId)
        ?.name ?? "Todos"
    );
  }, [
    effectiveServiceId,
    services,
    isArboladoAccount,
    isServiciosPublicosAccount,
    isZyvAccount,
    isGirsuAccount,
    serviceId,
  ]);

  const filterLabel = getFilterLabel({
    dateFrom,
    dateTo,
    status,
    serviceName: selectedServiceName,
    zone,
  });

  const mainStat = stats?.byStreet?.[0];
  const mostDelayedComplaint = stats?.oldestInProgress?.[0];

  const detailPageCount = Math.max(
    Math.ceil(detailItems.length / DETAIL_PAGE_SIZE),
    1,
  );

  const currentDetailPage = Math.min(detailPage, detailPageCount);

  const paginatedDetailItems = useMemo(() => {
    const start = (currentDetailPage - 1) * DETAIL_PAGE_SIZE;
    return detailItems.slice(start, start + DETAIL_PAGE_SIZE);
  }, [detailItems, currentDetailPage]);

  const detailShowingFrom =
    detailItems.length === 0 ? 0 : (currentDetailPage - 1) * DETAIL_PAGE_SIZE + 1;

  const detailShowingTo = Math.min(
    currentDetailPage * DETAIL_PAGE_SIZE,
    detailItems.length,
  );

  const buildStatsParams = ({
    detailGroupParam,
    detailValueParam,
  }: {
    detailGroupParam?: DetailGroup;
    detailValueParam?: string;
  } = {}) => {
    const params = new URLSearchParams();

    params.append("group_by", "street");

    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    if (status !== "all") params.append("status", status);

    if (isServiciosPublicosAccount && serviceId === "all") {
      params.append(
        "service_ids",
        serviciosPublicosServices.map((service) => service.id).join(","),
      );
    } else if (isZyvAccount && serviceId === "all") {
      params.append(
        "service_ids",
        zyvServices.map((service) => service.id).join(","),
      );
    } else if (isGirsuAccount && serviceId === "all") {
      params.append(
        "service_ids",
        girsuServices.map((service) => service.id).join(","),
      );
    } else if (effectiveServiceId !== "all") {
      params.append("service_id", effectiveServiceId);
    }

    if (zone !== "all") params.append("zone", zone);

    if (
      detailGroupParam &&
      detailValueParam &&
      detailGroupParam !== "delay"
    ) {
      params.append("detail_group", detailGroupParam);
      params.append("detail_value", detailValueParam);
    }

    return params;
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        const user = data.user ?? data.data ?? data;

        if (user) {
          setCurrentUser(user);
          return;
        }
      }
    } catch (error) {
      console.error("No se pudo obtener el usuario desde /api/auth/me:", error);
    }

    try {
      const possibleKeys = ["user", "currentUser", "authUser", "sessionUser"];

      for (const key of possibleKeys) {
        const rawValue = localStorage.getItem(key);

        if (!rawValue) continue;

        const parsedValue = JSON.parse(rawValue);
        const user = parsedValue.user ?? parsedValue.data ?? parsedValue;

        if (user) {
          setCurrentUser(user);
          return;
        }
      }
    } catch (error) {
      console.error("No se pudo leer el usuario desde localStorage:", error);
    }
  };

  const fetchServices = async () => {
    try {
      const response = await fetch("/api/services", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) return;

      if (data.data) {
        setServices(data.data.filter((service: Service) => service.active));
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  };

  const fetchStats = async () => {
    setLoading(true);

    try {
      const params = buildStatsParams();

      const response = await fetch(`/api/complaints/stats?${params}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Error al cargar estadísticas");
        return;
      }

      setStats(data.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Error al cargar estadísticas");
    } finally {
      setLoading(false);
    }
  };

  const openDetailModal = async (
    group: DetailGroup,
    item: StatItem,
    pageToOpen = 1,
  ) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailGroup(group);
    setDetailValue(item.name);
    setDetailItems([]);
    setDetailTotal(0);
    setDetailPage(pageToOpen);

    try {
      const params = buildStatsParams({
        detailGroupParam: group,
        detailValueParam: item.name,
      });

      const response = await fetch(`/api/complaints/stats?${params}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Error al cargar detalle");
        return;
      }

      const items = data.data?.detail?.items ?? [];
      setDetailItems(items);
      setDetailTotal(data.data?.detail?.total ?? items.length);
      setDetailPage(pageToOpen);
    } catch (error) {
      console.error("Error fetching stat detail:", error);
      toast.error("Error al cargar detalle de estadística");
    } finally {
      setDetailLoading(false);
    }
  };

  const openDelayDetailModal = (pageToOpen = 1) => {
    const items = stats?.oldestInProgress ?? [];

    setDetailOpen(true);
    setDetailLoading(false);
    setDetailGroup("delay");
    setDetailValue("Reclamos en proceso con mayor demora");
    setDetailItems(items);
    setDetailTotal(items.length);
    setDetailPage(pageToOpen);
  };

  const closeDetailModal = () => {
    setDetailOpen(false);
    setDetailLoading(false);
    setDetailGroup(null);
    setDetailValue("");
    setDetailItems([]);
    setDetailTotal(0);
    setDetailPage(1);
  };

  const saveReturnStateAndOpenComplaint = (complaintId: number) => {
    try {
      sessionStorage.setItem(
        STATS_RETURN_STATE_KEY,
        JSON.stringify({
          dateFrom,
          dateTo,
          status,
          serviceId,
          zone,
          detailGroup,
          detailValue,
          detailPage: currentDetailPage,
          scrollY: window.scrollY,
        }),
      );
    } catch (error) {
      console.error("No se pudo guardar el estado de estadísticas:", error);
    }

    router.push(`/dashboard/complaints/${complaintId}/view`);
  };

  const exportDetailPdf = () => {
    if (!detailGroup || !detailValue || detailItems.length === 0) {
      toast.error("No hay detalle para exportar");
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const marginX = 12;
      const contentWidth = pageWidth - marginX * 2;
      const footerY = pageHeight - 8;
      const tableStartY = 76;
      const rowHeight = 8;
      const bottomLimit = pageHeight - 18;

      const exportedAt = new Date().toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const totalText = `${detailTotal || detailItems.length} reclamos`;
      const title = `Detalle por ${getDetailGroupLabel(detailGroup)}: ${detailValue}`;

      const getStatusPdfColors = (itemStatus: string) => {
        if (itemStatus === "Resuelto") {
          return {
            bg: [220, 252, 231] as [number, number, number],
            text: [22, 101, 52] as [number, number, number],
            border: [187, 247, 208] as [number, number, number],
          };
        }

        if (itemStatus === "En proceso") {
          return {
            bg: [254, 249, 195] as [number, number, number],
            text: [133, 77, 14] as [number, number, number],
            border: [253, 224, 71] as [number, number, number],
          };
        }

        if (itemStatus === "No resuelto") {
          return {
            bg: [254, 226, 226] as [number, number, number],
            text: [153, 27, 27] as [number, number, number],
            border: [252, 165, 165] as [number, number, number],
          };
        }

        return {
          bg: [243, 244, 246] as [number, number, number],
          text: [55, 65, 81] as [number, number, number],
          border: [229, 231, 235] as [number, number, number],
        };
      };

      const drawTopHeader = () => {
        doc.setFillColor(0, 162, 127);
        doc.roundedRect(marginX, 10, contentWidth, 19, 3, 3, "F");

        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text("Sistema Integral SAySSPP", marginX + 5, 18);

        doc.setFontSize(8);
        doc.setTextColor(219, 255, 246);
        doc.text("Gestión de Reclamos · Estadísticas", marginX + 5, 24);

        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(`Exportado: ${exportedAt}`, pageWidth - marginX - 5, 18, {
          align: "right",
        });
      };

      const drawTitleAndSummary = () => {
        doc.setFontSize(15);
        doc.setTextColor(15, 23, 42);
        doc.text(title, marginX, 40);

        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(filterLabel, marginX, 46);

        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, 49, pageWidth - marginX, 49);

        const cardY = 52;
        const cardH = 13;
        const cardGap = 4;
        const cardW = (contentWidth - cardGap * 2) / 3;

        const cards = [
          { label: "Total", value: totalText },
          {
            label: "Tipo de detalle",
            value: getDetailGroupLabel(detailGroup).toUpperCase(),
          },
          { label: "Elemento seleccionado", value: detailValue },
        ];

        cards.forEach((card, index) => {
          const x = marginX + index * (cardW + cardGap);

          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(x, cardY, cardW, cardH, 2.5, 2.5, "FD");

          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          doc.text(card.label, x + 3, cardY + 4);

          doc.setFontSize(8.5);
          doc.setTextColor(15, 23, 42);
          doc.text(
            doc.splitTextToSize(card.value, cardW - 6)[0] ?? "-",
            x + 3,
            cardY + 9.5,
          );
        });
      };

      const columns = [
        { title: "N°", x: marginX + 2, width: 16 },
        { title: "Fecha", x: marginX + 22, width: 24 },
        { title: "Dirección", x: marginX + 50, width: 54 },
        { title: "Servicio", x: marginX + 108, width: 38 },
        { title: "Causa", x: marginX + 150, width: 58 },
        { title: "Zona", x: marginX + 212, width: 30 },
        { title: "Estado", x: marginX + 246, width: 30 },
      ];

      const drawTableHeader = (y: number) => {
        doc.setFillColor(236, 253, 245);
        doc.setDrawColor(167, 243, 208);
        doc.roundedRect(marginX, y - 5, contentWidth, 9, 2, 2, "FD");

        doc.setFontSize(7.8);
        doc.setTextColor(6, 95, 70);

        columns.forEach((column) => {
          doc.text(column.title, column.x, y);
        });
      };

      const drawFooter = () => {
        const pageCount = doc.getNumberOfPages();

        for (let i = 1; i <= pageCount; i += 1) {
          doc.setPage(i);

          doc.setDrawColor(226, 232, 240);
          doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);

          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(
            "Municipalidad de General Pico · Sistema de Gestión de Reclamos",
            marginX,
            footerY,
          );

          doc.text(`Página ${i} de ${pageCount}`, pageWidth - marginX, footerY, {
            align: "right",
          });
        }
      };

      const drawPageBase = () => {
        drawTopHeader();
        drawTitleAndSummary();
        drawTableHeader(tableStartY);
      };

      drawPageBase();

      let y = tableStartY + 8;

      detailItems.forEach((item, index) => {
        if (y > bottomLimit) {
          doc.addPage();
          drawPageBase();
          y = tableStartY + 8;
        }

        if (index % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(marginX, y - 5.3, contentWidth, rowHeight, "F");
        }

        doc.setDrawColor(241, 245, 249);
        doc.line(marginX, y + 2.6, pageWidth - marginX, y + 2.6);

        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);

        const rowValues = [
          String(item.complaint_number ?? item.id),
          formatDate(item.complaint_date),
          item.address || "-",
          item.service || "-",
          item.cause || "-",
          item.zone || "-",
        ];

        rowValues.forEach((value, columnIndex) => {
          const column = columns[columnIndex];
          doc.text(
            doc.splitTextToSize(value, column.width)[0] ?? "-",
            column.x,
            y,
          );
        });

        const statusColors = getStatusPdfColors(item.status);
        const statusColumn = columns[6];

        doc.setFillColor(...statusColors.bg);
        doc.setDrawColor(...statusColors.border);
        doc.roundedRect(statusColumn.x - 1, y - 4.2, 27, 5.5, 2.5, 2.5, "FD");

        doc.setFontSize(7);
        doc.setTextColor(...statusColors.text);
        doc.text(
          doc.splitTextToSize(item.status || "-", 24)[0] ?? "-",
          statusColumn.x + 12.5,
          y - 0.6,
          { align: "center" },
        );

        y += rowHeight;
      });

      drawFooter();

      const safeValue = detailValue
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase();

      doc.save(`detalle_estadistica_${safeValue || "reclamos"}.pdf`);
      toast.success("PDF del detalle exportado correctamente");
    } catch (error) {
      console.error("Error exporting detail PDF:", error);
      toast.error("Error al exportar PDF del detalle");
    }
  };

  useEffect(() => {
    try {
      const rawState = sessionStorage.getItem(STATS_RETURN_STATE_KEY);

      if (!rawState) return;

      const savedState = JSON.parse(rawState);

      setDateFrom(savedState.dateFrom || "");
      setDateTo(savedState.dateTo || "");
      setStatus(savedState.status || "all");
      setServiceId(savedState.serviceId || "all");
      setZone(savedState.zone || "all");

      if (savedState.detailGroup && savedState.detailValue) {
        setPendingRestoreDetail({
          group: savedState.detailGroup,
          value: savedState.detailValue,
          page: Number(savedState.detailPage || 1),
          scrollY: Number(savedState.scrollY || 0),
        });
      }
    } catch (error) {
      console.error("No se pudo restaurar el estado de estadísticas:", error);
      sessionStorage.removeItem(STATS_RETURN_STATE_KEY);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
    fetchServices();
  }, []);

  useEffect(() => {
    if (isArboladoAccount && arboladoService) {
      setServiceId(String(arboladoService.id));
      return;
    }

    if (isServiciosPublicosAccount || isZyvAccount || isGirsuAccount) {
      setServiceId("all");
    }
  }, [
    isArboladoAccount,
    isServiciosPublicosAccount,
    isZyvAccount,
    isGirsuAccount,
    arboladoService,
  ]);

  useEffect(() => {
    if (isArboladoAccount && !arboladoService) return;
    if (isServiciosPublicosAccount && serviciosPublicosServices.length === 0) {
      setStats({
        total: 0,
        groupBy: "street",
        grouped: [],
        byStreet: [],
        byService: [],
        byCause: [],
        byStatus: [],
        byZone: [],
        byContactMethod: [],
        oldestInProgress: [],
      });
      setLoading(false);
      return;
    }
    if (isZyvAccount && zyvServices.length === 0) return;
    if (isGirsuAccount && girsuServices.length === 0) {
      setStats({
        total: 0,
        groupBy: "street",
        grouped: [],
        byStreet: [],
        byService: [],
        byCause: [],
        byStatus: [],
        byZone: [],
        byContactMethod: [],
        oldestInProgress: [],
      });
      setLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      fetchStats();
    }, 350);

    return () => clearTimeout(timeout);
  }, [
    dateFrom,
    dateTo,
    status,
    serviceId,
    zone,
    effectiveServiceId,
    isArboladoAccount,
    isServiciosPublicosAccount,
    isZyvAccount,
    isGirsuAccount,
    arboladoService,
    serviciosPublicosServices,
    zyvServices,
  ]);

  useEffect(() => {
    if (!pendingRestoreDetail || loading) return;

    const restorePromise =
      pendingRestoreDetail.group === "delay"
        ? Promise.resolve(openDelayDetailModal(pendingRestoreDetail.page))
        : openDetailModal(
            pendingRestoreDetail.group,
            { name: pendingRestoreDetail.value, count: 0 },
            pendingRestoreDetail.page,
          );

    void restorePromise.then(() => {
      window.scrollTo({ top: pendingRestoreDetail.scrollY, behavior: "auto" });
      sessionStorage.removeItem(STATS_RETURN_STATE_KEY);
      setPendingRestoreDetail(null);
    });
  }, [pendingRestoreDetail, loading]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setStatus("all");
    setZone("all");

    if (isArboladoAccount && arboladoService) {
      setServiceId(String(arboladoService.id));
      return;
    }

    setServiceId("all");
  };

  const addChartToPdf = ({
    doc,
    title,
    data,
    startY,
  }: {
    doc: jsPDF;
    title: string;
    data: StatItem[];
    startY: number;
  }) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let y = startY;
    const max = Math.max(...data.map((item) => item.count), 1);

    const left = 14;
    const right = pageWidth - 14;
    const labelWidth = 62;
    const valueWidth = 16;
    const barLeft = left + labelWidth;
    const barMaxWidth = right - barLeft - valueWidth;
    const rowHeight = 9;

    if (y + 18 > pageHeight - 16) {
      doc.addPage();
      y = 18;
    }

    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(title, left, y);

    y += 10;

    data.forEach((item) => {
      if (y + rowHeight > pageHeight - 16) {
        doc.addPage();
        y = 18;

        doc.setFontSize(13);
        doc.setTextColor(30, 41, 59);
        doc.text(title, left, y);

        y += 10;
      }

      const percentage = item.count / max;
      const barWidth = Math.max(barMaxWidth * percentage, 3);
      const label = doc.splitTextToSize(item.name, labelWidth - 3)[0];

      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(label, left, y + 4);

      doc.setFillColor(234, 243, 240);
      doc.roundedRect(barLeft, y, barMaxWidth, 5, 2, 2, "F");

      doc.setFillColor(0, 162, 127);
      doc.roundedRect(barLeft, y, barWidth, 5, 2, 2, "F");

      doc.setFontSize(8);
      doc.setTextColor(0, 162, 127);
      doc.text(String(item.count), right, y + 4, {
        align: "right",
      });

      y += rowHeight;
    });

    return y + 8;
  };

  const exportPdf = () => {
    if (!stats) {
      toast.error("No hay estadísticas para exportar");
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text("Estadísticas de reclamos", 14, 18);

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Fecha de exportación: ${new Date().toLocaleString("es-AR")}`,
        14,
        26,
      );
      doc.text(`Total analizado: ${stats.total}`, 14, 32);

      doc.text(
        isArboladoAccount
          ? "Vista: Reclamos Arbolado"
          : isServiciosPublicosAccount
            ? "Vista: Servicios Públicos"
            : isZyvAccount
              ? "Vista: Reclamos Zoonosis y Vectores"
              : isGirsuAccount
                ? "Vista: GIRSU"
                : "Vista: General",
        14,
        38,
      );

      const splitFilters = doc.splitTextToSize(`Filtros: ${filterLabel}`, 180);
      doc.text(splitFilters, 14, 44);

      let currentY = 54 + splitFilters.length * 4;

      currentY = addChartToPdf({
        doc,
        title: "Calles con más reclamos",
        data: stats.byStreet,
        startY: currentY,
      });

      currentY = addChartToPdf({
        doc,
        title: "Reclamos por servicio",
        data: stats.byService,
        startY: currentY,
      });

      currentY = addChartToPdf({
        doc,
        title: "Causas más frecuentes",
        data: stats.byCause,
        startY: currentY,
      });

      currentY = addChartToPdf({
        doc,
        title: "Reclamos por zona",
        data: stats.byZone,
        startY: currentY,
      });

      currentY = addChartToPdf({
        doc,
        title: "Reclamos por medio de contacto",
        data: stats.byContactMethod ?? [],
        startY: currentY,
      });

      currentY = addChartToPdf({
        doc,
        title: "Reclamos en proceso con mayor demora",
        data: stats.oldestInProgress.map((item) => ({
          name: `Reclamo ${item.complaint_number ?? item.id}`,
          count: item.delay_days ?? 0,
        })),
        startY: currentY,
      });

      addChartToPdf({
        doc,
        title: "Reclamos por estado",
        data: stats.byStatus,
        startY: currentY,
      });

      const pageCount = doc.getNumberOfPages();

      for (let i = 1; i <= pageCount; i += 1) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(
          `Página ${i} de ${pageCount}`,
          doc.internal.pageSize.getWidth() - 34,
          doc.internal.pageSize.getHeight() - 8,
        );
      }

      doc.save(
        isArboladoAccount
          ? "estadisticas_reclamos_arbolado.pdf"
          : isServiciosPublicosAccount
            ? "estadisticas_reclamos_servicios_publicos.pdf"
            : isZyvAccount
              ? "estadisticas_reclamos_zyv.pdf"
              : isGirsuAccount
                ? "estadisticas_reclamos_girsu.pdf"
                : "estadisticas_reclamos_general.pdf",
      );

      toast.success("PDF exportado correctamente");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Error al exportar PDF");
    }
  };

  return (
    <>
      <div className="space-y-4 text-foreground">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Estadísticas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Los filtros se aplican automáticamente. Hacé click en una barra
              para ver los reclamos incluidos.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={exportPdf}
              disabled={loading || !stats}
              className="h-11 rounded-xl border-border bg-card px-5 text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>

            <Button
              onClick={fetchStats}
              className="h-11 rounded-xl bg-[#00A27F] px-5 font-semibold text-white hover:bg-[#008568]"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Actualizar
            </Button>
          </div>
        </div>

        <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-sm">
          <CardContent className="p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Desde
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-12 w-full rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Hasta
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-12 w-full rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Estado
                </label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-12 w-full rounded-xl text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="En proceso">En proceso</SelectItem>
                    <SelectItem value="Resuelto">Resuelto</SelectItem>
                    <SelectItem value="No resuelto">No resuelto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Servicio
                </label>

                {isArboladoAccount ? (
                  <Select value={effectiveServiceId} disabled>
                    <SelectTrigger className="h-12 w-full rounded-xl text-sm">
                      <SelectValue placeholder="Arbolado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={effectiveServiceId}>Arbolado</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={serviceId} onValueChange={setServiceId}>
                    <SelectTrigger className="h-12 w-full rounded-xl text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {isServiciosPublicosAccount
                          ? "Todos Servicios Públicos"
                          : isZyvAccount
                            ? "Todos ZyV"
                            : isGirsuAccount
                              ? "Todos GIRSU"
                              : "Todos"}
                      </SelectItem>

                      {visibleServices.map((service) => (
                        <SelectItem key={service.id} value={String(service.id)}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Zona
                </label>
                <Select value={zone} onValueChange={setZone}>
                  <SelectTrigger className="h-12 w-full rounded-xl text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {Array.from({ length: 16 }, (_, i) => String(i + 1)).map(
                      (z) => (
                        <SelectItem key={z} value={z}>
                          Zona {z}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-muted-foreground">
                {loading ? "Aplicando filtros..." : filterLabel}
              </p>

              <Button
                variant="outline"
                onClick={clearFilters}
                className="h-11 rounded-xl border-border bg-card px-5 text-foreground hover:bg-accent hover:text-accent-foreground"
                disabled={loading}
              >
                <FilterX className="mr-2 h-4 w-4" />
                Limpiar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-foreground">
                Total analizado
              </CardTitle>
              <BarChart3 className="h-5 w-5 text-[#00A27F]" />
            </CardHeader>

            <CardContent>
              <div className="text-4xl font-bold text-foreground">
                {loading ? "..." : stats?.total ?? 0}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Reclamos con filtros aplicados
              </p>
            </CardContent>
          </Card>

          <button
            type="button"
            disabled={loading || !mainStat}
            onClick={() =>
              mainStat ? openDetailModal("street", mainStat) : undefined
            }
            className="text-left disabled:cursor-default"
          >
            <Card className="h-full rounded-2xl border-border bg-card text-card-foreground shadow-sm transition hover:border-[#00A27F] hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <TrendingUp className="h-5 w-5 text-[#00A27F]" />
                <CardTitle className="text-sm font-bold text-foreground">
                  Más repetido por calle
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? "..." : mainStat?.name ?? "Sin datos"}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mainStat
                    ? `${mainStat.count} reclamos registrados · Click para ver`
                    : "No hay información disponible"}
                </p>
              </CardContent>
            </Card>
          </button>

          <button
            type="button"
            disabled={loading || !mostDelayedComplaint}
            onClick={() =>
              mostDelayedComplaint ? openDelayDetailModal() : undefined
            }
            className="text-left disabled:cursor-default"
          >
            <Card className="h-full rounded-2xl border-border bg-card text-card-foreground shadow-sm transition hover:border-[#00A27F] hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Clock3 className="h-5 w-5 text-[#00A27F]" />
                <CardTitle className="text-sm font-bold text-foreground">
                  Reclamo más demorado
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {loading
                    ? "..."
                    : mostDelayedComplaint
                      ? `Reclamo ${
                          mostDelayedComplaint.complaint_number ??
                          mostDelayedComplaint.id
                        }`
                      : "Sin datos"}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mostDelayedComplaint
                    ? `${mostDelayedComplaint.delay_days ?? 0} días en proceso · ${formatDate(
                        mostDelayedComplaint.complaint_date,
                      )} · Click para ver`
                    : "No hay reclamos actualmente en proceso"}
                </p>
              </CardContent>
            </Card>
          </button>
        </div>

        {loading ? (
          <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-sm">
            <CardContent className="flex items-center justify-center gap-2 py-14 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando estadísticas...
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <StatBars
              title="Calles con más reclamos"
              data={stats?.byStreet ?? []}
              group="street"
              onItemClick={openDetailModal}
            />

            <StatBars
              title="Reclamos por servicio"
              data={stats?.byService ?? []}
              group="service"
              onItemClick={openDetailModal}
            />

            <StatBars
              title="Causas más frecuentes"
              data={stats?.byCause ?? []}
              group="cause"
              onItemClick={openDetailModal}
            />

            <StatBars
              title="Reclamos por zona"
              data={stats?.byZone ?? []}
              group="zone"
              onItemClick={openDetailModal}
            />

            <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base font-bold text-foreground">
                    Reclamos con mayor demora
                  </CardTitle>

                  {(stats?.oldestInProgress?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => openDelayDetailModal()}
                      className="hidden items-center gap-1 rounded-full bg-[#00A27F]/10 px-2.5 py-1 text-xs font-medium text-[#00A27F] sm:flex"
                    >
                      <MousePointerClick className="h-3.5 w-3.5" />
                      Click para ver
                    </button>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                {(stats?.oldestInProgress?.length ?? 0) === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No hay reclamos en proceso
                  </p>
                ) : (
                  <div className="space-y-2">
                    {stats?.oldestInProgress.slice(0, 10).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => saveReturnStateAndOpenComplaint(item.id)}
                        className="flex w-full items-center justify-between gap-4 rounded-xl border border-border p-3 text-left transition hover:border-[#00A27F] hover:bg-muted/60"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            Reclamo {item.complaint_number ?? item.id}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatDate(item.complaint_date)} · {item.address} · {item.service}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-[#00A27F]">
                            {item.delay_days ?? 0} días
                          </p>
                          <p className="text-xs text-muted-foreground">
                            En proceso
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <StatBars
              title="Reclamos por estado"
              data={stats?.byStatus ?? []}
              group="status"
              onItemClick={openDetailModal}
            />

            <StatBars
              title="Reclamos por medio de contacto"
              data={stats?.byContactMethod ?? []}
              group="contact_method"
              onItemClick={openDetailModal}
            />
          </div>
        )}
      </div>

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div className="flex max-h-[88vh] w-full max-w-6xl flex-col rounded-2xl border border-border bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  Detalle por{" "}
                  {detailGroup ? getDetailGroupLabel(detailGroup) : "estadística"}
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  {detailValue || "-"} · {detailTotal || detailItems.length} reclamo
                  {(detailTotal || detailItems.length) !== 1 ? "s" : ""} encontrado
                  {(detailTotal || detailItems.length) !== 1 ? "s" : ""}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {filterLabel}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={exportDetailPdf}
                  disabled={detailLoading || detailItems.length === 0}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Exportar PDF
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={closeDetailModal}
                  className="h-9 w-9 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-5">
              {detailLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Cargando detalle...
                </div>
              ) : detailItems.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
                  No se encontraron reclamos para esta estadística.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-muted/60 text-left">
                      <tr>
                        <th className="px-4 py-3 font-semibold">N°</th>
                        <th className="px-4 py-3 font-semibold">Fecha</th>
                        <th className="px-4 py-3 font-semibold">Dirección</th>
                        <th className="px-4 py-3 font-semibold">Servicio</th>
                        <th className="px-4 py-3 font-semibold">Causa</th>
                        <th className="px-4 py-3 font-semibold">Zona</th>
                        <th className="px-4 py-3 font-semibold">Estado</th>
                        {detailGroup === "delay" && (
                          <th className="px-4 py-3 font-semibold">
                            Días en proceso
                          </th>
                        )}
                        <th className="px-4 py-3 text-center font-semibold">
                          Acción
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                      {paginatedDetailItems.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/40">
                          <td className="px-4 py-3 font-medium">
                            {item.complaint_number ?? item.id}
                          </td>
                          <td className="px-4 py-3">
                            {formatDate(item.complaint_date)}
                          </td>
                          <td className="px-4 py-3">{item.address}</td>
                          <td className="px-4 py-3">{item.service}</td>
                          <td className="px-4 py-3">{item.cause}</td>
                          <td className="px-4 py-3">{item.zone}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                              {item.status}
                            </span>
                          </td>
                          {detailGroup === "delay" && (
                            <td className="px-4 py-3 font-bold text-[#00A27F]">
                              {item.delay_days ?? 0} días
                            </td>
                          )}
                          <td className="px-4 py-3 text-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                saveReturnStateAndOpenComplaint(item.id)
                              }
                              className="gap-1"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Ver
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                {detailItems.length > 0
                  ? `Mostrando ${detailShowingFrom}-${detailShowingTo} de ${detailTotal || detailItems.length
                  } reclamos`
                  : "Sin reclamos para mostrar"}
              </p>

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDetailPage((page) => Math.max(page - 1, 1))}
                  disabled={detailLoading || currentDetailPage <= 1}
                >
                  Anterior
                </Button>

                <span className="min-w-[92px] text-center text-sm text-muted-foreground">
                  Página {currentDetailPage} de {detailPageCount}
                </span>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDetailPage((page) => Math.min(page + 1, detailPageCount))
                  }
                  disabled={detailLoading || currentDetailPage >= detailPageCount}
                >
                  Siguiente
                </Button>

                <Button type="button" variant="outline" onClick={closeDetailModal}>
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
