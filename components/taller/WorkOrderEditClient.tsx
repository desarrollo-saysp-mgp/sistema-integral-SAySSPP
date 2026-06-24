"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { WorkOrder } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import {
  AREA_SOLICITANTE_OPTIONS,
  DRIVER_OPTIONS,
  FAILURE_REPORT_OPTIONS,
  LOCALIZACION_FALLA_OPTIONS,
  PROVIDER_OPTIONS,
  REPAIR_TYPE_OPTIONS,
  REQUIRES_SPARE_PART_OPTIONS,
  STATUS_OPTIONS,
  TIPO_FALLA_OPTIONS,
  VEHICLE_OPTIONS,
} from "@/lib/taller/options";

type AmountCurrency = "ARS" | "USD";

type WorkOrderFormData = {
  order_number: string;
  entry_date: string;
  requesting_area: string;
  failure_report: string;
  repair_type: string;
  vehicle_code: string;
  criticality: string;
  failure_type: string;
  failure_location: string;
  requires_spare_part: string;
  vehicle: string;
  license_plate: string;
  exit_date: string;
  spare_part_detail: string;
  spare_part_code: string;
  units: string;
  provider: string;
  amount: string;
  amount_currency: AmountCurrency;
  observations: string;
  driver: string;
  status: string;
  workshop_entry_date: string;
  closed_date: string;
};

type PdfStatusColors = {
  fillColor: [number, number, number];
  textColor: [number, number, number];
};

const WORK_ORDERS_REGISTER_PATH = "/dashboard/taller/ordenes-trabajo";
const CURRENCY_MARKER_REGEX = /\n?\[\[amount_currency:(ARS|USD)\]\]/g;

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getUniqueOptions = (options: readonly string[]) => {
  const seen = new Set<string>();

  return options
    .map((option) => String(option || "").trim())
    .filter((option) => {
      if (!option) return false;

      const normalized = normalizeText(option);

      if (seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
};

const getCriticalityValue = (value?: string | number | null) => {
  const cleanValue = String(value ?? "").trim();

  return cleanValue || "--";
};

const getCriticalityClass = (criticality?: string | number | null) => {
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

const cleanTextValue = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const hasRealValue = (value?: string | number | null) => {
  return value !== null && value !== undefined && String(value).trim() !== "";
};

const getAmountCurrencyFromObservations = (
  observations?: string | null,
): AmountCurrency => {
  const match = String(observations || "").match(
    /\[\[amount_currency:(ARS|USD)\]\]/,
  );

  if (match?.[1] === "USD") return "USD";

  return "ARS";
};

const cleanObservations = (value?: string | null) => {
  return String(value || "").replace(CURRENCY_MARKER_REGEX, "").trim();
};

const buildObservationsWithCurrency = (
  observations: string,
  currency: AmountCurrency,
) => {
  const cleanedObservations = cleanObservations(observations);

  return [cleanedObservations, `[[amount_currency:${currency}]]`]
    .filter(Boolean)
    .join("\n");
};

const formatProviders = (value?: string | null) => {
  const providers = String(value || "")
    .split("|")
    .map((provider) => provider.trim())
    .filter(Boolean);

  if (providers.length === 0) return "-";

  return providers.join(", ");
};

const getVehicleMatchFromOrder = (order: WorkOrder) => {
  if (order.vehicle_code) {
    const byCode = VEHICLE_OPTIONS.find(
      (item) =>
        normalizeText(item.code) === normalizeText(order.vehicle_code || ""),
    );

    if (byCode) return byCode;
  }

  if (order.vehicle) {
    const byVehicle = VEHICLE_OPTIONS.find(
      (item) =>
        normalizeText(item.vehicle) === normalizeText(order.vehicle || ""),
    );

    if (byVehicle) return byVehicle;
  }

  if (order.license_plate) {
    const byLicensePlate = VEHICLE_OPTIONS.find(
      (item) =>
        normalizeText(item.licensePlate || "") ===
        normalizeText(order.license_plate || ""),
    );

    if (byLicensePlate) return byLicensePlate;
  }

  return null;
};

const getInitialFormData = (order: WorkOrder): WorkOrderFormData => {
  const matchedVehicle = getVehicleMatchFromOrder(order);

  return {
    order_number: order.order_number || "",
    entry_date: order.entry_date || "",
    requesting_area: order.requesting_area || "",
    failure_report: order.failure_report || "",
    repair_type: order.repair_type || "",
    vehicle_code: order.vehicle_code || matchedVehicle?.code || "",
    criticality: getCriticalityValue(
      order.criticality || matchedVehicle?.criticality,
    ),
    failure_type: order.failure_type || "",
    failure_location: order.failure_location || "",
    requires_spare_part: order.requires_spare_part || "",
    vehicle: order.vehicle || matchedVehicle?.vehicle || "",
    license_plate: order.license_plate || matchedVehicle?.licensePlate || "",
    exit_date: order.exit_date || "",
    spare_part_detail: order.spare_part_detail || "",
    spare_part_code: order.spare_part_code || "",
    units:
      order.units === null || order.units === undefined
        ? ""
        : String(order.units),
    provider: order.provider || "",
    amount:
      order.amount === null || order.amount === undefined
        ? ""
        : String(order.amount),
    amount_currency: getAmountCurrencyFromObservations(order.observations),
    observations: cleanObservations(order.observations),
    driver: order.driver || "",
    status: order.status || "",
    workshop_entry_date: order.workshop_entry_date || "",
    closed_date: order.closed_date || "",
  };
};

export function WorkOrderEditClient({ order }: { order: WorkOrder }) {
  const router = useRouter();

  const [formData, setFormData] = useState<WorkOrderFormData>(
    getInitialFormData(order),
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const shouldShowLegacySparePartCode = hasRealValue(order.spare_part_code);
  const shouldShowLegacyUnits = hasRealValue(order.units);

  const vehicleCodeOptions = useMemo(
    () => getUniqueOptions(VEHICLE_OPTIONS.map((item) => item.code)),
    [],
  );

  const vehicleNameOptions = useMemo(
    () => getUniqueOptions(VEHICLE_OPTIONS.map((item) => item.vehicle)),
    [],
  );

  const providerOptions = useMemo(() => getUniqueOptions(PROVIDER_OPTIONS), []);

  const handleChange = (field: keyof WorkOrderFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCurrencyChange = (value: string) => {
    if (value !== "ARS" && value !== "USD") return;

    setFormData((prev) => ({
      ...prev,
      amount_currency: value,
    }));
  };

  const handleVehicleCodeChange = (value: string) => {
    const selectedVehicle = VEHICLE_OPTIONS.find(
      (item) => normalizeText(item.code) === normalizeText(value),
    );

    setFormData((prev) => ({
      ...prev,
      vehicle_code: value,
      vehicle: selectedVehicle?.vehicle ?? prev.vehicle,
      license_plate: selectedVehicle?.licensePlate ?? prev.license_plate,
      criticality: getCriticalityValue(selectedVehicle?.criticality),
    }));
  };

  const handleVehicleNameChange = (value: string) => {
    const selectedVehicle = VEHICLE_OPTIONS.find(
      (item) => normalizeText(item.vehicle) === normalizeText(value),
    );

    setFormData((prev) => ({
      ...prev,
      vehicle: value,
      vehicle_code: selectedVehicle?.code ?? prev.vehicle_code,
      license_plate: selectedVehicle?.licensePlate ?? prev.license_plate,
      criticality: getCriticalityValue(selectedVehicle?.criticality),
    }));
  };

  const hasAtLeastOneValue = () => {
    return Object.entries(formData).some(([key, value]) => {
      if (key === "criticality") return value !== "--";
      if (key === "amount_currency") return false;

      return String(value || "").trim() !== "";
    });
  };

  const formatDateForPDF = (dateString?: string | null) => {
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

  const formatMoneyForPDF = (
    value?: string | number | null,
    currency: AmountCurrency = formData.amount_currency,
  ) => {
    if (value === null || value === undefined || value === "") return "-";

    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) return String(value);

    return numberValue.toLocaleString("es-AR", {
      style: "currency",
      currency,
    });
  };

  const cleanPdfValue = (value?: string | number | null) => {
    if (value === null || value === undefined || value === "") return "-";
    return String(value);
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

  const getSparePartPdfRows = () => {
    const rows: string[][] = [
      ["Requiere repuesto", cleanPdfValue(formData.requires_spare_part)],
      ["Detalle de repuesto", cleanPdfValue(formData.spare_part_detail)],
    ];

    if (shouldShowLegacySparePartCode) {
      rows.push(["Código de repuesto", cleanPdfValue(formData.spare_part_code)]);
    }

    if (shouldShowLegacyUnits) {
      rows.push(["Unidades", cleanPdfValue(formData.units)]);
    }

    rows.push(["Proveedor/es", formatProviders(formData.provider)]);
    rows.push(["Moneda", formData.amount_currency]);
    rows.push(["Monto", formatMoneyForPDF(formData.amount)]);

    return rows;
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
      doc.text(`Detalle de OT ${cleanPdfValue(formData.order_number)}`, 14, 40);

      const statusColors = getPdfStatusColors(formData.status);

      doc.setFillColor(...statusColors.fillColor);
      doc.roundedRect(pageWidth - 58, 34, 44, 9, 3, 3, "F");
      doc.setFontSize(8.5);
      doc.setTextColor(...statusColors.textColor);
      doc.text(cleanPdfValue(formData.status), pageWidth - 36, 40, {
        align: "center",
      });

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Exportado: ${new Date().toLocaleString("es-AR")}`, 14, 47);

      autoTable(doc, {
        startY: 55,
        head: [["Información básica", ""]],
        body: [
          ["N° orden de trabajo", cleanPdfValue(formData.order_number)],
          ["Fecha de ingreso", formatDateForPDF(formData.entry_date)],
          ["Estado", cleanPdfValue(formData.status)],
          ["Fecha ingreso al taller", formatDateForPDF(formData.workshop_entry_date)],
          ["Fecha de cierre", formatDateForPDF(formData.closed_date)],
          ["Área solicitante", cleanPdfValue(formData.requesting_area)],
          ["Reporte de falla", cleanPdfValue(formData.failure_report)],
          ["Tipo de reparación", cleanPdfValue(formData.repair_type)],
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
            const colors = getPdfStatusColors(formData.status);

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
          ["Código de vehículo", cleanPdfValue(formData.vehicle_code)],
          ["Vehículo", cleanPdfValue(formData.vehicle)],
          ["Dominio", cleanPdfValue(formData.license_plate)],
          ["Criticidad", cleanPdfValue(formData.criticality)],
          ["Tipo de falla", cleanPdfValue(formData.failure_type)],
          ["Localización de falla", cleanPdfValue(formData.failure_location)],
          ["Fecha de salida", formatDateForPDF(formData.exit_date)],
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
            data.row.index === 3 &&
            data.column.index === 1
          ) {
            const value = Number(formData.criticality);

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

      autoTable(doc, {
        startY: getLastAutoTableY(doc) + 8,
        head: [["Repuestos y proveedor", ""]],
        body: getSparePartPdfRows(),
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
          ["Chofer", cleanPdfValue(formData.driver)],
          ["Observaciones", cleanPdfValue(formData.observations)],
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
        doc.text(
          `Página ${index} de ${pageCount}`,
          pageWidth - 14,
          pageHeight - 8,
          {
            align: "right",
          },
        );
      }

      doc.save(`ot_${cleanPdfValue(formData.order_number)}.pdf`);
      toast.success("PDF de la OT exportado correctamente");
    } catch (error) {
      console.error("Error exporting OT PDF:", error);
      toast.error("Error al exportar PDF");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!hasAtLeastOneValue()) {
      toast.error("Cargá al menos un dato para guardar la orden de trabajo");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/work-orders/${order.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          spare_part_code: shouldShowLegacySparePartCode
            ? formData.spare_part_code || null
            : null,
          units:
            shouldShowLegacyUnits && formData.units
              ? Number(formData.units)
              : null,
          amount: formData.amount ? Number(formData.amount) : null,
          observations: buildObservationsWithCurrency(
            formData.observations,
            formData.amount_currency,
          ),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al actualizar orden de trabajo");
      }

      toast.success("Orden de trabajo actualizada correctamente");
      router.push(WORK_ORDERS_REGISTER_PATH);
      router.refresh();
    } catch (error) {
      console.error("Error updating work order:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al actualizar orden de trabajo",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);

    try {
      const response = await fetch(`/api/work-orders/${order.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al eliminar orden de trabajo");
      }

      toast.success("Orden de trabajo eliminada correctamente");
      setIsDeleteDialogOpen(false);
      router.push(WORK_ORDERS_REGISTER_PATH);
      router.refresh();
    } catch (error) {
      console.error("Error deleting work order:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al eliminar orden de trabajo",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(WORK_ORDERS_REGISTER_PATH)}
            className="-ml-2 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al registro
          </Button>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportPDF}
              disabled={saving || deleting}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Exportar PDF
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={saving || deleting}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar OT
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Información básica</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 pt-0">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Field label="N° orden de trabajo">
                <Input
                  value={formData.order_number}
                  onChange={(event) =>
                    handleChange("order_number", event.target.value)
                  }
                  placeholder="Ej: 1"
                />
              </Field>

              <Field label="Fecha de ingreso">
                <Input
                  type="date"
                  value={formData.entry_date}
                  onChange={(event) =>
                    handleChange("entry_date", event.target.value)
                  }
                />
              </Field>

              <ComboField
                label="Estado"
                value={formData.status}
                onChange={(value) => handleChange("status", value)}
                options={STATUS_OPTIONS}
                placeholder="Seleccione o escriba"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Field label="Fecha ingreso al taller">
                <Input
                  type="date"
                  value={formData.workshop_entry_date}
                  onChange={(event) =>
                    handleChange("workshop_entry_date", event.target.value)
                  }
                />
              </Field>

              <Field label="Fecha de cierre">
                <Input
                  type="date"
                  value={formData.closed_date}
                  onChange={(event) =>
                    handleChange("closed_date", event.target.value)
                  }
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <ComboField
                label="Área solicitante"
                value={formData.requesting_area}
                onChange={(value) => handleChange("requesting_area", value)}
                options={AREA_SOLICITANTE_OPTIONS}
                placeholder="Ej: GIRSU"
              />

              <ComboField
                label="Tipo de reparación"
                value={formData.repair_type}
                onChange={(value) => handleChange("repair_type", value)}
                options={REPAIR_TYPE_OPTIONS}
                placeholder="Seleccione o escriba"
              />
            </div>

            <ComboField
              label="Reporte de falla"
              value={formData.failure_report}
              onChange={(value) => handleChange("failure_report", value)}
              options={FAILURE_REPORT_OPTIONS}
              placeholder="Si / No"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Vehículo y falla</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 pt-0">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <ComboField
                label="Código de vehículo"
                value={formData.vehicle_code}
                onChange={handleVehicleCodeChange}
                options={vehicleCodeOptions}
                placeholder="Ej: RD.4"
              />

              <ComboField
                label="Vehículo"
                value={formData.vehicle}
                onChange={handleVehicleNameChange}
                options={vehicleNameOptions}
                placeholder="Ej: IVECO"
              />

              <Field label="Dominio">
                <Input
                  value={formData.license_plate}
                  onChange={(event) =>
                    handleChange("license_plate", event.target.value)
                  }
                  placeholder="Ej: AB123CD"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <CriticalityField value={formData.criticality} />

              <ComboField
                label="Tipo de falla"
                value={formData.failure_type}
                onChange={(value) => handleChange("failure_type", value)}
                options={TIPO_FALLA_OPTIONS}
                placeholder="Ej: Alternador"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <ComboField
                label="Localización de falla"
                value={formData.failure_location}
                onChange={(value) => handleChange("failure_location", value)}
                options={LOCALIZACION_FALLA_OPTIONS}
                placeholder="Ej: Motor"
              />

              <Field label="Fecha de salida">
                <Input
                  type="date"
                  value={formData.exit_date}
                  onChange={(event) =>
                    handleChange("exit_date", event.target.value)
                  }
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Repuestos y proveedor</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 pt-0">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <ComboField
                label="Requiere repuesto"
                value={formData.requires_spare_part}
                onChange={(value) =>
                  handleChange("requires_spare_part", value)
                }
                options={REQUIRES_SPARE_PART_OPTIONS}
                placeholder="SI / NO"
              />

              <Field label="Detalle de repuesto">
                <Input
                  value={formData.spare_part_detail}
                  onChange={(event) =>
                    handleChange("spare_part_detail", event.target.value)
                  }
                  placeholder="Ej: Batería, filtro, manguera..."
                />
              </Field>
            </div>

            {(shouldShowLegacySparePartCode || shouldShowLegacyUnits) && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {shouldShowLegacySparePartCode && (
                  <Field label="Código de repuesto anterior">
                    <Input
                      value={formData.spare_part_code}
                      onChange={(event) =>
                        handleChange("spare_part_code", event.target.value)
                      }
                      placeholder="Código de repuesto anterior"
                    />
                  </Field>
                )}

                {shouldShowLegacyUnits && (
                  <Field label="Unidades anteriores">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={formData.units}
                      onChange={(event) =>
                        handleChange("units", event.target.value)
                      }
                      placeholder="0"
                    />
                  </Field>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <MultiProviderField
                label="Proveedor/es"
                value={formData.provider}
                onChange={(value) => handleChange("provider", value)}
                options={providerOptions}
                placeholder="Seleccione o escriba un proveedor"
              />

              <Field label="Moneda">
                <select
                  value={formData.amount_currency}
                  onChange={(event) => handleCurrencyChange(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="ARS">Pesos argentinos (ARS)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </Field>

              <Field label="Monto">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={formData.amount}
                  onChange={(event) =>
                    handleChange("amount", event.target.value)
                  }
                  placeholder={
                    formData.amount_currency === "USD" ? "Ej: 120" : "Ej: 150000"
                  }
                />
              </Field>
            </div>

            <ComboField
              label="Chofer"
              value={formData.driver}
              onChange={(value) => handleChange("driver", value)}
              options={DRIVER_OPTIONS}
              placeholder="Chofer"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Observaciones</CardTitle>
          </CardHeader>

          <CardContent className="pt-0">
            <Field label="Detalle / observaciones">
              <textarea
                value={formData.observations}
                onChange={(event) =>
                  handleChange("observations", event.target.value)
                }
                rows={5}
                placeholder="Escribí observaciones de la orden de trabajo..."
                className="w-full min-h-[120px] resize-none rounded-md border border-input bg-background px-3 py-3 text-sm ring-offset-background placeholder:text-muted-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </Field>


          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-20 -mx-6 border-t bg-background/95 px-6 py-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(WORK_ORDERS_REGISTER_PATH)}
              disabled={saving || deleting}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={saving || deleting}
              className="w-full gap-2 sm:w-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar cambios
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl border bg-background p-5 shadow-lg">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Eliminar OT</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  ¿Seguro que querés eliminar esta orden de trabajo?
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={deleting}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <p>
                <span className="font-medium">OT:</span>{" "}
                {order.order_number || "-"}
              </p>
              <p>
                <span className="font-medium">Vehículo:</span>{" "}
                {formData.vehicle || "-"}
              </p>
              <p>
                <span className="font-medium">Dominio:</span>{" "}
                {formData.license_plate || "-"}
              </p>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Esta acción no se puede deshacer.
            </p>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={deleting}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                className="gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Eliminar definitivamente
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function CriticalityField({ value }: { value: string }) {
  const criticality = getCriticalityValue(value);

  return (
    <div className="space-y-2">
      <Label>Criticidad</Label>

      <div
        className={`flex h-10 items-center rounded-md border px-3 text-sm font-semibold ${getCriticalityClass(
          criticality,
        )}`}
      >
        {criticality}
      </div>
    </div>
  );
}

function MultiProviderField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const providers = useMemo(() => {
    return String(value || "")
      .split("|")
      .map((provider) => provider.trim())
      .filter(Boolean);
  }, [value]);

  const addProvider = (providerValue: string) => {
    const cleanProvider = providerValue.trim();

    if (!cleanProvider) return;

    const exists = providers.some(
      (provider) => normalizeText(provider) === normalizeText(cleanProvider),
    );

    if (exists) {
      setDraft("");
      return;
    }

    onChange([...providers, cleanProvider].join(" | "));
    setDraft("");
  };

  const removeProvider = (providerValue: string) => {
    onChange(
      providers
        .filter(
          (provider) =>
            normalizeText(provider) !== normalizeText(providerValue),
        )
        .join(" | "),
    );
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <div className="space-y-2">
        {providers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {providers.map((provider) => (
              <span
                key={provider}
                className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-xs font-medium"
              >
                {provider}

                <button
                  type="button"
                  onClick={() => removeProvider(provider)}
                  className="rounded-full text-muted-foreground hover:text-destructive"
                  aria-label={`Quitar proveedor ${provider}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <ComboInput
              value={draft}
              onChange={setDraft}
              onSelect={addProvider}
              options={options}
              placeholder={placeholder}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => addProvider(draft)}
            className="h-10 shrink-0 gap-2"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Podés agregar uno o varios proveedores.
        </p>
      </div>
    </div>
  );
}

function ComboInput({
  value,
  onChange,
  onSelect,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const uniqueOptions = useMemo(() => getUniqueOptions(options), [options]);

  const visibleOptions = useMemo(() => {
    const query = normalizeText(value);

    if (!query) {
      return uniqueOptions;
    }

    return uniqueOptions.filter((option) =>
      normalizeText(option).includes(query),
    );
  }, [uniqueOptions, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSelect(value);
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="h-10 pr-10"
        />

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label="Abrir proveedores"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-[80] mt-1 max-h-[260px] w-full overflow-y-auto rounded-md border border-border bg-background shadow-lg">
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onSelect(option);
                  setIsOpen(false);
                }}
                className="flex min-h-9 w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                <span className="break-words leading-snug">{option}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No se encontraron opciones
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ComboField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const uniqueOptions = useMemo(() => getUniqueOptions(options), [options]);

  const visibleOptions = useMemo(() => {
    const query = normalizeText(searchText);

    if (!query) {
      return uniqueOptions;
    }

    return uniqueOptions.filter((option) =>
      normalizeText(option).includes(query),
    );
  }, [uniqueOptions, searchText]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchText("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const openDropdown = () => {
    setSearchText("");
    setIsOpen(true);
  };

  const handleSelect = (option: string) => {
    onChange(option);
    setSearchText("");
    setIsOpen(false);
  };

  return (
    <Field label={label}>
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Input
            value={isOpen && searchText ? searchText : value}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSearchText(nextValue);
              onChange(nextValue);
              setIsOpen(true);
            }}
            onFocus={openDropdown}
            placeholder={placeholder}
            autoComplete="off"
            className="h-10 pr-10"
          />

          <button
            type="button"
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
                setSearchText("");
              } else {
                openDropdown();
              }
            }}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label={`Abrir opciones de ${label}`}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {isOpen && (
          <div className="absolute z-[80] mt-1 max-h-[260px] w-full overflow-y-auto rounded-md border border-border bg-background shadow-lg">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => {
                const isSelected =
                  normalizeText(option) === normalizeText(value);

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`flex min-h-9 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                      isSelected ? "bg-muted" : ""
                    }`}
                  >
                    <span className="break-words leading-snug">{option}</span>

                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No se encontraron opciones
              </div>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}