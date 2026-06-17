"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { WorkOrder } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PlusCircle,
  Search,
  Loader2,
  ClipboardList,
  Eye,
  Pencil,
  Filter,
  X,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import { VEHICLE_OPTIONS } from "@/lib/taller/options";

const ALL_VALUE = "Todos";
const ITEMS_PER_PAGE = 15;
const CURRENCY_MARKER_REGEX = /\n?\[\[amount_currency:(ARS|USD)\]\]/g;

const statusOptions = [
  "INICIADO",
  "PRESUPUESTOS",
  "COMPRAS",
  "TALLER",
  "TALLER TERCERIZADO",
  "CERRADO",
];

type AmountCurrency = "ARS" | "USD";

type PdfStatusColors = {
  fillColor: [number, number, number];
  textColor: [number, number, number];
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getVehicleFromCode = (vehicleCode?: string | null) => {
  if (!vehicleCode) return null;

  return VEHICLE_OPTIONS.find(
    (item) => normalizeText(item.code) === normalizeText(vehicleCode),
  );
};

const getVehicleLabel = (order: WorkOrder) => {
  if (order.vehicle && order.vehicle.trim()) {
    return order.vehicle;
  }

  const matchedVehicle = getVehicleFromCode(order.vehicle_code);
  return matchedVehicle?.vehicle || "-";
};

const getLicensePlateLabel = (order: WorkOrder) => {
  if (order.license_plate && order.license_plate.trim()) {
    return order.license_plate;
  }

  const matchedVehicle = getVehicleFromCode(order.vehicle_code);
  return matchedVehicle?.licensePlate || "-";
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

const formatMoney = (
  value?: number | null,
  currency: AmountCurrency = "ARS",
) => {
  if (value === null || value === undefined) return "-";

  return value.toLocaleString("es-AR", {
    style: "currency",
    currency,
  });
};

const formatOrderMoney = (order: WorkOrder) => {
  return formatMoney(order.amount, getAmountCurrency(order));
};

const getUniqueOptions = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();

  return values
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value || value === "-") return false;

      const normalized = normalizeText(value);

      if (seen.has(normalized)) return false;

      seen.add(normalized);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, "es"));
};

const isDateInRange = (
  dateString: string | null | undefined,
  dateFrom: string,
  dateTo: string,
) => {
  if (!dateFrom && !dateTo) return true;
  if (!dateString) return false;

  const dateValue = dateString;

  if (dateFrom && dateValue < dateFrom) return false;
  if (dateTo && dateValue > dateTo) return false;

  return true;
};

const getDateTimeValue = (dateString?: string | null) => {
  if (!dateString) return 0;

  const [year, month, day] = dateString.split("-").map(Number);

  if (!year || !month || !day) return 0;

  return new Date(year, month - 1, day).getTime();
};

export function WorkOrdersClient() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState(ALL_VALUE);
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [repairTypeFilter, setRepairTypeFilter] = useState(ALL_VALUE);
  const [vehicleFilter, setVehicleFilter] = useState(ALL_VALUE);
  const [failureTypeFilter, setFailureTypeFilter] = useState(ALL_VALUE);
  const [driverFilter, setDriverFilter] = useState(ALL_VALUE);

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/work-orders");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al cargar órdenes de trabajo");
      }

      setWorkOrders(result.data || []);
    } catch (error) {
      console.error("Error fetching work orders:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al cargar órdenes de trabajo",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const areaOptions = useMemo(() => {
    return getUniqueOptions(workOrders.map((order) => order.requesting_area));
  }, [workOrders]);

  const repairTypeOptions = useMemo(() => {
    return getUniqueOptions(workOrders.map((order) => order.repair_type));
  }, [workOrders]);

  const vehicleOptions = useMemo(() => {
    return getUniqueOptions(workOrders.map((order) => getVehicleLabel(order)));
  }, [workOrders]);

  const failureTypeOptions = useMemo(() => {
    return getUniqueOptions(workOrders.map((order) => order.failure_type));
  }, [workOrders]);

  const driverOptions = useMemo(() => {
    return getUniqueOptions(workOrders.map((order) => order.driver));
  }, [workOrders]);

  const filteredWorkOrders = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    const filtered = workOrders.filter((order) => {
      const vehicleLabel = getVehicleLabel(order);
      const licensePlateLabel = getLicensePlateLabel(order);
      const cleanObservationLabel = cleanObservations(order.observations);
      const providerLabel = formatProviders(order.provider);
      const amountLabel = formatOrderMoney(order);

      const matchesSearch =
        !normalizedSearch ||
        normalizeText(order.order_number).includes(normalizedSearch) ||
        normalizeText(order.vehicle_code).includes(normalizedSearch) ||
        normalizeText(vehicleLabel).includes(normalizedSearch) ||
        normalizeText(licensePlateLabel).includes(normalizedSearch) ||
        normalizeText(order.driver).includes(normalizedSearch) ||
        normalizeText(order.provider).includes(normalizedSearch) ||
        normalizeText(providerLabel).includes(normalizedSearch) ||
        normalizeText(cleanObservationLabel).includes(normalizedSearch) ||
        normalizeText(amountLabel).includes(normalizedSearch) ||
        normalizeText(order.failure_report).includes(normalizedSearch) ||
        normalizeText(order.failure_type).includes(normalizedSearch) ||
        normalizeText(order.failure_location).includes(normalizedSearch) ||
        normalizeText(order.repair_type).includes(normalizedSearch) ||
        normalizeText(order.spare_part_detail).includes(normalizedSearch);

      const matchesArea =
        areaFilter === ALL_VALUE ||
        normalizeText(order.requesting_area) === normalizeText(areaFilter);

      const matchesStatus =
        statusFilter === ALL_VALUE ||
        normalizeText(order.status) === normalizeText(statusFilter);

      const matchesRepairType =
        repairTypeFilter === ALL_VALUE ||
        normalizeText(order.repair_type) === normalizeText(repairTypeFilter);

      const matchesVehicle =
        vehicleFilter === ALL_VALUE ||
        normalizeText(vehicleLabel) === normalizeText(vehicleFilter) ||
        normalizeText(order.vehicle_code) === normalizeText(vehicleFilter);

      const matchesFailureType =
        failureTypeFilter === ALL_VALUE ||
        normalizeText(order.failure_type) === normalizeText(failureTypeFilter);

      const matchesDriver =
        driverFilter === ALL_VALUE ||
        normalizeText(order.driver) === normalizeText(driverFilter);

      const matchesDate = isDateInRange(
        order.entry_date,
        dateFromFilter,
        dateToFilter,
      );

      return (
        matchesSearch &&
        matchesArea &&
        matchesStatus &&
        matchesRepairType &&
        matchesVehicle &&
        matchesFailureType &&
        matchesDriver &&
        matchesDate
      );
    });

    return filtered.sort((a, b) => {
      const dateA = getDateTimeValue(a.entry_date);
      const dateB = getDateTimeValue(b.entry_date);

      if (dateA !== dateB) {
        return dateB - dateA;
      }

      const orderNumberA = Number(a.order_number);
      const orderNumberB = Number(b.order_number);

      if (Number.isFinite(orderNumberA) && Number.isFinite(orderNumberB)) {
        return orderNumberB - orderNumberA;
      }

      return String(b.order_number || "").localeCompare(
        String(a.order_number || ""),
        "es",
        { numeric: true },
      );
    });
  }, [
    workOrders,
    search,
    areaFilter,
    statusFilter,
    dateFromFilter,
    dateToFilter,
    repairTypeFilter,
    vehicleFilter,
    failureTypeFilter,
    driverFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredWorkOrders.length / ITEMS_PER_PAGE),
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    areaFilter,
    statusFilter,
    dateFromFilter,
    dateToFilter,
    repairTypeFilter,
    vehicleFilter,
    failureTypeFilter,
    driverFilter,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setSelectedOrderIds((prev) =>
      prev.filter((id) =>
        filteredWorkOrders.some((order) => String(order.id) === id),
      ),
    );
  }, [filteredWorkOrders]);

  const paginatedWorkOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;

    return filteredWorkOrders.slice(start, end);
  }, [filteredWorkOrders, currentPage]);

  const selectedWorkOrders = useMemo(() => {
    return filteredWorkOrders.filter((order) =>
      selectedOrderIds.includes(String(order.id)),
    );
  }, [filteredWorkOrders, selectedOrderIds]);

  const exportWorkOrders =
    selectedWorkOrders.length > 0 ? selectedWorkOrders : filteredWorkOrders;

  const hasSelectedOrders = selectedWorkOrders.length > 0;

  const allVisibleSelected =
    paginatedWorkOrders.length > 0 &&
    paginatedWorkOrders.every((order) =>
      selectedOrderIds.includes(String(order.id)),
    );

  const someVisibleSelected =
    paginatedWorkOrders.some((order) =>
      selectedOrderIds.includes(String(order.id)),
    ) && !allVisibleSelected;

  const hasActiveFilters =
    search.trim() ||
    areaFilter !== ALL_VALUE ||
    statusFilter !== ALL_VALUE ||
    dateFromFilter ||
    dateToFilter ||
    repairTypeFilter !== ALL_VALUE ||
    vehicleFilter !== ALL_VALUE ||
    failureTypeFilter !== ALL_VALUE ||
    driverFilter !== ALL_VALUE;

  const clearFilters = () => {
    setSearch("");
    setAreaFilter(ALL_VALUE);
    setStatusFilter(ALL_VALUE);
    setDateFromFilter("");
    setDateToFilter("");
    setRepairTypeFilter(ALL_VALUE);
    setVehicleFilter(ALL_VALUE);
    setFailureTypeFilter(ALL_VALUE);
    setDriverFilter(ALL_VALUE);
    setSelectedOrderIds([]);
    setCurrentPage(1);
  };

  const toggleOrderSelection = (orderId: string, checked: boolean) => {
    setSelectedOrderIds((prev) =>
      checked ? [...prev, orderId] : prev.filter((id) => id !== orderId),
    );
  };

  const toggleVisibleSelection = (checked: boolean) => {
    const visibleIds = paginatedWorkOrders.map((order) => String(order.id));

    if (checked) {
      setSelectedOrderIds((prev) => [...new Set([...prev, ...visibleIds])]);
      return;
    }

    setSelectedOrderIds((prev) =>
      prev.filter((id) => !visibleIds.includes(id)),
    );
  };

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

  const getStatusBadgeClass = (status?: string | null) => {
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

  const getVisibleRangeText = () => {
    const start =
      filteredWorkOrders.length === 0
        ? 0
        : (currentPage - 1) * ITEMS_PER_PAGE + 1;

    const end = Math.min(
      currentPage * ITEMS_PER_PAGE,
      filteredWorkOrders.length,
    );

    return { start, end };
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
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

  const buildWhatsAppMessage = (items: WorkOrder[]) => {
    const partes: string[] = ["*Órdenes de trabajo:*", ""];

    items.forEach((order, index) => {
      partes.push(`*OT ${index + 1}*`);
      partes.push(`N° OT: *${order.order_number || "-"}*`);
      partes.push(`Fecha ingreso: *${formatDate(order.entry_date)}*`);
      partes.push(`Fecha salida: *${formatDate(order.exit_date)}*`);
      partes.push(`Área solicitante: *${order.requesting_area || "-"}*`);
      partes.push(`Código vehículo: *${order.vehicle_code || "-"}*`);
      partes.push(`Vehículo: *${getVehicleLabel(order)}*`);
      partes.push(`Dominio: *${getLicensePlateLabel(order)}*`);
      partes.push(`Criticidad: *${order.criticality || "-"}*`);
      partes.push(`Tipo de falla: *${order.failure_type || "-"}*`);
      partes.push(`Localización de falla: *${order.failure_location || "-"}*`);
      partes.push(`Reporte de falla: *${order.failure_report || "-"}*`);
      partes.push(`Tipo de reparación: *${order.repair_type || "-"}*`);
      partes.push(`Requiere repuesto: *${order.requires_spare_part || "-"}*`);
      partes.push(`Detalle repuesto: *${order.spare_part_detail || "-"}*`);
      partes.push(`Proveedor/es: *${formatProviders(order.provider)}*`);
      partes.push(`Monto: *${formatOrderMoney(order)}*`);
      partes.push(`Chofer: *${order.driver || "-"}*`);
      partes.push(`Estado: *${order.status || "-"}*`);
      partes.push(`Observaciones: *${cleanObservations(order.observations)}*`);
      partes.push("");
    });

    return partes.join("\n");
  };

  const handleSendWhatsApp = () => {
    if (selectedWorkOrders.length === 0) {
      toast.error("Seleccioná al menos una OT para enviar por WhatsApp");
      return;
    }

    const mensaje = buildWhatsAppMessage(selectedWorkOrders);
    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const exportToExcel = () => {
    try {
      const formattedData = exportWorkOrders.map((order) => ({
        "Orden de trabajo": order.order_number || "-",
        "Fecha de ingreso": formatDate(order.entry_date),
        "Fecha de salida": formatDate(order.exit_date),
        "Área solicitante": order.requesting_area || "-",
        "Código de vehículo": order.vehicle_code || "-",
        Vehículo: getVehicleLabel(order),
        Dominio: getLicensePlateLabel(order),
        Criticidad: order.criticality || "-",
        "Tipo de falla": order.failure_type || "-",
        "Localización de falla": order.failure_location || "-",
        "Reporte de falla": order.failure_report || "-",
        "Tipo de reparación": order.repair_type || "-",
        "Requiere repuesto": order.requires_spare_part || "-",
        "Detalle de repuesto": order.spare_part_detail || "-",
        "Proveedor/es": formatProviders(order.provider),
        Moneda: getAmountCurrency(order),
        Monto: order.amount ?? "-",
        "Monto formateado": formatOrderMoney(order),
        Chofer: order.driver || "-",
        Estado: order.status || "-",
        Observaciones: cleanObservations(order.observations),
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "Ordenes de Trabajo");

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
      });

      saveAs(
        blob,
        hasSelectedOrders
          ? "ordenes_trabajo_seleccionadas.xlsx"
          : "ordenes_trabajo_filtradas.xlsx",
      );

      toast.success(
        hasSelectedOrders
          ? "Excel de OT seleccionadas exportado correctamente"
          : "Excel de OT filtradas exportado correctamente",
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
      doc.text("Sistema Integral SAySSPP", 52, 15);

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text("Registro de Órdenes de Trabajo - Taller", 52, 21);
      doc.text(`Cantidad de OT exportadas: ${exportWorkOrders.length}`, 14, 31);
      doc.text(
        `Fecha de exportación: ${new Date().toLocaleString("es-AR")}`,
        14,
        37,
      );

      const tableData = exportWorkOrders.map((order) => [
        order.order_number || "-",
        formatDate(order.entry_date),
        order.requesting_area || "-",
        order.vehicle_code || "-",
        getVehicleLabel(order),
        getLicensePlateLabel(order),
        order.failure_type || "-",
        order.repair_type || "-",
        formatProviders(order.provider),
        formatOrderMoney(order),
        order.status || "-",
      ]);

      autoTable(doc, {
        startY: 44,
        head: [
          [
            "OT",
            "Fecha",
            "Área",
            "Código",
            "Vehículo",
            "Dominio",
            "Falla",
            "Reparación",
            "Proveedor/es",
            "Monto",
            "Estado",
          ],
        ],
        body: tableData,
        theme: "grid",
        showHead: "everyPage",
        pageBreak: "auto",
        rowPageBreak: "avoid",
        margin: { top: 44, right: 10, bottom: 14, left: 10 },
        styles: {
          fontSize: 7,
          cellPadding: 1.7,
          overflow: "linebreak",
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
          0: { cellWidth: 12 },
          1: { cellWidth: 18 },
          2: { cellWidth: 24 },
          3: { cellWidth: 20 },
          4: { cellWidth: 42 },
          5: { cellWidth: 20 },
          6: { cellWidth: 26 },
          7: { cellWidth: 24 },
          8: { cellWidth: 34 },
          9: { cellWidth: 24 },
          10: { cellWidth: 24 },
        },
        didParseCell: (data: CellHookData) => {
          if (data.section === "body" && data.column.index === 10) {
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
            doc.internal.pageSize.getWidth() - 30,
            doc.internal.pageSize.getHeight() - 8,
          );
        },
      });

      doc.save(
        hasSelectedOrders
          ? "ordenes_trabajo_seleccionadas.pdf"
          : "ordenes_trabajo_filtradas.pdf",
      );

      toast.success(
        hasSelectedOrders
          ? "PDF de OT seleccionadas exportado correctamente"
          : "PDF de OT filtradas exportado correctamente",
      );
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Error al exportar PDF");
    }
  };

  const { start, end } = getVisibleRangeText();
  const pageNumbers = getPageNumbers();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Registro de OT</h2>
          <p className="text-sm text-muted-foreground">
            Consultá y seguí las órdenes de trabajo cargadas.
          </p>
        </div>

        <Button asChild className="h-9 gap-2 rounded-xl">
          <Link href="/dashboard/taller/ordenes-trabajo/nueva">
            <PlusCircle className="h-4 w-4" />
            Cargar nueva OT
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Órdenes cargadas</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Usá los filtros para encontrar rápidamente una orden de trabajo.
              </p>
            </div>

            <div className="w-fit rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
              {filteredWorkOrders.length} de {workOrders.length} OT
              {filteredWorkOrders.length === 1 ? " encontrada" : " encontradas"}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-3 shadow-sm">
            <div className="mb-3 flex items-center gap-2 border-b pb-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Filter className="h-4 w-4 text-primary" />
              </div>

              <div>
                <p className="text-sm font-semibold leading-none">Filtros</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Filtrá por área, estado, fecha, vehículo, falla y chofer.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por OT, vehículo, dominio, chofer, proveedor, falla, monto..."
                  className="h-9 rounded-xl pl-9"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <FilterSelect
                  value={areaFilter}
                  onValueChange={setAreaFilter}
                  placeholder="Área"
                  options={areaOptions}
                />

                <FilterSelect
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  placeholder="Estado"
                  options={statusOptions}
                />

                <FilterSelect
                  value={repairTypeFilter}
                  onValueChange={setRepairTypeFilter}
                  placeholder="Tipo de reparación"
                  options={repairTypeOptions}
                />

                <FilterSelect
                  value={vehicleFilter}
                  onValueChange={setVehicleFilter}
                  placeholder="Vehículo"
                  options={vehicleOptions}
                />

                <FilterSelect
                  value={failureTypeFilter}
                  onValueChange={setFailureTypeFilter}
                  placeholder="Tipo de falla"
                  options={failureTypeOptions}
                />

                <FilterSelect
                  value={driverFilter}
                  onValueChange={setDriverFilter}
                  placeholder="Chofer"
                  options={driverOptions}
                />

                <DateFilter
                  label="Fecha desde"
                  value={dateFromFilter}
                  onChange={setDateFromFilter}
                />

                <DateFilter
                  label="Fecha hasta"
                  value={dateToFilter}
                  onChange={setDateToFilter}
                />
              </div>

              <div className="flex flex-col gap-2 border-t pt-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                    className="h-9 gap-2 rounded-xl"
                  >
                    <X className="h-4 w-4" />
                    Limpiar
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={fetchWorkOrders}
                    disabled={loading}
                    className="h-9 gap-2 rounded-xl"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Actualizar
                  </Button>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendWhatsApp}
                    disabled={selectedWorkOrders.length === 0}
                    className="h-9 gap-2 rounded-xl"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={exportToExcel}
                    disabled={exportWorkOrders.length === 0}
                    className="h-9 gap-2 rounded-xl"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    {hasSelectedOrders
                      ? `Excel ${selectedWorkOrders.length}`
                      : "Excel"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={exportToPDF}
                    disabled={exportWorkOrders.length === 0}
                    className="h-9 gap-2 rounded-xl"
                  >
                    <FileText className="h-4 w-4" />
                    {hasSelectedOrders
                      ? `PDF ${selectedWorkOrders.length}`
                      : "PDF"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {hasSelectedOrders && (
            <p className="text-sm text-muted-foreground">
              {selectedWorkOrders.length} OT seleccionada(s). Al exportar o
              enviar por WhatsApp se usarán solo esas OT.
            </p>
          )}
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Cargando órdenes...
            </div>
          ) : filteredWorkOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <ClipboardList className="mb-3 h-10 w-10" />
              <p>No hay órdenes de trabajo que coincidan con los filtros.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 shadow-sm">
                  <div>
                    <p className="text-sm font-semibold">OT visibles</p>
                    <p className="text-xs text-muted-foreground">
                      Selección de la página actual
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Todos</span>
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
                      aria-label="Seleccionar OT visibles"
                    />
                  </div>
                </div>

                {paginatedWorkOrders.map((order) => {
                  const orderId = String(order.id);
                  const isSelected = selectedOrderIds.includes(orderId);

                  return (
                    <Card key={order.id} className="rounded-xl">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">OT</p>
                            <p className="text-lg font-bold">
                              {order.order_number || "-"}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge
                              className={`${getStatusBadgeClass(
                                order.status,
                              )} border`}
                            >
                              {order.status || "-"}
                            </Badge>

                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                toggleOrderSelection(orderId, checked === true)
                              }
                              aria-label={`Seleccionar OT ${
                                order.order_number || ""
                              }`}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <Info
                            label="Fecha"
                            value={formatDate(order.entry_date)}
                          />

                          <Info
                            label="Área"
                            value={order.requesting_area || "-"}
                          />

                          <Info
                            label="Código"
                            value={order.vehicle_code || "-"}
                          />

                          <Info
                            label="Vehículo"
                            value={getVehicleLabel(order)}
                          />

                          <Info
                            label="Dominio"
                            value={getLicensePlateLabel(order)}
                          />

                          <Info
                            label="Falla"
                            value={
                              order.failure_type || order.failure_report || "-"
                            }
                          />

                          <Info
                            label="Reparación"
                            value={order.repair_type || "-"}
                          />

                          <Info
                            label="Proveedor/es"
                            value={formatProviders(order.provider)}
                          />

                          <Info
                            label="Monto"
                            value={formatOrderMoney(order)}
                          />

                          <Info label="Chofer" value={order.driver || "-"} />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="gap-2"
                          >
                            <Link
                              href={`/dashboard/taller/ordenes-trabajo/${order.id}/view`}
                            >
                              <Eye className="h-4 w-4" />
                              Ver
                            </Link>
                          </Button>

                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="gap-2"
                          >
                            <Link
                              href={`/dashboard/taller/ordenes-trabajo/${order.id}/edit`}
                            >
                              <Pencil className="h-4 w-4" />
                              Editar
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto rounded-xl border md:block">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="w-[52px] px-3 py-3 text-center">
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
                            aria-label="Seleccionar OT visibles"
                          />
                        </div>
                      </th>

                      <th className="px-3 py-3 text-left font-semibold">OT</th>

                      <th className="px-3 py-3 text-left font-semibold">
                        Fecha ingreso
                      </th>

                      <th className="px-3 py-3 text-left font-semibold">
                        Área
                      </th>

                      <th className="px-3 py-3 text-left font-semibold">
                        Vehículo
                      </th>

                      <th className="px-3 py-3 text-left font-semibold">
                        Dominio
                      </th>

                      <th className="px-3 py-3 text-left font-semibold">
                        Falla
                      </th>

                      <th className="px-3 py-3 text-left font-semibold">
                        Reparación
                      </th>

                      <th className="px-3 py-3 text-left font-semibold">
                        Repuesto
                      </th>

                      <th className="px-3 py-3 text-left font-semibold">
                        Proveedor/es
                      </th>

                      <th className="px-3 py-3 text-left font-semibold">
                        Monto
                      </th>

                      <th className="px-3 py-3 text-left font-semibold">
                        Estado
                      </th>

                      <th className="px-3 py-3 text-center font-semibold">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedWorkOrders.map((order) => {
                      const orderId = String(order.id);
                      const isSelected = selectedOrderIds.includes(orderId);

                      return (
                        <tr key={order.id} className="border-t">
                          <td className="px-3 py-3 text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) =>
                                  toggleOrderSelection(
                                    orderId,
                                    checked === true,
                                  )
                                }
                                aria-label={`Seleccionar OT ${
                                  order.order_number || ""
                                }`}
                              />
                            </div>
                          </td>

                          <td className="px-3 py-3 font-medium">
                            {order.order_number || "-"}
                          </td>

                          <td className="px-3 py-3">
                            {formatDate(order.entry_date)}
                          </td>

                          <td className="px-3 py-3">
                            {order.requesting_area || "-"}
                          </td>

                          <td className="px-3 py-3">
                            <div>
                              <p>{getVehicleLabel(order)}</p>
                              <p className="text-xs text-muted-foreground">
                                Código: {order.vehicle_code || "-"}
                              </p>
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            {getLicensePlateLabel(order)}
                          </td>

                          <td className="px-3 py-3">
                            {order.failure_type || order.failure_report || "-"}
                          </td>

                          <td className="px-3 py-3">
                            {order.repair_type || "-"}
                          </td>

                          <td className="px-3 py-3">
                            {order.requires_spare_part || "-"}
                          </td>

                          <td className="px-3 py-3">
                            {formatProviders(order.provider)}
                          </td>

                          <td className="px-3 py-3">
                            {formatOrderMoney(order)}
                          </td>

                          <td className="px-3 py-3">
                            <Badge
                              className={`${getStatusBadgeClass(
                                order.status,
                              )} border`}
                            >
                              {order.status || "-"}
                            </Badge>
                          </td>

                          <td className="px-3 py-3">
                            <div className="flex justify-center gap-2">
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                title="Ver detalle"
                                className="transition-all hover:bg-accent hover:text-primary active:scale-95"
                              >
                                <Link
                                  href={`/dashboard/taller/ordenes-trabajo/${order.id}/view`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>

                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                title="Editar OT"
                                className="transition-all hover:bg-accent hover:text-primary active:scale-95"
                              >
                                <Link
                                  href={`/dashboard/taller/ordenes-trabajo/${order.id}/edit`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">
                  Mostrando{" "}
                  <span className="font-medium text-foreground">{start}</span>{" "}
                  a <span className="font-medium text-foreground">{end}</span>{" "}
                  de{" "}
                  <span className="font-medium text-foreground">
                    {filteredWorkOrders.length}
                  </span>{" "}
                  OT
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
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
                        <span className="px-1 text-sm text-muted-foreground">
                          ...
                        </span>
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
                      {pageNumbers[pageNumbers.length - 1] <
                        totalPages - 1 && (
                        <span className="px-1 text-sm text-muted-foreground">
                          ...
                        </span>
                      )}

                      <Button
                        type="button"
                        variant={
                          currentPage === totalPages ? "default" : "outline"
                        }
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
                      setCurrentPage((prev) =>
                        Math.min(prev + 1, totalPages),
                      )
                    }
                    disabled={currentPage === totalPages}
                    className="gap-1"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterSelect({
  value,
  onValueChange,
  placeholder,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  options: readonly string[];
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{placeholder}</p>

      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 rounded-xl">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value={ALL_VALUE}>Todos</SelectItem>

          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>

      <Input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-xl"
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="break-words text-sm">{value}</p>
    </div>
  );
}