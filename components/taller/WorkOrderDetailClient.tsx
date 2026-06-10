"use client";

import Link from "next/link";
import type { WorkOrder } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  ClipboardList,
  FileText,
  Package,
  Pencil,
  User,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";

type PdfStatusColors = {
  fillColor: [number, number, number];
  textColor: [number, number, number];
};

export function WorkOrderDetailClient({ order }: { order: WorkOrder }) {
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

  const formatMoney = (value?: number | null) => {
    if (value === null || value === undefined) return "-";

    return value.toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
    });
  };

  const cleanValue = (value?: string | number | null) => {
    if (value === null || value === undefined || value === "") return "-";
    return String(value);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "CERRADO":
        return "border-green-200 bg-green-100 text-green-800 hover:bg-green-100";
      case "PRESUPUESTOS":
        return "border-yellow-200 bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "COMPRAS":
        return "border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "TALLER":
        return "border-orange-200 bg-orange-100 text-orange-800 hover:bg-orange-100";
      case "TALLER TERCERIZADO":
        return "border-purple-200 bg-purple-100 text-purple-800 hover:bg-purple-100";
      case "INICIADO":
      default:
        return "border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-100";
    }
  };

  const getPdfStatusColors = (status?: string | null): PdfStatusColors => {
    switch (status) {
      case "CERRADO":
        return {
          fillColor: [220, 252, 231],
          textColor: [22, 101, 52],
        };
      case "PRESUPUESTOS":
        return {
          fillColor: [254, 249, 195],
          textColor: [133, 77, 14],
        };
      case "COMPRAS":
        return {
          fillColor: [219, 234, 254],
          textColor: [30, 64, 175],
        };
      case "TALLER":
        return {
          fillColor: [255, 237, 213],
          textColor: [154, 52, 18],
        };
      case "TALLER TERCERIZADO":
        return {
          fillColor: [243, 232, 255],
          textColor: [107, 33, 168],
        };
      case "INICIADO":
      default:
        return {
          fillColor: [241, 245, 249],
          textColor: [51, 65, 85],
        };
    }
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

  const getLastAutoTableY = (doc: jsPDF) => {
    const finalY = (
      doc as unknown as {
        lastAutoTable?: { finalY?: number };
      }
    ).lastAutoTable?.finalY;

    return typeof finalY === "number" ? finalY : 55;
  };

  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      let logoDataUrl: string | null = null;

      try {
        logoDataUrl = await loadImageAsDataUrl(
          "/logo-general-pico-horizontal.png",
        );
      } catch (error) {
        console.warn("No se pudo cargar el logo para el PDF:", error);
      }

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", 14, 10, 36, 13);
      }

      doc.setFontSize(17);
      doc.setTextColor(30, 41, 59);
      doc.text("Sistema Integral SAySSPP", 56, 16);

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text("Registro de Órdenes de Trabajo - Taller", 56, 22);

      doc.setDrawColor(226, 232, 240);
      doc.line(14, 29, pageWidth - 14, 29);

      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text(`Detalle de OT ${cleanValue(order.order_number)}`, 14, 40);

      const statusColors = getPdfStatusColors(order.status);

      doc.setFillColor(...statusColors.fillColor);
      doc.roundedRect(pageWidth - 58, 34, 44, 9, 3, 3, "F");
      doc.setFontSize(8.5);
      doc.setTextColor(...statusColors.textColor);
      doc.text(cleanValue(order.status), pageWidth - 36, 40, {
        align: "center",
      });

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Exportado: ${new Date().toLocaleString("es-AR")}`, 14, 47);

      autoTable(doc, {
        startY: 55,
        head: [["Información básica", ""]],
        body: [
          ["N° orden de trabajo", cleanValue(order.order_number)],
          ["Fecha de ingreso", formatDate(order.entry_date)],
          ["Estado", cleanValue(order.status)],
          ["Área solicitante", cleanValue(order.requesting_area)],
          ["Reporte de falla", cleanValue(order.failure_report)],
          ["Tipo de reparación", cleanValue(order.repair_type)],
        ],
        theme: "grid",
        margin: { left: 14, right: 14 },
        styles: {
          fontSize: 9,
          cellPadding: 2.5,
          textColor: [51, 65, 85],
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 55, fontStyle: "bold" },
          1: { cellWidth: 123 },
        },
        didParseCell: (data: CellHookData) => {
          if (
            data.section === "body" &&
            data.row.index === 2 &&
            data.column.index === 1
          ) {
            const colors = getPdfStatusColors(order.status);
            data.cell.styles.fillColor = colors.fillColor;
            data.cell.styles.textColor = colors.textColor;
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      autoTable(doc, {
        startY: getLastAutoTableY(doc) + 8,
        head: [["Vehículo y falla", ""]],
        body: [
          ["Código de vehículo", cleanValue(order.vehicle_code)],
          ["Vehículo", cleanValue(order.vehicle)],
          ["Dominio", cleanValue(order.license_plate)],
          ["Criticidad", cleanValue(order.criticality)],
          ["Tipo de falla", cleanValue(order.failure_type)],
          ["Localización de falla", cleanValue(order.failure_location)],
          ["Fecha de salida", formatDate(order.exit_date)],
        ],
        theme: "grid",
        margin: { left: 14, right: 14 },
        styles: {
          fontSize: 9,
          cellPadding: 2.5,
          textColor: [51, 65, 85],
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 55, fontStyle: "bold" },
          1: { cellWidth: 123 },
        },
      });

      autoTable(doc, {
        startY: getLastAutoTableY(doc) + 8,
        head: [["Repuestos y proveedor", ""]],
        body: [
          ["Requiere repuesto", cleanValue(order.requires_spare_part)],
          ["Detalle de repuesto", cleanValue(order.spare_part_detail)],
          ["Código de repuesto", cleanValue(order.spare_part_code)],
          ["Unidades", cleanValue(order.units)],
          ["Proveedor", cleanValue(order.provider)],
          ["Monto", formatMoney(order.amount)],
        ],
        theme: "grid",
        margin: { left: 14, right: 14 },
        styles: {
          fontSize: 9,
          cellPadding: 2.5,
          textColor: [51, 65, 85],
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 55, fontStyle: "bold" },
          1: { cellWidth: 123 },
        },
      });

      autoTable(doc, {
        startY: getLastAutoTableY(doc) + 8,
        head: [["Chofer y observaciones", ""]],
        body: [
          ["Chofer", cleanValue(order.driver)],
          ["Observaciones", cleanValue(order.observations)],
        ],
        theme: "grid",
        margin: { left: 14, right: 14 },
        styles: {
          fontSize: 9,
          cellPadding: 2.5,
          textColor: [51, 65, 85],
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 55, fontStyle: "bold" },
          1: { cellWidth: 123 },
        },
      });

      autoTable(doc, {
        startY: getLastAutoTableY(doc) + 8,
        body: [
          ["Creado", new Date(order.created_at).toLocaleString("es-AR")],
          [
            "Última modificación",
            new Date(order.updated_at).toLocaleString("es-AR"),
          ],
        ],
        theme: "plain",
        margin: { left: 14, right: 14 },
        styles: {
          fontSize: 8,
          cellPadding: 1.5,
          textColor: [100, 116, 139],
        },
        columnStyles: {
          0: { cellWidth: 45, fontStyle: "bold" },
          1: { cellWidth: 133 },
        },
      });

      const pageCount = doc.getNumberOfPages();

      for (let index = 1; index <= pageCount; index += 1) {
        doc.setPage(index);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`Página ${index} de ${pageCount}`, pageWidth - 14, pageHeight - 8, {
          align: "right",
        });
      }

      doc.save(`ot_${cleanValue(order.order_number)}.pdf`);
      toast.success("PDF de la OT exportado correctamente");
    } catch (error) {
      console.error("Error exporting OT PDF:", error);
      toast.error("Error al exportar PDF");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <Button asChild variant="ghost" className="-ml-2 gap-2">
          <Link href="/dashboard/taller/ordenes-trabajo">
            <ArrowLeft className="h-4 w-4" />
            Volver al registro
          </Link>
        </Button>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportPDF}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </Button>

          <Button asChild className="gap-2">
            <Link href={`/dashboard/taller/ordenes-trabajo/${order.id}/edit`}>
              <Pencil className="h-4 w-4" />
              Editar OT
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            OT {cleanValue(order.order_number)}
          </h2>
          <p className="text-sm text-muted-foreground">
            Detalle de la orden de trabajo.
          </p>
        </div>

        <Badge
          className={`${getStatusBadgeClass(order.status)} border px-3 py-1 text-sm`}
        >
          {order.status || "-"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-[#00A27F]" />
            Información básica
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Info label="N° orden de trabajo" value={cleanValue(order.order_number)} />
            <Info label="Fecha de ingreso" value={formatDate(order.entry_date)} />
            <Info label="Estado" value={cleanValue(order.status)} />
            <Info label="Área solicitante" value={cleanValue(order.requesting_area)} />
            <Info label="Reporte de falla" value={cleanValue(order.failure_report)} />
            <Info label="Tipo de reparación" value={cleanValue(order.repair_type)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Car className="h-5 w-5 text-[#00A27F]" />
            Vehículo y falla
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Info label="Código de vehículo" value={cleanValue(order.vehicle_code)} />
            <Info label="Vehículo" value={cleanValue(order.vehicle)} />
            <Info label="Dominio" value={cleanValue(order.license_plate)} />
            <Info label="Criticidad" value={cleanValue(order.criticality)} />
            <Info label="Tipo de falla" value={cleanValue(order.failure_type)} />
            <Info label="Localización de falla" value={cleanValue(order.failure_location)} />
            <Info label="Fecha de salida" value={formatDate(order.exit_date)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-[#00A27F]" />
            Repuestos y proveedor
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Info label="Requiere repuesto" value={cleanValue(order.requires_spare_part)} />
            <Info label="Detalle de repuesto" value={cleanValue(order.spare_part_detail)} />
            <Info label="Código de repuesto" value={cleanValue(order.spare_part_code)} />
            <Info label="Unidades" value={cleanValue(order.units)} />
            <Info label="Proveedor" value={cleanValue(order.provider)} />
            <Info label="Monto" value={formatMoney(order.amount)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-[#00A27F]" />
            Chofer y observaciones
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Info label="Chofer" value={cleanValue(order.driver)} />

          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Observaciones
            </p>
            <p className="min-h-[80px] whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm leading-relaxed">
              {cleanValue(order.observations)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 py-5 text-xs text-muted-foreground md:grid-cols-2">
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Creado: {new Date(order.created_at).toLocaleString("es-AR")}
          </p>

          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Última modificación: {new Date(order.updated_at).toLocaleString("es-AR")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-muted-foreground">{label}</p>
      <p className="break-words text-sm">{value}</p>
    </div>
  );
}