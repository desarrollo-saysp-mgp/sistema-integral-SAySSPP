"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  FilterX,
  History,
  Info,
  Loader2,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/page-loader";

type AuditSource = "audit" | "historical";

type AuditLog = {
  id: string;
  personnel_id: string | null;
  personnel_name: string | null;
  personnel_legajo: string | null;

  action: "INSERT" | "UPDATE" | "DELETE";

  changed_by: string | null;
  changed_by_name: string | null;
  changed_by_email: string | null;

  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;

  changed_at: string;

  source: AuditSource;
  historical_note: string | null;
};

type ChangeItem = {
  key: string;
  label: string;
  before: unknown;
  after: unknown;
};

type SourceFilter = "all" | AuditSource;

type ActionFilter =
  | "all"
  | "Alta"
  | "Edición"
  | "Baja"
  | "Reactivación"
  | "Eliminación";

const PAGE_SIZE = 20;

const FIELD_LABELS: Record<string, string> = {
  nombre_completo: "Nombre completo",
  legajo: "Legajo",
  codigo_direccion: "Código de dirección",
  direccion: "Dirección",
  area_rrhh: "Área RR. HH.",
  tarea: "Tarea",
  tipo_contrato: "Tipo de contratación",
  convenio: "Convenio",
  numero_resolucion: "Número de resolución",
  horas_arregladas: "Horas arregladas",
  regimen_especial: "Régimen especial",
  hora_ingreso: "Hora de ingreso",
  hora_salida: "Hora de salida",
  observaciones: "Observaciones",
  activo: "Estado",
  fecha_baja: "Fecha de baja",
};

const IGNORED_CHANGE_FIELDS = new Set([
  "id",
  "creado_en",
  "creado_por",
  "actualizado_en",
  "actualizado_por",
  "dado_de_baja_por",
  "fecha_actualizacion",
]);

const normalizeSearch = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const formatDateTime = (value: string) => {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
};

const formatValue = (key: string, value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return "Sin informar";
  }

  if (key === "activo") {
    return value === true ? "Activo" : "Baja";
  }

  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }

  if (
    key === "fecha_baja" &&
    typeof value === "string" &&
    value
  ) {
    return formatDateTime(value);
  }

  if (key === "tipo_contrato") {
    if (value === "PLANTA_PERMANENTE") {
      return "Planta permanente";
    }

    if (value === "MONOTRIBUTISTA") {
      return "Monotributista";
    }

    if (value === "CONTRATO_CON_APORTES") {
      return "Contrato con aportes";
    }
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

const valuesAreEqual = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const getActionLabel = (log: AuditLog): ActionFilter => {
  if (log.action === "INSERT") {
    return "Alta";
  }

  if (log.action === "DELETE") {
    return "Eliminación";
  }

  const oldActive = log.old_data?.activo;
  const newActive = log.new_data?.activo;

  if (oldActive === true && newActive === false) {
    return "Baja";
  }

  if (oldActive === false && newActive === true) {
    return "Reactivación";
  }

  if (
    log.source === "historical" &&
    log.historical_note
      ?.toLowerCase()
      .includes("baja histórica")
  ) {
    return "Baja";
  }

  return "Edición";
};

const getActionVariant = (
  log: AuditLog,
): "default" | "secondary" | "destructive" | "outline" => {
  const action = getActionLabel(log);

  if (action === "Alta") {
    return "default";
  }

  if (action === "Baja" || action === "Eliminación") {
    return "destructive";
  }

  if (action === "Reactivación") {
    return "secondary";
  }

  return "outline";
};

const getChanges = (log: AuditLog): ChangeItem[] => {
  if (log.source !== "audit") {
    return [];
  }

  if (log.action === "INSERT") {
    const data = log.new_data ?? {};

    return Object.keys(data)
      .filter((key) => !IGNORED_CHANGE_FIELDS.has(key))
      .filter((key) => data[key] !== null && data[key] !== "")
      .map((key) => ({
        key,
        label: FIELD_LABELS[key] ?? key,
        before: null,
        after: data[key],
      }));
  }

  if (log.action === "DELETE") {
    const data = log.old_data ?? {};

    return Object.keys(data)
      .filter((key) => !IGNORED_CHANGE_FIELDS.has(key))
      .filter((key) => data[key] !== null && data[key] !== "")
      .map((key) => ({
        key,
        label: FIELD_LABELS[key] ?? key,
        before: data[key],
        after: null,
      }));
  }

  const oldData = log.old_data ?? {};
  const newData = log.new_data ?? {};

  const keys = new Set([
    ...Object.keys(oldData),
    ...Object.keys(newData),
  ]);

  return Array.from(keys)
    .filter((key) => !IGNORED_CHANGE_FIELDS.has(key))
    .filter(
      (key) =>
        !valuesAreEqual(oldData[key], newData[key]),
    )
    .map((key) => ({
      key,
      label: FIELD_LABELS[key] ?? key,
      before: oldData[key],
      after: newData[key],
    }));
};

const getLocalDateKey = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
};

export function PersonnelHistoryClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] =
    useState<SourceFilter>("all");
  const [actionFilter, setActionFilter] =
    useState<ActionFilter>("all");
  const [userFilter, setUserFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(),
  );

  const loadHistory = useCallback(
    async (showRefreshLoader = false) => {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const supabase = createClient();

        const { data, error: historyError } = await supabase
          .from("personnel_audit_log")
          .select("*")
          .order("changed_at", {
            ascending: false,
          })
          .limit(2000);

        if (historyError) {
          throw historyError;
        }

        setLogs((data ?? []) as AuditLog[]);
      } catch (loadError) {
        console.error(
          "Error al cargar historial de personal:",
          loadError,
        );

        setError(
          "No se pudo cargar el historial de cambios.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    sourceFilter,
    actionFilter,
    userFilter,
    dateFrom,
    dateTo,
  ]);

  const users = useMemo(() => {
    const userMap = new Map<string, string>();

    logs.forEach((log) => {
      const name =
        log.changed_by_name?.trim() ||
        "Usuario no identificado";

      userMap.set(name, name);
    });

    return Array.from(userMap.values()).sort((a, b) =>
      a.localeCompare(b, "es"),
    );
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const search = normalizeSearch(searchTerm);

    return logs.filter((log) => {
      if (
        sourceFilter !== "all" &&
        log.source !== sourceFilter
      ) {
        return false;
      }

      const action = getActionLabel(log);

      if (
        actionFilter !== "all" &&
        action !== actionFilter
      ) {
        return false;
      }

      const logUser =
        log.changed_by_name?.trim() ||
        "Usuario no identificado";

      if (
        userFilter !== "all" &&
        logUser !== userFilter
      ) {
        return false;
      }

      const dateKey = getLocalDateKey(log.changed_at);

      if (dateFrom && dateKey < dateFrom) {
        return false;
      }

      if (dateTo && dateKey > dateTo) {
        return false;
      }

      if (!search) {
        return true;
      }

      const values = [
        log.personnel_name,
        log.personnel_legajo,
        log.changed_by_name,
        log.changed_by_email,
        action,
        log.source === "audit"
          ? "auditado"
          : "histórico",
        log.historical_note,
      ];

      return values.some((value) =>
        normalizeSearch(value).includes(search),
      );
    });
  }, [
    logs,
    searchTerm,
    sourceFilter,
    actionFilter,
    userFilter,
    dateFrom,
    dateTo,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLogs.length / PAGE_SIZE),
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredLogs.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [filteredLogs, currentPage]);

  const firstVisible =
    filteredLogs.length === 0
      ? 0
      : (currentPage - 1) * PAGE_SIZE + 1;

  const lastVisible = Math.min(
    currentPage * PAGE_SIZE,
    filteredLogs.length,
  );

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    sourceFilter !== "all" ||
    actionFilter !== "all" ||
    userFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  const clearFilters = () => {
    setSearchTerm("");
    setSourceFilter("all");
    setActionFilter("all");
    setUserFilter("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  if (loading) {
    return (
      <>
        <PageLoader show />

        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />

            <p className="text-sm">
              Cargando historial de personal...
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageLoader show={false} />

      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              asChild
              className="-ml-3"
            >
              <Link href="/dashboard/personnel">
                <ArrowLeft className="mr-2 size-4" />
                Volver a Personal
              </Link>
            </Button>

            <h1 className="text-2xl font-bold sm:text-3xl">
              Historial de cambios
            </h1>

            <p className="text-muted-foreground">
              Auditoría de altas, ediciones, bajas,
              reactivaciones y eliminaciones del personal.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void loadHistory(true)}
            disabled={refreshing}
            className="w-full sm:w-auto"
          >
            {refreshing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}

            Actualizar
          </Button>
        </div>

        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground sm:p-5">
            <Info className="mt-0.5 size-5 shrink-0" />

            <div className="space-y-1">
              <p>
                <span className="font-medium text-foreground">
                  Auditado:
                </span>{" "}
                registro exacto capturado desde que se activó
                la auditoría. En las ediciones se puede consultar
                qué cambió.
              </p>

              <p>
                <span className="font-medium text-foreground">
                  Histórico:
                </span>{" "}
                actividad anterior reconstruida desde los datos
                que ya existían. Puede indicar alta, baja o última
                modificación conocida, pero no permite recuperar
                los campos exactos que cambiaron.
              </p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive/40">
            <CardContent className="py-4 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        <Card className="rounded-2xl">
          <CardContent className="space-y-5 p-4 sm:p-6">
            <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(event.target.value)
                  }
                  placeholder="Buscar por persona, legajo, usuario, acción o tipo de registro..."
                  className="bg-background pl-9"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Tipo de registro
                  </label>

                  <select
                    value={sourceFilter}
                    onChange={(event) =>
                      setSourceFilter(
                        event.target.value as SourceFilter,
                      )
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">Todos</option>
                    <option value="audit">Auditados</option>
                    <option value="historical">Históricos</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Acción
                  </label>

                  <select
                    value={actionFilter}
                    onChange={(event) =>
                      setActionFilter(
                        event.target.value as ActionFilter,
                      )
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">Todas</option>
                    <option value="Alta">Altas</option>
                    <option value="Edición">Ediciones</option>
                    <option value="Baja">Bajas</option>
                    <option value="Reactivación">
                      Reactivaciones
                    </option>
                    <option value="Eliminación">
                      Eliminaciones
                    </option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Usuario
                  </label>

                  <select
                    value={userFilter}
                    onChange={(event) =>
                      setUserFilter(event.target.value)
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">Todos</option>

                    {users.map((user) => (
                      <option key={user} value={user}>
                        {user}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Desde
                  </label>

                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(event) =>
                      setDateFrom(event.target.value)
                    }
                    className="bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Hasta
                  </label>

                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(event) =>
                      setDateTo(event.target.value)
                    }
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {filteredLogs.length === 1
                    ? "1 registro encontrado"
                    : `${filteredLogs.length} registros encontrados`}
                </p>

                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                  >
                    <FilterX className="mr-2 size-4" />
                    Limpiar filtros
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {paginatedLogs.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  No se encontraron registros con los filtros seleccionados.
                </div>
              ) : (
                paginatedLogs.map((log) => {
                  const isExpanded = expandedIds.has(log.id);
                  const changes = getChanges(log);
                  const isHistorical =
                    log.source === "historical";

                  return (
                    <Card
                      key={log.id}
                      className="rounded-xl border shadow-sm"
                    >
                      <CardContent className="space-y-3 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">
                                {log.personnel_name ||
                                  "Personal sin nombre"}
                              </p>

                              <Badge
                                variant={getActionVariant(log)}
                              >
                                {getActionLabel(log)}
                              </Badge>

                              <Badge
                                variant="outline"
                                className="gap-1"
                              >
                                <History className="size-3" />

                                {isHistorical
                                  ? "Histórico"
                                  : "Auditado"}
                              </Badge>
                            </div>

                            <p className="mt-1 text-sm text-muted-foreground">
                              Legajo:{" "}
                              <span className="font-medium text-foreground">
                                {log.personnel_legajo || "-"}
                              </span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock3 className="size-4" />

                            <span>
                              {formatDateTime(log.changed_at)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
                          <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

                          <div className="min-w-0 text-sm">
                            <p className="font-medium">
                              {log.changed_by_name ||
                                "Usuario no identificado"}
                            </p>

                            <p className="break-all text-muted-foreground">
                              {log.changed_by_email || "-"}
                            </p>
                          </div>
                        </div>

                        {isHistorical ? (
                          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                            {log.historical_note ||
                              "Registro histórico reconstruido. No se dispone del detalle exacto de los cambios."}
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  toggleExpanded(log.id)
                                }
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="mr-2 size-4" />
                                    Ocultar detalle
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="mr-2 size-4" />
                                    {log.action === "INSERT"
                                      ? "Ver datos cargados"
                                      : log.action === "DELETE"
                                        ? "Ver datos eliminados"
                                        : "Ver cambios"}
                                  </>
                                )}
                              </Button>
                            </div>

                            {isExpanded && (
                              <div className="space-y-3 rounded-xl border bg-muted/20 p-3 sm:p-4">
                                {changes.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">
                                    No se detectaron cambios de datos para mostrar.
                                  </p>
                                ) : (
                                  changes.map((change) => (
                                    <div
                                      key={change.key}
                                      className="rounded-lg border bg-background p-3"
                                    >
                                      <p className="mb-2 text-sm font-semibold">
                                        {change.label}
                                      </p>

                                      {log.action === "INSERT" ? (
                                        <div className="text-sm">
                                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Valor cargado
                                          </p>

                                          <p className="mt-1 break-words font-medium">
                                            {formatValue(
                                              change.key,
                                              change.after,
                                            )}
                                          </p>
                                        </div>
                                      ) : log.action ===
                                        "DELETE" ? (
                                        <div className="text-sm">
                                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Valor eliminado
                                          </p>

                                          <p className="mt-1 break-words font-medium">
                                            {formatValue(
                                              change.key,
                                              change.before,
                                            )}
                                          </p>
                                        </div>
                                      ) : (
                                        <div className="grid gap-3 md:grid-cols-2">
                                          <div className="rounded-lg bg-muted/40 p-3">
                                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                              Antes
                                            </p>

                                            <p className="mt-1 break-words text-sm font-medium">
                                              {formatValue(
                                                change.key,
                                                change.before,
                                              )}
                                            </p>
                                          </div>

                                          <div className="rounded-lg bg-muted/40 p-3">
                                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                              Después
                                            </p>

                                            <p className="mt-1 break-words text-sm font-medium">
                                              {formatValue(
                                                change.key,
                                                change.after,
                                              )}
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {filteredLogs.length > 0 && (
              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Mostrando{" "}
                  <span className="font-medium text-foreground">
                    {firstVisible}-{lastVisible}
                  </span>{" "}
                  de{" "}
                  <span className="font-medium text-foreground">
                    {filteredLogs.length}
                  </span>{" "}
                  registros
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    aria-label="Primera página"
                  >
                    <ChevronsLeft className="size-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.max(1, page - 1),
                      )
                    }
                    disabled={currentPage === 1}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>

                  <div className="min-w-[130px] text-center text-sm">
                    Página{" "}
                    <span className="font-semibold">
                      {currentPage}
                    </span>{" "}
                    de{" "}
                    <span className="font-semibold">
                      {totalPages}
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(totalPages, page + 1),
                      )
                    }
                    disabled={currentPage === totalPages}
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="size-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setCurrentPage(totalPages)
                    }
                    disabled={currentPage === totalPages}
                    aria-label="Última página"
                  >
                    <ChevronsRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
