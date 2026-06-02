"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  User,
  MapPin,
  Phone,
  FileText,
  Clock,
  CalendarDays,
  History,
  Eye,
  MessageSquareText,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  Complaint,
  Service,
  Cause,
  User as UserType,
  ComplaintHistoryWithUser,
} from "@/types";
import { useUser } from "@/hooks/useUser";

type ComplaintWithDetails = Complaint & {
  service: Service | null;
  cause: Cause | null;
  loaded_by_user: UserType;
};

type ComplaintExtraData = {
  department?: unknown;
  description_type?: unknown;
  level?: unknown;

  depto?: unknown;
  descripcion?: unknown;
  nivel?: unknown;
  agente?: unknown;

  sp_seen?: unknown;
  sp_observations?: unknown;
  sp_resolution_date?: unknown;
};

const FIELD_LABELS: Record<string, string> = {
  complaint_date: "Fecha de reclamo",
  resolution_date: "Fecha de resolución",
  complainant_name: "Nombre y apellido",
  address: "Calle",
  street_number: "Número",
  dni: "DNI",
  phone_number: "Teléfono",
  email: "Email",
  service_id: "Servicio",
  cause_id: "Causa",
  zone: "Tipo de domicilio",
  since_when: "Desde cuándo",
  contact_method: "Medio de contacto",
  details: "Detalle",
  status: "Estado",
  referred: "Derivado",
  latlon: "Lat/Lon",
  extra_data: "Datos adicionales",
};

const getExtraData = (complaint: Complaint): ComplaintExtraData => {
  if (
    complaint.extra_data &&
    typeof complaint.extra_data === "object" &&
    !Array.isArray(complaint.extra_data)
  ) {
    return complaint.extra_data as ComplaintExtraData;
  }

  return {};
};

const getArboladoDepartment = (extra: ComplaintExtraData) => {
  if (typeof extra.department === "string") return extra.department;
  if (typeof extra.depto === "string") return extra.depto;
  return "";
};

const getArboladoLevel = (extra: ComplaintExtraData) => {
  if (typeof extra.level === "string") return extra.level;
  if (typeof extra.nivel === "string") return extra.nivel;
  return "";
};

const getArboladoDescription = (extra: ComplaintExtraData) => {
  if (typeof extra.description_type === "string") return extra.description_type;
  if (typeof extra.descripcion === "string") return extra.descripcion;
  return "";
};

const getArboladoAgent = (extra: ComplaintExtraData) => {
  if (typeof extra.agente === "string") return extra.agente;
  return "";
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const isServiciosPublicosService = (serviceName: string) => {
  const normalized = normalizeText(serviceName);

  return (
    normalized.includes("barrido") ||
    normalized.includes("riego") ||
    normalized.includes("motonivelacion") ||
    normalized.includes("canales y desagues")
  );
};

const getSPTrackingData = (extra: ComplaintExtraData) => {
  return {
    seen: extra.sp_seen === true,
    observations:
      typeof extra.sp_observations === "string" ? extra.sp_observations : "",
    resolutionDate:
      typeof extra.sp_resolution_date === "string"
        ? extra.sp_resolution_date
        : "",
  };
};

export default function ComplaintViewPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { profile } = useUser();

  const isServiciosPublicosUser =
    profile?.email?.toLowerCase() === "adm.serviciospublicos.mgp@gmail.com";

  const [complaint, setComplaint] = useState<ComplaintWithDetails | null>(null);
  const [history, setHistory] = useState<ComplaintHistoryWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (id) fetchComplaint();
  }, [id]);

  useEffect(() => {
    if (id && (profile?.role === "Admin" || profile?.role === "AdminLectura")) {
      fetchHistory();
    }
  }, [id, profile?.role]);

  const fetchComplaint = async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/complaints/${id}`);
      const data = await response.json();

      if (response.ok && data.data) {
        setComplaint(data.data);
      } else {
        toast.error(data.error || "Error al cargar reclamo");
        router.push("/dashboard/complaints");
      }
    } catch (error) {
      console.error("Error fetching complaint:", error);
      toast.error("Error al cargar reclamo");
      router.push("/dashboard/complaints");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);

    try {
      const response = await fetch(`/api/complaints/${id}/history`);
      const data = await response.json();

      if (response.ok && data.data) {
        setHistory(data.data);
      } else if (response.status !== 403) {
        toast.error(data.error || "Error al cargar historial");
      }
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error("Error al cargar historial");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/dashboard/complaints");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "En proceso":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "Resuelto":
        return "bg-green-100 text-green-800 border-green-300";
      case "No resuelto":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getPdfStatusColors = (status: string) => {
    switch (status) {
      case "En proceso":
        return {
          fillColor: [254, 249, 195] as [number, number, number],
          textColor: [133, 77, 14] as [number, number, number],
        };
      case "Resuelto":
        return {
          fillColor: [220, 252, 231] as [number, number, number],
          textColor: [22, 101, 52] as [number, number, number],
        };
      case "No resuelto":
        return {
          fillColor: [254, 226, 226] as [number, number, number],
          textColor: [153, 27, 27] as [number, number, number],
        };
      default:
        return {
          fillColor: [243, 244, 246] as [number, number, number],
          textColor: [55, 65, 81] as [number, number, number],
        };
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateOnly = (dateString?: string | null) => {
    if (!dateString) return "-";

    const [year, month, day] = dateString.split("-").map(Number);

    if (year && month && day) {
      return new Date(year, month - 1, day).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }

    return new Date(dateString).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatBoolean = (value: boolean) => (value ? "Sí" : "No");

  const formatJsonHistoryValue = (value: string | null) => {
    if (!value || value === "-") return "-";

    try {
      const parsed = JSON.parse(value);

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return value;
      }

      const data = parsed as ComplaintExtraData;

      const lines: string[] = [];

      if ("sp_seen" in data) {
        lines.push(`Visto: ${data.sp_seen === true ? "Sí" : "No"}`);
      }

      if ("sp_resolution_date" in data) {
        lines.push(
          `Fecha de resolución: ${
            typeof data.sp_resolution_date === "string" &&
            data.sp_resolution_date
              ? formatDateOnly(data.sp_resolution_date)
              : "-"
          }`,
        );
      }

      if ("sp_observations" in data) {
        lines.push(
          `Observaciones: ${
            typeof data.sp_observations === "string" &&
            data.sp_observations.trim()
              ? data.sp_observations
              : "-"
          }`,
        );
      }

      if (lines.length > 0) {
        return lines.join("\n");
      }

      return Object.entries(parsed)
        .map(([key, itemValue]) => `${key}: ${String(itemValue ?? "-")}`)
        .join("\n");
    } catch {
      return value;
    }
  };

  const formatHistoryValue = (value: string | null, fieldName?: string) => {
    if (value === null || value === "") return "-";
    if (value === "true") return "Sí";
    if (value === "false") return "No";

    if (fieldName === "extra_data") {
      return formatJsonHistoryValue(value);
    }

    return value;
  };

  const cleanValue = (value?: string | number | null) => {
    if (value === null || value === undefined || value === "") return "-";
    return String(value);
  };

  const loadImageAsDataUrl = (src: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.width * 2;
        canvas.height = image.height * 2;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo procesar la imagen"));
          return;
        }

        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      image.onerror = () => reject(new Error("No se pudo cargar el logo"));
      image.src = src;
    });
  };

  const handleExportPDF = async () => {
    if (!complaint) return;

    try {
      const serviceName = complaint.service?.name || "";

      const isZyV =
        complaint.form_variant === "zyv" ||
        serviceName === "Zoonosis" ||
        serviceName === "Vectores";

      const isArbolado =
        complaint.form_variant === "arbolado" ||
        serviceName.toLowerCase().includes("arbol");

      const extra = getExtraData(complaint);

      const arboladoDepartment = getArboladoDepartment(extra);
      const arboladoLevel = getArboladoLevel(extra);
      const arboladoDescription = getArboladoDescription(extra);
      const arboladoAgent = getArboladoAgent(extra);

      const displayComplaintNumber = cleanValue(
        isArbolado
          ? complaint.arbolado_number ?? complaint.complaint_number
          : complaint.complaint_number ?? complaint.arbolado_number,
      );

      const displayAddress = `${complaint.address || "-"} ${
        complaint.street_number || ""
      }`.trim();

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      let logoDataUrl: string | null = null;

      try {
        logoDataUrl = await loadImageAsDataUrl(
          "/logo-general-pico-horizontal.png",
        );
      } catch (error) {
        console.warn("No se pudo cargar el logo para el PDF:", error);
      }

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", 14, 10, 34, 12);
      }

      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text("Sistema de Gestión de Reclamos", 52, 15);

      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text("Atención Ciudadana - General Pico", 52, 21);

      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(`Reclamo N° ${displayComplaintNumber}`, 14, 34);

      const statusColors = getPdfStatusColors(complaint.status);
      doc.setFillColor(...statusColors.fillColor);
      doc.setTextColor(...statusColors.textColor);
      doc.roundedRect(62, 28.5, 32, 8, 2, 2, "F");
      doc.setFontSize(8);
      doc.text(complaint.status, 66, 34);

      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Creado el ${formatDateTime(complaint.created_at)}`, 14, 41);
      doc.text(
        `Exportado el ${new Date().toLocaleString("es-AR")}`,
        14,
        46,
      );

      const commonTableStyles = {
        theme: "grid" as const,
        margin: { left: 14, right: 14 },
        styles: {
          fontSize: 7.6,
          cellPadding: 1.6,
          overflow: "linebreak" as const,
          textColor: [51, 65, 85] as [number, number, number],
          lineColor: [226, 232, 240] as [number, number, number],
          lineWidth: 0.15,
          valign: "middle" as const,
        },
        headStyles: {
          fillColor: [16, 185, 129] as [number, number, number],
          textColor: [255, 255, 255] as [number, number, number],
          fontStyle: "bold" as const,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] as [number, number, number],
        },
        columnStyles: {
          0: { cellWidth: 36, fontStyle: "bold" as const },
          1: { cellWidth: 58 },
          2: { cellWidth: 36, fontStyle: "bold" as const },
          3: { cellWidth: 46 },
        },
      };

      autoTable(doc, {
        ...commonTableStyles,
        startY: 53,
        head: [["Datos del reclamante", "", "", ""]],
        body: [
          [
            "Nombre y apellido",
            cleanValue(complaint.complainant_name),
            "Dirección",
            displayAddress || "-",
          ],
          [
            "Teléfono",
            cleanValue(complaint.phone_number),
            "Medio de contacto",
            cleanValue(complaint.contact_method),
          ],
        ],
      });

      const yAfterApplicant =
        (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY ?? 76;

      autoTable(doc, {
        ...commonTableStyles,
        startY: yAfterApplicant + 6,
        head: [[isZyV ? "Detalle ZyV" : "Detalles del reclamo", "", "", ""]],
        body: [
          [
            isArbolado ? "Depto" : "Servicio",
            isArbolado
              ? cleanValue(arboladoDepartment || complaint.service?.name)
              : cleanValue(complaint.service?.name),
            isArbolado ? "Descripción" : "Causa",
            isArbolado
              ? cleanValue(arboladoDescription || complaint.cause?.name)
              : cleanValue(complaint.cause?.name),
          ],
          [
            isZyV ? "Tipo de domicilio" : isArbolado ? "Nivel" : "Zona",
            isArbolado
              ? cleanValue(arboladoLevel || complaint.since_when)
              : cleanValue(complaint.zone),
            isArbolado ? "Agente" : "Desde cuándo",
            isArbolado
              ? cleanValue(arboladoAgent)
              : cleanValue(complaint.since_when),
          ],
          [
            "Fecha de resolución",
            formatDateOnly(complaint.resolution_date),
            "",
            "",
          ],
        ],
      });

      const yAfterDetails =
        (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY ?? 105;

      autoTable(doc, {
        theme: "grid",
        startY: yAfterDetails + 6,
        margin: { left: 14, right: 14 },
        head: [["Detalle"]],
        body: [[cleanValue(complaint.details)]],
        styles: {
          fontSize: 7.6,
          cellPadding: 2,
          overflow: "linebreak",
          textColor: [51, 65, 85],
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
          valign: "top",
        },
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        bodyStyles: {
          fillColor: [248, 250, 252],
        },
      });

      const yAfterText =
        (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY ?? 135;

      autoTable(doc, {
        ...commonTableStyles,
        startY: yAfterText + 6,
        head: [["Estado y seguimiento", "", "", ""]],
        body: [
          [
            "Estado",
            complaint.status,
            "Responsable de carga",
            cleanValue(complaint.loaded_by_user?.full_name),
          ],
          [
            "Creado",
            formatDateTime(complaint.created_at),
            "",
            "",
          ],
        ],
        didParseCell: (data) => {
          if (
            data.section === "body" &&
            data.row.index === 0 &&
            data.column.index === 1
          ) {
            data.cell.styles.fillColor = statusColors.fillColor;
            data.cell.styles.textColor = statusColors.textColor;
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.halign = "center";
          }
        },
      });

      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        "Sistema Integral SAySSPP",
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: "center" },
      );

      doc.save(`reclamo_${displayComplaintNumber}.pdf`);

      toast.success("PDF del reclamo exportado correctamente");
    } catch (error) {
      console.error("Error exporting complaint PDF:", error);
      toast.error("Error al exportar PDF del reclamo");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Cargando reclamo...</div>
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Reclamo no encontrado</div>
        </div>
      </div>
    );
  }

  const serviceName = complaint.service?.name || "";

  const isZyV =
    complaint.form_variant === "zyv" ||
    serviceName === "Zoonosis" ||
    serviceName === "Vectores";

  const isArbolado =
    complaint.form_variant === "arbolado" ||
    serviceName.toLowerCase().includes("arbol");

  const extra = getExtraData(complaint);

  const arboladoDepartment = getArboladoDepartment(extra);
  const arboladoLevel = getArboladoLevel(extra);
  const arboladoDescription = getArboladoDescription(extra);
  const arboladoAgent = getArboladoAgent(extra);

  const spTracking = getSPTrackingData(extra);

  const shouldShowSPTracking =
    isServiciosPublicosService(serviceName) ||
    "sp_seen" in extra ||
    "sp_observations" in extra ||
    "sp_resolution_date" in extra;

  const displayComplaintNumber = cleanValue(
    isArbolado
      ? complaint.arbolado_number ?? complaint.complaint_number
      : complaint.complaint_number ?? complaint.arbolado_number,
  );

  const displayAddress = `${complaint.address || "-"} ${
    complaint.street_number || ""
  }`.trim();

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="-ml-2"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver
          </Button>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{displayComplaintNumber}</h1>

            <Badge
              className={`${getStatusColor(
                complaint.status,
              )} border px-3 py-1 text-sm`}
            >
              {complaint.status}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            Creado el {formatDateTime(complaint.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <FileText className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>

          {!isServiciosPublicosUser && (
            <Button onClick={() => router.push(`/dashboard/complaints/${id}`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar Reclamo
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-[#5CADEB]" />
            Datos del Reclamante
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            <InfoField
              label="Nombre y Apellido"
              value={cleanValue(complaint.complainant_name)}
            />

            <InfoField
              label="Dirección"
              value={displayAddress || "-"}
              icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
            />

            {!isArbolado && (
              <InfoField label="DNI" value={cleanValue(complaint.dni)} />
            )}

            <InfoField
              label="Teléfono"
              value={cleanValue(complaint.phone_number)}
              icon={<Phone className="h-4 w-4 text-muted-foreground" />}
            />

            <InfoField
              label="Medio de Contacto"
              value={cleanValue(complaint.contact_method)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-[#5CADEB]" />
            {isZyV ? "Detalle ZyV" : "Detalles del Reclamo"}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            <InfoField
              label={isArbolado ? "Depto" : "Servicio"}
              value={
                isArbolado
                  ? cleanValue(arboladoDepartment || complaint.service?.name)
                  : cleanValue(complaint.service?.name)
              }
            />

            <InfoField
              label={isArbolado ? "Descripción" : "Causa"}
              value={
                isArbolado
                  ? cleanValue(arboladoDescription || complaint.cause?.name)
                  : cleanValue(complaint.cause?.name)
              }
            />

            <InfoField
              label={
                isZyV ? "Tipo de domicilio" : isArbolado ? "Nivel" : "Zona"
              }
              value={
                isArbolado
                  ? cleanValue(arboladoLevel || complaint.since_when)
                  : cleanValue(complaint.zone)
              }
            />

            <InfoField
              label={isArbolado ? "Agente" : "Desde Cuándo"}
              value={
                isArbolado
                  ? cleanValue(arboladoAgent)
                  : cleanValue(complaint.since_when)
              }
              icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />}
            />

            <InfoField
              label="Fecha de Resolución"
              value={formatDateOnly(complaint.resolution_date)}
            />
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Detalle
            </p>

            <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm leading-relaxed">
              {cleanValue(complaint.details)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-[#5CADEB]" />
            Estado y Seguimiento
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium text-muted-foreground">
                Estado
              </p>

              <Badge
                className={`${getStatusColor(
                  complaint.status,
                )} border px-3 py-1 text-sm`}
              >
                {complaint.status}
              </Badge>
            </div>

            <InfoField
              label="Responsable de Carga"
              value={cleanValue(complaint.loaded_by_user?.full_name)}
            />
          </div>

          {shouldShowSPTracking && (
            <div className="mt-5 rounded-xl border bg-muted/20 p-4">
              <div className="mb-4 flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#00A27F]" />
                <h3 className="text-sm font-semibold">
                  Seguimiento de Servicios Públicos
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
                <InfoField
                  label="Visto"
                  value={formatBoolean(spTracking.seen)}
                />

                <InfoField
                  label="Fecha de resolución"
                  value={formatDateOnly(spTracking.resolutionDate)}
                />
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Observaciones
                  </p>
                </div>

                <p className="min-h-[44px] whitespace-pre-wrap rounded-md bg-background p-3 text-sm leading-relaxed">
                  {spTracking.observations.trim()
                    ? spTracking.observations
                    : "-"}
                </p>
              </div>
            </div>
          )}

          <div className="mt-5 border-t pt-4">
            <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
              <p className="text-xs text-muted-foreground">
                Creado: {formatDateTime(complaint.created_at)}
              </p>

              <p className="text-xs text-muted-foreground">
                Última modificación: {formatDateTime(complaint.updated_at)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {(profile?.role === "Admin" || profile?.role === "AdminLectura") && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-[#5CADEB]" />
              Historial de Cambios
            </CardTitle>
          </CardHeader>

          <CardContent>
            {historyLoading ? (
              <p className="text-sm text-muted-foreground">
                Cargando historial...
              </p>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay cambios registrados.
              </p>
            ) : (
              <div className="space-y-4">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border bg-muted/20 p-4"
                  >
                    <p className="text-sm">
                      <span className="font-semibold">
                        {item.user?.full_name || "Usuario desconocido"}
                      </span>{" "}
                      modificó{" "}
                      <span className="font-semibold">
                        {FIELD_LABELS[item.field_name] || item.field_name}
                      </span>
                    </p>

                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      <span className="font-medium">Antes:</span>{" "}
                      {formatHistoryValue(item.old_value, item.field_name)}
                    </p>

                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      <span className="font-medium">Después:</span>{" "}
                      {formatHistoryValue(item.new_value, item.field_name)}
                    </p>

                    <p className="pt-1 text-xs text-muted-foreground">
                      {formatDateTime(item.changed_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div>
      <p className="mb-0.5 text-sm font-medium text-muted-foreground">
        {label}
      </p>

      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}