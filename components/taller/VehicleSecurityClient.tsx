"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  ClipboardCheck,
  ChevronDown,
  Check,
  Layers3,
  Eye,
  FileText,
  Filter,
  Loader2,
  Pencil,
  PlusCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";

type ChecklistValue = "ok" | "bad" | "obs" | "" | null | undefined;

type VehicleSecurityInspection = {
  id: string;
  inspection_date: string;
  vehicle_code: string;
  vehicle: string | null;
  vehicle_type: string | null;
  license_plate: string | null;
  area: string | null;
  raw_score: number | null;
  state_percent: number | null;
  security_score: number;
  observations: string | null;
  created_at: string;
  updated_at: string;

  micas_del?: ChecklistValue;
  balizas_del?: ChecklistValue;
  altas_del?: ChecklistValue;
  bajas_del?: ChecklistValue;
  posicion_del?: ChecklistValue;
  ginios_del?: ChecklistValue;

  micas_tras?: ChecklistValue;
  balizas_tras?: ChecklistValue;
  ginios_tras?: ChecklistValue;
  posicion_tras?: ChecklistValue;
  stop_tras?: ChecklistValue;
  reversa_tras?: ChecklistValue;
  alarma_retro?: ChecklistValue;

  parabrisa_delantero?: ChecklistValue;
  parabrisa_trasero?: ChecklistValue;
  parabrisas_laterales?: ChecklistValue;
  limpia_parabrisas?: ChecklistValue;
  espejos?: ChecklistValue;

  anclaje_asientos?: ChecklistValue;
  cinturones_seguridad?: ChecklistValue;
  bocina?: ChecklistValue;
  espejo_ret_central?: ChecklistValue;
  freno_mano_bloqueo?: ChecklistValue;
  tablero_indicadores?: ChecklistValue;

  puerta_lado_conductor?: ChecklistValue;
  puerta_lado_acompanante?: ChecklistValue;
  baul_porton_trasero?: ChecklistValue;

  eje_delantero?: ChecklistValue;
  eje_trasero?: ChecklistValue;
  eje_dual?: ChecklistValue;

  documentacion_completa?: ChecklistValue;
  chapa_patente_delantera?: ChecklistValue;
  chapa_patente_trasera?: ChecklistValue;
  calcos_reflectivos?: ChecklistValue;
  extintor?: ChecklistValue;
  conos_balizas?: ChecklistValue;
  guardabarros_barreros?: ChecklistValue;

  botiquin?: ChecklistValue;
  calcos_municipio?: ChecklistValue;
  calco_codigo_vehiculo?: ChecklistValue;
};

type SecurityFilter = "Todos" | "Bueno" | "Regular" | "Crítico";
type ViewMode = "history" | "latest";
type ReportType = "lights" | "body" | "other" | "custom";

const ESTADO_GENERAL_PATH =
  "/dashboard/taller/ordenes-trabajo/criticidad/estado-general";

const getValidSecurityFilter = (value: string | null): SecurityFilter => {
  if (value === "Bueno" || value === "Regular" || value === "Crítico") {
    return value;
  }

  return "Todos";
};

const getValidViewMode = (value: string | null): ViewMode => {
  return value === "latest" ? "latest" : "history";
};

type ChecklistReportField = {
  key: keyof VehicleSecurityInspection;
  label: string;
};

const LIGHT_REPORT_FIELDS: ChecklistReportField[] = [
  { key: "micas_del", label: "Micas delanteras" },
  { key: "balizas_del", label: "Balizas delanteras" },
  { key: "altas_del", label: "Luces altas delanteras" },
  { key: "bajas_del", label: "Luces bajas delanteras" },
  { key: "posicion_del", label: "Luces de posición delanteras" },
  { key: "ginios_del", label: "Guiños delanteros" },

  { key: "micas_tras", label: "Micas traseras" },
  { key: "balizas_tras", label: "Balizas traseras" },
  { key: "ginios_tras", label: "Guiños traseros" },
  { key: "posicion_tras", label: "Luces de posición traseras" },
  { key: "stop_tras", label: "Luces de stop traseras" },
  { key: "reversa_tras", label: "Luces de reversa" },
  { key: "alarma_retro", label: "Alarma de retroceso" },
];

const BODY_REPORT_FIELDS: ChecklistReportField[] = [
  { key: "puerta_lado_conductor", label: "Puerta lado conductor" },
  { key: "puerta_lado_acompanante", label: "Puerta lado acompañante" },
  { key: "baul_porton_trasero", label: "Baúl / portón trasero" },

  { key: "guardabarros_barreros", label: "Guardabarros / barreros" },
  { key: "chapa_patente_delantera", label: "Chapa patente delantera" },
  { key: "chapa_patente_trasera", label: "Chapa patente trasera" },
  { key: "calcos_reflectivos", label: "Calcos reflectivos" },
  { key: "calcos_municipio", label: "Calcos del municipio" },
  { key: "calco_codigo_vehiculo", label: "Calco código vehículo" },

  { key: "parabrisa_delantero", label: "Parabrisa delantero" },
  { key: "parabrisa_trasero", label: "Parabrisa trasero" },
  { key: "parabrisas_laterales", label: "Parabrisas laterales" },
  { key: "limpia_parabrisas", label: "Limpia parabrisas" },
  { key: "espejos", label: "Espejos" },
];

const OTHER_REPORT_FIELDS: ChecklistReportField[] = [
  { key: "botiquin", label: "Botiquín" },
  { key: "calcos_municipio", label: "Calcos del municipio" },
  { key: "calco_codigo_vehiculo", label: "Calco código vehículo" },
];

const REPORT_FIELD_GROUPS: Array<{
  title: string;
  fields: ChecklistReportField[];
}> = [
  { title: "Luces delanteras y traseras", fields: LIGHT_REPORT_FIELDS },
  {
    title: "Cristales y espejos",
    fields: [
      { key: "parabrisa_delantero", label: "Parabrisas delantero" },
      { key: "parabrisa_trasero", label: "Parabrisas trasero" },
      { key: "parabrisas_laterales", label: "Cristales laterales" },
      { key: "limpia_parabrisas", label: "Limpiaparabrisas" },
      { key: "espejos", label: "Espejos" },
    ],
  },
  {
    title: "Seguridad y cabina",
    fields: [
      { key: "anclaje_asientos", label: "Anclaje de asientos" },
      { key: "cinturones_seguridad", label: "Cinturones de seguridad" },
      { key: "bocina", label: "Bocina" },
      { key: "espejo_ret_central", label: "Espejo retrovisor central" },
      { key: "freno_mano_bloqueo", label: "Freno de mano / bloqueo" },
      { key: "tablero_indicadores", label: "Tablero de indicadores" },
    ],
  },
  {
    title: "Carrocería y puertas",
    fields: [
      { key: "puerta_lado_conductor", label: "Puerta lado conductor" },
      { key: "puerta_lado_acompanante", label: "Puerta lado acompañante" },
      { key: "baul_porton_trasero", label: "Baúl / portón trasero" },
      { key: "guardabarros_barreros", label: "Guardabarros / barreros" },
    ],
  },
  {
    title: "Ejes",
    fields: [
      { key: "eje_delantero", label: "Eje delantero" },
      { key: "eje_trasero", label: "Eje trasero" },
      { key: "eje_dual", label: "Eje dual" },
    ],
  },
  {
    title: "Reglamentarios",
    fields: [
      { key: "documentacion_completa", label: "Documentación completa" },
      { key: "chapa_patente_delantera", label: "Chapa patente delantera" },
      { key: "chapa_patente_trasera", label: "Chapa patente trasera" },
      { key: "calcos_reflectivos", label: "Calcos reflectivos" },
      { key: "extintor", label: "Extintor" },
      { key: "conos_balizas", label: "Conos / balizas" },
    ],
  },
  { title: "Otros", fields: OTHER_REPORT_FIELDS },
];

const ALL_REPORT_FIELDS = REPORT_FIELD_GROUPS.flatMap((group) => group.fields);

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "-";

  const [year, month, day] = dateString.split("-").map(Number);

  if (year && month && day) {
    return new Date(year, month - 1, day).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  return dateString;
};

const getDateTime = (inspection: VehicleSecurityInspection) => {
  const inspectionDate = inspection.inspection_date
    ? new Date(`${inspection.inspection_date}T00:00:00`).getTime()
    : 0;

  const createdDate = inspection.created_at
    ? new Date(inspection.created_at).getTime()
    : 0;

  return inspectionDate || createdDate || 0;
};

const isLatestInspectionForVehicle = (
  inspection: VehicleSecurityInspection,
  latestInspections: VehicleSecurityInspection[],
) => {
  return latestInspections.some(
    (latest) =>
      latest.vehicle_code === inspection.vehicle_code &&
      latest.id === inspection.id,
  );
};

const getSecurityStatus = (
  statePercent: number | null | undefined,
): Exclude<SecurityFilter, "Todos"> => {
  const percent = Number(statePercent ?? 0);

  if (percent <= 70) return "Crítico";
  if (percent < 80) return "Regular";
  return "Bueno";
};

const getSecurityBadgeClass = (score: number) => {
  if (score >= 4) return "border-red-200 bg-red-100 text-red-800";
  if (score >= 2) return "border-yellow-200 bg-yellow-100 text-yellow-800";
  return "border-green-200 bg-green-100 text-green-800";
};

const getStatusBadgeClass = (status: SecurityFilter) => {
  if (status === "Crítico") return "border-red-200 bg-red-100 text-red-800";
  if (status === "Regular")
    return "border-yellow-200 bg-yellow-100 text-yellow-800";
  if (status === "Bueno")
    return "border-green-200 bg-green-100 text-green-800";

  return "border-slate-200 bg-slate-100 text-slate-700";
};

const dateInRange = (
  dateString: string | null | undefined,
  dateFrom: string,
  dateTo: string,
) => {
  if (!dateString) return false;

  if (dateFrom && dateString < dateFrom) return false;
  if (dateTo && dateString > dateTo) return false;

  return true;
};

const hasActiveFilters = ({
  search,
  code,
  plate,
  vehicle,
  direction,
  dateFrom,
  dateTo,
  securityStatus,
  viewMode,
}: {
  search: string;
  code: string;
  plate: string;
  vehicle: string;
  direction: string;
  dateFrom: string;
  dateTo: string;
  securityStatus: SecurityFilter;
  viewMode: ViewMode;
}) => {
  return (
    search.trim() !== "" ||
    code !== "Todos" ||
    plate.trim() !== "" ||
    vehicle.trim() !== "" ||
    direction !== "Todas" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    securityStatus !== "Todos" ||
    viewMode !== "history"
  );
};

const getProblemLabel = (value: ChecklistValue) => {
  if (value === "bad") return "No funciona / roto";
  if (value === "obs") return "Observado / revisar";
  return null;
};

const getReportFields = (
  reportType: ReportType,
  selectedFields: string[] = [],
): ChecklistReportField[] => {
  if (reportType === "lights") return LIGHT_REPORT_FIELDS;
  if (reportType === "body") return BODY_REPORT_FIELDS;
  if (reportType === "other") return OTHER_REPORT_FIELDS;
  return ALL_REPORT_FIELDS.filter((field) => selectedFields.includes(field.key));
};

const getReportTitle = (reportType: ReportType) => {
  if (reportType === "lights") return "INFORME PARA TALLER - LUCES";
  if (reportType === "body") return "INFORME PARA TALLER - CHAPA / CARROCERÍA";
  if (reportType === "other") return "INFORME PARA TALLER - OTROS";
  return "INFORME PARA TALLER - PERSONALIZADO";
};

const getReportFileName = (reportType: ReportType) => {
  if (reportType === "lights") return "informe_luces";
  if (reportType === "body") return "informe_chapa";
  if (reportType === "other") return "informe_otros";
  return "informe_personalizado";
};

const getInspectionProblems = (
  inspection: VehicleSecurityInspection,
  reportType: ReportType,
  selectedFields: string[] = [],
) => {
  const fields = getReportFields(reportType, selectedFields);

  return fields
    .map((field) => {
      const value = inspection[field.key] as ChecklistValue;
      const problem = getProblemLabel(value);
      if (!problem) return null;
      return { label: field.label, value, problem };
    })
    .filter(Boolean) as Array<{
      label: string;
      value: ChecklistValue;
      problem: string;
    }>;
};

export function VehicleSecurityClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [inspections, setInspections] = useState<VehicleSecurityInspection[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [codeFilter, setCodeFilter] = useState(
    () => searchParams.get("code") || "Todos",
  );
  const [plateFilter, setPlateFilter] = useState(
    () => searchParams.get("plate") || "",
  );
  const [vehicleFilter, setVehicleFilter] = useState(
    () => searchParams.get("vehicle") || "",
  );
  const [directionFilter, setDirectionFilter] = useState(
    () => searchParams.get("direction") || "Todas",
  );
  const [dateFromFilter, setDateFromFilter] = useState(
    () => searchParams.get("date_from") || "",
  );
  const [dateToFilter, setDateToFilter] = useState(
    () => searchParams.get("date_to") || "",
  );
  const [securityStatusFilter, setSecurityStatusFilter] =
    useState<SecurityFilter>(() => getValidSecurityFilter(searchParams.get("status")));
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    getValidViewMode(searchParams.get("view")),
  );

  const [inspectionToDelete, setInspectionToDelete] =
    useState<VehicleSecurityInspection | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [reportType, setReportType] = useState<ReportType | null>(null);


  const estadoGeneralUrl = useMemo(() => {
    const params = new URLSearchParams();

    if (search.trim()) params.set("search", search.trim());
    if (codeFilter !== "Todos") params.set("code", codeFilter);
    if (plateFilter.trim()) params.set("plate", plateFilter.trim());
    if (vehicleFilter.trim()) params.set("vehicle", vehicleFilter.trim());
    if (directionFilter !== "Todas") params.set("direction", directionFilter);
    if (dateFromFilter) params.set("date_from", dateFromFilter);
    if (dateToFilter) params.set("date_to", dateToFilter);
    if (securityStatusFilter !== "Todos") {
      params.set("status", securityStatusFilter);
    }
    if (viewMode !== "history") params.set("view", viewMode);

    const queryString = params.toString();

    return `${ESTADO_GENERAL_PATH}${queryString ? `?${queryString}` : ""}`;
  }, [
    search,
    codeFilter,
    plateFilter,
    vehicleFilter,
    directionFilter,
    dateFromFilter,
    dateToFilter,
    securityStatusFilter,
    viewMode,
  ]);

  const encodedReturnTo = useMemo(
    () => encodeURIComponent(estadoGeneralUrl),
    [estadoGeneralUrl],
  );

  const currentUrl = useMemo(() => {
    const currentQueryString = searchParams.toString();

    return `${pathname}${currentQueryString ? `?${currentQueryString}` : ""}`;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (currentUrl === estadoGeneralUrl) return;

    router.replace(estadoGeneralUrl, { scroll: false });
  }, [currentUrl, estadoGeneralUrl, router]);

  const fetchInspections = async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/taller/estado-general", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Error al cargar inspecciones vehiculares",
        );
      }

      setInspections(result.data || []);
    } catch (error) {
      console.error("Error fetching inspections:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al cargar estado general",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, []);

  const sortedInspections = useMemo(() => {
    return [...inspections].sort((a, b) => getDateTime(b) - getDateTime(a));
  }, [inspections]);

  const latestByVehicle = useMemo(() => {
    const map = new Map<string, VehicleSecurityInspection>();

    sortedInspections.forEach((inspection) => {
      const vehicleCode = String(inspection.vehicle_code || "").trim();

      if (!vehicleCode) return;

      const current = map.get(vehicleCode);

      if (!current) {
        map.set(vehicleCode, inspection);
        return;
      }

      if (getDateTime(inspection) > getDateTime(current)) {
        map.set(vehicleCode, inspection);
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => getDateTime(b) - getDateTime(a),
    );
  }, [sortedInspections]);

  const baseInspections = useMemo(() => {
    return viewMode === "latest" ? latestByVehicle : sortedInspections;
  }, [latestByVehicle, sortedInspections, viewMode]);

  const vehicleCodes = useMemo(() => {
    const codes = new Set<string>();

    inspections.forEach((inspection) => {
      const code = String(inspection.vehicle_code || "").trim();

      if (code) codes.add(code);
    });

    return Array.from(codes).sort((a, b) =>
      a.localeCompare(b, "es", { numeric: true }),
    );
  }, [inspections]);

  const directions = useMemo(() => {
    const values = new Set<string>();

    inspections.forEach((inspection) => {
      const direction = String(inspection.area || "").trim();

      if (direction) values.add(direction);
    });

    return Array.from(values).sort((a, b) =>
      a.localeCompare(b, "es", { numeric: true }),
    );
  }, [inspections]);

  const openReportModal = (nextReportType: ReportType) => setReportType(nextReportType);

  const applyCommonFilters = (
    source: VehicleSecurityInspection[],
    options?: {
      includeStatus?: boolean;
      includeDates?: boolean;
    },
  ) => {
    const includeStatus = options?.includeStatus ?? true;
    const includeDates = options?.includeDates ?? true;

    const normalizedSearch = normalizeText(search);
    const normalizedPlate = normalizeText(plateFilter);
    const normalizedVehicle = normalizeText(vehicleFilter);
    const normalizedDirection = normalizeText(directionFilter);

    return source.filter((inspection) => {
      const inspectionStatus = getSecurityStatus(inspection.state_percent);

      const matchesSearch =
        !normalizedSearch ||
        normalizeText(inspection.vehicle_code).includes(normalizedSearch) ||
        normalizeText(inspection.vehicle).includes(normalizedSearch) ||
        normalizeText(inspection.license_plate).includes(normalizedSearch) ||
        normalizeText(inspection.area).includes(normalizedSearch);

      const matchesCode =
        codeFilter === "Todos" || inspection.vehicle_code === codeFilter;

      const matchesPlate =
        !normalizedPlate ||
        normalizeText(inspection.license_plate).includes(normalizedPlate);

      const matchesVehicle =
        !normalizedVehicle ||
        normalizeText(inspection.vehicle).includes(normalizedVehicle);

      const matchesDirection =
        directionFilter === "Todas" ||
        normalizeText(inspection.area) === normalizedDirection;

      const matchesDate =
        !includeDates ||
        (!dateFromFilter && !dateToFilter) ||
        dateInRange(inspection.inspection_date, dateFromFilter, dateToFilter);

      const matchesStatus =
        !includeStatus ||
        securityStatusFilter === "Todos" ||
        inspectionStatus === securityStatusFilter;

      return (
        matchesSearch &&
        matchesCode &&
        matchesPlate &&
        matchesVehicle &&
        matchesDirection &&
        matchesDate &&
        matchesStatus
      );
    });
  };

  const filteredInspections = useMemo(() => {
    return applyCommonFilters(baseInspections, {
      includeStatus: true,
      includeDates: true,
    });
  }, [
    baseInspections,
    search,
    codeFilter,
    plateFilter,
    vehicleFilter,
    directionFilter,
    dateFromFilter,
    dateToFilter,
    securityStatusFilter,
  ]);

  const latestStatsBase = useMemo(() => {
    return applyCommonFilters(latestByVehicle, {
      includeStatus: false,
      includeDates: true,
    });
  }, [
    latestByVehicle,
    search,
    codeFilter,
    plateFilter,
    vehicleFilter,
    directionFilter,
    dateFromFilter,
    dateToFilter,
  ]);

  const historyStatsBase = useMemo(() => {
    return applyCommonFilters(sortedInspections, {
      includeStatus: false,
      includeDates: true,
    });
  }, [
    sortedInspections,
    search,
    codeFilter,
    plateFilter,
    vehicleFilter,
    directionFilter,
    dateFromFilter,
    dateToFilter,
  ]);

  const totalCardValue =
    viewMode === "latest" ? latestStatsBase.length : historyStatsBase.length;

  const goodVehicles = latestStatsBase.filter(
    (inspection) => getSecurityStatus(inspection.state_percent) === "Bueno",
  ).length;

  const regularVehicles = latestStatsBase.filter(
    (inspection) => getSecurityStatus(inspection.state_percent) === "Regular",
  ).length;

  const criticalVehicles = latestStatsBase.filter(
    (inspection) => getSecurityStatus(inspection.state_percent) === "Crítico",
  ).length;

  const activeFilters = hasActiveFilters({
    search,
    code: codeFilter,
    plate: plateFilter,
    vehicle: vehicleFilter,
    direction: directionFilter,
    dateFrom: dateFromFilter,
    dateTo: dateToFilter,
    securityStatus: securityStatusFilter,
    viewMode,
  });

  const clearFilters = () => {
    setSearch("");
    setCodeFilter("Todos");
    setPlateFilter("");
    setVehicleFilter("");
    setDirectionFilter("Todas");
    setDateFromFilter("");
    setDateToFilter("");
    setSecurityStatusFilter("Todos");
    setViewMode("history");
  };

  const handleCardFilter = (status: SecurityFilter) => {
    setSecurityStatusFilter(status);

    if (status === "Todos") {
      setViewMode("history");
      return;
    }

    setViewMode("latest");
  };

  const handleDelete = async () => {
    if (!inspectionToDelete) return;

    try {
      setDeleting(true);

      const response = await fetch(
        `/api/taller/estado-general/${inspectionToDelete.id}`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al eliminar checklist");
      }

      toast.success("Checklist eliminado correctamente");
      setInspectionToDelete(null);
      fetchInspections();
    } catch (error) {
      console.error("Error deleting inspection:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al eliminar checklist",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Button asChild variant="ghost" className="-ml-2 mb-3 gap-2">
              <Link href="/dashboard/taller/ordenes-trabajo/criticidad">
                <ArrowLeft className="h-4 w-4" />
                Volver a criticidad
              </Link>
            </Button>

            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Estado General Vehicular
            </h1>

            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Registro de checklist vehicular para calcular seguridad.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={fetchInspections}
              disabled={loading}
              className="gap-2 rounded-xl"
            >
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => openReportModal("lights")}
              disabled={loading || latestByVehicle.length === 0}
              className="gap-2 rounded-xl"
            >
              <FileText className="h-4 w-4" />
              Informe luces
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => openReportModal("body")}
              disabled={loading || latestByVehicle.length === 0}
              className="gap-2 rounded-xl"
            >
              <FileText className="h-4 w-4" />
              Informe chapa
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => openReportModal("other")}
              disabled={loading || latestByVehicle.length === 0}
              className="gap-2 rounded-xl"
            >
              <FileText className="h-4 w-4" />
              Informe otros
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => openReportModal("custom")}
              disabled={loading || latestByVehicle.length === 0}
              className="gap-2 rounded-xl"
            >
              <Filter className="h-4 w-4" />
              Informe personalizado
            </Button>

            <Button asChild className="gap-2 rounded-xl">
              <Link
                  href={`/dashboard/taller/ordenes-trabajo/criticidad/estado-general/nuevo?returnTo=${encodedReturnTo}`}
                >
                <PlusCircle className="h-4 w-4" />
                Nuevo checklist
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title={
              viewMode === "latest"
                ? "Últimas checklist"
                : "Checklists cargados"
            }
            value={totalCardValue}
            description={
              viewMode === "latest" ? "Una por vehículo" : "Historial completo"
            }
            active={securityStatusFilter === "Todos"}
            onClick={() => handleCardFilter("Todos")}
          />

          <SummaryCard
            title="Vehículos buenos"
            value={goodVehicles}
            description="% Estado 80 o superior"
            active={securityStatusFilter === "Bueno"}
            onClick={() => handleCardFilter("Bueno")}
          />

          <SummaryCard
            title="Vehículos regulares"
            value={regularVehicles}
            description="% Estado mayor a 70 y menor a 80"
            active={securityStatusFilter === "Regular"}
            onClick={() => handleCardFilter("Regular")}
          />

          <SummaryCard
            title="Vehículos críticos"
            value={criticalVehicles}
            description="% Estado 70 o menor"
            active={securityStatusFilter === "Crítico"}
            onClick={() => handleCardFilter("Crítico")}
          />
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-[#00A27F]" />
                  Historial de checklists
                </CardTitle>

                <p className="mt-1 text-sm text-muted-foreground">
                  Cada checklist actualiza la seguridad del vehículo y alimenta
                  la criticidad.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Badge
                  variant="outline"
                  className="w-fit rounded-full px-3 py-1"
                >
                  Vista actual:{" "}
                  {viewMode === "history"
                    ? "Todo el historial"
                    : "Última checklist por vehículo"}
                </Badge>

                <Badge
                  variant="outline"
                  className="w-fit rounded-full px-3 py-1"
                >
                  {filteredInspections.length} de {baseInspections.length}{" "}
                  registros
                </Badge>
              </div>
            </div>

            <div className="rounded-2xl border bg-muted/20 p-3 sm:p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Filter className="h-4 w-4 text-[#00A27F]" />
                Filtros
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                  <label className="mb-1 block text-xs font-medium">
                    Buscar
                  </label>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Código, vehículo, dominio o dirección..."
                      className="h-10 rounded-xl pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium">
                    Código
                  </label>

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
                  <label className="mb-1 block text-xs font-medium">
                    Dirección
                  </label>

                  <select
                    value={directionFilter}
                    onChange={(event) => setDirectionFilter(event.target.value)}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  >
                    <option value="Todas">Todas</option>

                    {directions.map((direction) => (
                      <option key={direction} value={direction}>
                        {direction}
                      </option>
                    ))}
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
                    Estado
                  </label>

                  <select
                    value={securityStatusFilter}
                    onChange={(event) => {
                      const nextStatus = event.target.value as SecurityFilter;

                      setSecurityStatusFilter(nextStatus);

                      if (nextStatus !== "Todos") {
                        setViewMode("latest");
                      }
                    }}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Bueno">Bueno</option>
                    <option value="Regular">Regular</option>
                    <option value="Crítico">Crítico</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium">
                    Desde
                  </label>

                  <Input
                    type="date"
                    value={dateFromFilter}
                    onChange={(event) => setDateFromFilter(event.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium">
                    Hasta
                  </label>

                  <Input
                    type="date"
                    value={dateToFilter}
                    onChange={(event) => setDateToFilter(event.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                  <label className="mb-1 block text-xs font-medium">
                    Vista
                  </label>

                  <select
                    value={viewMode}
                    onChange={(event) =>
                      setViewMode(event.target.value as ViewMode)
                    }
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  >
                    <option value="history">Todo el historial</option>
                    <option value="latest">
                      Última checklist por vehículo
                    </option>
                  </select>
                </div>

                <div className="flex items-end sm:col-span-2 lg:col-span-1 xl:col-span-2">
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
                Cargando checklists...
              </div>
            ) : filteredInspections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Truck className="mb-3 h-10 w-10" />
                <p>No hay checklists para los filtros aplicados.</p>
                <p className="mt-1 text-sm">
                  Probá limpiar filtros o cargar un nuevo estado general.
                </p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto rounded-xl border lg:block">
                  <table className="w-full min-w-[1150px] border-collapse text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-3 text-left font-semibold">
                          Fecha
                        </th>
                        <th className="px-3 py-3 text-left font-semibold">
                          Código
                        </th>
                        <th className="px-3 py-3 text-left font-semibold">
                          Vehículo
                        </th>
                        <th className="px-3 py-3 text-left font-semibold">
                          Dominio
                        </th>
                        <th className="px-3 py-3 text-left font-semibold">
                          Dirección
                        </th>
                        <th className="px-3 py-3 text-center font-semibold">
                          Puntaje
                        </th>
                        <th className="px-3 py-3 text-center font-semibold">
                          % Estado
                        </th>
                        <th className="px-3 py-3 text-center font-semibold">
                          Seguridad
                        </th>
                        <th className="px-3 py-3 text-center font-semibold">
                          Estado
                        </th>
                        <th className="px-3 py-3 text-center font-semibold">
                          Actual
                        </th>
                        <th className="px-3 py-3 text-center font-semibold">
                          Acciones
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredInspections.map((inspection) => {
                        const status = getSecurityStatus(
                          inspection.state_percent,
                        );

                        const isLatest = isLatestInspectionForVehicle(
                          inspection,
                          latestByVehicle,
                        );

                        return (
                          <tr key={inspection.id} className="border-t">
                            <td className="px-3 py-3">
                              {formatDate(inspection.inspection_date)}
                            </td>

                            <td className="px-3 py-3 font-semibold">
                              {inspection.vehicle_code}
                            </td>

                            <td className="px-3 py-3">
                              {inspection.vehicle || "-"}
                            </td>

                            <td className="px-3 py-3">
                              {inspection.license_plate || "-"}
                            </td>

                            <td className="px-3 py-3">
                              {inspection.area || "-"}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {inspection.raw_score ?? "-"}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {inspection.state_percent !== null &&
                                inspection.state_percent !== undefined
                                ? `${inspection.state_percent}%`
                                : "-"}
                            </td>

                            <td className="px-3 py-3 text-center">
                              <Badge
                                className={`${getSecurityBadgeClass(
                                  inspection.security_score,
                                )} border`}
                              >
                                {inspection.security_score}
                              </Badge>
                            </td>

                            <td className="px-3 py-3 text-center">
                              <Badge
                                className={`${getStatusBadgeClass(
                                  status,
                                )} border`}
                              >
                                {status.toUpperCase()}
                              </Badge>
                            </td>

                            <td className="px-3 py-3 text-center">
                              {isLatest ? (
                                <Badge className="border border-primary/20 bg-primary/10 text-primary">
                                  Última
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>

                            <td className="px-3 py-3">
                              <Actions
                                inspection={inspection}
                                encodedReturnTo={encodedReturnTo}
                                onDelete={() =>
                                  setInspectionToDelete(inspection)
                                }
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 lg:hidden">
                  {filteredInspections.map((inspection) => {
                    const status = getSecurityStatus(inspection.state_percent);

                    const isLatest = isLatestInspectionForVehicle(
                      inspection,
                      latestByVehicle,
                    );

                    return (
                      <Card key={inspection.id} className="overflow-hidden">
                        <CardContent className="space-y-4 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(inspection.inspection_date)}
                              </p>

                              <p className="mt-1 text-lg font-bold">
                                {inspection.vehicle_code}
                              </p>

                              <p className="text-sm font-medium">
                                {inspection.vehicle || "-"}
                              </p>

                              <p className="text-xs text-muted-foreground">
                                Dominio: {inspection.license_plate || "-"}
                              </p>
                            </div>

                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <Badge
                                className={`${getStatusBadgeClass(
                                  status,
                                )} border`}
                              >
                                {status.toUpperCase()}
                              </Badge>

                              {isLatest && (
                                <Badge className="border border-primary/20 bg-primary/10 text-primary">
                                  Última
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <MobileInfo
                              label="Dirección"
                              value={inspection.area || "-"}
                            />
                            <MobileInfo
                              label="Puntaje"
                              value={String(inspection.raw_score ?? "-")}
                            />
                            <MobileInfo
                              label="% Estado"
                              value={
                                inspection.state_percent !== null &&
                                  inspection.state_percent !== undefined
                                  ? `${inspection.state_percent}%`
                                  : "-"
                              }
                            />
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Seguridad
                              </p>
                              <Badge
                                className={`${getSecurityBadgeClass(
                                  inspection.security_score,
                                )} mt-1 border`}
                              >
                                {inspection.security_score}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex justify-end border-t pt-3">
                            <Actions
                              inspection={inspection}
                              encodedReturnTo={encodedReturnTo}
                              onDelete={() =>
                                setInspectionToDelete(inspection)
                              }
                            />
                          </div>
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

      {reportType && (
        <VehicleReportModal
          reportType={reportType}
          latestByVehicle={latestByVehicle}
          onClose={() => setReportType(null)}
        />
      )}

      <AlertDialog
        open={!!inspectionToDelete}
        onOpenChange={(open) => {
          if (!open) setInspectionToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar checklist?</AlertDialogTitle>

            <AlertDialogDescription>
              Se eliminará el checklist de{" "}
              <strong>{inspectionToDelete?.vehicle_code}</strong>. Luego se
              recalculará la seguridad del vehículo según el último checklist
              disponible.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>

            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


// El estado del generador permanece aislado de la tabla principal.
// Las selecciones y búsquedas del modal ya no vuelven a renderizar los 216 checklists.
function VehicleReportModal({
  reportType,
  latestByVehicle,
  onClose,
}: {
  reportType: ReportType;
  latestByVehicle: VehicleSecurityInspection[];
  onClose: () => void;
}) {
  const [selectedReportFields, setSelectedReportFields] = useState<string[]>([]);
  const [reportFieldSearch, setReportFieldSearch] = useState("");
  const [expandedReportGroups, setExpandedReportGroups] = useState<string[]>([]);
  const [selectedReportVehicle, setSelectedReportVehicle] = useState("all");
  const [generatingReport, setGeneratingReport] = useState(false);

  const reportVehicles = useMemo(() => {
    if (!reportType) return [];

    return latestByVehicle
      .map((inspection) => ({
        inspection,
        problems: getInspectionProblems(inspection, reportType, selectedReportFields),
      }))
      .filter((item) => item.problems.length > 0)
      .sort((a, b) =>
        a.inspection.vehicle_code.localeCompare(b.inspection.vehicle_code, "es", {
          numeric: true,
        }),
      );
  }, [latestByVehicle, reportType, selectedReportFields]);

  // La vista previa y el PDF usan exactamente la misma selección.
  const selectedReportItems = useMemo(() =>
    selectedReportVehicle === "all"
      ? reportVehicles
      : reportVehicles.filter((item) => item.inspection.id === selectedReportVehicle),
    [reportVehicles, selectedReportVehicle],
  );

  const closeReportModal = () => {
    if (generatingReport) return;

    onClose();
  };

  const generateReportPdf = async () => {
    if (!reportType) return;
    if (reportType === "custom" && selectedReportFields.length === 0) {
      toast.error("Seleccioná al menos un campo para el informe");
      return;
    }

    const selectedItems = selectedReportItems;

    if (selectedItems.length === 0) {
      toast.error("No hay vehículos con problemas para generar el informe");
      return;
    }

    try {
      setGeneratingReport(true);

      const { default: jsPDF } = await import("jspdf");

      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 14;
      const bottomMargin = 16;
      let y = 16;

      const addPageIfNeeded = (neededHeight = 20) => {
        if (y + neededHeight <= pageHeight - bottomMargin) return;

        doc.addPage();
        y = 16;
      };

      const addText = (
        text: string,
        x: number,
        options?: {
          fontSize?: number;
          bold?: boolean;
          color?: [number, number, number];
          maxWidth?: number;
          lineGap?: number;
        },
      ) => {
        const fontSize = options?.fontSize ?? 10;
        const maxWidth = options?.maxWidth ?? pageWidth - marginX * 2;
        const lineGap = options?.lineGap ?? 5;

        doc.setFontSize(fontSize);
        doc.setFont("helvetica", options?.bold ? "bold" : "normal");

        if (options?.color) {
          doc.setTextColor(...options.color);
        } else {
          doc.setTextColor(20, 20, 20);
        }

        const lines = doc.splitTextToSize(text, maxWidth);
        addPageIfNeeded(lines.length * lineGap);

        doc.text(lines, x, y);
        y += lines.length * lineGap;
      };

      doc.setFillColor(0, 162, 127);
      doc.rect(0, 0, pageWidth, 10, "F");

      y = 18;

      addText(getReportTitle(reportType), marginX, {
        fontSize: 15,
        bold: true,
      });

      addText(
        `Fecha de emisión: ${new Date().toLocaleDateString("es-AR")}`,
        marginX,
        {
          fontSize: 9,
          color: [90, 90, 90],
        },
      );

      if (reportType === "custom") {
        addText(`Campos seleccionados: ${getReportFields(reportType, selectedReportFields).map((field) => field.label).join(", ")}`, marginX, {
          fontSize: 9,
          color: [90, 90, 90],
        });
      }

      addText(`Vehículos incluidos: ${selectedItems.length}`, marginX, {
        fontSize: 9,
        color: [90, 90, 90],
      });

      y += 3;

      selectedItems.forEach((item, index) => {
        const inspection = item.inspection;
        const problems = item.problems;

        addPageIfNeeded(45);

        if (index > 0) {
          doc.setDrawColor(220, 220, 220);
          doc.line(marginX, y, pageWidth - marginX, y);
          y += 7;
        }

        addText(
          `${inspection.vehicle_code} - ${inspection.vehicle || "Sin vehículo"}`,
          marginX,
          {
            fontSize: 12,
            bold: true,
          },
        );

        addText(
          `Dominio: ${inspection.license_plate || "-"}   |   Dirección: ${inspection.area || "-"
          }   |   Última checklist: ${formatDate(inspection.inspection_date)}`,
          marginX,
          {
            fontSize: 9,
            color: [90, 90, 90],
          },
        );

        addText(
          `Estado general: ${inspection.state_percent ?? "-"
          }%   |   Seguridad: ${inspection.security_score}`,
          marginX,
          {
            fontSize: 9,
            color: [90, 90, 90],
          },
        );

        y += 2;

        addText("Elementos a revisar / reparar:", marginX, {
          fontSize: 10,
          bold: true,
        });

        problems.forEach((problem) => {
          addText(`• ${problem.label}: ${problem.problem}`, marginX + 3, {
            fontSize: 9,
            maxWidth: pageWidth - marginX * 2 - 3,
          });
        });

        if (inspection.observations?.trim()) {
          y += 1;

          addText(`Observaciones: ${inspection.observations.trim()}`, marginX, {
            fontSize: 9,
            color: [70, 70, 70],
          });
        }

        y += 6;
      });

      const totalPages = doc.getNumberOfPages();

      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Página ${page} de ${totalPages}`,
          pageWidth - marginX,
          pageHeight - 7,
          { align: "right" },
        );
      }

      const fileName = `${getReportFileName(reportType)}_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;

      doc.save(fileName);
      toast.success("Informe generado correctamente");
      onClose();
    } catch (error) {
      console.error("Error generating vehicle report:", error);
      toast.error("No se pudo generar el informe");
    } finally {
      setGeneratingReport(false);
    }
  };


  return (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-background p-5 shadow-xl">
            <div className="mb-4">
              <h2 className="text-lg font-bold">
                {reportType === "lights"
                  ? "Generar informe de luces"
                  : reportType === "body"
                    ? "Generar informe de chapa"
                    : reportType === "other"
                      ? "Generar informe de otros"
                      : "Generar informe personalizado"}
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Se toma la última checklist de cada vehículo. Podés generar un
                informe general o elegir un vehículo puntual.
              </p>
            </div>

            <div className="space-y-3">
              {reportType === "custom" && (
                <section className="overflow-hidden rounded-2xl border border-border/80 bg-muted/20">
                  <div className="space-y-3 border-b border-border/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                          <Layers3 className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold">Seleccioná qué querés evaluar</h3>
                          <p className="text-xs text-muted-foreground">Elegí categorías completas o elementos puntuales.</p>
                        </div>
                      </div>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500">
                        {selectedReportFields.length} de {ALL_REPORT_FIELDS.length} seleccionados
                      </span>
                    </div>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={reportFieldSearch}
                        onChange={(event) => setReportFieldSearch(event.target.value)}
                        placeholder="Buscar botiquín, extintor, luces, calcos..."
                        className="h-10 rounded-xl bg-background pl-9"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" className="h-8 rounded-full text-xs"
                        onClick={() => setSelectedReportFields(ALL_REPORT_FIELDS.map((field) => String(field.key)))}>
                        <Check className="mr-1 h-3.5 w-3.5" /> Seleccionar todo
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-8 rounded-full text-xs"
                        disabled={selectedReportFields.length === 0}
                        onClick={() => setSelectedReportFields([])}>
                        <X className="mr-1 h-3.5 w-3.5" /> Limpiar selección
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[310px] space-y-2 overflow-y-auto p-3 [scrollbar-color:theme(colors.zinc.600)_transparent] [scrollbar-width:thin]">
                    {REPORT_FIELD_GROUPS.filter((group) =>
                      !reportFieldSearch.trim() ||
                      normalizeText(group.title).includes(normalizeText(reportFieldSearch)) ||
                      group.fields.some((field) => normalizeText(field.label).includes(normalizeText(reportFieldSearch)))
                    ).map((group) => {
                      const keys = group.fields.map((field) => String(field.key));
                      const count = keys.filter((key) => selectedReportFields.includes(key)).length;
                      const allSelected = count === keys.length;
                      const searching = Boolean(reportFieldSearch.trim());
                      const groupMatches = normalizeText(group.title).includes(normalizeText(reportFieldSearch));
                      const visibleFields = searching && !groupMatches
                        ? group.fields.filter((field) => normalizeText(field.label).includes(normalizeText(reportFieldSearch)))
                        : group.fields;
                      const expanded = searching || expandedReportGroups.includes(group.title);
                      return (
                        <div key={group.title} className={`overflow-hidden rounded-xl border transition-colors ${count ? "border-emerald-500/40 bg-emerald-500/[0.035]" : "border-border/70 bg-background/70"}`}>
                          <div className="flex items-center gap-2 p-2">
                            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60"
                              onClick={() => setExpandedReportGroups((previous) => previous.includes(group.title) ? previous.filter((title) => title !== group.title) : [...previous, group.title])}>
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${count ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                                <ClipboardCheck className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold">{group.title}</div>
                                <div className="text-[11px] text-muted-foreground">{count} de {keys.length} elementos</div>
                              </div>
                              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                            </button>
                            <button type="button" title={allSelected ? "Quitar categoría" : "Seleccionar categoría"}
                              aria-label={`${allSelected ? "Quitar" : "Seleccionar"} ${group.title}`}
                              onClick={() => setSelectedReportFields((previous) => allSelected ? previous.filter((key) => !keys.includes(key)) : Array.from(new Set([...previous, ...keys])))}
                              className={`flex h-8 shrink-0 items-center rounded-lg border px-3 text-xs font-medium transition-colors ${allSelected ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-500" : "border-border hover:border-emerald-500/50 hover:text-emerald-500"}`}>
                              {allSelected ? <><Check className="mr-1 h-3 w-3" /> Completa</> : "Elegir todos"}
                            </button>
                          </div>
                          {expanded && (
                            <div className="grid grid-cols-1 gap-2 border-t border-border/60 p-3 sm:grid-cols-2">
                              {visibleFields.map((field) => {
                                const key = String(field.key);
                                const selected = selectedReportFields.includes(key);
                                return (
                                  <button key={key} type="button" aria-pressed={selected}
                                    onClick={() => setSelectedReportFields((previous) => selected ? previous.filter((item) => item !== key) : [...previous, key])}
                                    className={`flex min-h-10 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-all ${selected ? "border-emerald-500/50 bg-emerald-500/10 text-foreground" : "border-border/80 bg-background/80 text-muted-foreground hover:border-emerald-500/40 hover:bg-muted/50 hover:text-foreground"}`}>
                                    <span className={`flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-md border ${selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40"}`}>
                                      {selected && <Check className="h-3 w-3 stroke-[3]" />}
                                    </span>
                                    {field.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {REPORT_FIELD_GROUPS.every((group) => !normalizeText(group.title).includes(normalizeText(reportFieldSearch)) && !group.fields.some((field) => normalizeText(field.label).includes(normalizeText(reportFieldSearch))) ) && (
                      <p className="py-6 text-center text-sm text-muted-foreground">No encontramos campos con esa búsqueda.</p>
                    )}
                  </div>
                  <div className="border-t border-border/70 bg-background/50 px-4 py-2.5 text-xs text-muted-foreground">
                    El PDF incluirá únicamente los elementos seleccionados que estén rotos u observados.
                  </div>
                </section>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Vehículo
                </label>

                <select
                  value={selectedReportVehicle}
                  onChange={(event) =>
                    setSelectedReportVehicle(event.target.value)
                  }
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="all">
                    Todos los vehículos con problemas detectados (
                    {reportVehicles.length})
                  </option>

                  {reportVehicles.map((item) => (
                    <option
                      key={item.inspection.id}
                      value={item.inspection.id}
                    >
                      {item.inspection.vehicle_code} -{" "}
                      {item.inspection.vehicle || "Sin vehículo"} -{" "}
                      {item.inspection.license_plate || "Sin dominio"} (
                      {item.problems.length} problema
                      {item.problems.length === 1 ? "" : "s"})
                    </option>
                  ))}
                </select>
              </div>

              {reportType === "custom" && selectedReportFields.length === 0 && (
                <p className="text-sm text-muted-foreground">Elegí al menos un campo para consultar vehículos con problemas.</p>
              )}

              {reportVehicles.length === 0 && (reportType !== "custom" || selectedReportFields.length > 0) && (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                  No se detectaron problemas para este tipo de informe en las
                  últimas checklists.
                </div>
              )}

              {selectedReportItems.length > 0 && (
                <div className={`rounded-2xl border p-4 text-sm transition-colors ${
                  selectedReportVehicle === "all"
                    ? "border-border bg-muted/20"
                    : "border-emerald-500/40 bg-emerald-500/10"
                }`}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold">
                      {selectedReportVehicle === "all" ? (
                        <Truck className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Check className="h-4 w-4 text-emerald-500" />
                      )}
                      {selectedReportVehicle === "all"
                        ? "Informe general · Todos los vehículos"
                        : "Informe individual · Solo el vehículo seleccionado"}
                    </div>
                    <Badge variant="outline" className="rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-500">
                      {selectedReportItems.length} {selectedReportItems.length === 1 ? "vehículo" : "vehículos"} en el PDF
                    </Badge>
                  </div>
                  <div className={selectedReportVehicle === "all" ? "max-h-40 space-y-1 overflow-y-auto pr-1" : "space-y-1"}>
                    {selectedReportItems.map((item) => (
                      <div key={item.inspection.id} className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                        <p className="font-medium">
                          {item.inspection.vehicle_code} - {item.inspection.vehicle || "Sin vehículo"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Dominio: {item.inspection.license_plate || "-"} · {item.problems.length} {item.problems.length === 1 ? "ítem" : "ítems"} a revisar
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {selectedReportVehicle === "all"
                      ? "El PDF incluirá todos los vehículos de esta lista."
                      : "El PDF incluirá únicamente este vehículo y los problemas detectados en los campos del informe."}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeReportModal}
                disabled={generatingReport}
                className="rounded-xl"
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={generateReportPdf}
                disabled={generatingReport || reportVehicles.length === 0 || (reportType === "custom" && selectedReportFields.length === 0)}
                className="gap-2 rounded-xl"
              >
                {generatingReport ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {selectedReportVehicle === "all"
                  ? `Generar PDF (${selectedReportItems.length} vehículos)`
                  : "Generar PDF individual"}
              </Button>
            </div>
          </div>
        </div>
  );
}


function Actions({
  inspection,
  encodedReturnTo,
  onDelete,
}: {
  inspection: VehicleSecurityInspection;
  encodedReturnTo: string;
  onDelete: () => void;
}) {
  return (
    <div className="flex justify-center gap-2">
      <Button
        asChild
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        title="Ver checklist"
      >
        <Link
          href={`/dashboard/taller/ordenes-trabajo/criticidad/estado-general/${inspection.id}/view?returnTo=${encodedReturnTo}`}
        >
          <Eye className="h-4 w-4" />
        </Link>
      </Button>

      <Button
        asChild
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        title="Editar checklist"
      >
        <Link
          href={`/dashboard/taller/ordenes-trabajo/criticidad/estado-general/${inspection.id}/edit?returnTo=${encodedReturnTo}`}
        >
          <Pencil className="h-4 w-4" />
        </Link>
      </Button>

      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
        title="Eliminar checklist"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
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
        className={`h-full transition hover:border-primary/50 hover:shadow-md ${active ? "border-primary bg-primary/5" : ""
          }`}
      >
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {description}
            </p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function MobileInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}