"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ClipboardList,
  Eye,
  Pencil,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

import type { RnuEntry } from "./page";
import { deleteRnuEntry } from "../actions";

type Props = {
  initialEntries: RnuEntry[];
  userRole: string;
};

const REASON_LABELS: Record<string, string> = {
  PESCA: "Pesca",
  RECREACION: "Recreación",
  PAMPA_WAKE: "Pampa Wake",
  ACTIVIDAD_PROGRAMADA: "Actividad programada",
  FOTOGRAFIA_AVISTAJE:
    "Fotografía / avistaje de aves",
  KAYAK: "Kayak",
  ACAMPE: "Acampe",
};

const TRANSPORT_LABELS: Record<string, string> = {
  AUTO: "Auto",
  MOTO: "Moto",
  BICICLETA: "Bicicleta",
  CAMINANDO_CORRIENDO: "Caminando / corriendo",
};

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatDate(value: string) {
  if (!value) return "—";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatTime(value: string | null) {
  if (!value) return "—";

  return value.slice(0, 5);
}

function getTransportLabel(value: string | null) {
  if (!value) return "—";

  return TRANSPORT_LABELS[value] || value;
}

function getReasonLabel(
  reasons: string[] | null,
) {
  if (!reasons?.length) {
    return "—";
  }

  return reasons
    .map(
      (reason) =>
        REASON_LABELS[reason] || reason,
    )
    .join(", ");
}

function getTodayArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:
      "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function RegistrosRnuClient({
  initialEntries,
  userRole,
}: Props) {
  const [entries, setEntries] =
    useState(initialEntries);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [isPending, startTransition] =
    useTransition();

  const canEdit =
    userRole === "admin" ||
    userRole === "rnu";

  const today = getTodayArgentina();

  const todayEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.entry_date === today,
      ),
    [entries, today],
  );

  const todayVisitorCount =
    todayEntries.reduce(
      (total, entry) =>
        total +
        Number(entry.visitor_count || 0),
      0,
    );

  const todayGeneralCount =
    todayEntries.filter(
      (entry) =>
        entry.entry_type === "GENERAL",
    ).length;

  const todayInstitutionCount =
    todayEntries.filter(
      (entry) =>
        entry.entry_type ===
        "INSTITUCION",
    ).length;

  const filteredEntries = useMemo(() => {
    const normalizedSearch =
      normalizeSearch(search);

    return entries.filter((entry) => {
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

      if (normalizedSearch) {
        const searchableText =
          normalizeSearch(
            [
              entry.province_locality,
              entry.institution_name,
              entry.responsible_name,
              getTransportLabel(
                entry.transport_type,
              ),
              getReasonLabel(
                entry.entry_reasons,
              ),
            ]
              .filter(Boolean)
              .join(" "),
          );

        if (
          !searchableText.includes(
            normalizedSearch,
          )
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    entries,
    search,
    type,
    from,
    to,
  ]);

  function clearFilters() {
    setSearch("");
    setType("");
    setFrom("");
    setTo("");
  }

  function handleDelete(
    entry: RnuEntry,
  ) {
    const label =
      entry.entry_type === "INSTITUCION"
        ? entry.institution_name ||
          "esta institución"
        : "este ingreso";

    const confirmed = window.confirm(
      `¿Seguro que querés eliminar ${label}? Esta acción no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(entry.id);

    startTransition(async () => {
      try {
        await deleteRnuEntry(entry.id);

        setEntries((current) =>
          current.filter(
            (item) =>
              item.id !== entry.id,
          ),
        );
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "No se pudo eliminar el registro.",
        );
      } finally {
        setDeletingId(null);
      }
    });
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
          Registros de ingresos
        </h1>

        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Consultá y administrá los
          ingresos registrados en la
          Reserva Natural Urbana.
        </p>
      </section>

      {/* TARJETAS */}
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 sm:h-11 sm:w-11">
              <Users className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Personas hoy
              </p>

              <p className="text-xl font-bold sm:text-2xl">
                {todayVisitorCount}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted sm:h-11 sm:w-11">
              <Users className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Generales hoy
              </p>

              <p className="text-xl font-bold sm:text-2xl">
                {todayGeneralCount}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 sm:h-11 sm:w-11">
              <Building2 className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Instituciones hoy
              </p>

              <p className="text-xl font-bold sm:text-2xl">
                {todayInstitutionCount}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted sm:h-11 sm:w-11">
              <ClipboardList className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Registros hoy
              </p>

              <p className="text-xl font-bold sm:text-2xl">
                {todayEntries.length}
              </p>
            </div>
          </div>
        </article>
      </section>

      {/* FILTROS EN TIEMPO REAL */}
      <section className="mb-6 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label
              htmlFor="search"
              className="mb-2 block text-sm font-medium"
            >
              Buscar
            </label>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                id="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Procedencia, institución..."
                className="min-h-11 w-full rounded-xl border bg-background pl-10 pr-4 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-medium">
              Tipo
            </label>

            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value)
              }
              className="min-h-11 w-full rounded-xl border bg-background px-3 text-sm"
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

          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-medium">
              Desde
            </label>

            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                type="date"
                value={from}
                onChange={(event) =>
                  setFrom(
                    event.target.value,
                  )
                }
                className="min-h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-medium">
              Hasta
            </label>

            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                type="date"
                value={to}
                onChange={(event) =>
                  setTo(
                    event.target.value,
                  )
                }
                className="min-h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="flex items-end lg:col-span-2">
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold hover:bg-muted"
            >
              <X className="h-4 w-4" />
              Limpiar
            </button>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {filteredEntries.length}{" "}
          {filteredEntries.length === 1
            ? "registro encontrado"
            : "registros encontrados"}
        </p>
      </section>

      {filteredEntries.length === 0 ? (
        <section className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <p className="text-muted-foreground">
            No se encontraron registros.
          </p>
        </section>
      ) : (
        <>
          {/* CELULAR + TABLET */}
          <div className="grid grid-cols-1 gap-4 xl:hidden md:grid-cols-2">
            {filteredEntries.map(
              (entry) => {
                const isInstitution =
                  entry.entry_type ===
                  "INSTITUCION";

                return (
                  <article
                    key={entry.id}
                    className="flex flex-col rounded-2xl border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                          {isInstitution ? (
                            <Building2 className="h-5 w-5" />
                          ) : (
                            <Users className="h-5 w-5" />
                          )}
                        </div>

                        <div>
                          <h2 className="font-semibold">
                            {isInstitution
                              ? entry.institution_name ||
                                "Institución"
                              : "Ingreso general"}
                          </h2>

                          <p className="text-sm text-muted-foreground">
                            {formatDate(
                              entry.entry_date,
                            )}{" "}
                            ·{" "}
                            {formatTime(
                              entry.entry_time,
                            )}
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                        {entry.visitor_count}{" "}
                        {entry.visitor_count ===
                        1
                          ? "persona"
                          : "personas"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm">
                      <p>
                        <span className="font-medium">
                          Procedencia:
                        </span>{" "}
                        {entry.province_locality ||
                          "—"}
                      </p>

                      <p>
                        <span className="font-medium">
                          Medio:
                        </span>{" "}
                        {isInstitution
                          ? "—"
                          : getTransportLabel(
                              entry.transport_type,
                            )}
                      </p>

                      <p>
                        <span className="font-medium">
                          Motivo:
                        </span>{" "}
                        {isInstitution
                          ? "—"
                          : getReasonLabel(
                              entry.entry_reasons,
                            )}
                      </p>

                      <p>
                        <span className="font-medium">
                          Institución:
                        </span>{" "}
                        {isInstitution
                          ? entry.institution_name ||
                            "—"
                          : "—"}
                      </p>
                    </div>

                    <div className="mt-auto grid grid-cols-3 gap-2 pt-5">
                      <Link
                        href={`/dashboard/rnu/registros/${entry.id}`}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border font-medium hover:bg-muted"
                      >
                        <Eye className="h-4 w-4" />
                        Ver
                      </Link>

                      {canEdit ? (
                        <>
                          <Link
                            href={`/dashboard/rnu/registros/${entry.id}/editar`}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border font-medium hover:bg-muted"
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </Link>

                          <button
                            type="button"
                            disabled={
                              isPending &&
                              deletingId ===
                                entry.id
                            }
                            onClick={() =>
                              handleDelete(
                                entry,
                              )
                            }
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </button>
                        </>
                      ) : (
                        <div className="col-span-2" />
                      )}
                    </div>
                  </article>
                );
              },
            )}
          </div>

          {/* PC GRANDE */}
          <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-sm xl:block">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b text-left">
                  <th className="px-4 py-3">
                    Fecha
                  </th>

                  <th className="px-4 py-3">
                    Hora
                  </th>

                  <th className="px-4 py-3">
                    Tipo
                  </th>

                  <th className="px-4 py-3">
                    Cant.
                  </th>

                  <th className="px-4 py-3">
                    Procedencia
                  </th>

                  <th className="px-4 py-3">
                    Medio
                  </th>

                  <th className="px-4 py-3">
                    Motivo
                  </th>

                  <th className="px-4 py-3">
                    Institución
                  </th>

                  <th className="px-4 py-3 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredEntries.map(
                  (entry) => {
                    const isInstitution =
                      entry.entry_type ===
                      "INSTITUCION";

                    return (
                      <tr
                        key={entry.id}
                        className="border-b last:border-0"
                      >
                        <td className="px-4 py-4">
                          {formatDate(
                            entry.entry_date,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {formatTime(
                            entry.entry_time,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                            {isInstitution
                              ? "Institución"
                              : "General"}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          {
                            entry.visitor_count
                          }
                        </td>

                        <td className="px-4 py-4">
                          {entry.province_locality ||
                            "—"}
                        </td>

                        <td className="px-4 py-4">
                          {isInstitution
                            ? "—"
                            : getTransportLabel(
                                entry.transport_type,
                              )}
                        </td>

                        <td className="max-w-[220px] px-4 py-4">
                          {isInstitution
                            ? "—"
                            : getReasonLabel(
                                entry.entry_reasons,
                              )}
                        </td>

                        <td className="px-4 py-4">
                          {isInstitution
                            ? entry.institution_name ||
                              "—"
                            : "—"}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-1">
                            <Link
                              href={`/dashboard/rnu/registros/${entry.id}`}
                              title="Ver detalle"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-muted"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>

                            {canEdit && (
                              <>
                                <Link
                                  href={`/dashboard/rnu/registros/${entry.id}/editar`}
                                  title="Editar"
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-muted"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Link>

                                <button
                                  type="button"
                                  title="Eliminar"
                                  onClick={() =>
                                    handleDelete(
                                      entry,
                                    )
                                  }
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}