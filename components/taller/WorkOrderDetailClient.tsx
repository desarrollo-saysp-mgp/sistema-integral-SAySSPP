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

type AmountCurrency = "ARS" | "USD";

type PdfStatusColors = {
  fillColor: [number, number, number];
  textColor: [number, number, number];
};

const CURRENCY_MARKER_REGEX = /\n?\[\[amount_currency:(ARS|USD)\]\]/g;

const cleanValue = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const hasRealValue = (value?: string | number | null) => {
  return value !== null && value !== undefined && String(value).trim() !== "";
};

const getAmountCurrency = (order: WorkOrder): AmountCurrency => {
  const observations = String(order.observations || "");
  const match = observations.match(/\[\[amount_currency:(ARS|USD)\]\]/);

  if (match?.[1] === "USD") return "USD";

  return "ARS";
};

const cleanObservations = (value?: string | null) => {
  const cleaned = String(value || "").replace(CURRENCY_MARKER_REGEX, "").trim();

  return cleaned || "-";
};

const formatProviders = (value?: string | null) => {
  const providers = String(value || "")
    .split("|")
    .map((provider) => provider.trim())
    .filter(Boolean);

  if (providers.length === 0) return "-";

  return providers.join(", ");
};

export function WorkOrderDetailClient({ order }: { order: WorkOrder }) {
  const amountCurrency = getAmountCurrency(order);

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

  const formatMoney = (
    value?: number | null,
    currency: AmountCurrency = amountCurrency,
  ) => {
    if (value === null || value === undefined) return "-";

    return value.toLocaleString("es-AR", {
      style: "currency",
      currency,
    });
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
        doc.addImage(logoDataUrl, "PNG", 14, 8, 32, 11);
      }

      doc.setFontSize(15);
      doc.setTextColor(30, 41, 59);
      doc.text("Sistema Integral SAySSPP", 52, 13);

      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text("Registro de Órdenes de Trabajo - Taller", 52, 18);

      doc.setDrawColor(226, 232, 240);
      doc.line(14, 23, pageWidth - 14, 23);

      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(`Detalle de OT ${cleanValue(order.order_number)}`, 14, 31);

      const statusColors = getPdfStatusColors(order.status);

      doc.setFillColor(...statusColors.fillColor);
      doc.roundedRect(pageWidth - 55, 26, 41, 8, 2, 2, "F");
      doc.setFontSize(7.5);
      doc.setTextColor(...statusColors.textColor);
      doc.text(cleanValue(order.status), pageWidth - 34.5, 31.2, {
        align: "center",
      });

      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Exportado: ${new Date().toLocaleString("es-AR")}`, 14, 37);

      const compactRows: string[][] = [
        ["INFORMACIÓN BÁSICA", ""],
        ["N° orden de trabajo", cleanValue(order.order_number)],
        ["Fecha de ingreso", formatDate(order.entry_date)],
        ["Estado", cleanValue(order.status)],
        ["Área solicitante", cleanValue(order.requesting_area)],
        ["Reporte de falla", cleanValue(order.failure_report)],
        ["Tipo de reparación", cleanValue(order.repair_type)],

        ["VEHÍCULO Y FALLA", ""],
        ["Código de vehículo", cleanValue(order.vehicle_code)],
        ["Vehículo", cleanValue(order.vehicle)],
        ["Dominio", cleanValue(order.license_plate)],
        ["Criticidad", cleanValue(order.criticality)],
        ["Tipo de falla", cleanValue(order.failure_type)],
        ["Localización de falla", cleanValue(order.failure_location)],
        ["Fecha de salida", formatDate(order.exit_date)],

        ["REPUESTOS Y PROVEEDOR", ""],
        ["Requiere repuesto", cleanValue(order.requires_spare_part)],
        ["Detalle de repuesto", cleanValue(order.spare_part_detail)],
      ];

      if (hasRealValue(order.spare_part_code)) {
        compactRows.push([
          "Código de repuesto",
          cleanValue(order.spare_part_code),
        ]);
      }

      if (hasRealValue(order.units)) {
        compactRows.push(["Unidades", cleanValue(order.units)]);
      }

      compactRows.push(
        ["Proveedor/es", formatProviders(order.provider)],
        ["Moneda", amountCurrency],
        ["Monto", formatMoney(order.amount, amountCurrency)],

        ["CHOFER Y OBSERVACIONES", ""],
        ["Chofer", cleanValue(order.driver)],
        ["Observaciones", cleanObservations(order.observations)],

        ["DATOS DE REGISTRO", ""],
        ["Creado", new Date(order.created_at).toLocaleString("es-AR")],
        [
          "Última modificación",
          new Date(order.updated_at).toLocaleString("es-AR"),
        ],
      );

      autoTable(doc, {
        startY: 44,
        body: compactRows,
        theme: "grid",
        margin: { left: 14, right: 14, bottom: 10 },
        pageBreak: "avoid",
        rowPageBreak: "avoid",
        styles: {
          fontSize: 8,
          cellPadding: 1.8,
          textColor: [51, 65, 85],
          lineColor: [226, 232, 240],
          lineWidth: 0.12,
          valign: "middle",
          overflow: "linebreak",
        },
        columnStyles: {
          0: { cellWidth: 52, fontStyle: "bold" },
          1: { cellWidth: 130 },
        },
        didParseCell: (data: CellHookData) => {
          const rawRow = data.row.raw;
          const firstValue = Array.isArray(rawRow) ? String(rawRow[0] ?? "") : "";

          const isSectionRow = [
            "INFORMACIÓN BÁSICA",
            "VEHÍCULO Y FALLA",
            "REPUESTOS Y PROVEEDOR",
            "CHOFER Y OBSERVACIONES",
            "DATOS DE REGISTRO",
          ].includes(firstValue);

          if (isSectionRow) {
            data.cell.styles.fillColor = [16, 185, 129];
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = "bold";

            if (data.column.index === 1) {
              data.cell.text = [""];
            }
          }

          if (firstValue === "Estado" && data.column.index === 1) {
            const colors = getPdfStatusColors(order.status);

            data.cell.styles.fillColor = colors.fillColor;
            data.cell.styles.textColor = colors.textColor;
            data.cell.styles.fontStyle = "bold";
          }

          if (firstValue === "Criticidad" && data.column.index === 1) {
            const value = Number(order.criticality);

            if (!Number.isFinite(value)) {
              data.cell.styles.fillColor = [241, 245, 249];
              data.cell.styles.textColor = [51, 65, 85];
            } else if (value >= 13) {
              data.cell.styles.fillColor = [254, 226, 226];
              data.cell.styles.textColor = [153, 27, 27];
            } else if (value >= 10) {
              data.cell.styles.fillColor = [254, 249, 195];
              data.cell.styles.textColor = [133, 77, 14];
            } else {
              data.cell.styles.fillColor = [220, 252, 231];
              data.cell.styles.textColor = [22, 101, 52];
            }

            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text("Página 1 de 1", pageWidth - 14, pageHeight - 7, {
        align: "right",
      });

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
            <Info
              label="N° orden de trabajo"
              value={cleanValue(order.order_number)}
            />
            <Info
              label="Fecha de ingreso"
              value={formatDate(order.entry_date)}
            />
            <Info label="Estado" value={cleanValue(order.status)} />
            <Info
              label="Área solicitante"
              value={cleanValue(order.requesting_area)}
            />
            <Info
              label="Reporte de falla"
              value={cleanValue(order.failure_report)}
            />
            <Info
              label="Tipo de reparación"
              value={cleanValue(order.repair_type)}
            />
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
            <Info
              label="Código de vehículo"
              value={cleanValue(order.vehicle_code)}
            />
            <Info label="Vehículo" value={cleanValue(order.vehicle)} />
            <Info label="Dominio" value={cleanValue(order.license_plate)} />
            <Info label="Criticidad" value={cleanValue(order.criticality)} />
            <Info
              label="Tipo de falla"
              value={cleanValue(order.failure_type)}
            />
            <Info
              label="Localización de falla"
              value={cleanValue(order.failure_location)}
            />
            <Info
              label="Fecha de salida"
              value={formatDate(order.exit_date)}
            />
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
            <Info
              label="Requiere repuesto"
              value={cleanValue(order.requires_spare_part)}
            />
            <Info
              label="Detalle de repuesto"
              value={cleanValue(order.spare_part_detail)}
            />

            {hasRealValue(order.spare_part_code) && (
              <Info
                label="Código de repuesto"
                value={cleanValue(order.spare_part_code)}
              />
            )}

            {hasRealValue(order.units) && (
              <Info label="Unidades" value={cleanValue(order.units)} />
            )}

            <Info label="Proveedor/es" value={formatProviders(order.provider)} />
            <Info label="Moneda" value={amountCurrency} />
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
              {cleanObservations(order.observations)}
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
            Última modificación:{" "}
            {new Date(order.updated_at).toLocaleString("es-AR")}
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