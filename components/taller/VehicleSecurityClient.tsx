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
type ReportType = "lights" | "body";

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

const getReportFields = (reportType: ReportType) => {
  return reportType === "lights" ? LIGHT_REPORT_FIELDS : BODY_REPORT_FIELDS;
};

const getReportTitle = (reportType: ReportType) => {
  return reportType === "lights"
    ? "INFORME PARA TALLER - LUCES"
    : "INFORME PARA TALLER - CHAPA / CARROCERÍA";
};

const getReportFileName = (reportType: ReportType) => {
  return reportType === "lights" ? "informe_luces" : "informe_chapa";
};

const getInspectionProblems = (
  inspection: VehicleSecurityInspection,
  reportType: ReportType,
) => {
  const fields = getReportFields(reportType);

  return fields
    .map((field) => {
      const value = inspection[field.key] as ChecklistValue;
      const problem = getProblemLabel(value);

      if (!problem) return null;

      return {
        label: field.label,
        value,
        problem,
      };
    })
    .filter(Boolean) as Array<{
      label: string;
      value: ChecklistValue;
      problem: string;
    }>;
};

export function VehicleSecurityClient() {
  const [inspections, setInspections] = useState<VehicleSecurityInspection[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [codeFilter, setCodeFilter] = useState("Todos");
  const [plateFilter, setPlateFilter] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState("Todas");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [securityStatusFilter, setSecurityStatusFilter] =
    useState<SecurityFilter>("Todos");
  const [viewMode, setViewMode] = useState<ViewMode>("history");

  const [inspectionToDelete, setInspectionToDelete] =
    useState<VehicleSecurityInspection | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [selectedReportVehicle, setSelectedReportVehicle] = useState("all");
  const [generatingReport, setGeneratingReport] = useState(false);

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

  const reportVehicles = useMemo(() => {
    if (!reportType) return [];

    return latestByVehicle
      .map((inspection) => ({
        inspection,
        problems: getInspectionProblems(inspection, reportType),
      }))
      .filter((item) => item.problems.length > 0)
      .sort((a, b) =>
        a.inspection.vehicle_code.localeCompare(b.inspection.vehicle_code, "es", {
          numeric: true,
        }),
      );
  }, [latestByVehicle, reportType]);

  const openReportModal = (nextReportType: ReportType) => {
    setReportType(nextReportType);
    setSelectedReportVehicle("all");
  };

  const closeReportModal = () => {
    if (generatingReport) return;

    setReportType(null);
    setSelectedReportVehicle("all");
  };

  const generateReportPdf = async () => {
    if (!reportType) return;

    const selectedItems =
      selectedReportVehicle === "all"
        ? reportVehicles
        : reportVehicles.filter(
          (item) => item.inspection.id === selectedReportVehicle,
        );

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
      closeReportModal();
    } catch (error) {
      console.error("Error generating vehicle report:", error);
      toast.error("No se pudo generar el informe");
    } finally {
      setGeneratingReport(false);
    }
  };

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

            <Button asChild className="gap-2 rounded-xl">
              <Link href="/dashboard/taller/ordenes-trabajo/criticidad/estado-general/nuevo">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border bg-background p-5 shadow-xl">
            <div className="mb-4">
              <h2 className="text-lg font-bold">
                {reportType === "lights"
                  ? "Generar informe de luces"
                  : "Generar informe de chapa"}
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Se toma la última checklist de cada vehículo. Podés generar un
                informe general o elegir un vehículo puntual.
              </p>
            </div>

            <div className="space-y-3">
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

              {reportVehicles.length === 0 && (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                  No se detectaron problemas para este tipo de informe en las
                  últimas checklists.
                </div>
              )}

              {reportVehicles.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-xl border bg-muted/20 p-3 text-sm">
                  <p className="mb-2 font-semibold">
                    Vehículos con problemas detectados:
                  </p>

                  <div className="space-y-1">
                    {reportVehicles.map((item) => (
                      <p key={item.inspection.id}>
                        • <strong>{item.inspection.vehicle_code}</strong> -{" "}
                        {item.inspection.vehicle || "-"} -{" "}
                        {item.inspection.license_plate || "-"}:{" "}
                        {item.problems.length} ítem
                        {item.problems.length === 1 ? "" : "s"} a revisar
                      </p>
                    ))}
                  </div>
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
                disabled={generatingReport || reportVehicles.length === 0}
                className="gap-2 rounded-xl"
              >
                {generatingReport ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Generar PDF
              </Button>
            </div>
          </div>
        </div>
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

function Actions({
  inspection,
  onDelete,
}: {
  inspection: VehicleSecurityInspection;
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
          href={`/dashboard/taller/ordenes-trabajo/criticidad/estado-general/${inspection.id}/view`}
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
          href={`/dashboard/taller/ordenes-trabajo/criticidad/estado-general/${inspection.id}/edit`}
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