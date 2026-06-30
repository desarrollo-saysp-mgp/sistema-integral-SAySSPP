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

type SupplyItem = {
  code?: string | null;
  units?: string | number | null;
  description?: string | null;
};

type WorkOrderWithSupplies = WorkOrder & {
  supplies_needed?: SupplyItem[] | null;
};

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

const getCriticalityValue = (value?: string | number | null) => {
  const cleanCriticality = String(value ?? "").trim();

  return cleanCriticality || "--";
};

const getCriticalityBadgeClass = (criticality?: string | number | null) => {
  const value = Number(criticality);

  if (!Number.isFinite(value)) {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  if (value >= 13) {
    return "border-red-200 bg-red-100 text-red-800";
  }

  if (value >= 10) {
    return "border-yellow-200 bg-yellow-100 text-yellow-800";
  }

  return "border-green-200 bg-green-100 text-green-800";
};

const formatProviders = (value?: string | null) => {
  const providers = String(value || "")
    .split("|")
    .map((provider) => provider.trim())
    .filter(Boolean);

  if (providers.length === 0) return "-";

  return providers.join(", ");
};

const EMPTY_SUPPLY_ITEMS: SupplyItem[] = Array.from({ length: 5 }, () => ({
  code: "",
  units: "",
  description: "",
}));

const getSupplyItems = (order: WorkOrderWithSupplies) => {
  const cleanItems = Array.isArray(order.supplies_needed)
    ? order.supplies_needed
        .map((item) => ({
          code: String(item?.code || "").trim(),
          units: String(item?.units || "").trim(),
          description: String(item?.description || "").trim(),
        }))
        .filter((item) => item.code || item.units || item.description)
    : [];

  return cleanItems;
};

const getSupplyItemsForDisplay = (order: WorkOrderWithSupplies) => {
  const cleanItems = getSupplyItems(order);
  return cleanItems.length > 0 ? cleanItems : EMPTY_SUPPLY_ITEMS;
};

export function WorkOrderDetailClient({ order }: { order: WorkOrderWithSupplies }) {
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
      const marginX = 14;
      const contentWidth = pageWidth - marginX * 2;

      let logoDataUrl: string | null = null;

      try {
        logoDataUrl = await loadImageAsDataUrl(
          "/logo-general-pico-horizontal.png",
        );
      } catch (error) {
        console.warn("No se pudo cargar el logo para el PDF:", error);
      }

      const statusColors = getPdfStatusColors(order.status);

      const drawHeader = (pageNumber: number) => {
        if (logoDataUrl) {
          doc.addImage(logoDataUrl, "PNG", marginX, 7, 32, 14);
        }

        doc.setFontSize(13);
        doc.setTextColor(30, 41, 59);
        doc.text("Registro de Órdenes de Trabajo - Taller", 52, 15);

        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, 24, pageWidth - marginX, 24);

        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text(`Detalle de OT ${cleanValue(order.order_number)}`, marginX, 32);

        doc.setFillColor(...statusColors.fillColor);
        doc.roundedRect(pageWidth - 55, 27, 41, 8, 2, 2, "F");
        doc.setFontSize(7.5);
        doc.setTextColor(...statusColors.textColor);
        doc.text(cleanValue(order.status), pageWidth - 34.5, 32.2, {
          align: "center",
        });

        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Exportado: ${new Date().toLocaleString("es-AR")}`, marginX, 38);

        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text(`Página ${pageNumber} de 2`, pageWidth - marginX, pageHeight - 7, {
          align: "right",
        });
      };

      const registroRows: string[][] = [
        ["DATOS DE REGISTRO", ""],
        ["Creado", new Date(order.created_at).toLocaleString("es-AR")],
        [
          "Última modificación",
          new Date(order.updated_at).toLocaleString("es-AR"),
        ],
      ];

      const drawTable = (rows: string[][], startY: number) => {
        autoTable(doc, {
          startY,
          body: rows,
          theme: "grid",
          margin: { left: marginX, right: marginX, bottom: 8 },
          pageBreak: "avoid",
          rowPageBreak: "avoid",
          styles: {
            fontSize: 8,
            cellPadding: 2,
            textColor: [51, 65, 85],
            lineColor: [226, 232, 240],
            lineWidth: 0.12,
            valign: "middle",
            overflow: "linebreak",
          },
          columnStyles: {
            0: { cellWidth: 52, fontStyle: "bold" },
            1: { cellWidth: contentWidth - 52 },
          },
          didParseCell: (data: CellHookData) => {
            const rawRow = data.row.raw;
            const firstValue = Array.isArray(rawRow)
              ? String(rawRow[0] ?? "")
              : "";

            const isSectionRow = [
              "INFORMACIÓN BÁSICA",
              "VEHÍCULO Y FALLA",
              "REPUESTOS Y PROVEEDOR",
              "INSUMOS Y/O REPUESTOS NECESARIOS",
              "OBSERVACIONES",
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
      };

      const drawSuppliesTable = (startY: number) => {
        autoTable(doc, {
          startY,
          head: [
            ["INSUMOS Y/O REPUESTOS NECESARIOS", "", ""],
            ["Código", "Un.", "Descripción"],
          ],
          body: getSupplyItemsForDisplay(order).map((item) => [
            item.code || "-",
            item.units || "-",
            item.description || "-",
          ]),
          theme: "grid",
          margin: { left: marginX, right: marginX, bottom: 8 },
          pageBreak: "avoid",
          rowPageBreak: "avoid",
          styles: {
            fontSize: 8,
            cellPadding: 2,
            textColor: [51, 65, 85],
            lineColor: [226, 232, 240],
            lineWidth: 0.12,
            valign: "middle",
            overflow: "linebreak",
          },
          headStyles: {
            fillColor: [16, 185, 129],
            textColor: [255, 255, 255],
            fontStyle: "bold",
          },
          columnStyles: {
            0: { cellWidth: 35, fontStyle: "bold" },
            1: { cellWidth: 20 },
            2: { cellWidth: contentWidth - 55 },
          },
          didParseCell: (data: CellHookData) => {
            if (data.section !== "head") return;

            if (data.row.index === 0) {
              data.cell.styles.fillColor = [16, 185, 129];
              data.cell.styles.textColor = [255, 255, 255];
              data.cell.styles.fontStyle = "bold";
              return;
            }

            if (data.row.index === 1) {
              data.cell.styles.fillColor = [248, 250, 252];
              data.cell.styles.textColor = [51, 65, 85];
              data.cell.styles.fontStyle = "bold";
            }
          },
        });
      };

      const getLastAutoTableY = () => {
        const finalY = (
          doc as unknown as {
            lastAutoTable?: { finalY?: number };
          }
        ).lastAutoTable?.finalY;

        return typeof finalY === "number" ? finalY : 45;
      };

      drawHeader(1);

      const firstPageRows: string[][] = [
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
        ["Fecha ingreso al taller", formatDate(order.workshop_entry_date)],
        ["Chofer", cleanValue(order.driver)],

        ...registroRows,
      ];

      drawTable(firstPageRows, 45);

      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.25);
      doc.line(70, pageHeight - 42, pageWidth - 70, pageHeight - 42);

      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(
        "Firma y Aclaración Capataz",
        pageWidth / 2,
        pageHeight - 37,
        { align: "center" },
      );

      doc.addPage();
      drawHeader(2);

      const secondPageRows: string[][] = [
        ["VEHÍCULO Y FALLA", ""],
        ["Tipo de falla", cleanValue(order.failure_type)],
        ["Localización de falla", cleanValue(order.failure_location)],
        ["Fecha de salida", formatDate(order.exit_date)],

        ["REPUESTOS Y PROVEEDOR", ""],
        ["Requiere repuesto", cleanValue(order.requires_spare_part)],
        ["Detalle de repuesto", cleanValue(order.spare_part_detail)],
      ];

      if (hasRealValue(order.spare_part_code)) {
        secondPageRows.push([
          "Código de repuesto",
          cleanValue(order.spare_part_code),
        ]);
      }

      if (hasRealValue(order.units)) {
        secondPageRows.push(["Unidades", cleanValue(order.units)]);
      }

      secondPageRows.push(
        ["Proveedor/es", formatProviders(order.provider)],
        ["Moneda", amountCurrency],
        ["Monto", formatMoney(order.amount, amountCurrency)],
      );

      drawTable(secondPageRows, 45);

      if (getSupplyItems(order).length > 0) {
        drawSuppliesTable(getLastAutoTableY() + 6);
      }

      const observationsRows: string[][] = [
        ["OBSERVACIONES", ""],
        ["Observaciones", cleanObservations(order.observations)],
        ...registroRows,
      ];

      drawTable(observationsRows, getLastAutoTableY() + 6);

      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.25);

      const signatureY = pageHeight - 36;
      const signatureWidth = 48;
      const signatureGap = 10;
      const totalSignatureWidth = signatureWidth * 3 + signatureGap * 2;
      const signatureStartX = (pageWidth - totalSignatureWidth) / 2;

      const signatures = [
        "Firma y Aclaración Taller",
        "Firma y Aclaración Suministro",
        "Firma y Aclaración Director/Secretario",
      ];

      signatures.forEach((label, index) => {
        const x = signatureStartX + index * (signatureWidth + signatureGap);

        doc.line(x, signatureY, x + signatureWidth, signatureY);

        doc.setFontSize(7.2);
        doc.setTextColor(51, 65, 85);
        doc.text(label, x + signatureWidth / 2, signatureY + 5, {
          align: "center",
        });
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
            <CriticalityInfo value={order.criticality} />
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
            <Info
              label="Fecha ingreso al taller"
              value={formatDate(order.workshop_entry_date)}
            />
            <Info
              label="Fecha de cierre"
              value={formatDate(order.closed_date)}
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

          </div>

          <div className="mt-6 space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Insumos y/o repuestos necesarios
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Código, unidades y descripción de insumos solicitados.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <div className="grid grid-cols-[120px_80px_1fr] bg-muted/60 text-xs font-semibold text-muted-foreground">
                <div className="border-r px-3 py-2">Código</div>
                <div className="border-r px-3 py-2">Un.</div>
                <div className="px-3 py-2">Descripción</div>
              </div>

              {getSupplyItemsForDisplay(order).map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[120px_80px_1fr] border-t text-sm"
                >
                  <div className="border-r px-3 py-2">
                    {cleanValue(item.code)}
                  </div>
                  <div className="border-r px-3 py-2">
                    {cleanValue(item.units)}
                  </div>
                  <div className="px-3 py-2">
                    {cleanValue(item.description)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
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

function CriticalityInfo({ value }: { value?: string | number | null }) {
  const criticality = getCriticalityValue(value);

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-muted-foreground">
        Criticidad
      </p>

      <Badge
        className={`${getCriticalityBadgeClass(
          criticality,
        )} border px-3 py-1 text-sm font-semibold`}
      >
        {criticality}
      </Badge>
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