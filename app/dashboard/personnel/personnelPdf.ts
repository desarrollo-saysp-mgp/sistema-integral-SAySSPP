import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import type { Personnel } from "@/types";

type ExportPersonnelPdfOptions = {
  title?: string;
  filters?: string[];
};

const formatContractType = (
  contractType: Personnel["tipo_contrato"],
) => {
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

  if (person.tipo_contrato === "PLANTA_PERMANENTE") {
    return person.numero_resolucion
      ? `${contract} - Resolución: ${person.numero_resolucion}`
      : contract;
  }

  if (person.tipo_contrato === "MONOTRIBUTISTA") {
    if (!person.convenio) {
      return `${contract} - Sin convenio`;
    }

    return person.numero_resolucion
      ? `${contract} - Con convenio - Resolución: ${person.numero_resolucion}`
      : `${contract} - Con convenio`;
  }

  return contract;
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

export function exportPersonnelToPdf(
  personnel: Personnel[],
  options: ExportPersonnelPdfOptions = {},
) {
  const title = options.title ?? "Listado de personal";
  const filters = options.filters ?? [];

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generado: ${formatDateTime()}`, 14, 21);
  doc.text(`Cantidad de registros: ${personnel.length}`, 14, 26);

  let tableStartY = 32;

  if (filters.length > 0) {
    const filterText = `Filtros: ${filters.join(" | ")}`;
    const wrappedFilters = doc.splitTextToSize(filterText, 265);
    doc.text(wrappedFilters, 14, 31);
    tableStartY = 31 + wrappedFilters.length * 4 + 3;
  } else {
    doc.text("Filtros: ninguno", 14, 31);
    tableStartY = 37;
  }

  autoTable(doc, {
    startY: tableStartY,
    head: [[
      "Legajo",
      "Nombre completo",
      "Código",
      "Dirección",
      "Área RR. HH.",
      "Contratación / detalle",
      "Tarea",
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
      person.activo ? "Activo" : "Baja",
    ]),
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 1.5,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fontStyle: "bold",
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 17 },
      1: { cellWidth: 37 },
      2: { cellWidth: 15 },
      3: { cellWidth: 41 },
      4: { cellWidth: 37 },
      5: { cellWidth: 42 },
      6: { cellWidth: 50 },
      7: { cellWidth: 15 },
    },
    margin: {
      left: 8,
      right: 8,
      bottom: 12,
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFontSize(8);
      doc.text(
        `Página ${pageCount}`,
        pageWidth - 22,
        pageHeight - 6,
      );

      if (data.pageNumber > 1) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(title, 8, 7);
      }
    },
  });

  const date = new Date().toISOString().slice(0, 10);
  const fileName = `${sanitizeFileName(title)}_${date}.pdf`;
  doc.save(fileName);
}
