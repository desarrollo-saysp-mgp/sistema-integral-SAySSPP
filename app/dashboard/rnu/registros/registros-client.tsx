"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  useTransition,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
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
  initialSearch: string;
  initialType: "" | "GENERAL" | "INSTITUCION";
  initialFrom: string;
  initialTo: string;
  currentPage: number;
  totalPages: number;
  totalEntries: number;
  todayVisitorCount: number;
  todayGeneralCount: number;
  todayInstitutionCount: number;
  todayRecordsCount: number;
};

const ITEMS_PER_PAGE = 20;

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
  initialSearch,
  initialType,
  initialFrom,
  initialTo,
  currentPage,
  totalPages,
  totalEntries,
  todayVisitorCount,
  todayGeneralCount,
  todayInstitutionCount,
  todayRecordsCount,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [entries, setEntries] =
    useState(initialEntries);

  const [search, setSearch] =
    useState(initialSearch);

  const [type, setType] =
    useState(initialType);

  const [from, setFrom] =
    useState(initialFrom);

  const [to, setTo] =
    useState(initialTo);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [isPending, startTransition] =
    useTransition();

  const [
    isNavigating,
    startNavigationTransition,
  ] = useTransition();

  const canEdit =
    userRole === "admin" ||
    userRole === "rnu";

  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setType(initialType);
  }, [initialType]);

  useEffect(() => {
    setFrom(initialFrom);
  }, [initialFrom]);

  useEffect(() => {
    setTo(initialTo);
  }, [initialTo]);

  function buildUrl({
    page = 1,
    nextSearch = search,
    nextType = type,
    nextFrom = from,
    nextTo = to,
  }: {
    page?: number;
    nextSearch?: string;
    nextType?: string;
    nextFrom?: string;
    nextTo?: string;
  }) {
    const params = new URLSearchParams();
    const cleanSearch = nextSearch.trim();

    if (page > 1) params.set("pagina", String(page));
    if (cleanSearch) params.set("buscar", cleanSearch);
    if (nextType) params.set("tipo", nextType);
    if (nextFrom) params.set("desde", nextFrom);
    if (nextTo) params.set("hasta", nextTo);

    const query = params.toString();

    return query
      ? `/dashboard/rnu/registros?${query}`
      : "/dashboard/rnu/registros";
  }

  function navigateTo({
    page = 1,
    nextSearch = search,
    nextType = type,
    nextFrom = from,
    nextTo = to,
  }: {
    page?: number;
    nextSearch?: string;
    nextType?: string;
    nextFrom?: string;
    nextTo?: string;
  }) {
    const nextUrl = buildUrl({
      page,
      nextSearch,
      nextType,
      nextFrom,
      nextTo,
    });

    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery
      ? `/dashboard/rnu/registros?${currentQuery}`
      : "/dashboard/rnu/registros";

    if (nextUrl === currentUrl) return;

    startNavigationTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  }

  useEffect(() => {
    if (search.trim() === initialSearch) return;

    const timeoutId = window.setTimeout(() => {
      navigateTo({
        page: 1,
        nextSearch: search,
      });
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, initialSearch]);

  const firstVisibleRecord =
    totalEntries === 0
      ? 0
      : (currentPage - 1) * ITEMS_PER_PAGE + 1;

  const lastVisibleRecord =
    totalEntries === 0
      ? 0
      : Math.min(
          firstVisibleRecord + entries.length - 1,
          totalEntries,
        );

  function getPageNumbers(): number[] {
    if (totalPages <= 7) {
      return Array.from(
        { length: totalPages },
        (_, index) => index + 1,
      );
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
  }

  const pageNumbers = getPageNumbers();

  function clearFilters() {
    setSearch("");
    setType("");
    setFrom("");
    setTo("");

    navigateTo({
      page: 1,
      nextSearch: "",
      nextType: "",
      nextFrom: "",
      nextTo: "",
    });
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

        if (entries.length === 1 && currentPage > 1) {
          navigateTo({ page: currentPage - 1 });
        } else {
          router.refresh();
        }
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
    <>
      {isNavigating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="rounded-2xl border bg-card px-6 py-5 text-center shadow-xl">
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-muted border-t-emerald-600" />
            <p className="mt-3 font-semibold">Cargando...</p>
          </div>
        </div>
      )}

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
                {todayRecordsCount}
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
              onChange={(event) => {
                const nextType =
                  event.target.value as
                    | ""
                    | "GENERAL"
                    | "INSTITUCION";

                setType(nextType);

                navigateTo({
                  page: 1,
                  nextType,
                });
              }}
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
                onChange={(event) => {
                  const nextFrom = event.target.value;
                  setFrom(nextFrom);
                  navigateTo({ page: 1, nextFrom });
                }}
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
                onChange={(event) => {
                  const nextTo = event.target.value;
                  setTo(nextTo);
                  navigateTo({ page: 1, nextTo });
                }}
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
          {totalEntries}{" "}
          {totalEntries === 1
            ? "registro encontrado"
            : "registros encontrados"}
        </p>
      </section>

      {totalEntries === 0 ? (
        <section className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <p className="text-muted-foreground">
            No se encontraron registros.
          </p>
        </section>
      ) : (
        <>
          {/* CELULAR + TABLET */}
          <div className="grid grid-cols-1 gap-4 xl:hidden md:grid-cols-2">
            {entries.map(
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
                {entries.map(
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

          <section className="mt-5 rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center text-sm text-muted-foreground sm:text-left">
                Mostrando{" "}
                <span className="font-semibold text-foreground">
                  {firstVisibleRecord}
                </span>{" "}
                a{" "}
                <span className="font-semibold text-foreground">
                  {lastVisibleRecord}
                </span>{" "}
                de{" "}
                <span className="font-semibold text-foreground">
                  {totalEntries}
                </span>{" "}
                registros
              </p>

              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    navigateTo({
                      page: Math.max(1, currentPage - 1),
                    })
                  }
                  disabled={currentPage === 1}
                  className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border bg-background px-3 text-sm font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {pageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() =>
                      navigateTo({ page: pageNumber })
                    }
                    className={`hidden h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-colors sm:inline-flex ${
                      currentPage === pageNumber
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}

                <div className="inline-flex h-10 items-center justify-center rounded-xl border bg-muted/40 px-4 text-sm font-semibold sm:hidden">
                  {currentPage} / {totalPages}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigateTo({
                      page: Math.min(
                        totalPages,
                        currentPage + 1,
                      ),
                    })
                  }
                  disabled={currentPage === totalPages}
                  className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border bg-background px-3 text-sm font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </>
      )}
      </main>
    </>
  );
}