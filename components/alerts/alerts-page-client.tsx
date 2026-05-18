"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  ClipboardList,
  Filter,
  MapPin,
  Search,
  ChevronDown,
  ChevronUp,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AlertLink } from "@/components/alerts/alert-link";
import { Button } from "@/components/ui/button";
import type { AlertItem } from "@/lib/get-alerts";

type AlertSeverity = AlertItem["severity"];

type AlertsPageClientProps = {
  alerts: AlertItem[];
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const formatDateForInput = (value?: string | null) => {
  if (!value) return "";
  return value.split("T")[0];
};

export function AlertsPageClient({ alerts }: AlertsPageClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const alertsPerPage = 20;

  const serviceOptions = useMemo(() => {
    const values = alerts
      .map((alert) => alert.serviceName)
      .filter((value): value is string => Boolean(value));

    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    const query = normalizeText(searchTerm);

    return alerts.filter((alert) => {
      const alertDate = formatDateForInput(alert.createdAt);

      const matchesSearch =
        !query ||
        normalizeText(alert.title).includes(query) ||
        normalizeText(alert.description).includes(query) ||
        normalizeText(alert.complainantName).includes(query) ||
        normalizeText(alert.complaintNumber).includes(query) ||
        normalizeText(alert.serviceName).includes(query) ||
        normalizeText(alert.zone).includes(query);

      const matchesService =
        serviceFilter === "all" || alert.serviceName === serviceFilter;

      const matchesSeverity =
        severityFilter === "all" || alert.severity === severityFilter;

      const matchesDateFrom =
        !dateFromFilter || (!!alertDate && alertDate >= dateFromFilter);

      const matchesDateTo =
        !dateToFilter || (!!alertDate && alertDate <= dateToFilter);

      return (
        matchesSearch &&
        matchesService &&
        matchesSeverity &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [
    alerts,
    searchTerm,
    serviceFilter,
    severityFilter,
    dateFromFilter,
    dateToFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAlerts.length / alertsPerPage),
  );

  const paginatedAlerts = useMemo(() => {
    const startIndex = (currentPage - 1) * alertsPerPage;
    const endIndex = startIndex + alertsPerPage;

    return filteredAlerts.slice(startIndex, endIndex);
  }, [filteredAlerts, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    setExpandedAlertId(null);
  }, [
    searchTerm,
    serviceFilter,
    severityFilter,
    dateFromFilter,
    dateToFilter,
  ]);

  const highAlerts = filteredAlerts.filter(
    (alert) => alert.severity === "high",
  );

  const mediumAlerts = filteredAlerts.filter(
    (alert) => alert.severity === "medium",
  );

  const hasActiveFilters =
    searchTerm ||
    serviceFilter !== "all" ||
    severityFilter !== "all" ||
    dateFromFilter ||
    dateToFilter;

  const clearFilters = () => {
    setSearchTerm("");
    setServiceFilter("all");
    setSeverityFilter("all");
    setDateFromFilter("");
    setDateToFilter("");
    setExpandedAlertId(null);
    setCurrentPage(1);
  };

  const toggleAlertDetails = (alertId: string) => {
    setExpandedAlertId((current) => (current === alertId ? null : alertId));
  };

  const handleSummaryFilter = (severity: "all" | "high" | "medium") => {
    setSeverityFilter(severity);
    setExpandedAlertId(null);
    setCurrentPage(1);
  };

  const handlePreviousPage = () => {
    setCurrentPage((page) => Math.max(1, page - 1));
    setExpandedAlertId(null);
  };

  const handleNextPage = () => {
    setCurrentPage((page) => Math.min(totalPages, page + 1));
    setExpandedAlertId(null);
  };

  const handleGoToPage = (page: number) => {
    setCurrentPage(page);
    setExpandedAlertId(null);
  };

  const getVisibleRangeText = () => {
    if (filteredAlerts.length === 0) {
      return { start: 0, end: 0 };
    }

    const start = (currentPage - 1) * alertsPerPage + 1;
    const end = Math.min(currentPage * alertsPerPage, filteredAlerts.length);

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

  const getSeverityLabel = (severity: AlertSeverity) => {
    if (severity === "high") return "Alta";
    if (severity === "medium") return "Media";
    return "Baja";
  };

  const getSeverityClass = (severity: AlertSeverity) => {
    if (severity === "high") {
      return "border-red-200 bg-red-50 text-red-700";
    }

    if (severity === "medium") {
      return "border-yellow-200 bg-yellow-50 text-yellow-700";
    }

    return "border-blue-200 bg-blue-50 text-blue-700";
  };

  const getIconClass = (severity: AlertSeverity) => {
    if (severity === "high") {
      return "bg-red-100 text-red-600";
    }

    if (severity === "medium") {
      return "bg-yellow-100 text-yellow-600";
    }

    return "bg-blue-100 text-blue-600";
  };

  const { start, end } = getVisibleRangeText();
  const pageNumbers = getPageNumbers();

  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => handleSummaryFilter("all")}
          className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#00A27F] hover:shadow-md ${
            severityFilter === "all"
              ? "border-[#00A27F] ring-2 ring-[#00A27F]/15"
              : "border-[#D8E3DE]"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#6B7280]">
              Alertas activas
            </p>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00A27F]/12 text-[#00A27F]">
              <Bell className="h-4 w-4" />
            </div>
          </div>

          <p className="mt-4 text-3xl font-bold text-[#1F2937]">
            {filteredAlerts.length}
          </p>

          <p className="mt-1 text-sm text-[#6B7280]">
            Ver todas las alertas
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleSummaryFilter("high")}
          className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md ${
            severityFilter === "high"
              ? "border-red-300 ring-2 ring-red-100"
              : "border-[#D8E3DE]"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#6B7280]">
              Prioridad alta
            </p>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>

          <p className="mt-4 text-3xl font-bold text-red-600">
            {highAlerts.length}
          </p>

          <p className="mt-1 text-sm text-[#6B7280]">
            Reclamos demorados o críticos
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleSummaryFilter("medium")}
          className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-yellow-300 hover:shadow-md ${
            severityFilter === "medium"
              ? "border-yellow-300 ring-2 ring-yellow-100"
              : "border-[#D8E3DE]"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#6B7280]">
              Prioridad media
            </p>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
              <ClipboardList className="h-4 w-4" />
            </div>
          </div>

          <p className="mt-4 text-3xl font-bold text-yellow-600">
            {mediumAlerts.length}
          </p>

          <p className="mt-1 text-sm text-[#6B7280]">
            Acumulación por servicio o zona
          </p>
        </button>
      </section>

      <section className="rounded-2xl border border-[#D8E3DE] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 border-b border-[#D8E3DE] pb-3">
          <Filter className="h-4 w-4 text-[#6B7280]" />

          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6B7280]">
            Filtros
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm font-medium text-[#374151]">
              Buscar
            </label>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />

              <input
                type="text"
                placeholder="Nombre, reclamo, servicio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 w-full rounded-xl border border-[#D8E3DE] bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[#00A27F] focus:ring-2 focus:ring-[#00A27F]/15"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#374151]">
              Servicio
            </label>

            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#D8E3DE] bg-white px-3 text-sm outline-none transition focus:border-[#00A27F] focus:ring-2 focus:ring-[#00A27F]/15"
            >
              <option value="all">Todos</option>

              {serviceOptions.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#374151]">
              Prioridad
            </label>

            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setExpandedAlertId(null);
                setCurrentPage(1);
              }}
              className="h-10 w-full rounded-xl border border-[#D8E3DE] bg-white px-3 text-sm outline-none transition focus:border-[#00A27F] focus:ring-2 focus:ring-[#00A27F]/15"
            >
              <option value="all">Todas</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#374151]">
              Desde
            </label>

            <input
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#D8E3DE] bg-white px-3 text-sm outline-none transition focus:border-[#00A27F] focus:ring-2 focus:ring-[#00A27F]/15"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#374151]">
              Hasta
            </label>

            <input
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#D8E3DE] bg-white px-3 text-sm outline-none transition focus:border-[#00A27F] focus:ring-2 focus:ring-[#00A27F]/15"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-[#D8E3DE] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition hover:bg-[#F9FAFB]"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-1 text-sm text-[#6B7280] sm:flex-row sm:items-center sm:justify-between">
        <p>
          {filteredAlerts.length} alerta
          {filteredAlerts.length !== 1 ? "s" : ""} encontrada
          {filteredAlerts.length !== 1 ? "s" : ""}
        </p>

        {filteredAlerts.length > alertsPerPage && (
          <p>
            Mostrando {start} - {end} de {filteredAlerts.length}
          </p>
        )}
      </div>

      <section className="rounded-2xl border border-[#D8E3DE] bg-white shadow-sm">
        <div className="border-b border-[#D8E3DE] px-5 py-4">
          <h2 className="text-lg font-semibold text-[#1F2937]">
            Listado detallado
          </h2>

          <p className="mt-1 text-sm text-[#6B7280]">
            Se muestran las alertas activas en base al estado actual de los
            reclamos.
          </p>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#00A27F]/12 text-[#00A27F]">
              <Bell className="h-6 w-6" />
            </div>

            <h3 className="mt-4 font-semibold text-[#1F2937]">
              No hay alertas con esos filtros
            </h3>

            <p className="mt-1 text-sm text-[#6B7280]">
              Probá limpiar los filtros o cambiar los criterios de búsqueda.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {paginatedAlerts.map((alert) => {
              const hasRelatedComplaints =
                !!alert.relatedComplaints &&
                alert.relatedComplaints.length > 0;

              const isExpanded = expandedAlertId === alert.id;

              const content = (
                <article
                  className={`flex gap-4 p-5 transition ${
                    alert.complaintId
                      ? "cursor-pointer hover:bg-[#F9FAFB]"
                      : "hover:bg-[#F9FAFB]"
                  }`}
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${getIconClass(
                      alert.severity,
                    )}`}
                  >
                    {alert.zone ? (
                      <MapPin className="h-5 w-5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-semibold text-[#1F2937]">
                        {alert.title}
                      </h3>

                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getSeverityClass(
                          alert.severity,
                        )}`}
                      >
                        Prioridad {getSeverityLabel(alert.severity)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-[#4B5563]">
                      {alert.description}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
                      {alert.complainantName && (
                        <span className="rounded-full bg-[#F3F4F6] px-3 py-1">
                          Nombre: {alert.complainantName}
                        </span>
                      )}

                      {alert.serviceName && (
                        <span className="rounded-full bg-[#F3F4F6] px-3 py-1">
                          Servicio: {alert.serviceName}
                        </span>
                      )}

                      {alert.zone && (
                        <span className="rounded-full bg-[#F3F4F6] px-3 py-1">
                          Zona: {alert.zone}
                        </span>
                      )}

                      {alert.count && (
                        <span className="rounded-full bg-[#F3F4F6] px-3 py-1">
                          Cantidad: {alert.count}
                        </span>
                      )}

                      {hasRelatedComplaints && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleAlertDetails(alert.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-[#00A27F]/12 px-3 py-1 font-semibold text-[#00A27F] transition hover:bg-[#00A27F]/20"
                        >
                          {isExpanded
                            ? "Ocultar reclamos"
                            : "Ver reclamos incluidos"}

                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}

                      {alert.complaintId && (
                        <span className="rounded-full bg-[#00A27F]/12 px-3 py-1 font-semibold text-[#00A27F]">
                          Ver reclamo #
                          {alert.complaintNumber ?? alert.complaintId}
                        </span>
                      )}
                    </div>

                    {isExpanded && hasRelatedComplaints && (
                      <div className="mt-4 w-full rounded-2xl border border-[#D8E3DE] bg-[#F8FAF9] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#1F2937]">
                              Reclamos incluidos en esta alerta
                            </p>

                            <p className="text-xs text-[#6B7280]">
                              Se encontraron {alert.relatedComplaints?.length}{" "}
                              reclamos que generaron esta alerta.
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {alert.relatedComplaints?.map((complaint) => (
                            <Link
                              key={complaint.id}
                              href={`/dashboard/complaints/${complaint.id}/view`}
                              className="group rounded-xl border border-[#E5E7EB] bg-white p-3 text-sm transition hover:border-[#00A27F] hover:bg-[#00A27F]/5"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-[#1F2937]">
                                    Reclamo #
                                    {complaint.complaintNumber ?? complaint.id}
                                  </p>

                                  <p className="mt-1 truncate text-xs text-[#6B7280]">
                                    {complaint.complainantName || "Sin nombre"}
                                  </p>

                                  <p className="mt-1 text-xs text-[#6B7280]">
                                    {complaint.complaintDate || "Sin fecha"} ·{" "}
                                    {complaint.status || "Sin estado"}
                                  </p>
                                </div>

                                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#00A27F]">
                                  <Eye className="h-3.5 w-3.5" />
                                  Ver
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );

              if (alert.complaintId) {
                return (
                  <AlertLink
                    key={alert.id}
                    href={`/dashboard/complaints/${alert.complaintId}/view`}
                    className="block"
                  >
                    {content}
                  </AlertLink>
                );
              }

              return <div key={alert.id}>{content}</div>;
            })}
          </div>
        )}
      </section>

      {filteredAlerts.length > alertsPerPage && (
        <div className="flex flex-col gap-3 rounded-xl border border-[#D8E3DE] bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-[#6B7280]">
            Mostrando{" "}
            <span className="font-medium text-[#1F2937]">{start}</span> a{" "}
            <span className="font-medium text-[#1F2937]">{end}</span> de{" "}
            <span className="font-medium text-[#1F2937]">
              {filteredAlerts.length}
            </span>{" "}
            alertas
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
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
                  onClick={() => handleGoToPage(1)}
                  className="min-w-9"
                >
                  1
                </Button>

                {pageNumbers[0] > 2 && (
                  <span className="px-1 text-sm text-[#6B7280]">...</span>
                )}
              </>
            )}

            {pageNumbers.map((page) => (
              <Button
                key={page}
                type="button"
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => handleGoToPage(page)}
                className="min-w-9"
              >
                {page}
              </Button>
            ))}

            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                  <span className="px-1 text-sm text-[#6B7280]">...</span>
                )}

                <Button
                  type="button"
                  variant={currentPage === totalPages ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleGoToPage(totalPages)}
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
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="gap-1"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}