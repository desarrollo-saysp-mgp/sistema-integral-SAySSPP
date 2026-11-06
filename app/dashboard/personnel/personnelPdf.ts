import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";

import type { Personnel } from "@/types";

type ExportPersonnelPdfOptions = {
  title?: string;
  filters?: string[];
};

type PersonnelWithSchedule = Personnel & {
  hora_ingreso?: string | null;
  hora_salida?: string | null;
  modalidad_horas_extra?: string | null;
  horas_50?: number | null;
  horas_100?: number | null;
  horas_arregladas?: number | null;
};

const GREEN: [number, number, number] = [0, 174, 130];
const DARK: [number, number, number] = [34, 48, 57];
const MUTED: [number, number, number] = [103, 116, 126];
const LIGHT: [number, number, number] = [246, 250, 249];
const BORDER: [number, number, number] = [225, 233, 230];

const formatContractType = (contractType: Personnel["tipo_contrato"]) => {
  switch (contractType) {
    case "PLANTA_PERMANENTE":
      return "Planta permanente";
    case "MONOTRIBUTISTA":
      return "Monotributista";
    case "CONTRATO_CON_APORTES":
      return "Contrato con aportes";
    default:
      return contractType;
  }
};

const formatContractDetail = (person: Personnel) => {
  const contract = formatContractType(person.tipo_contrato);
  if (person.tipo_contrato === "MONOTRIBUTISTA") return contract;
  return person.numero_resolucion
    ? `${contract} - Resolución: ${person.numero_resolucion}`
    : contract;
};

const formatSchedule = (person: Personnel) => {
  const data = person as PersonnelWithSchedule;
  const entrada = data.hora_ingreso?.slice(0, 5);
  const salida = data.hora_salida?.slice(0, 5);
  return entrada || salida
    ? `${entrada || "--:--"} a ${salida || "--:--"}`
    : "Sin horario";
};

const formatExtraHours = (person: Personnel) => {
  const data = person as PersonnelWithSchedule;
  const modalidad = data.modalidad_horas_extra;
  if (!modalidad || modalidad === "NO") return "Sin horas extras";

  const porcentajes: string[] = [];
  if (Number(data.horas_50 ?? 0) > 0) porcentajes.push("50 %");
  if (Number(data.horas_100 ?? 0) > 0) porcentajes.push("100 %");

  const titulo = modalidad === "ARREGLO" ? "Arreglo" : "Horas extras";
  const detalle = porcentajes.length ? porcentajes.join(" y ") : "sin porcentaje";

  // La cantidad solo se muestra para Arreglo y cuando existe un valor válido.
  // Evitamos convertir null en 0 y respetamos los decimales en formato argentino.
  const raw = data.horas_arregladas;
  const cantidad = raw !== null && raw !== undefined && String(raw).trim() !== ""
    ? Number(raw)
    : null;
  const horas = modalidad === "ARREGLO" && cantidad !== null && Number.isFinite(cantidad)
    ? ` · ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(cantidad)} h arregladas`
    : "";

  return `${titulo} · ${detalle}${horas}`;
};

const formatDateTime = () =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

const sanitizeFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

/** El logo se convierte a un JPEG pequeño para no inflar el PDF. */
const loadCompressedMunicipalLogo = async (): Promise<string | null> => {
  try {
    return await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const originalWidth = img.naturalWidth || img.width;
        const originalHeight = img.naturalHeight || img.height;
        if (!originalWidth || !originalHeight) {
          reject(new Error("Logo sin dimensiones válidas"));
          return;
        }

        const maxWidth = 300;
        const width = Math.min(originalWidth, maxWidth);
        const height = Math.max(1, Math.round(originalHeight * (width / originalWidth)));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas no disponible"));
          return;
        }

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.onerror = () => reject(new Error("No se encontró el logo municipal"));
      img.src = "/logo-general-pico-horizontal.png";
    });
  } catch (error) {
    console.warn("El PDF se exportará sin logo:", error);
    return null;
  }
};

/**
 * El filtro de Activos viene aplicado por defecto desde PersonnelTable.
 * Ordenar la lista tampoco reduce el conjunto de empleados.
 * Por eso ninguno de esos dos ajustes se considera un filtro específico.
 */
const hasSpecificFilters = (filters: string[]) =>
  filters.some((filter) => {
    const normalized = filter.trim().toLocaleLowerCase("es");
    return (
      normalized !== "estado: activos" &&
      !normalized.startsWith("orden:")
    );
  });

export async function exportPersonnelToPdf(
  personnel: Personnel[],
  options: ExportPersonnelPdfOptions = {},
): Promise<void> {
  const title = options.title ?? "Listado de personal";
  const filters = options.filters ?? [];
  const isFiltered = hasSpecificFilters(filters);

  // Se calculan sobre los mismos registros que recibe la exportación.
  // Así los totales siempre coinciden con la tabla y respetan sus filtros.
  const activePersonnel = personnel.filter((person) => person.activo);
  const basePersonnel = isFiltered ? personnel : activePersonnel;
  const counts = {
    total: isFiltered ? personnel.length : activePersonnel.length,
    permanent: basePersonnel.filter((p) => p.tipo_contrato === "PLANTA_PERMANENTE").length,
    monotributists: basePersonnel.filter((p) => p.tipo_contrato === "MONOTRIBUTISTA").length,
    contributions: basePersonnel.filter((p) => p.tipo_contrato === "CONTRATO_CON_APORTES").length,
  };

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const logo = await loadCompressedMunicipalLogo();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 8;

  const drawHeader = () => {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, 32, "F");

    if (logo) {
      doc.addImage(logo, "JPEG", marginX, 9, 34, 12, undefined, "FAST");
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...GREEN);
      doc.text("GENERAL PICO", marginX, 16);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...DARK);
    doc.text(title, 49, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text("Secretaría de Ambiente y Servicios Públicos", 49, 21);

    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.8);
    doc.line(marginX, 29, pageWidth - marginX, 29);
  };

  const drawSummary = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(isFiltered ? "Resumen del personal filtrado" : "Resumen del personal", marginX, 37);

    // Ocultamos los indicadores cuyo total sea cero. El indicador general
    // permanece visible incluso si la búsqueda no devuelve registros.
    const cards = [
      { label: isFiltered ? "Registros filtrados" : "Personal activo", value: counts.total },
      { label: "Planta permanente", value: counts.permanent },
      { label: "Monotributistas", value: counts.monotributists },
      { label: "Contratos con aportes", value: counts.contributions },
    ].filter((card, index) => index === 0 || card.value > 0);

    const cardGap = 3;
    const cardWidth = (pageWidth - 2 * marginX - cardGap * (cards.length - 1)) / cards.length;
    const cardY = 40;
    const cardHeight = 17;

    cards.forEach(({ label, value }, index) => {
      const x = marginX + index * (cardWidth + cardGap);
      doc.setFillColor(...LIGHT);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(label, x + 3, cardY + 5.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...DARK);
      doc.text(String(value), x + 3, cardY + 13);
    });
  };

  const filterText = filters.length
    ? `Filtros: ${filters.join(" | ")}`
    : "Filtros: ninguno";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.7);
  const wrappedFilters: string[] = doc.splitTextToSize(
    filterText,
    pageWidth - 2 * marginX,
  );

  // Espacio reservado para los cuatro indicadores y los filtros.
  const filtersY = 63;
  const firstTableY = filtersY + wrappedFilters.length * 3.5 + 6;

  autoTable(doc, {
    startY: firstTableY,
    head: [[
      "Legajo",
      "Nombre completo",
      "Código",
      "Dirección",
      "Área RR. HH.",
      "Contratación / detalle",
      "Tarea",
      "Horario / extras",
      "Estado",
    ]],
    body: personnel.map((person) => [
      String(person.legajo),
      person.nombre_completo,
      person.codigo_direccion ?? "-",
      person.direccion ?? "-",
      person.area_rrhh ?? "-",
      formatContractDetail(person),
      person.tarea ?? "-",
      `${formatSchedule(person)}\n${formatExtraHours(person)}`,
      person.activo ? "Activo" : "Baja",
    ]),
    theme: "striped",
    showHead: "everyPage",
    pageBreak: "auto",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 6.6,
      cellPadding: 1.5,
      overflow: "linebreak",
      valign: "middle",
      textColor: DARK,
      lineColor: [230, 237, 233],
      lineWidth: 0.08,
    },
    headStyles: {
      fillColor: GREEN,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 6.7,
      halign: "left",
    },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 35 },
      2: { cellWidth: 14 },
      3: { cellWidth: 37 },
      4: { cellWidth: 30 },
      5: { cellWidth: 42 },
      6: { cellWidth: 35 },
      7: { cellWidth: 44 },
      8: { cellWidth: 14, halign: "center" },
    },
    margin: {
      left: marginX,
      right: marginX,
      top: 36,
      bottom: 14,
    },
    didParseCell: (data: CellHookData) => {
      if (data.section === "body" && data.column.index === 8) {
        const isActive = String(data.cell.raw) === "Activo";
        data.cell.styles.textColor = isActive ? [0, 123, 93] : [169, 54, 54];
        data.cell.styles.fontStyle = "bold";
      }
    },
    didDrawPage: (data) => {
      drawHeader();
      if (data.pageNumber === 1) {
        drawSummary();
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MUTED);
        doc.setFontSize(7.7);
        doc.text(wrappedFilters, marginX, filtersY);
        doc.setFontSize(7.3);
        doc.text(`Generado: ${formatDateTime()}   |   Registros exportados: ${personnel.length}`, marginX, firstTableY - 3);
      }
    },
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setDrawColor(222, 233, 227);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 11, pageWidth - marginX, pageHeight - 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text("Municipalidad de General Pico · Personal", marginX, pageHeight - 6);
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - marginX, pageHeight - 6, {
      align: "right",
    });
  }

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`${sanitizeFileName(title)}_${date}.pdf`);
}
