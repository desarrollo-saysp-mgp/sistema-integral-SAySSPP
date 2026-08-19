"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  Loader2,
  MapPin,
  RotateCcw,
  TrendingUp,
  Users,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

import type { RnuStatsEntry } from "./page";

type Props = {
  initialEntries: RnuStatsEntry[];
};

type PdfDocument = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

const TRANSPORT_LABELS: Record<string, string> = {
  AUTO: "Auto",
  MOTO: "Moto",
  BICICLETA: "Bicicleta",
  CAMINANDO_CORRIENDO: "Caminando / corriendo",
};

const REASON_LABELS: Record<string, string> = {
  PESCA: "Pesca",
  RECREACION: "Recreación",
  PAMPA_WAKE: "Pampa Wake",
  ACTIVIDAD_PROGRAMADA: "Actividad programada",
  FOTOGRAFIA_AVISTAJE: "Fotografía / avistaje de aves",
  KAYAK: "Kayak",
  ACAMPE: "Acampe",
};

const FACILITY_LABELS: Record<string, string> = {
  SUM: "SUM",
  CENTRO_INTERPRETATIVO: "Centro Interpretativo",
};

const ACTIVITY_LABELS: Record<string, string> = {
  KAYAK: "Kayak",
  AVISTAJE: "Avistaje",
  CENTRO_ATENCION_VISITANTE:
    "Centro de Atención al Visitante",
};

function formatDate(value: string) {
  if (!value) return "—";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function getCountMap(values: string[]) {
  return values.reduce<Record<string, number>>(
    (accumulator, value) => {
      accumulator[value] =
        (accumulator[value] || 0) + 1;

      return accumulator;
    },
    {},
  );
}

function sortCountMap(
  map: Record<string, number>,
) {
  return Object.entries(map).sort(
    (a, b) => b[1] - a[1],
  );
}

function getTypeLabel(type: string) {
  if (type === "GENERAL") {
    return "Ingresos generales";
  }

  if (type === "INSTITUCION") {
    return "Instituciones";
  }

  return "Todos";
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function loadImageAsDataUrl(
  src: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.crossOrigin = "anonymous";

    image.onload = () => {
      const canvas =
        document.createElement("canvas");

      /*
       * El logo se muestra pequeño en el PDF (34 x 12 mm),
       * por lo que no tiene sentido incrustar la imagen original
       * a resolución completa. La reducimos antes de convertirla.
       */
      const originalWidth =
        image.naturalWidth || image.width;

      const originalHeight =
        image.naturalHeight || image.height;

      const maxWidth = 500;

      const targetWidth = Math.min(
        originalWidth,
        maxWidth,
      );

      const scale =
        originalWidth > 0
          ? targetWidth / originalWidth
          : 1;

      const targetHeight = Math.max(
        1,
        Math.round(originalHeight * scale),
      );

      canvas.width = Math.max(
        1,
        Math.round(targetWidth),
      );

      canvas.height = targetHeight;

      const context =
        canvas.getContext("2d");

      if (!context) {
        reject(
          new Error(
            "No se pudo procesar el logo.",
          ),
        );

        return;
      }

      /*
       * JPEG no admite transparencia.
       * Pintamos fondo blanco para conservar una apariencia limpia
       * y reducir muchísimo el peso respecto de un PNG grande.
       */
      context.fillStyle = "#ffffff";
      context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height,
      );

      context.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      resolve(
        canvas.toDataURL(
          "image/jpeg",
          0.72,
        ),
      );
    };

    image.onerror = () => {
      reject(
        new Error(
          "No se pudo cargar el logo.",
        ),
      );
    };

    image.src = src;
  });
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ElementType;
}) {
  return (
    <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {title}
          </p>

          <p className="mt-1 text-2xl font-bold">
            {value}
          </p>

          {subtitle ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function RankingCard({
  title,
  items,
}: {
  title: string;
  items: [string, number][];
}) {
  const maxValue =
    items.length > 0
      ? Math.max(
          ...items.map((item) => item[1]),
        )
      : 0;

  return (
    <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold">
        {title}
      </h2>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No hay datos para mostrar.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {items.map(([label, value]) => {
            const percentage =
              maxValue > 0
                ? (value / maxValue) * 100
                : 0;

            return (
              <div key={label}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    {label}
                  </span>

                  <span className="text-sm font-semibold">
                    {value}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{
                      width: `${percentage}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

export default function EstadisticasRnuClient({
  initialEntries,
}: Props) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("");
  const [isExportingPdf, setIsExportingPdf] =
    useState(false);

  const filteredEntries = useMemo(() => {
    return initialEntries.filter((entry) => {
      if (
        type &&
        entry.entry_type !== type
      ) {
        return false;
      }

      if (
        from &&
        entry.entry_date < from
      ) {
        return false;
      }

      if (
        to &&
        entry.entry_date > to
      ) {
        return false;
      }

      return true;
    });
  }, [initialEntries, from, to, type]);

  const stats = useMemo(() => {
    const totalRecords =
      filteredEntries.length;

    const totalVisitors =
      filteredEntries.reduce(
        (total, entry) =>
          total +
          Number(entry.visitor_count || 0),
        0,
      );

    const generalEntries =
      filteredEntries.filter(
        (entry) =>
          entry.entry_type === "GENERAL",
      );

    const institutionEntries =
      filteredEntries.filter(
        (entry) =>
          entry.entry_type ===
          "INSTITUCION",
      );

    const generalVisitors =
      generalEntries.reduce(
        (total, entry) =>
          total +
          Number(entry.visitor_count || 0),
        0,
      );

    const institutionVisitors =
      institutionEntries.reduce(
        (total, entry) =>
          total +
          Number(entry.visitor_count || 0),
        0,
      );

    const localityValues =
      filteredEntries
        .map((entry) =>
          entry.province_locality?.trim(),
        )
        .filter(
          (value): value is string =>
            Boolean(value),
        );

    const localityMap =
      getCountMap(localityValues);

    const transportValues =
      generalEntries
        .map((entry) =>
          entry.transport_type
            ? TRANSPORT_LABELS[
                entry.transport_type
              ] || entry.transport_type
            : null,
        )
        .filter(
          (value): value is string =>
            Boolean(value),
        );

    const transportMap =
      getCountMap(transportValues);

    const reasonValues =
      generalEntries.flatMap((entry) =>
        (entry.entry_reasons || []).map(
          (reason) =>
            REASON_LABELS[reason] ||
            reason,
        ),
      );

    const reasonMap =
      getCountMap(reasonValues);

    const facilityValues =
      filteredEntries.flatMap((entry) =>
        (entry.facilities || []).map(
          (facility) =>
            FACILITY_LABELS[facility] ||
            facility,
        ),
      );

    const facilityMap =
      getCountMap(facilityValues);

    const activityValues =
      institutionEntries.flatMap(
        (entry) =>
          (entry.activities || []).map(
            (activity) =>
              ACTIVITY_LABELS[
                activity
              ] || activity,
          ),
      );

    const activityMap =
      getCountMap(activityValues);

    const firstVisitYes =
      generalEntries.filter(
        (entry) =>
          entry.first_visit === true,
      ).length;

    const firstVisitNo =
      generalEntries.filter(
        (entry) =>
          entry.first_visit === false,
      ).length;

    const firstVisitUnanswered =
      generalEntries.filter(
        (entry) =>
          entry.first_visit === null,
      ).length;

    const institutionNames =
      institutionEntries
        .map((entry) =>
          entry.institution_name?.trim(),
        )
        .filter(
          (value): value is string =>
            Boolean(value),
        );

    const institutionMap =
      getCountMap(institutionNames);

    const dayMap: Record<string, number> =
      {};

    filteredEntries.forEach((entry) => {
      dayMap[entry.entry_date] =
        (dayMap[entry.entry_date] || 0) +
        Number(entry.visitor_count || 0);
    });

    return {
      totalRecords,
      totalVisitors,

      generalCount:
        generalEntries.length,

      institutionCount:
        institutionEntries.length,

      generalVisitors,
      institutionVisitors,

      localities:
        sortCountMap(localityMap),

      transports:
        sortCountMap(transportMap),

      reasons:
        sortCountMap(reasonMap),

      facilities:
        sortCountMap(facilityMap),

      activities:
        sortCountMap(activityMap),

      institutions:
        sortCountMap(institutionMap),

      firstVisitYes,
      firstVisitNo,
      firstVisitUnanswered,

      visitorsByDay:
        Object.entries(dayMap).sort(
          (a, b) =>
            a[0].localeCompare(b[0]),
        ),
    };
  }, [filteredEntries]);

  const maxVisitorsPerDay =
    stats.visitorsByDay.length
      ? Math.max(
          ...stats.visitorsByDay.map(
            ([, count]) => count,
          ),
        )
      : 0;

  function clearFilters() {
    setFrom("");
    setTo("");
    setType("");
  }

  async function exportToPdf() {
    if (filteredEntries.length === 0) {
      toast.error(
        "No hay estadísticas para exportar con los filtros actuales.",
      );

      return;
    }

    if (isExportingPdf) {
      return;
    }

    setIsExportingPdf(true);

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      }) as PdfDocument;

      let logoDataUrl: string | null = null;

      try {
        logoDataUrl =
          await loadImageAsDataUrl(
            "/logo-general-pico-horizontal.png",
          );
      } catch (error) {
        console.warn(
          "No se pudo cargar el logo para el PDF:",
          error,
        );
      }

      if (logoDataUrl) {
        doc.addImage(
          logoDataUrl,
          "JPEG",
          14,
          10,
          34,
          12,
          undefined,
          "FAST",
        );
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.setTextColor(30, 41, 59);

      doc.text(
        "Estadísticas RNU",
        52,
        15,
      );

      doc.setFont(
        "helvetica",
        "normal",
      );
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);

      doc.text(
        "Reserva Natural Urbana Benicio Delfín Pérez",
        52,
        21,
      );

      const typeLabel =
        getTypeLabel(type);

      const periodFrom = from
        ? formatDate(from)
        : "Sin límite";

      const periodTo = to
        ? formatDate(to)
        : "Sin límite";

      doc.setFontSize(9);

      doc.text(
        `Tipo de ingreso: ${typeLabel}`,
        14,
        32,
      );

      doc.text(
        `Período: ${periodFrom} al ${periodTo}`,
        14,
        37,
      );

      doc.text(
        `Fecha de exportación: ${new Date().toLocaleString(
          "es-AR",
        )}`,
        14,
        42,
      );

      autoTable(doc, {
        startY: 48,
        head: [
          [
            "Indicador",
            "Cantidad",
            "Detalle",
          ],
        ],
        body: [
          [
            "Personas",
            stats.totalVisitors,
            "Total de visitantes",
          ],
          [
            "Registros",
            stats.totalRecords,
            "Ingresos cargados",
          ],
          [
            "Ingresos generales",
            stats.generalCount,
            `${stats.generalVisitors} personas`,
          ],
          [
            "Instituciones",
            stats.institutionCount,
            `${stats.institutionVisitors} personas`,
          ],
        ],
        theme: "grid",
        margin: {
          left: 14,
          right: 14,
        },
        styles: {
          fontSize: 9,
          cellPadding: 2.5,
          textColor: [51, 65, 85],
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
        },
        headStyles: {
          fillColor: [5, 150, 105],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: {
            cellWidth: 62,
          },
          1: {
            cellWidth: 35,
            halign: "center",
          },
          2: {
            cellWidth: 85,
          },
        },
      });

      let nextY =
        (doc.lastAutoTable?.finalY ??
          48) + 8;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);

      doc.text(
        "Personas por día",
        14,
        nextY,
      );

      autoTable(doc, {
        startY: nextY + 3,
        head: [
          [
            "Fecha",
            "Cantidad de personas",
          ],
        ],
        body:
          stats.visitorsByDay.length > 0
            ? stats.visitorsByDay.map(
                ([date, count]) => [
                  formatDate(date),
                  count,
                ],
              )
            : [["Sin datos", "0"]],
        theme: "grid",
        showHead: "everyPage",
        margin: {
          left: 14,
          right: 14,
          top: 18,
          bottom: 16,
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 2.2,
          textColor: [51, 65, 85],
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
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
          0: {
            cellWidth: 90,
          },
          1: {
            cellWidth: 90,
            halign: "center",
          },
        },
      });

      nextY =
        (doc.lastAutoTable?.finalY ??
          nextY) + 8;

      if (nextY > 245) {
        doc.addPage();
        nextY = 18;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);

      doc.text(
        "Primera visita",
        14,
        nextY,
      );

      autoTable(doc, {
        startY: nextY + 3,
        head: [
          [
            "Respuesta",
            "Cantidad de registros",
          ],
        ],
        body: [
          [
            "Sí",
            stats.firstVisitYes,
          ],
          [
            "No",
            stats.firstVisitNo,
          ],
          [
            "Sin respuesta",
            stats.firstVisitUnanswered,
          ],
        ],
        theme: "grid",
        margin: {
          left: 14,
          right: 14,
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 2.2,
          textColor: [51, 65, 85],
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
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
          0: {
            cellWidth: 90,
          },
          1: {
            cellWidth: 90,
            halign: "center",
          },
        },
      });

      nextY =
        (doc.lastAutoTable?.finalY ??
          nextY) + 8;

      if (nextY > 245) {
        doc.addPage();
        nextY = 18;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);

      doc.text(
        "Distribución de visitantes",
        14,
        nextY,
      );

      autoTable(doc, {
        startY: nextY + 3,
        head: [
          [
            "Tipo",
            "Personas",
            "Porcentaje",
          ],
        ],
        body: [
          [
            "Ingresos generales",
            stats.generalVisitors,
            stats.totalVisitors > 0
              ? `${(
                  (stats.generalVisitors /
                    stats.totalVisitors) *
                  100
                ).toFixed(1)}%`
              : "0%",
          ],
          [
            "Instituciones",
            stats.institutionVisitors,
            stats.totalVisitors > 0
              ? `${(
                  (stats.institutionVisitors /
                    stats.totalVisitors) *
                  100
                ).toFixed(1)}%`
              : "0%",
          ],
        ],
        theme: "grid",
        margin: {
          left: 14,
          right: 14,
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 2.2,
          textColor: [51, 65, 85],
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
        },
        headStyles: {
          fillColor: [14, 165, 233],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: {
            cellWidth: 80,
          },
          1: {
            cellWidth: 50,
            halign: "center",
          },
          2: {
            cellWidth: 50,
            halign: "center",
          },
        },
      });

      const rankingSections: Array<{
        title: string;
        items: [string, number][];
      }> = [
        {
          title: "Motivos de ingreso",
          items: stats.reasons,
        },
        {
          title: "Medios de ingreso",
          items: stats.transports,
        },
        {
          title: "Procedencias",
          items: stats.localities,
        },
        {
          title: "Instituciones",
          items: stats.institutions,
        },
        {
          title:
            "Instalaciones utilizadas",
          items: stats.facilities,
        },
        {
          title:
            "Actividades institucionales",
          items: stats.activities,
        },
      ];

      for (const section of rankingSections) {
        nextY =
          (doc.lastAutoTable?.finalY ??
            18) + 8;

        if (nextY > 245) {
          doc.addPage();
          nextY = 18;
        }

        doc.setFont(
          "helvetica",
          "bold",
        );
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);

        doc.text(
          section.title,
          14,
          nextY,
        );

        autoTable(doc, {
          startY: nextY + 3,
          head: [
            [
              "Opción",
              "Cantidad",
            ],
          ],
          body:
            section.items.length > 0
              ? section.items.map(
                  ([label, count]) => [
                    label,
                    count,
                  ],
                )
              : [
                  [
                    "Sin datos",
                    "0",
                  ],
                ],
          theme: "grid",
          showHead: "everyPage",
          pageBreak: "auto",
          rowPageBreak: "avoid",
          margin: {
            left: 14,
            right: 14,
            top: 18,
            bottom: 16,
          },
          styles: {
            fontSize: 8.5,
            cellPadding: 2.2,
            textColor: [51, 65, 85],
            lineColor: [226, 232, 240],
            lineWidth: 0.15,
            overflow: "linebreak",
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
            0: {
              cellWidth: 140,
            },
            1: {
              cellWidth: 40,
              halign: "center",
            },
          },
        });
      }

      const pageCount =
        doc.getNumberOfPages();

      for (
        let pageNumber = 1;
        pageNumber <= pageCount;
        pageNumber += 1
      ) {
        doc.setPage(pageNumber);

        doc.setDrawColor(
          226,
          232,
          240,
        );

        doc.line(
          14,
          282,
          196,
          282,
        );

        doc.setFont(
          "helvetica",
          "normal",
        );
        doc.setFontSize(8);
        doc.setTextColor(
          100,
          116,
          139,
        );

        doc.text(
          "Sistema Integral SAySSPP · Registro de Ingresos RNU",
          14,
          288,
        );

        doc.text(
          `Página ${pageNumber} de ${pageCount}`,
          196,
          288,
          {
            align: "right",
          },
        );
      }

      const fileParts = [
        "estadisticas_rnu",
        type
          ? sanitizeFileName(
              getTypeLabel(type),
            )
          : "todos",
      ];

      if (from) {
        fileParts.push(
          `desde_${from}`,
        );
      }

      if (to) {
        fileParts.push(
          `hasta_${to}`,
        );
      }

      doc.save(
        `${fileParts.join("_")}.pdf`,
      );

      toast.success(
        "Estadísticas RNU exportadas correctamente.",
      );
    } catch (error) {
      console.error(
        "Error al exportar estadísticas RNU:",
        error,
      );

      toast.error(
        "No se pudieron exportar las estadísticas.",
      );
    } finally {
      setIsExportingPdf(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/dashboard/rnu"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />

          Volver
        </Link>

        <button
          type="button"
          onClick={exportToPdf}
          disabled={
            isExportingPdf ||
            filteredEntries.length === 0
          }
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isExportingPdf ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}

          {isExportingPdf
            ? "Generando PDF..."
            : "Exportar PDF"}
        </button>
      </div>

      <section className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Estadísticas RNU
        </h1>

        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Analizá los ingresos y visitantes registrados en la Reserva Natural
          Urbana.
        </p>
      </section>

      <section className="mb-6 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Tipo
            </label>

            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value)
              }
              className="min-h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            >
              <option value="">
                Todos
              </option>

              <option value="GENERAL">
                General
              </option>

              <option value="INSTITUCION">
                Institución
              </option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Desde
            </label>

            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                type="date"
                value={from}
                onChange={(event) =>
                  setFrom(event.target.value)
                }
                className="min-h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Hasta
            </label>

            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                type="date"
                value={to}
                onChange={(event) =>
                  setTo(event.target.value)
                }
                className="min-h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold hover:bg-muted"
            >
              <RotateCcw className="h-4 w-4" />

              Limpiar filtros
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Personas"
          value={stats.totalVisitors}
          subtitle="Total de visitantes"
          icon={Users}
        />

        <StatCard
          title="Registros"
          value={stats.totalRecords}
          subtitle="Ingresos cargados"
          icon={ClipboardList}
        />

        <StatCard
          title="Ingresos generales"
          value={stats.generalCount}
          subtitle={`${stats.generalVisitors} personas`}
          icon={TrendingUp}
        />

        <StatCard
          title="Instituciones"
          value={stats.institutionCount}
          subtitle={`${stats.institutionVisitors} personas`}
          icon={Building2}
        />
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold">
          Personas por día
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Cantidad total de personas registradas por fecha.
        </p>

        {stats.visitorsByDay.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">
            No hay datos para mostrar.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {stats.visitorsByDay.map(
              ([date, count]) => {
                const percentage =
                  maxVisitorsPerDay > 0
                    ? (count /
                        maxVisitorsPerDay) *
                      100
                    : 0;

                return (
                  <div key={date}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {formatDate(date)}
                      </span>

                      <span className="text-sm font-semibold">
                        {count}
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{
                          width: `${percentage}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </section>

      <section className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold">
            Primera visita
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Solo ingresos generales con respuesta registrada.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-background p-4">
              <p className="text-sm text-muted-foreground">
                Sí
              </p>

              <p className="mt-1 text-2xl font-bold">
                {stats.firstVisitYes}
              </p>
            </div>

            <div className="rounded-xl border bg-background p-4">
              <p className="text-sm text-muted-foreground">
                No
              </p>

              <p className="mt-1 text-2xl font-bold">
                {stats.firstVisitNo}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold">
            Distribución de visitantes
          </h2>

          <div className="mt-5 space-y-4">
            <div>
              <div className="mb-2 flex justify-between gap-2 text-sm">
                <span>
                  Ingresos generales
                </span>

                <strong>
                  {stats.generalVisitors}
                </strong>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-600"
                  style={{
                    width:
                      stats.totalVisitors > 0
                        ? `${
                            (stats.generalVisitors /
                              stats.totalVisitors) *
                            100
                          }%`
                        : "0%",
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex justify-between gap-2 text-sm">
                <span>
                  Instituciones
                </span>

                <strong>
                  {stats.institutionVisitors}
                </strong>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-sky-600"
                  style={{
                    width:
                      stats.totalVisitors > 0
                        ? `${
                            (stats.institutionVisitors /
                              stats.totalVisitors) *
                            100
                          }%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankingCard
          title="Motivos de ingreso"
          items={stats.reasons}
        />

        <RankingCard
          title="Medios de ingreso"
          items={stats.transports}
        />

        <RankingCard
          title="Procedencias"
          items={stats.localities}
        />

        <RankingCard
          title="Instituciones"
          items={stats.institutions}
        />

        <RankingCard
          title="Instalaciones utilizadas"
          items={stats.facilities}
        />

        <RankingCard
          title="Actividades institucionales"
          items={stats.activities}
        />
      </section>

      <section className="mt-5 rounded-2xl border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

          <p className="text-sm text-muted-foreground">
            Las estadísticas cambian automáticamente al modificar el tipo de
            ingreso o el rango de fechas. El PDF respeta los filtros aplicados.
          </p>
        </div>
      </section>
    </main>
  );
}