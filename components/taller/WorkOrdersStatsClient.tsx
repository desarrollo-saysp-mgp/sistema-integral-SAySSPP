"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { WorkOrder } from "@/types";
import { VEHICLE_OPTIONS } from "@/lib/taller/options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Loader2,
  RefreshCcw,
  X,
  Wrench,
  Truck,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ALL_VALUE = "Todos";

type StatItem = {
  name: string;
  value: number;
};

const CHART_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizeVehicleCode = (value: unknown) =>
  normalizeText(value).replace(/[^a-z0-9]/g, "");

const getVehicleFromCode = (vehicleCode?: string | null) => {
  if (!vehicleCode) return null;

  const normalizedCode = normalizeVehicleCode(vehicleCode);

  return VEHICLE_OPTIONS.find(
    (item) => normalizeVehicleCode(item.code) === normalizedCode,
  );
};

const getVehicleLabel = (order: WorkOrder) => {
  if (order.vehicle && order.vehicle.trim() && order.vehicle.trim() !== "-") {
    return order.vehicle.trim();
  }

  const matchedVehicle = getVehicleFromCode(order.vehicle_code);
  return matchedVehicle?.vehicle || "-";
};

const getVehicleCodeLabel = (order: WorkOrder) => {
  return String(order.vehicle_code || "").trim() || "Sin código";
};

const getVehicleStatsLabel = (order: WorkOrder) => {
  const vehicle = getVehicleLabel(order);
  const code = getVehicleCodeLabel(order);

  if (vehicle === "-" && code === "Sin código") return "-";

  return `${vehicle} · Código: ${code}`;
};

const getVehicleUniqueKey = (order: WorkOrder) => {
  const code = getVehicleCodeLabel(order);

  if (code !== "Sin código") return normalizeVehicleCode(code);

  return normalizeText(getVehicleLabel(order));
};

const formatProviders = (value?: string | null) => {
  const providers = String(value || "")
    .split("|")
    .map((provider) => provider.trim())
    .filter(Boolean);

  if (providers.length === 0) return ["-"];

  return providers;
};

const formatNumber = (value: number) =>
  value.toLocaleString("es-AR", {
    maximumFractionDigits: 0,
  });

const getUniqueOptions = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();

  return values
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value || value === "-") return false;

      const normalized = normalizeText(value);

      if (seen.has(normalized)) return false;

      seen.add(normalized);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
};

const isDateInRange = (
  dateString: string | null | undefined,
  dateFrom: string,
  dateTo: string,
) => {
  if (!dateFrom && !dateTo) return true;
  if (!dateString) return false;

  if (dateFrom && dateString < dateFrom) return false;
  if (dateTo && dateString > dateTo) return false;

  return true;
};

const getMonthLabel = (dateString?: string | null) => {
  if (!dateString) return "Sin fecha";

  const [year, month] = dateString.split("-").map(Number);

  if (!year || !month) return "Sin fecha";

  return `${String(month).padStart(2, "0")}/${year}`;
};

const groupCount = (
  items: WorkOrder[],
  getKey: (order: WorkOrder) => string,
): StatItem[] => {
  const map = new Map<string, number>();

  items.forEach((order) => {
    const key = getKey(order) || "-";
    map.set(key, (map.get(key) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

const getTop = <T,>(items: T[], limit = 10) => items.slice(0, limit);

export function WorkOrdersStatsClient() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const statsPanelRef = useRef<HTMLDivElement | null>(null);

  const [areaFilter, setAreaFilter] = useState(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState(ALL_VALUE);
  const [repairTypeFilter, setRepairTypeFilter] = useState(ALL_VALUE);
  const [failureTypeFilter, setFailureTypeFilter] = useState(ALL_VALUE);
  const [vehicleFilter, setVehicleFilter] = useState(ALL_VALUE);
  const [vehicleCodeFilter, setVehicleCodeFilter] = useState(ALL_VALUE);
  const [driverFilter, setDriverFilter] = useState(ALL_VALUE);
  const [providerFilter, setProviderFilter] = useState(ALL_VALUE);
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/work-orders");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al cargar órdenes de trabajo");
      }

      setWorkOrders(result.data || []);
    } catch (error) {
      console.error("Error fetching work orders stats:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al cargar estadísticas",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const areaOptions = useMemo(
    () => getUniqueOptions(workOrders.map((order) => order.requesting_area)),
    [workOrders],
  );

  const statusOptions = useMemo(
    () => getUniqueOptions(workOrders.map((order) => order.status)),
    [workOrders],
  );

  const repairTypeOptions = useMemo(
    () => getUniqueOptions(workOrders.map((order) => order.repair_type)),
    [workOrders],
  );

  const failureTypeOptions = useMemo(
    () => getUniqueOptions(workOrders.map((order) => order.failure_type)),
    [workOrders],
  );

  const vehicleOptions = useMemo(
    () =>
      getUniqueOptions(workOrders.map((order) => getVehicleStatsLabel(order))),
    [workOrders],
  );

  const vehicleCodeOptions = useMemo(
    () => getUniqueOptions(workOrders.map((order) => order.vehicle_code)),
    [workOrders],
  );

  const driverOptions = useMemo(
    () => getUniqueOptions(workOrders.map((order) => order.driver)),
    [workOrders],
  );

  const providerOptions = useMemo(() => {
    return getUniqueOptions(
      workOrders.flatMap((order) => formatProviders(order.provider)),
    );
  }, [workOrders]);

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((order) => {
      const providers = formatProviders(order.provider);

      const matchesArea =
        areaFilter === ALL_VALUE ||
        normalizeText(order.requesting_area) === normalizeText(areaFilter);

      const matchesStatus =
        statusFilter === ALL_VALUE ||
        normalizeText(order.status) === normalizeText(statusFilter);

      const matchesRepairType =
        repairTypeFilter === ALL_VALUE ||
        normalizeText(order.repair_type) === normalizeText(repairTypeFilter);

      const matchesFailureType =
        failureTypeFilter === ALL_VALUE ||
        normalizeText(order.failure_type) === normalizeText(failureTypeFilter);

      const matchesVehicle =
        vehicleFilter === ALL_VALUE ||
        normalizeText(getVehicleStatsLabel(order)) ===
          normalizeText(vehicleFilter);

      const matchesVehicleCode =
        vehicleCodeFilter === ALL_VALUE ||
        normalizeText(order.vehicle_code) === normalizeText(vehicleCodeFilter);

      const matchesDriver =
        driverFilter === ALL_VALUE ||
        normalizeText(order.driver) === normalizeText(driverFilter);

      const matchesProvider =
        providerFilter === ALL_VALUE ||
        providers.some(
          (provider) =>
            normalizeText(provider) === normalizeText(providerFilter),
        );

      const matchesDate = isDateInRange(
        order.entry_date,
        dateFromFilter,
        dateToFilter,
      );

      return (
        matchesArea &&
        matchesStatus &&
        matchesRepairType &&
        matchesFailureType &&
        matchesVehicle &&
        matchesVehicleCode &&
        matchesDriver &&
        matchesProvider &&
        matchesDate
      );
    });
  }, [
    workOrders,
    areaFilter,
    statusFilter,
    repairTypeFilter,
    failureTypeFilter,
    vehicleFilter,
    vehicleCodeFilter,
    driverFilter,
    providerFilter,
    dateFromFilter,
    dateToFilter,
  ]);

  const hasActiveFilters =
    areaFilter !== ALL_VALUE ||
    statusFilter !== ALL_VALUE ||
    repairTypeFilter !== ALL_VALUE ||
    failureTypeFilter !== ALL_VALUE ||
    vehicleFilter !== ALL_VALUE ||
    vehicleCodeFilter !== ALL_VALUE ||
    driverFilter !== ALL_VALUE ||
    providerFilter !== ALL_VALUE ||
    dateFromFilter ||
    dateToFilter;

  const clearFilters = () => {
    setAreaFilter(ALL_VALUE);
    setStatusFilter(ALL_VALUE);
    setRepairTypeFilter(ALL_VALUE);
    setFailureTypeFilter(ALL_VALUE);
    setVehicleFilter(ALL_VALUE);
    setVehicleCodeFilter(ALL_VALUE);
    setDriverFilter(ALL_VALUE);
    setProviderFilter(ALL_VALUE);
    setDateFromFilter("");
    setDateToFilter("");
  };

  const stats = useMemo(() => {
    const total = filteredWorkOrders.length;

    const closed = filteredWorkOrders.filter(
      (order) => normalizeText(order.status) === "cerrado",
    ).length;

    const open = total - closed;

    const vehicles = new Set(
      filteredWorkOrders
        .map((order) => getVehicleUniqueKey(order))
        .filter((value) => value && value !== "-"),
    );

    const withSparePart = filteredWorkOrders.filter(
      (order) => normalizeText(order.requires_spare_part) === "si",
    ).length;

    return {
      total,
      closed,
      open,
      vehiclesCount: vehicles.size,
      withSparePart,
    };
  }, [filteredWorkOrders]);

  const ordersByMonth = useMemo(() => {
    const data = groupCount(filteredWorkOrders, (order) =>
      getMonthLabel(order.entry_date),
    );

    return data.sort((a, b) => {
      if (a.name === "Sin fecha") return 1;
      if (b.name === "Sin fecha") return -1;

      const [monthA, yearA] = a.name.split("/").map(Number);
      const [monthB, yearB] = b.name.split("/").map(Number);

      return yearA - yearB || monthA - monthB;
    });
  }, [filteredWorkOrders]);

  const ordersByStatus = useMemo(
    () => groupCount(filteredWorkOrders, (order) => order.status || "-"),
    [filteredWorkOrders],
  );

  const ordersByArea = useMemo(
    () =>
      getTop(
        groupCount(filteredWorkOrders, (order) => order.requesting_area || "-"),
        8,
      ),
    [filteredWorkOrders],
  );

  const ordersByRepairType = useMemo(
    () =>
      getTop(
        groupCount(filteredWorkOrders, (order) => order.repair_type || "-"),
        8,
      ),
    [filteredWorkOrders],
  );

  const ordersByFailureType = useMemo(
    () =>
      getTop(
        groupCount(filteredWorkOrders, (order) => order.failure_type || "-"),
        10,
      ),
    [filteredWorkOrders],
  );

  const topVehiclesByOrders = useMemo(
    () =>
      getTop(
        groupCount(filteredWorkOrders, (order) => getVehicleStatsLabel(order)),
        10,
      ),
    [filteredWorkOrders],
  );

  const topProvidersByOrders = useMemo(
    () =>
      getTop(
        groupCount(
          filteredWorkOrders,
          (order) => formatProviders(order.provider)[0] || "-",
        ),
        10,
      ),
    [filteredWorkOrders],
  );

  const topDrivers = useMemo(
    () =>
      getTop(groupCount(filteredWorkOrders, (order) => order.driver || "-"), 10),
    [filteredWorkOrders],
  );

  const exportStatsPdf = async () => {
    if (filteredWorkOrders.length === 0) {
      toast.error("No hay datos para exportar con los filtros actuales");
      return;
    }

    if (!statsPanelRef.current) {
      toast.error("No se encontró el panel para exportar");
      return;
    }

    try {
      setExportingPdf(true);

      const [{ default: jsPDF }, { domToPng }] = await Promise.all([
        import("jspdf"),
        import("modern-screenshot"),
      ]);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      const panel = statsPanelRef.current;

      const imageData = await domToPng(panel, {
        backgroundColor: "#ffffff",
        scale: 2,
        width: panel.scrollWidth,
        height: panel.scrollHeight,
      });

      const pdf = new jsPDF("p", "mm", "a4");

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 8;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      const imageWidth = usableWidth;

      const imageProperties = pdf.getImageProperties(imageData);
      const imageHeight =
        (imageProperties.height * imageWidth) / imageProperties.width;

      let remainingHeight = imageHeight;
      let positionY = margin;

      pdf.addImage(imageData, "PNG", margin, positionY, imageWidth, imageHeight);

      remainingHeight -= usableHeight;

      while (remainingHeight > 0) {
        pdf.addPage();

        positionY = margin - (imageHeight - remainingHeight);

        pdf.addImage(
          imageData,
          "PNG",
          margin,
          positionY,
          imageWidth,
          imageHeight,
        );

        remainingHeight -= usableHeight;
      }

      const totalPages = pdf.getNumberOfPages();

      if (totalPages > 1) {
        for (let page = 1; page <= totalPages; page += 1) {
          pdf.setPage(page);
          pdf.setFontSize(7);
          pdf.setTextColor(120);

          pdf.text(
            `Página ${page} de ${totalPages}`,
            pageWidth - margin,
            pageHeight - 5,
            { align: "right" },
          );
        }
      }

      const fileName = `estadisticas_ot_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;

      pdf.save(fileName);

      toast.success("PDF de estadísticas exportado correctamente");
    } catch (error) {
      console.error("Error exporting stats PDF:", error);
      toast.error("No se pudo exportar el PDF de estadísticas");
    } finally {
      setExportingPdf(false);
    }
  };

  if (!mounted) {
    return (
      <div className="space-y-5">
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Cargando estadísticas...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-start">
        <Button asChild variant="outline" className="h-9 gap-2 rounded-xl">
          <Link href="/dashboard/taller/ordenes-trabajo">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </Button>
      </div>

      <Card
        ref={statsPanelRef}
        className={exportingPdf ? "stats-panel-exporting" : ""}
      >
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Panel estadístico de OT
              </CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                Filtrá la información y analizá órdenes, vehículos, fallas,
                proveedores y choferes.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="w-fit rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                {filteredWorkOrders.length} de {workOrders.length} OT analizadas
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={exportStatsPdf}
                disabled={
                  loading || exportingPdf || filteredWorkOrders.length === 0
                }
                className="h-9 gap-2 rounded-xl pdf-hidden"
              >
                {exportingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Exportar PDF
              </Button>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12 xl:items-end">
              <div className="xl:col-span-2">
                <FilterSelect
                  value={areaFilter}
                  onValueChange={setAreaFilter}
                  placeholder="Área"
                  options={areaOptions}
                />
              </div>

              <div className="xl:col-span-2">
                <FilterSelect
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  placeholder="Estado"
                  options={statusOptions}
                />
              </div>

              <div className="xl:col-span-3">
                <FilterSelect
                  value={vehicleFilter}
                  onValueChange={setVehicleFilter}
                  placeholder="Vehículo"
                  options={vehicleOptions}
                />
              </div>

              <div className="xl:col-span-3">
                <FilterSelect
                  value={providerFilter}
                  onValueChange={setProviderFilter}
                  placeholder="Proveedor"
                  options={providerOptions}
                />
              </div>

              <div className="xl:col-span-2">
                <FilterSelect
                  value={vehicleCodeFilter}
                  onValueChange={setVehicleCodeFilter}
                  placeholder="Código"
                  options={vehicleCodeOptions}
                />
              </div>

              <div className="xl:col-span-2">
                <FilterSelect
                  value={repairTypeFilter}
                  onValueChange={setRepairTypeFilter}
                  placeholder="Reparación"
                  options={repairTypeOptions}
                />
              </div>

              <div className="xl:col-span-2">
                <FilterSelect
                  value={failureTypeFilter}
                  onValueChange={setFailureTypeFilter}
                  placeholder="Falla"
                  options={failureTypeOptions}
                />
              </div>

              <div className="xl:col-span-2">
                <FilterSelect
                  value={driverFilter}
                  onValueChange={setDriverFilter}
                  placeholder="Chofer"
                  options={driverOptions}
                />
              </div>

              <div className="xl:col-span-2">
                <DateFilter
                  label="Fecha desde"
                  value={dateFromFilter}
                  onChange={setDateFromFilter}
                />
              </div>

              <div className="xl:col-span-2">
                <DateFilter
                  label="Fecha hasta"
                  value={dateToFilter}
                  onChange={setDateToFilter}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:justify-between pdf-hidden">
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="h-9 gap-2 rounded-xl"
              >
                <X className="h-4 w-4" />
                Limpiar filtros
              </Button>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={fetchWorkOrders}
                  disabled={loading}
                  className="h-9 gap-2 rounded-xl"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Actualizar
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Cargando estadísticas...
            </div>
          ) : filteredWorkOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <ClipboardList className="mb-3 h-10 w-10" />
              <p>No hay datos para los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard
                  title="Total de OT"
                  value={formatNumber(stats.total)}
                  description="Órdenes dentro de los filtros"
                  icon={<ClipboardList className="h-5 w-5" />}
                />

                <StatCard
                  title="OT cerradas"
                  value={formatNumber(stats.closed)}
                  description={`${
                    stats.total > 0
                      ? Math.round((stats.closed / stats.total) * 100)
                      : 0
                  }% del total`}
                  icon={<CheckCircle2 className="h-5 w-5" />}
                />

                <StatCard
                  title="OT abiertas"
                  value={formatNumber(stats.open)}
                  description="Pendientes o en proceso"
                  icon={<AlertCircle className="h-5 w-5" />}
                />

                <StatCard
                  title="Vehículos intervenidos"
                  value={formatNumber(stats.vehiclesCount)}
                  description="Vehículos únicos con OT"
                  icon={<Truck className="h-5 w-5" />}
                />

                <StatCard
                  title="Con repuesto"
                  value={formatNumber(stats.withSparePart)}
                  description={`${
                    stats.total > 0
                      ? Math.round((stats.withSparePart / stats.total) * 100)
                      : 0
                  }% del total`}
                  icon={<Wrench className="h-5 w-5" />}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <ChartCard title="OT por mes">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={ordersByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="value" name="OT" radius={[8, 8, 0, 0]}>
                        {ordersByMonth.map((_, index) => (
                          <Cell
                            key={`month-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="OT por estado">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={ordersByStatus}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={105}
                        label
                      >
                        {ordersByStatus.map((_, index) => (
                          <Cell
                            key={`status-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="OT por área solicitante">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={ordersByArea} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" fontSize={12} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        fontSize={12}
                      />
                      <Tooltip />
                      <Bar dataKey="value" name="OT" radius={[0, 8, 8, 0]}>
                        {ordersByArea.map((_, index) => (
                          <Cell
                            key={`area-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="OT por tipo de reparación">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={ordersByRepairType} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" fontSize={12} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        fontSize={12}
                      />
                      <Tooltip />
                      <Bar dataKey="value" name="OT" radius={[0, 8, 8, 0]}>
                        {ordersByRepairType.map((_, index) => (
                          <Cell
                            key={`repair-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Top fallas más repetidas">
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={ordersByFailureType} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" fontSize={12} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={135}
                        fontSize={12}
                      />
                      <Tooltip />
                      <Bar dataKey="value" name="OT" radius={[0, 8, 8, 0]}>
                        {ordersByFailureType.map((_, index) => (
                          <Cell
                            key={`failure-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Top proveedores con más OT">
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={topProvidersByOrders} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" fontSize={12} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={150}
                        fontSize={12}
                      />
                      <Tooltip />
                      <Bar dataKey="value" name="OT" radius={[0, 8, 8, 0]}>
                        {topProvidersByOrders.map((_, index) => (
                          <Cell
                            key={`provider-orders-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <RankingCard
                  title="Vehículos con más OT"
                  items={topVehiclesByOrders}
                  valueLabel="OT"
                />

                <RankingCard
                  title="Proveedores con más OT"
                  items={topProvidersByOrders}
                  valueLabel="OT"
                />

                <RankingCard
                  title="Choferes con más OT"
                  items={topDrivers}
                  valueLabel="OT"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <style jsx global>{`
        .stats-panel-exporting {
          background: #ffffff !important;
          color: #111827 !important;
          box-shadow: none !important;
        }

        .stats-panel-exporting .pdf-hidden {
          display: none !important;
        }

        .stats-panel-exporting * {
          text-shadow: none !important;
        }

        .stats-panel-exporting .recharts-wrapper,
        .stats-panel-exporting .recharts-surface,
        .stats-panel-exporting svg {
          overflow: visible !important;
        }
      `}</style>
    </div>
  );
}

function FilterSelect({
  value,
  onValueChange,
  placeholder,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  options: readonly string[];
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{placeholder}</p>

      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 w-full min-w-0 rounded-xl">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value={ALL_VALUE}>Todos</SelectItem>

          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>

      <Input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-xl"
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>

      <CardContent>{children}</CardContent>
    </Card>
  );
}

function RankingCard({
  title,
  items,
  valueLabel,
}: {
  title: string;
  items: Array<{ name: string; value: number }>;
  valueLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos.</p>
          ) : (
            items.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {index + 1}. {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{valueLabel}</p>
                </div>

                <p className="shrink-0 text-sm font-bold">
                  {formatNumber(item.value)}
                </p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}