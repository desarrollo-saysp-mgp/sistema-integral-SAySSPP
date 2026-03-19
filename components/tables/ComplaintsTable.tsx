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
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";

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
  service: Service;
  cause: Cause;
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

export function ComplaintsTable({
  complaints,
  onStatusChange,
}: ComplaintsTableProps) {
  const router = useRouter();
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(complaints.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [complaints.length, currentPage, totalPages]);

  const paginatedComplaints = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return complaints.slice(start, end);
  }, [complaints, currentPage]);

  const handleStatusChange = async (
    complaintId: number,
    newStatus: string,
  ) => {
    if (!onStatusChange) return;

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
        canvas.width = image.width;
        canvas.height = image.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo procesar la imagen"));
          return;
        }

        ctx.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/jpeg"));
      };
      image.onerror = () => reject(new Error("No se pudo cargar el logo"));
      image.src = src;
    });
  };

  const exportToExcel = () => {
    try {
      const formattedData = complaints.map((item) => ({
        Número: item.complaint_number,
        Fecha: formatDate(item.complaint_date),
        Nombre: item.complainant_name,
        Servicio: item.service?.name ?? "",
        Causa: item.cause?.name ?? "",
        Zona: item.zone,
        "Desde Cuándo": item.since_when,
        Estado: item.status,
        "Cargado por": item.loaded_by_user?.full_name ?? "",
      }));

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

      saveAs(blob, "reclamos_filtrados.xlsx");
      toast.success("Excel exportado correctamente");
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
        logoDataUrl = await loadImageAsDataUrl("/logo-general-pico-horizontal.jpg");
      } catch (error) {
        console.warn("No se pudo cargar el logo para el PDF:", error);
      }

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "JPEG", 14, 10, 34, 12);
      }

      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text("Sistema de Gestión de Reclamos", 52, 15);

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text("Atención Ciudadana - General Pico", 52, 21);
      doc.text(`Cantidad de reclamos exportados: ${complaints.length}`, 14, 31);
      doc.text(
        `Fecha de exportación: ${new Date().toLocaleString("es-AR")}`,
        14,
        37,
      );

      const tableData = complaints.map((item) => [
        item.complaint_number,
        formatDate(item.complaint_date),
        item.complainant_name,
        item.service?.name ?? "",
        item.cause?.name ?? "",
        item.zone,
        item.since_when,
        item.status,
        item.loaded_by_user?.full_name ?? "",
      ]);

      autoTable(doc, {
        startY: 44,
        head: [[
          "N°",
          "Fecha",
          "Nombre",
          "Servicio",
          "Causa",
          "Zona",
          "Desde Cuándo",
          "Estado",
          "Cargado por",
        ]],
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
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 22 },
          2: { cellWidth: 38 },
          3: { cellWidth: 28 },
          4: { cellWidth: 34 },
          5: { cellWidth: 14, halign: "center" },
          6: { cellWidth: 24 },
          7: { cellWidth: 28, halign: "center" },
          8: { cellWidth: 34 },
        },
        didParseCell: (data: CellHookData) => {
          if (data.section === "body" && data.column.index === 7) {
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

      doc.save("reclamos_filtrados.pdf");
      toast.success("PDF exportado correctamente");
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
        <Button
          type="button"
          variant="outline"
          onClick={exportToExcel}
          className="gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Exportar Excel
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={exportToPDF}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
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
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedComplaints.map((complaint, index) => {
              const isEvenRow = index % 2 === 0;
              const isUpdating = updatingStatus === complaint.id;

              return (
                <TableRow
                  key={complaint.id}
                  className={
                    isEvenRow
                      ? "bg-background transition-colors hover:bg-accent/40"
                      : "bg-muted/25 transition-colors hover:bg-accent/40"
                  }
                >
                  <TableCell className="font-medium">
                    {complaint.complaint_number}
                  </TableCell>
                  <TableCell>{formatDate(complaint.complaint_date)}</TableCell>
                  <TableCell>{complaint.complainant_name}</TableCell>
                  <TableCell>{complaint.service.name}</TableCell>
                  <TableCell>{complaint.cause.name}</TableCell>
                  <TableCell>{complaint.zone}</TableCell>
                  <TableCell>{complaint.since_when}</TableCell>
                  <TableCell>
                    <div>
                      {onStatusChange ? (
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
                  <TableCell>{complaint.loaded_by_user.full_name}</TableCell>
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
          <span className="font-medium text-foreground">{complaints.length}</span>{" "}
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