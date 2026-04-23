"use client";

import { useEffect, useMemo, useState } from "react";
import type { Complaint, Service, Cause, User } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Loader2,
  MessageCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import { useUser } from "@/hooks/useUser";

const ITEMS_PER_PAGE = 20;

const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatLocalDate = (dateStr: string): string => {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

type ComplaintWithDetails = Complaint & {
  service: Service | null;
  cause: Cause | null;
  loaded_by_user: User;
};

interface ComplaintsTableProps {
  complaints: ComplaintWithDetails[];
  onStatusChange?: (complaintId: number, newStatus: string) => Promise<void>;
}

type PdfStatusColors = {
  fillColor: [number, number, number];
  textColor: [number, number, number];
};

type ComplaintExtraData = {
  department?: unknown;
  description_type?: unknown;
  level?: unknown;
  observations?: unknown;
  solution?: unknown;
  resolution_date?: unknown;
  agent?: unknown;
  resolution_responsible?: unknown;
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

const getComplaintDisplayData = (complaint: ComplaintWithDetails) => {
  const extra = getExtraData(complaint);
  const isArbolado = complaint.form_variant === "arbolado";

  const serviceLabel =
    complaint.service?.name ??
    (typeof extra.department === "string" ? extra.department : null) ??
    (isArbolado ? "Arbolado" : "-");

  const causeLabel =
    complaint.cause?.name ??
    (typeof extra.description_type === "string"
      ? extra.description_type
      : null) ??
    complaint.details ??
    "-";

  const zoneLabel = complaint.zone ?? "-";

  const sinceWhenLabel =
    complaint.since_when ??
    (typeof extra.level === "string" ? extra.level : null) ??
    "-";

  const detailLabel =
    complaint.details ??
    (typeof extra.observations === "string" ? extra.observations : null) ??
    (typeof extra.description_type === "string" ? extra.description_type : null) ??
    "-";

  const addressLabel =
    `${complaint.address || "-"} ${complaint.street_number || ""}`.trim();

  const resolutionDateLabel =
    typeof extra.resolution_date === "string" && extra.resolution_date
      ? formatLocalDate(extra.resolution_date)
      : "-";

  const agentLabel =
    typeof extra.agent === "string" && extra.agent ? extra.agent : "-";

  const departmentLabel =
    typeof extra.department === "string" && extra.department
      ? extra.department
      : "Arbolado";

  const levelLabel =
    typeof extra.level === "string" && extra.level ? extra.level : "-";

  const descriptionLabel =
    typeof extra.description_type === "string" && extra.description_type
      ? extra.description_type
      : complaint.details || "-";

  return {
    isArbolado,
    extra,
    serviceLabel,
    causeLabel,
    zoneLabel,
    sinceWhenLabel,
    detailLabel,
    addressLabel,
    resolutionDateLabel,
    agentLabel,
    departmentLabel,
    levelLabel,
    descriptionLabel,
  };
};

export function ComplaintsTable({
  complaints,
  onStatusChange,
}: ComplaintsTableProps) {
  const router = useRouter();
  const { profile } = useUser();
  const isReadOnly = profile?.role === "AdminLectura";
  const isArboladoUser = profile?.role === "ReclamosArbolado";
  const canSendWhatsApp =
    profile?.role === "Admin" || profile?.role === "Reclamos";

  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedComplaintIds, setSelectedComplaintIds] = useState<number[]>([]);

  const totalPages = Math.max(1, Math.ceil(complaints.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [complaints.length, currentPage, totalPages]);

  useEffect(() => {
    setSelectedComplaintIds((prev) =>
      prev.filter((id) => complaints.some((complaint) => complaint.id === id)),
    );
  }, [complaints]);

  const paginatedComplaints = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return complaints.slice(start, end);
  }, [complaints, currentPage]);

  const selectedComplaints = useMemo(() => {
    return complaints.filter((complaint) =>
      selectedComplaintIds.includes(complaint.id),
    );
  }, [complaints, selectedComplaintIds]);

  const exportComplaints = useMemo(() => {
    return selectedComplaints.length > 0 ? selectedComplaints : complaints;
  }, [selectedComplaints, complaints]);

  const hasSelectedComplaints = selectedComplaints.length > 0;

  const allVisibleSelected =
    paginatedComplaints.length > 0 &&
    paginatedComplaints.every((complaint) =>
      selectedComplaintIds.includes(complaint.id),
    );

  const someVisibleSelected =
    paginatedComplaints.some((complaint) =>
      selectedComplaintIds.includes(complaint.id),
    ) && !allVisibleSelected;

  const handleStatusChange = async (
    complaintId: number,
    newStatus: string,
  ) => {
    if (!onStatusChange || isReadOnly) return;

    setUpdatingStatus(complaintId);
    const toastId = toast.loading("Actualizando estado del reclamo...");

    try {
      await onStatusChange(complaintId, newStatus);
      toast.success("Estado actualizado correctamente", {
        id: toastId,
      });
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("No se pudo actualizar el estado", {
        id: toastId,
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleView = (complaintId: number) => {
    router.push(`/dashboard/complaints/${complaintId}/view`);
  };

  const handleEdit = (complaintId: number) => {
    router.push(`/dashboard/complaints/${complaintId}`);
  };

  const toggleComplaintSelection = (complaintId: number, checked: boolean) => {
    setSelectedComplaintIds((prev) =>
      checked
        ? [...prev, complaintId]
        : prev.filter((id) => id !== complaintId),
    );
  };

  const toggleVisibleSelection = (checked: boolean) => {
    const visibleIds = paginatedComplaints.map((complaint) => complaint.id);

    if (checked) {
      setSelectedComplaintIds((prev) => [
        ...new Set([...prev, ...visibleIds]),
      ]);
      return;
    }

    setSelectedComplaintIds((prev) =>
      prev.filter((id) => !visibleIds.includes(id)),
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "En proceso":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200";
      case "Resuelto":
        return "bg-green-100 text-green-800 hover:bg-green-100 border-green-200";
      case "No resuelto":
        return "bg-red-100 text-red-800 hover:bg-red-100 border-red-200";
      default:
        return "bg-muted text-muted-foreground hover:bg-muted border-border";
    }
  };

  const getPdfStatusColors = (status: string): PdfStatusColors => {
    switch (status) {
      case "En proceso":
        return {
          fillColor: [254, 249, 195],
          textColor: [133, 77, 14],
        };
      case "Resuelto":
        return {
          fillColor: [220, 252, 231],
          textColor: [22, 101, 52],
        };
      case "No resuelto":
        return {
          fillColor: [254, 226, 226],
          textColor: [153, 27, 27],
        };
      default:
        return {
          fillColor: [243, 244, 246],
          textColor: [55, 65, 81],
        };
    }
  };

  const formatDate = (dateString: string) => {
    return formatLocalDate(dateString);
  };

  const getVisibleRangeText = () => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const end = Math.min(currentPage * ITEMS_PER_PAGE, complaints.length);
    return { start, end };
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5];
    }

    if (currentPage >= totalPages - 3) {
      return [
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      currentPage - 2,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      currentPage + 2,
    ];
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

  const buildWhatsAppMessage = (items: ComplaintWithDetails[]) => {
    const partes: string[] = ["*Lista de reclamos:*", ""];

    items.forEach((item, index) => {
      const display = getComplaintDisplayData(item);
      const direccion = display.addressLabel;
      const telefono = item.phone_number || "-";
      const servicio = display.serviceLabel || "-";
      const causa = display.causeLabel || "-";
      const zona = display.zoneLabel || "-";
      const desde = display.sinceWhenLabel || "-";
      const detalle = display.detailLabel || "-";
      const fecha = item.complaint_date ? formatDate(item.complaint_date) : "-";
      const cargadoPor = item.loaded_by_user?.full_name || "-";

      partes.push(`*Reclamo ${index + 1}*`);
      partes.push(`Número: *${item.complaint_number || "-"}*`);
      partes.push(`Fecha: *${fecha}*`);
      partes.push(`Nombre: *${item.complainant_name || "-"}*`);
      partes.push(`Dirección: *${direccion || "-"}*`);
      partes.push(`Teléfono: *${telefono}*`);
      partes.push(`Servicio: *${servicio}*`);
      partes.push(`Causa: *${causa}*`);
      partes.push(`Zona/Sector: *${zona}*`);
      partes.push(`Desde: *${desde}*`);
      partes.push(`Detalle: *${detalle}*`);
      partes.push(`Cargado por: *${cargadoPor}*`);
      partes.push("");
    });

    return partes.join("\n");
  };

  const handleSendWhatsApp = () => {
    if (selectedComplaints.length === 0) {
      toast.error("Seleccioná al menos un reclamo para enviar");
      return;
    }

    if (!canSendWhatsApp) {
      toast.error("No tenés permisos para enviar reclamos por WhatsApp");
      return;
    }

    const mensaje = buildWhatsAppMessage(selectedComplaints);
    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const exportToExcel = () => {
    try {
      const formattedData = exportComplaints.map((item) => {
        const display = getComplaintDisplayData(item);

        if (isArboladoUser) {
          return {
            Número: item.complaint_number,
            Fecha: formatDate(item.complaint_date),
            Nombre: item.complainant_name,
            Dirección: display.addressLabel,
            Depto: display.departmentLabel,
            Nivel: display.levelLabel,
            Descripción: display.descriptionLabel,
            "Fecha resolución": display.resolutionDateLabel,
            Agente: display.agentLabel,
            Estado: item.status,
            "Cargado por": item.loaded_by_user?.full_name ?? "",
          };
        }

        return {
          Número: item.complaint_number,
          Fecha: formatDate(item.complaint_date),
          Nombre: item.complainant_name,
          Dirección: display.addressLabel,
          Servicio: display.serviceLabel,
          Causa: display.causeLabel,
          "Desde Cuándo": display.sinceWhenLabel,
          Estado: item.status,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "Reclamos");

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
      });

      saveAs(
        blob,
        hasSelectedComplaints
          ? "reclamos_seleccionados.xlsx"
          : "reclamos_filtrados.xlsx",
      );

      toast.success(
        hasSelectedComplaints
          ? "Excel de reclamos seleccionados exportado correctamente"
          : "Excel de reclamos filtrados exportado correctamente",
      );
    } catch (error) {
      console.error("Error exporting Excel:", error);
      toast.error("Error al exportar Excel");
    }
  };

  const exportToPDF = async () => {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
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

      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text("Sistema de Gestión de Reclamos", 52, 15);

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text("Atención Ciudadana - General Pico", 52, 21);
      doc.text(
        `Cantidad de reclamos exportados: ${exportComplaints.length}`,
        14,
        31,
      );
      doc.text(
        `Fecha de exportación: ${new Date().toLocaleString("es-AR")}`,
        14,
        37,
      );

      const arboladoHead = [[
        "N°",
        "Fecha",
        "Nombre",
        "Dirección",
        "Depto",
        "Nivel",
        "Descripción",
        "Fecha resolución",
        "Agente",
        "Estado",
      ]];

      const generalHead = [[
        "N°",
        "Fecha",
        "Nombre",
        "Dirección",
        "Servicio",
        "Causa",
        "Desde Cuándo",
        "Estado",
      ]];

      const tableData = exportComplaints.map((item) => {
        const display = getComplaintDisplayData(item);

        if (isArboladoUser) {
          return [
            item.complaint_number,
            formatDate(item.complaint_date),
            item.complainant_name,
            display.addressLabel,
            display.departmentLabel,
            display.levelLabel,
            display.descriptionLabel,
            display.resolutionDateLabel,
            display.agentLabel,
            item.status,
          ];
        }

        return [
          item.complaint_number,
          formatDate(item.complaint_date),
          item.complainant_name,
          display.addressLabel,
          display.serviceLabel,
          display.causeLabel,
          display.sinceWhenLabel,
          item.status,
        ];
      });

      autoTable(doc, {
        startY: 44,
        head: isArboladoUser ? arboladoHead : generalHead,
        body: tableData,
        theme: "grid",
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          textColor: [51, 65, 85],
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
          valign: "middle",
        },
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        didParseCell: (data: CellHookData) => {
          const statusColumnIndex = isArboladoUser ? 9 : 7;

          if (data.section === "body" && data.column.index === statusColumnIndex) {
            const status = String(data.cell.raw ?? "");
            const colors = getPdfStatusColors(status);

            data.cell.styles.fillColor = colors.fillColor;
            data.cell.styles.textColor = colors.textColor;
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.halign = "center";
            data.cell.styles.lineColor = colors.fillColor;
          }
        },
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(9);
          doc.setTextColor(100);
          doc.text(
            `Página ${data.pageNumber} de ${pageCount}`,
            doc.internal.pageSize.getWidth() - 28,
            doc.internal.pageSize.getHeight() - 8,
          );
        },
      });

      doc.save(
        hasSelectedComplaints
          ? "reclamos_seleccionados.pdf"
          : "reclamos_filtrados.pdf",
      );

      toast.success(
        hasSelectedComplaints
          ? "PDF de reclamos seleccionados exportado correctamente"
          : "PDF de reclamos filtrados exportado correctamente",
      );
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Error al exportar PDF");
    }
  };

  if (complaints.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">
          No se encontraron reclamos que coincidan con los filtros.
        </p>
      </div>
    );
  }

  const { start, end } = getVisibleRangeText();
  const pageNumbers = getPageNumbers();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
        {!isArboladoUser && canSendWhatsApp && (
          <Button
            type="button"
            variant="outline"
            onClick={handleSendWhatsApp}
            className="gap-2"
            disabled={selectedComplaints.length === 0}
          >
            <MessageCircle className="h-4 w-4" />
            Enviar WhatsApp
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={exportToExcel}
          className="gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {hasSelectedComplaints
            ? `Exportar Excel ${selectedComplaints.length} seleccionados`
            : "Exportar Excel"}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={exportToPDF}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          {hasSelectedComplaints
            ? `Exportar PDF ${selectedComplaints.length} seleccionados`
            : "Exportar PDF"}
        </Button>
      </div>

      {selectedComplaints.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {selectedComplaints.length} reclamo(s) seleccionado(s). Al exportar se
          usarán solo esos reclamos.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[52px] text-center">
                <div className="flex justify-center">
                  <Checkbox
                    checked={
                      allVisibleSelected
                        ? true
                        : someVisibleSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(checked) =>
                      toggleVisibleSelection(checked === true)
                    }
                    aria-label="Seleccionar reclamos visibles"
                  />
                </div>
              </TableHead>

              {isArboladoUser ? (
                <>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Depto</TableHead>
                  <TableHead>Nivel</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Fecha resolución</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </>
              ) : (
                <>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Causa</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Desde Cuándo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cargado por</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedComplaints.map((complaint, index) => {
              const isEvenRow = index % 2 === 0;
              const isUpdating = updatingStatus === complaint.id;
              const isSelected = selectedComplaintIds.includes(complaint.id);
              const display = getComplaintDisplayData(complaint);

              return (
                <TableRow
                  key={complaint.id}
                  className={
                    isEvenRow
                      ? "bg-background transition-colors hover:bg-accent/40"
                      : "bg-muted/25 transition-colors hover:bg-accent/40"
                  }
                >
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          toggleComplaintSelection(
                            complaint.id,
                            checked === true,
                          )
                        }
                        aria-label={`Seleccionar reclamo ${complaint.complaint_number}`}
                      />
                    </div>
                  </TableCell>

                  {isArboladoUser ? (
                    <>
                      <TableCell className="font-medium">
                        {complaint.complaint_number}
                      </TableCell>
                      <TableCell>{formatDate(complaint.complaint_date)}</TableCell>
                      <TableCell>{complaint.complainant_name ?? "-"}</TableCell>
                      <TableCell>{display.addressLabel}</TableCell>
                      <TableCell>{display.departmentLabel}</TableCell>
                      <TableCell>{display.levelLabel}</TableCell>
                      <TableCell>{display.descriptionLabel}</TableCell>
                      <TableCell>{display.resolutionDateLabel}</TableCell>
                      <TableCell>{display.agentLabel}</TableCell>
                      <TableCell>
                        <div>
                          {onStatusChange && !isReadOnly ? (
                            <Select
                              value={complaint.status}
                              onValueChange={(value) =>
                                handleStatusChange(complaint.id, value)
                              }
                              disabled={isUpdating}
                            >
                              <SelectTrigger
                                className={`w-[150px] ${getStatusColor(
                                  complaint.status,
                                )} ${isUpdating ? "opacity-80" : ""}`}
                              >
                                {isUpdating ? (
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Guardando...</span>
                                  </div>
                                ) : (
                                  <SelectValue />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="En proceso">
                                  En proceso
                                </SelectItem>
                                <SelectItem value="Resuelto">Resuelto</SelectItem>
                                <SelectItem value="No resuelto">
                                  No resuelto
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={getStatusColor(complaint.status)}>
                              {complaint.status}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(complaint.id)}
                            title="Ver reclamo"
                            className="transition-all hover:bg-accent hover:text-primary active:scale-95"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(complaint.id)}
                            title="Editar reclamo"
                            className="transition-all hover:bg-accent hover:text-primary active:scale-95"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium">
                        {complaint.complaint_number}
                      </TableCell>
                      <TableCell>{formatDate(complaint.complaint_date)}</TableCell>
                      <TableCell>{complaint.complainant_name ?? "-"}</TableCell>
                      <TableCell>{display.serviceLabel}</TableCell>
                      <TableCell>{display.causeLabel}</TableCell>
                      <TableCell>{display.zoneLabel}</TableCell>
                      <TableCell>{display.sinceWhenLabel}</TableCell>
                      <TableCell>
                        <div>
                          {onStatusChange && !isReadOnly ? (
                            <Select
                              value={complaint.status}
                              onValueChange={(value) =>
                                handleStatusChange(complaint.id, value)
                              }
                              disabled={isUpdating}
                            >
                              <SelectTrigger
                                className={`w-[150px] ${getStatusColor(
                                  complaint.status,
                                )} ${isUpdating ? "opacity-80" : ""}`}
                              >
                                {isUpdating ? (
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Guardando...</span>
                                  </div>
                                ) : (
                                  <SelectValue />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="En proceso">
                                  En proceso
                                </SelectItem>
                                <SelectItem value="Resuelto">Resuelto</SelectItem>
                                <SelectItem value="No resuelto">
                                  No resuelto
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={getStatusColor(complaint.status)}>
                              {complaint.status}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {complaint.loaded_by_user?.full_name ??
                          "Usuario no disponible"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(complaint.id)}
                            title="Ver reclamo"
                            className="transition-all hover:bg-accent hover:text-primary active:scale-95"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(complaint.id)}
                            title="Editar reclamo"
                            className="transition-all hover:bg-accent hover:text-primary active:scale-95"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando <span className="font-medium text-foreground">{start}</span>{" "}
          a <span className="font-medium text-foreground">{end}</span> de{" "}
          <span className="font-medium text-foreground">
            {complaints.length}
          </span>{" "}
          reclamos
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          {pageNumbers[0] > 1 && (
            <>
              <Button
                type="button"
                variant={currentPage === 1 ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(1)}
                className="min-w-9"
              >
                1
              </Button>
              {pageNumbers[0] > 2 && (
                <span className="px-1 text-sm text-muted-foreground">...</span>
              )}
            </>
          )}

          {pageNumbers.map((page) => (
            <Button
              key={page}
              type="button"
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentPage(page)}
              className="min-w-9"
            >
              {page}
            </Button>
          ))}

          {pageNumbers[pageNumbers.length - 1] < totalPages && (
            <>
              {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                <span className="px-1 text-sm text-muted-foreground">...</span>
              )}
              <Button
                type="button"
                variant={currentPage === totalPages ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                className="min-w-9"
              >
                {totalPages}
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="gap-1"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}