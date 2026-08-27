"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  Filter,
  Gauge,
  Loader2,
  Pencil,
  RefreshCcw,
  Search,
  Truck,
  X,
  PieChart as PieChartIcon,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

type VehicleCriticalityStatus =
  | "BUENO"
  | "REGULAR"
  | "MALO"
  | "SIN DATOS"
  | "SIN CHECKLIST"
  | "FUERA DE SERVICIO"
  | "DADO DE BAJA";

type StatusFilter = "Todos" | VehicleCriticalityStatus;

type VehicleCriticalityRow = {
  vehicle_id: string;
  vehicle_code: string;
  vehicle: string;
  license_plate: string;

  operational_status: string | null;
  is_out_of_service: boolean;

  active: boolean;
  is_retired: boolean;
  deactivation_date: string | null;
  deactivation_reason: string | null;

  work_orders_count: number;
  mechanical_reliability_score: number;
  service_criticality: number;
  replacement_score: number;
  security_score: number;

  has_checklist: boolean;
  total_criticality: number | null;

  notes: string;

  status_label: VehicleCriticalityStatus;
  status_display: string;
};

type EditingValues = {
  replacement_score: string;
  notes: string;
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getStatusLabel = (status: VehicleCriticalityStatus) => {
  switch (status) {
    case "BUENO":
      return "BUENO";
    case "REGULAR":
      return "REGULAR";
    case "MALO":
      return "CRÍTICO";
    case "SIN CHECKLIST":
      return "SIN CHECKLIST";
    case "FUERA DE SERVICIO":
      return "FUERA DE SERVICIO";
    case "DADO DE BAJA":
      return "DADO DE BAJA";
    case "SIN DATOS":
    default:
      return "SIN DATOS";
  }
};

const getStatusBadgeClass = (status: VehicleCriticalityStatus) => {
  switch (status) {
    case "BUENO":
      return "border-green-200 bg-green-100 text-green-800";
    case "REGULAR":
      return "border-yellow-200 bg-yellow-100 text-yellow-800";
    case "MALO":
      return "border-red-200 bg-red-100 text-red-800";
    case "SIN CHECKLIST":
      return "border-orange-200 bg-orange-100 text-orange-800";
    case "FUERA DE SERVICIO":
      return "border-slate-300 bg-slate-100 text-slate-700";
    case "DADO DE BAJA":
      return "border-slate-300 bg-slate-100 text-slate-800";
    case "SIN DATOS":
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};

const getScoreBadgeClass = (score: number) => {
  if (score >= 4) return "border-red-200 bg-red-100 text-red-800";
  if (score >= 2) return "border-yellow-200 bg-yellow-100 text-yellow-800";
  return "border-green-200 bg-green-100 text-green-800";
};

const getTotalBadgeClass = (total: number | null) => {
  if (total === null) {
    return "border-orange-200 bg-orange-100 text-orange-800";
  }

  if (total >= 13) {
    return "border-red-200 bg-red-100 text-red-800";
  }

  if (total >= 10) {
    return "border-yellow-200 bg-yellow-100 text-yellow-800";
  }

  return "border-green-200 bg-green-100 text-green-800";
};

const hasActiveFilters = ({
  search,
  code,
  plate,
  vehicle,
  status,
  minTotal,
  maxTotal,
}: {
  search: string;
  code: string;
  plate: string;
  vehicle: string;
  status: StatusFilter;
  minTotal: string;
  maxTotal: string;
}) => {
  return (
    search.trim() !== "" ||
    code !== "Todos" ||
    plate.trim() !== "" ||
    vehicle.trim() !== "" ||
    status !== "Todos" ||
    minTotal.trim() !== "" ||
    maxTotal.trim() !== ""
  );
};

export function VehicleCriticalityClient() {
  const [rows, setRows] = useState<VehicleCriticalityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [savingVehicleCode, setSavingVehicleCode] = useState<string | null>(
    null,
  );

  const [editingVehicleCode, setEditingVehicleCode] = useState<string | null>(
    null,
  );

  const [editingValues, setEditingValues] = useState<EditingValues>({
    replacement_score: "0",
    notes: "",
  });

  const [search, setSearch] = useState("");
  const [codeFilter, setCodeFilter] = useState("Todos");
  const [plateFilter, setPlateFilter] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todos");
  const [minTotalFilter, setMinTotalFilter] = useState("");
  const [maxTotalFilter, setMaxTotalFilter] = useState("");

  /*
   * FUENTE ÚNICA:
   * /api/taller/criticidad/resumen
   *
   * Ese endpoint toma Planta Vehicular como fuente de verdad
   * para activo / dado de baja / estado operativo.
   */
  const fetchData = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        "/api/taller/criticidad/resumen",
        {
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Error al cargar criticidad vehicular",
        );
      }

      setRows(
        (result?.data ||
          []) as VehicleCriticalityRow[],
      );
    } catch (error) {
      console.error(
        "Error fetching vehicle criticality summary:",
        error,
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "Error al cargar criticidad vehicular",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const vehicleCodes = useMemo(() => {
    const codes = new Set<string>();

    rows.forEach((row) => {
      if (row.vehicle_code.trim()) codes.add(row.vehicle_code.trim());
    });

    return Array.from(codes).sort((a, b) =>
      a.localeCompare(b, "es", { numeric: true }),
    );
  }, [rows]);

  const baseFilteredRows = useMemo(() => {
    const normalizedSearch = normalizeText(search);
    const normalizedPlate = normalizeText(plateFilter);
    const normalizedVehicle = normalizeText(vehicleFilter);
    const minTotal =
      minTotalFilter.trim() === "" ? null : Number(minTotalFilter);
    const maxTotal =
      maxTotalFilter.trim() === "" ? null : Number(maxTotalFilter);

    return rows.filter((row) => {
      const matchesSearch =
        !normalizedSearch ||
        normalizeText(row.vehicle_code).includes(normalizedSearch) ||
        normalizeText(row.vehicle).includes(normalizedSearch) ||
        normalizeText(row.license_plate).includes(normalizedSearch) ||
        normalizeText(row.operational_status).includes(normalizedSearch) ||
        normalizeText(getStatusLabel(row.status_label)).includes(normalizedSearch);

      const matchesCode =
        codeFilter === "Todos" || row.vehicle_code === codeFilter;

      const matchesPlate =
        !normalizedPlate ||
        normalizeText(row.license_plate).includes(normalizedPlate);

      const matchesVehicle =
        !normalizedVehicle ||
        normalizeText(row.vehicle).includes(normalizedVehicle);

      const matchesMinTotal =
        row.is_retired ||
        minTotal === null ||
        !Number.isFinite(minTotal) ||
        (row.total_criticality !== null && row.total_criticality >= minTotal);

      const matchesMaxTotal =
        row.is_retired ||
        maxTotal === null ||
        !Number.isFinite(maxTotal) ||
        (row.total_criticality !== null && row.total_criticality <= maxTotal);

      return (
        matchesSearch &&
        matchesCode &&
        matchesPlate &&
        matchesVehicle &&
        matchesMinTotal &&
        matchesMaxTotal
      );
    });
  }, [
    rows,
    search,
    codeFilter,
    plateFilter,
    vehicleFilter,
    minTotalFilter,
    maxTotalFilter,
  ]);

  /*
   * Sólo los vehículos activos Y operativos participan del cálculo.
   * Los fuera de servicio y los dados de baja quedan visibles,
   * pero excluidos de los indicadores de criticidad.
   */
  const calculableBaseRows = baseFilteredRows.filter(
    (row) =>
      !row.is_retired &&
      !row.is_out_of_service,
  );

  const outOfServiceBaseRows = baseFilteredRows.filter(
    (row) =>
      !row.is_retired &&
      row.is_out_of_service,
  );

  const retiredBaseRows = baseFilteredRows.filter(
    (row) => row.is_retired,
  );

  const filteredRows = useMemo(() => {
    if (statusFilter === "Todos") {
      return baseFilteredRows.filter(
        (row) =>
          !row.is_retired &&
          !row.is_out_of_service,
      );
    }

    return baseFilteredRows.filter(
      (row) =>
        row.status_label ===
        statusFilter,
    );
  }, [baseFilteredRows, statusFilter]);

  const totalVehicles = calculableBaseRows.length;

  const goodVehicles = calculableBaseRows.filter(
    (row) => row.has_checklist && row.status_label === "BUENO",
  ).length;

  const regularVehicles = calculableBaseRows.filter(
    (row) => row.has_checklist && row.status_label === "REGULAR",
  ).length;

  const badVehicles = calculableBaseRows.filter(
    (row) => row.has_checklist && row.status_label === "MALO",
  ).length;

  const withoutChecklistVehicles = calculableBaseRows.filter(
    (row) => !row.has_checklist,
  ).length;

  const outOfServiceVehicles =
    outOfServiceBaseRows.length;

  const retiredVehicles =
    retiredBaseRows.length;

  const activeFilters = hasActiveFilters({
    search,
    code: codeFilter,
    plate: plateFilter,
    vehicle: vehicleFilter,
    status: statusFilter,
    minTotal: minTotalFilter,
    maxTotal: maxTotalFilter,
  });

  const clearFilters = () => {
    setSearch("");
    setCodeFilter("Todos");
    setPlateFilter("");
    setVehicleFilter("");
    setStatusFilter("Todos");
    setMinTotalFilter("");
    setMaxTotalFilter("");
  };

  const handleCardFilter = (status: StatusFilter) => {
    if (status === "Todos") {
      setStatusFilter("Todos");
      return;
    }

    setStatusFilter((prev) => (prev === status ? "Todos" : status));
  };

  const startEditing = (row: VehicleCriticalityRow) => {
    if (
      row.is_retired ||
      row.is_out_of_service
    ) {
      return;
    }

    setEditingVehicleCode(row.vehicle_code);
    setEditingValues({
      replacement_score: String(row.replacement_score),
      notes: row.notes,
    });
  };

  const cancelEditing = () => {
    setEditingVehicleCode(null);
    setEditingValues({
      replacement_score: "0",
      notes: "",
    });
  };

  const updateEditingValue = (field: keyof EditingValues, value: string) => {
    setEditingValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveEditing = async (vehicleCode: string) => {
    try {
      setSavingVehicleCode(vehicleCode);

      const currentRow = rows.find(
        (row) =>
          normalizeText(row.vehicle_code) ===
          normalizeText(vehicleCode),
      );

      if (!currentRow || currentRow.is_retired) {
        throw new Error(
          "No se encontró el vehículo activo para actualizar",
        );
      }

      const response = await fetch(
        `/api/taller/criticidad/${encodeURIComponent(vehicleCode)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            service_criticality:
              currentRow.service_criticality,
            replacement_score:
              editingValues.replacement_score,
            security_score:
              currentRow.security_score,
            notes: editingValues.notes,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Error al actualizar criticidad vehicular",
        );
      }

      toast.success("Reemplazo actualizado");
      cancelEditing();
      await fetchData();
    } catch (error) {
      console.error(
        "Error updating vehicle criticality:",
        error,
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "Error al actualizar criticidad vehicular",
      );
    } finally {
      setSavingVehicleCode(null);
    }
  };

  const chartData = useMemo(() => {
    const data = [
      {
        key: "BUENO",
        name: "Bueno",
        value: goodVehicles,
        color: "#22c55e",
      },
      {
        key: "REGULAR",
        name: "Regular",
        value: regularVehicles,
        color: "#eab308",
      },
      {
        key: "MALO",
        name: "Crítico",
        value: badVehicles,
        color: "#ef4444",
      },
      {
        key: "SIN CHECKLIST",
        name: "Sin checklist",
        value: withoutChecklistVehicles,
        color: "#f97316",
      },
      {
        key: "FUERA DE SERVICIO",
        name: "Fuera de servicio",
        value: outOfServiceVehicles,
        color: "#94a3b8",
      },
      {
        key: "DADO DE BAJA",
        name: "Dados de baja",
        value: retiredVehicles,
        color: "#64748b",
      },
    ];

    return data.filter((item) => item.value > 0);
  }, [
    goodVehicles,
    regularVehicles,
    badVehicles,
    withoutChecklistVehicles,
    outOfServiceVehicles,
    retiredVehicles,
  ]);

  const chartTotal =
    goodVehicles +
    regularVehicles +
    badVehicles +
    withoutChecklistVehicles +
    outOfServiceVehicles +
    retiredVehicles;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-2 mb-3 gap-2">
            <Link href="/dashboard/taller/ordenes-trabajo">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Criticidad Vehicular
          </h1>

          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Gestión y cálculo de criticidad de la planta vehicular.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="gap-2 rounded-xl">
            <Link href="/dashboard/taller/ordenes-trabajo/criticidad/estado-general">
              <ClipboardCheck className="h-4 w-4" />
              Checklist Vehicular
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="gap-2 rounded-xl"
          >
            <RefreshCcw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <SummaryCard
          title="Vehículos analizados"
          value={totalVehicles}
          description="Activos según filtros"
          active={statusFilter === "Todos"}
          onClick={() => handleCardFilter("Todos")}
        />

        <SummaryCard
          title="Buenos"
          value={goodVehicles}
          description="Criticidad menor a 10"
          active={statusFilter === "BUENO"}
          onClick={() => handleCardFilter("BUENO")}
        />

        <SummaryCard
          title="Regulares"
          value={regularVehicles}
          description="Criticidad entre 10 y 12"
          active={statusFilter === "REGULAR"}
          onClick={() => handleCardFilter("REGULAR")}
        />

        <SummaryCard
          title="Críticos"
          value={badVehicles}
          description="Criticidad 13 o superior"
          active={statusFilter === "MALO"}
          onClick={() => handleCardFilter("MALO")}
        />

        <SummaryCard
          title="Sin checklist"
          value={withoutChecklistVehicles}
          description="Activos sin checklist"
          active={statusFilter === "SIN CHECKLIST"}
          onClick={() => handleCardFilter("SIN CHECKLIST")}
        />

        <SummaryCard
          title="Fuera de servicio"
          value={outOfServiceVehicles}
          description="Activos, excluidos del cálculo"
          active={statusFilter === "FUERA DE SERVICIO"}
          onClick={() => handleCardFilter("FUERA DE SERVICIO")}
        />

        <SummaryCard
          title="Dados de baja"
          value={retiredVehicles}
          description="Excluidos del cálculo"
          active={statusFilter === "DADO DE BAJA"}
          onClick={() => handleCardFilter("DADO DE BAJA")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <CriticalityChartCard
          data={chartData}
          total={chartTotal}
          loading={loading}
        />

        <CriticalityLegendCard />
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-[#00A27F]" />
                Panel de criticidad
              </CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                Criticidad total = confiabilidad mecánica + criticidad servicio
                + reemplazo + seguridad.
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                La situación administrativa y el estado operativo se toman
                directamente de Planta Vehicular. Los vehículos fuera de servicio
                y los dados de baja quedan visibles para control, pero no entran
                en el cálculo de criticidad.
              </p>
            </div>

            <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
              {filteredRows.length} de{" "}
              {statusFilter === "DADO DE BAJA"
                ? retiredBaseRows.length
                : statusFilter === "FUERA DE SERVICIO"
                  ? outOfServiceBaseRows.length
                  : calculableBaseRows.length}{" "}
              vehículos
            </Badge>
          </div>

          <div className="rounded-2xl border bg-muted/20 p-3 sm:p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Filter className="h-4 w-4 text-[#00A27F]" />
              Filtros
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="sm:col-span-2 xl:col-span-2">
                <label className="mb-1 block text-xs font-medium">
                  Buscar
                </label>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Código, vehículo, dominio o estado..."
                    className="h-10 rounded-xl pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">Código</label>

                <select
                  value={codeFilter}
                  onChange={(event) => setCodeFilter(event.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="Todos">Todos</option>

                  {vehicleCodes.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">Estado</label>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as StatusFilter)
                  }
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="Todos">Todos</option>
                  <option value="BUENO">Bueno</option>
                  <option value="REGULAR">Regular</option>
                  <option value="MALO">Crítico</option>
                  <option value="SIN CHECKLIST">Sin checklist</option>
                  <option value="FUERA DE SERVICIO">Fuera de servicio</option>
                  <option value="DADO DE BAJA">Dado de baja</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">
                  Dominio / patente
                </label>

                <Input
                  value={plateFilter}
                  onChange={(event) => setPlateFilter(event.target.value)}
                  placeholder="Ej: AFU928"
                  className="h-10 rounded-xl"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">
                  Vehículo
                </label>

                <Input
                  value={vehicleFilter}
                  onChange={(event) => setVehicleFilter(event.target.value)}
                  placeholder="Ej: Iveco"
                  className="h-10 rounded-xl"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">
                  Total desde
                </label>

                <Input
                  type="number"
                  min={0}
                  value={minTotalFilter}
                  onChange={(event) => setMinTotalFilter(event.target.value)}
                  placeholder="Ej: 10"
                  className="h-10 rounded-xl"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">
                  Total hasta
                </label>

                <Input
                  type="number"
                  min={0}
                  value={maxTotalFilter}
                  onChange={(event) => setMaxTotalFilter(event.target.value)}
                  placeholder="Ej: 12"
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="flex items-end sm:col-span-2 xl:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearFilters}
                  disabled={!activeFilters}
                  className="h-10 w-full gap-2 rounded-xl"
                >
                  <X className="h-4 w-4" />
                  Limpiar filtros
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Cargando criticidad vehicular...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Truck className="mb-3 h-10 w-10" />
              <p>No hay vehículos para los filtros aplicados.</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-xl border lg:block">
                <table className="w-full min-w-[1180px] border-collapse text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-3 text-left font-semibold">
                        Código
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">
                        Vehículo
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">
                        Dominio
                      </th>
                      <th className="px-3 py-3 text-center font-semibold">
                        OT 6 meses
                      </th>
                      <th className="px-3 py-3 text-center font-semibold">
                        Conf. mecánica
                      </th>
                      <th className="px-3 py-3 text-center font-semibold">
                        Crit. servicio
                      </th>
                      <th className="px-3 py-3 text-center font-semibold">
                        Reemplazo
                      </th>
                      <th className="px-3 py-3 text-center font-semibold">
                        Seguridad
                      </th>
                      <th className="px-3 py-3 text-center font-semibold">
                        Total
                      </th>
                      <th className="px-3 py-3 text-center font-semibold">
                        Estado
                      </th>
                      <th className="px-3 py-3 text-center font-semibold">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows.map((row) => {
                      const isEditing = editingVehicleCode === row.vehicle_code;
                      const isSaving = savingVehicleCode === row.vehicle_code;

                      return (
                        <tr key={row.vehicle_code} className="border-t align-top">
                          <td className="px-3 py-3 font-semibold">
                            {row.vehicle_code}
                          </td>

                          <td className="px-3 py-3">
                            <div className="space-y-1.5">
                              <div>{row.vehicle}</div>

                              {row.is_out_of_service && !row.is_retired && (
                                <Badge
                                  variant="outline"
                                  className="border-slate-300 bg-slate-100 text-[10px] font-semibold text-slate-700"
                                >
                                  FUERA DE SERVICIO
                                </Badge>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-3">{row.license_plate}</td>

                          <td className="px-3 py-3 text-center">
                            {row.is_retired || row.is_out_of_service
                              ? "--"
                              : row.work_orders_count}
                          </td>

                          {row.is_retired || row.is_out_of_service ? (
                            <>
                              <MutedCell />
                              <MutedCell />
                              <MutedCell />
                              <MutedCell />
                            </>
                          ) : (
                            <>
                              <ReadOnlyScoreCell
                                value={row.mechanical_reliability_score}
                              />

                              <ReadOnlyScoreCell
                                value={row.service_criticality}
                              />

                              <EditableReplacementCell
                                isEditing={isEditing}
                                value={row.replacement_score}
                                inputValue={editingValues.replacement_score}
                                onChange={(value) =>
                                  updateEditingValue("replacement_score", value)
                                }
                              />

                              <td className="px-3 py-3 text-center">
                                {row.has_checklist ? (
                                  <Badge
                                    className={`${getScoreBadgeClass(
                                      row.security_score,
                                    )} border`}
                                  >
                                    {row.security_score}
                                  </Badge>
                                ) : (
                                  <Badge className="border border-orange-200 bg-orange-100 text-orange-800">
                                    --
                                  </Badge>
                                )}
                              </td>
                            </>
                          )}

                          <td className="px-3 py-3 text-center">
                            <Badge
                              className={`${getTotalBadgeClass(
                                row.total_criticality,
                              )} border`}
                            >
                              {row.is_out_of_service
                                ? "--"
                                : row.total_criticality ?? "--"}
                            </Badge>
                          </td>

                          <td className="px-3 py-3 text-center">
                            <Badge
                              className={`${getStatusBadgeClass(
                                row.status_label,
                              )} border`}
                            >
                              {getStatusLabel(row.status_label)}
                            </Badge>
                          </td>

                          <td className="px-3 py-3">
                            {row.is_retired || row.is_out_of_service ? (
                              <div className="text-center text-xs text-muted-foreground">
                                Excluido
                              </div>
                            ) : isEditing ? (
                              <div className="flex justify-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => saveEditing(row.vehicle_code)}
                                  disabled={isSaving}
                                  className="h-8 gap-1 rounded-lg"
                                >
                                  {isSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                  Guardar
                                </Button>

                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditing}
                                  disabled={isSaving}
                                  className="h-8 gap-1 rounded-lg"
                                >
                                  <X className="h-4 w-4" />
                                  Cancelar
                                </Button>
                              </div>
                            ) : (
                              <div className="flex justify-center">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditing(row)}
                                  className="h-8 gap-1 rounded-lg"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Editar reemplazo
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 lg:hidden">
                {filteredRows.map((row) => {
                  const isEditing = editingVehicleCode === row.vehicle_code;
                  const isSaving = savingVehicleCode === row.vehicle_code;

                  return (
                    <Card key={row.vehicle_code} className="overflow-hidden">
                      <CardContent className="space-y-4 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-bold">
                              {row.vehicle_code}
                            </p>
                            <p className="text-sm font-medium">{row.vehicle}</p>

                            <p className="text-xs text-muted-foreground">
                              Dominio: {row.license_plate}
                            </p>

                            {row.is_out_of_service && !row.is_retired && (
                              <Badge
                                variant="outline"
                                className="mt-2 border-slate-300 bg-slate-100 text-[10px] font-semibold text-slate-700"
                              >
                                FUERA DE SERVICIO
                              </Badge>
                            )}
                          </div>

                          <Badge
                            className={`${getStatusBadgeClass(
                              row.status_label,
                            )} shrink-0 border`}
                          >
                            {getStatusLabel(row.status_label)}
                          </Badge>
                        </div>

                        {row.is_retired ? (
                          <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
                            Vehículo dado de baja en Planta Vehicular.
                            Excluido del cálculo de criticidad.
                            {row.deactivation_reason
                              ? ` Motivo: ${row.deactivation_reason}`
                              : ""}
                          </div>
                        ) : row.is_out_of_service ? (
                          <div className="rounded-xl border border-slate-300 bg-slate-100 p-3 text-sm text-slate-700">
                            Vehículo fuera de servicio. Queda visible para control,
                            pero se excluye temporalmente del cálculo de criticidad.
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <MobileScore
                                label="OT 6 meses"
                                value={row.work_orders_count}
                              />

                              <MobileScore
                                label="Conf. mecánica"
                                value={row.mechanical_reliability_score}
                              />

                              <MobileScore
                                label="Crit. servicio"
                                value={row.service_criticality}
                              />

                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Seguridad
                                </p>

                                {row.has_checklist ? (
                                  <Badge
                                    className={`${getScoreBadgeClass(
                                      row.security_score,
                                    )} mt-1 border`}
                                  >
                                    {row.security_score}
                                  </Badge>
                                ) : (
                                  <Badge className="mt-1 border border-orange-200 bg-orange-100 text-orange-800">
                                    --
                                  </Badge>
                                )}
                              </div>

                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Reemplazo
                                </p>

                                {isEditing ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    max={5}
                                    value={editingValues.replacement_score}
                                    onChange={(event) =>
                                      updateEditingValue(
                                        "replacement_score",
                                        event.target.value,
                                      )
                                    }
                                    className="mt-1 h-9 rounded-lg"
                                  />
                                ) : (
                                  <Badge
                                    className={`${getScoreBadgeClass(
                                      row.replacement_score,
                                    )} mt-1 border`}
                                  >
                                    {row.replacement_score}
                                  </Badge>
                                )}
                              </div>

                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Total
                                </p>

                                <Badge
                                  className={`${getTotalBadgeClass(
                                    row.total_criticality,
                                  )} mt-1 border`}
                                >
                                  {row.total_criticality ?? "--"}
                                </Badge>
                              </div>
                            </div>

                            <div className="flex justify-end border-t pt-3">
                              {isEditing ? (
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => saveEditing(row.vehicle_code)}
                                    disabled={isSaving}
                                    className="h-8 gap-1 rounded-lg"
                                  >
                                    {isSaving ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                    Guardar
                                  </Button>

                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEditing}
                                    disabled={isSaving}
                                    className="h-8 gap-1 rounded-lg"
                                  >
                                    <X className="h-4 w-4" />
                                    Cancelar
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditing(row)}
                                  className="h-8 gap-1 rounded-lg"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Editar reemplazo
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MutedCell() {
  return (
    <td className="px-3 py-3 text-center">
      <span className="text-muted-foreground">--</span>
    </td>
  );
}

function ReadOnlyScoreCell({ value }: { value: number }) {
  return (
    <td className="px-3 py-3 text-center">
      <Badge className={`${getScoreBadgeClass(value)} border`}>{value}</Badge>
    </td>
  );
}

function EditableReplacementCell({
  isEditing,
  value,
  inputValue,
  onChange,
}: {
  isEditing: boolean;
  value: number;
  inputValue: string;
  onChange: (value: string) => void;
}) {
  if (isEditing) {
    return (
      <td className="px-3 py-3 text-center">
        <Input
          type="number"
          min={0}
          max={5}
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
          className="mx-auto h-8 w-20 rounded-lg text-center"
        />
      </td>
    );
  }

  return (
    <td className="px-3 py-3 text-center">
      <Badge className={`${getScoreBadgeClass(value)} border`}>{value}</Badge>
    </td>
  );
}

function SummaryCard({
  title,
  value,
  description,
  active,
  onClick,
}: {
  title: string;
  value: number;
  description: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card
        className={`h-full transition hover:border-primary/50 hover:shadow-md ${
          active ? "border-primary bg-primary/5" : ""
        }`}
      >
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Gauge className="h-5 w-5 text-primary" />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function MobileScore({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <Badge className={`${getScoreBadgeClass(value)} mt-1 border`}>
        {value}
      </Badge>
    </div>
  );
}

function CriticalityChartCard({
  data,
  total,
  loading,
}: {
  data: { key: string; name: string; value: number; color: string }[];
  total: number;
  loading: boolean;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PieChartIcon className="h-5 w-5 text-[#00A27F]" />
          Distribución de criticidad
        </CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cargando gráfico...
          </div>
        ) : total === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No hay datos para mostrar.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    innerRadius={45}
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      `${name} ${((percent || 0) * 100).toFixed(1)}%`
                    }
                  >
                    {data.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>

                  <RechartsTooltip
                    formatter={(value, name) => {
                      const numericValue = Number(value ?? 0);

                      const percent =
                        total > 0
                          ? ((numericValue / total) * 100).toFixed(1)
                          : "0.0";

                      return [
                        `${numericValue} vehículos (${percent}%)`,
                        String(name ?? ""),
                      ];
                    }}
                  />

                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {data.map((item) => {
                const percent =
                  total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0";

                return (
                  <div
                    key={item.key}
                    className="rounded-xl border bg-muted/20 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />

                      <p className="text-sm font-medium">{item.name}</p>
                    </div>

                    <p className="mt-2 text-2xl font-bold">{item.value}</p>
                    <p className="text-xs text-muted-foreground">
                      {percent}% del total
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CriticalityLegendCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Info className="h-5 w-5 text-[#00A27F]" />
          Criterios utilizados para el cálculo de criticidad
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div className="space-y-2">
          <p>
            <strong className="text-foreground">Confiabilidad Mecánica:</strong>{" "}
            se calcula a partir de la cantidad de órdenes de trabajo registradas
            para cada vehículo en los últimos 6 meses, excluyendo aquellas
            cargadas como “Mantenimiento”.
          </p>

          <p>
            <strong className="text-foreground">Criticidad del Servicio:</strong>{" "}
            según la necesidad de contar con el vehículo para realizar el
            servicio en tiempo y forma.
          </p>

          <p className="rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed">
            <strong className="text-foreground">
              Referencias Criticidad del Servicio:
            </strong>{" "}
            RE=5; CT=3; DF=3; M=5; R=2; CYD=3; GRÚA=4; TRA=2.
          </p>

          <p>
            <strong className="text-foreground">Reemplazo:</strong> según la
            posibilidad o necesidad de reemplazar el vehículo para no afectar la
            prestación del servicio.
          </p>

          <p className="rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed">
            <strong className="text-foreground">Escala de reemplazo:</strong>{" "}
            RD=2; RE=5; Palas=5; B=5; M=4; R=1; CYD=3; GR=3; O=1.
          </p>

          <p>
            <strong className="text-foreground">Seguridad:</strong> surge del
            resultado de la última checklist vehicular realizada sobre cada
            unidad.
          </p>

          <p>
            <strong className="text-foreground">Sin checklist:</strong> sólo se
            consideran vehículos activos y operativos que nunca tuvieron checklist
            cargada. No se calcula la criticidad total porque no se puede determinar
            la seguridad.
          </p>

          <p>
            <strong className="text-foreground">Fuera de servicio:</strong> el
            estado operativo se toma desde Planta Vehicular. La unidad queda visible
            para control, pero se excluye temporalmente del cálculo de criticidad y
            no cuenta dentro de “Sin checklist”.
          </p>

          <p>
            <strong className="text-foreground">Dados de baja:</strong> se toman
            automáticamente desde Planta Vehicular. Quedan visibles para control,
            pero se excluyen del cálculo de criticidad.
          </p>

          <p>
            <strong className="text-foreground">Regadores (C):</strong> se
            excluye porque no representa un vehículo individual.
          </p>
        </div>

        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="mb-3 font-semibold text-foreground">
            Referencias de siglas utilizadas
          </p>

          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            <p>
              <strong>RD:</strong> Recolección Domiciliaria / Recolectoras
            </p>
            <p>
              <strong>RE:</strong> Recolección Especial
            </p>
            <p>
              <strong>CT:</strong> Contenedores / Porta Contenedores
            </p>
            <p>
              <strong>DF:</strong> Disposición Final
            </p>
            <p>
              <strong>M:</strong> Motoniveladoras
            </p>
            <p>
              <strong>R:</strong> Regadores
            </p>
            <p>
              <strong>CYD:</strong> Canales y Desagües
            </p>
            <p>
              <strong>GR / GRÚA:</strong> Grúa
            </p>
            <p>
              <strong>TRA:</strong> Tractores
            </p>
            <p>
              <strong>B:</strong> Barrido
            </p>
            <p>
              <strong>O:</strong> Otros vehículos
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="mb-3 font-semibold text-foreground">
            Escala de criticidad final
          </p>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Badge className="border border-green-200 bg-green-100 text-green-800">
                1 a 9
              </Badge>
              <p>
                <strong className="text-foreground">Baja:</strong> estado
                aceptable.
              </p>
            </div>

            <div className="flex items-start gap-2">
              <Badge className="border border-yellow-200 bg-yellow-100 text-yellow-800">
                10 a 12
              </Badge>
              <p>
                <strong className="text-foreground">Media:</strong> requiere
                seguimiento.
              </p>
            </div>

            <div className="flex items-start gap-2">
              <Badge className="border border-red-200 bg-red-100 text-red-800">
                13 a 20
              </Badge>
              <p>
                <strong className="text-foreground">Crítica:</strong> requiere
                atención prioritaria.
              </p>
            </div>

            <div className="flex items-start gap-2">
              <Badge className="border border-orange-200 bg-orange-100 text-orange-800">
                --
              </Badge>
              <p>
                <strong className="text-foreground">Sin checklist:</strong> no
                se calcula criticidad total.
              </p>
            </div>

            <div className="flex items-start gap-2">
              <Badge className="border border-slate-300 bg-slate-100 text-slate-700">
                F/S
              </Badge>
              <p>
                <strong className="text-foreground">Fuera de servicio:</strong>{" "}
                excluido temporalmente del cálculo.
              </p>
            </div>

            <div className="flex items-start gap-2">
              <Badge className="border border-slate-300 bg-slate-100 text-slate-800">
                Baja
              </Badge>
              <p>
                <strong className="text-foreground">Dado de baja:</strong>{" "}
                excluido del cálculo.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}