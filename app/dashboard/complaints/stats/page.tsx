"use client";

import { useEffect, useMemo, useState } from "react";
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
  Download,
  FilterX,
  Loader2,
  RefreshCcw,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

type StatItem = {
  name: string;
  count: number;
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
};

type Service = {
  id: number;
  name: string;
  active?: boolean;
};

const getGroupByTitle = (groupBy: string) => {
  if (groupBy === "all") return "general";
  if (groupBy === "street") return "calle";
  if (groupBy === "service") return "servicio";
  if (groupBy === "cause") return "causa";
  if (groupBy === "zone") return "zona";
  if (groupBy === "status") return "estado";
  return "general";
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

  if (dateFrom) filters.push(`Desde: ${dateFrom}`);
  if (dateTo) filters.push(`Hasta: ${dateTo}`);
  if (status !== "all") filters.push(`Estado: ${status}`);
  if (serviceName !== "Todos") filters.push(`Servicio: ${serviceName}`);
  if (zone !== "all") filters.push(`Zona: ${zone}`);

  return filters.length > 0 ? filters.join(" · ") : "Sin filtros aplicados";
};

function StatBars({
  title,
  data,
  emptyText = "Sin datos",
}: {
  title: string;
  data: StatItem[];
  emptyText?: string;
}) {
  const max = useMemo(
    () => Math.max(...data.map((item) => item.count), 1),
    [data],
  );

  return (
    <Card className="rounded-2xl border-[#D8E3DE] bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-[#373737]">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#6B7280]">{emptyText}</p>
        ) : (
          <div className="space-y-3">
            {data.map((item) => {
              const percentage = Math.max((item.count / max) * 100, 4);

              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="truncate font-medium text-[#373737]">
                      {item.name}
                    </span>
                    <span className="shrink-0 font-bold text-[#00A27F]">
                      {item.count}
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-[#EAF3F0]">
                    <div
                      className="h-full rounded-full bg-[#00A27F]"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupBy, setGroupBy] = useState("all");
  const [status, setStatus] = useState("all");
  const [serviceId, setServiceId] = useState("all");
  const [zone, setZone] = useState("all");

  const selectedServiceName = useMemo(() => {
    if (serviceId === "all") return "Todos";

    return (
      services.find((service) => String(service.id) === serviceId)?.name ??
      "Todos"
    );
  }, [serviceId, services]);

  const filterLabel = getFilterLabel({
    dateFrom,
    dateTo,
    status,
    serviceName: selectedServiceName,
    zone,
  });

  const mainData = useMemo(() => {
    if (!stats) return [];
    if (groupBy === "all") return stats.byStreet;
    return stats.grouped;
  }, [stats, groupBy]);

  const mainStat = mainData[0];

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
      const params = new URLSearchParams();

      params.append("group_by", groupBy === "all" ? "street" : groupBy);

      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);
      if (status !== "all") params.append("status", status);
      if (serviceId !== "all") params.append("service_id", serviceId);
      if (zone !== "all") params.append("zone", zone);

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

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchStats();
    }, 350);

    return () => clearTimeout(timeout);
  }, [dateFrom, dateTo, groupBy, status, serviceId, zone]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setGroupBy("all");
    setStatus("all");
    setServiceId("all");
    setZone("all");
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
      doc.text(`Vista: ${getGroupByTitle(groupBy)}`, 14, 38);

      const splitFilters = doc.splitTextToSize(`Filtros: ${filterLabel}`, 180);
      doc.text(splitFilters, 14, 44);

      let currentY = 54 + splitFilters.length * 4;

      if (groupBy === "all") {
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

        addChartToPdf({
          doc,
          title: "Reclamos por estado",
          data: stats.byStatus,
          startY: currentY,
        });
      } else {
        addChartToPdf({
          doc,
          title: `Estadística por ${getGroupByTitle(groupBy)}`,
          data: stats.grouped,
          startY: currentY,
        });
      }

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
        groupBy === "all"
          ? "estadisticas_reclamos_general.pdf"
          : `estadisticas_reclamos_${getGroupByTitle(groupBy)}.pdf`,
      );

      toast.success("PDF exportado correctamente");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Error al exportar PDF");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#373737]">Estadísticas</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Elegí qué querés analizar. Los filtros se aplican automáticamente.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={exportPdf}
            disabled={loading || !stats}
            className="h-11 rounded-xl border-[#D8E3DE] bg-white px-5"
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

      <Card className="rounded-2xl border-[#D8E3DE] bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#373737]">Desde</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-12 w-full rounded-xl text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#373737]">Hasta</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-12 w-full rounded-xl text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#373737]">
                Estadística por
              </label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="h-12 w-full rounded-xl text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">General</SelectItem>
                  <SelectItem value="street">Calle</SelectItem>
                  <SelectItem value="service">Servicio</SelectItem>
                  <SelectItem value="cause">Causa</SelectItem>
                  <SelectItem value="zone">Zona</SelectItem>
                  <SelectItem value="status">Estado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#373737]">Estado</label>
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
              <label className="text-xs font-semibold text-[#373737]">Servicio</label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger className="h-12 w-full rounded-xl text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={String(service.id)}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#373737]">Zona</label>
              <Select value={zone} onValueChange={setZone}>
                <SelectTrigger className="h-12 w-full rounded-xl text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Array.from({ length: 16 }, (_, i) => String(i + 1)).map((z) => (
                    <SelectItem key={z} value={z}>
                      Zona {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-[#6B7280]">
              {loading ? "Aplicando filtros..." : filterLabel}
            </p>

            <Button
              variant="outline"
              onClick={clearFilters}
              className="h-11 rounded-xl border-[#D8E3DE] px-5"
              disabled={loading}
            >
              <FilterX className="mr-2 h-4 w-4" />
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border-[#D8E3DE] bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-[#373737]">
              Total analizado
            </CardTitle>
            <BarChart3 className="h-5 w-5 text-[#00A27F]" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-[#373737]">
              {loading ? "..." : stats?.total ?? 0}
            </div>
            <p className="mt-1 text-sm text-[#6B7280]">
              Reclamos con filtros aplicados
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#D8E3DE] bg-white shadow-sm md:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <TrendingUp className="h-5 w-5 text-[#00A27F]" />
            <CardTitle className="text-sm font-bold text-[#373737]">
              Más repetido por{" "}
              {groupBy === "all" ? "calle" : getGroupByTitle(groupBy)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#373737]">
              {loading ? "..." : mainStat?.name ?? "Sin datos"}
            </div>
            <p className="mt-1 text-sm text-[#6B7280]">
              {mainStat
                ? `${mainStat.count} reclamos registrados`
                : "No hay información disponible"}
            </p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card className="rounded-2xl border-[#D8E3DE] bg-white shadow-sm">
          <CardContent className="flex items-center justify-center gap-2 py-14 text-[#6B7280]">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando estadísticas...
          </CardContent>
        </Card>
      ) : groupBy === "all" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <StatBars
            title="Calles con más reclamos"
            data={stats?.byStreet ?? []}
          />

          <StatBars
            title="Reclamos por servicio"
            data={stats?.byService ?? []}
          />

          <StatBars
            title="Causas más frecuentes"
            data={stats?.byCause ?? []}
          />

          <StatBars title="Reclamos por zona" data={stats?.byZone ?? []} />

          <div className="xl:col-span-2">
            <StatBars
              title="Reclamos por estado"
              data={stats?.byStatus ?? []}
            />
          </div>
        </div>
      ) : (
        <StatBars
          title={`Estadística por ${getGroupByTitle(groupBy)}`}
          data={stats?.grouped ?? []}
        />
      )}
    </div>
  );
}