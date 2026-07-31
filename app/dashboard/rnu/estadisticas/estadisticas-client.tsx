"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ClipboardList,
  MapPin,
  RotateCcw,
  TrendingUp,
  Users,
} from "lucide-react";

import type { RnuStatsEntry } from "./page";

type Props = {
  initialEntries: RnuStatsEntry[];
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
      ? Math.max(...items.map((item) => item[1]))
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
          entry.entry_type === "INSTITUCION",
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

    const dayMap: Record<string, number> = {};

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

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5">
        <Link
          href="/dashboard/rnu"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
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
            ingreso o el rango de fechas.
          </p>
        </div>
      </section>
    </main>
  );
}