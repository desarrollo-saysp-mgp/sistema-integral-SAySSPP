"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpDown,
  ArrowUpFromLine,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  History,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RelationValue = {
  id?: string;
  name?: string;
  full_name?: string;
  unit?: string;
  category_id?: string;
} | null;

type RawMovement = {
  id: string;
  movement_date: string;
  movement_type: string;
  product_id: string;
  quantity: number;
  recipient_id: string | null;
  area_id: string | null;
  reference: string | null;
  observations: string | null;
  legacy_destination: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  product?: RelationValue | RelationValue[];
  recipient?: RelationValue | RelationValue[];
  area?: RelationValue | RelationValue[];
  creator?: RelationValue | RelationValue[];
};

type HistoryMovement = {
  id: string;
  movement_date: string;
  movement_type: string;
  product_id: string;
  product_name: string;
  category_id: string;
  category_name: string;
  unit: string;
  quantity: number;
  recipient_name: string;
  area_name: string;
  destination: string;
  reference: string;
  observations: string;
  created_by_name: string;
  created_at: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

type MovementFilter =
  | "all"
  | "ENTRY"
  | "DELIVERY"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "INITIAL";

type SortOption =
  | "date_desc"
  | "date_asc"
  | "product_asc"
  | "product_desc"
  | "quantity_desc"
  | "quantity_asc";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type HistoryClientProps = {
  isReadonly: boolean;
};

const CHUNK_SIZE = 1000;
const PAGE_SIZE = 25;

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getRelation = (
  value: RelationValue | RelationValue[] | undefined,
): RelationValue => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const formatQuantity = (value: number | string | null | undefined) => {
  const quantity = Number(value ?? 0);

  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: Number.isInteger(quantity) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(quantity);
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";

  const [year, month, day] = value.slice(0, 10).split("-");

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getMovementLabel = (movementType: string) => {
  switch (movementType) {
    case "ENTRY":
      return "Entrada";
    case "DELIVERY":
      return "Entrega";
    case "ADJUSTMENT_IN":
      return "Ajuste de entrada";
    case "ADJUSTMENT_OUT":
      return "Ajuste de salida";
    case "INITIAL":
    case "INITIAL_STOCK":
      return "Stock inicial";
    default:
      return movementType || "Movimiento";
  }
};

const isIncomingMovement = (movementType: string) =>
  movementType === "ENTRY" ||
  movementType === "ADJUSTMENT_IN" ||
  movementType === "INITIAL" ||
  movementType === "INITIAL_STOCK";

const getMovementBadgeClasses = (movementType: string) => {
  if (
    movementType === "ENTRY" ||
    movementType === "INITIAL" ||
    movementType === "INITIAL_STOCK"
  ) {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  }

  if (movementType === "DELIVERY") {
    return "bg-sky-500/10 text-sky-700 dark:text-sky-400";
  }

  if (movementType === "ADJUSTMENT_IN") {
    return "bg-violet-500/10 text-violet-700 dark:text-violet-400";
  }

  if (movementType === "ADJUSTMENT_OUT") {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }

  return "bg-muted text-muted-foreground";
};

export function HistoryClient({ isReadonly }: HistoryClientProps) {
  const [movements, setMovements] = useState<HistoryMovement[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const [search, setSearch] = useState("");
  const [movementType, setMovementType] =
    useState<MovementFilter>("all");
  const [categoryId, setCategoryId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] =
    useState<HistoryMovement | null>(null);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showToast = useCallback(
    (type: "success" | "error", message: string) => {
      setToast({ type, message });
    },
    [],
  );

  const loadHistory = useCallback(
    async (showRefreshLoader = false) => {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const supabase = createClient();

        const allMovements: RawMovement[] = [];
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          const to = from + CHUNK_SIZE - 1;

          const { data, error } = await supabase
            .from("supply_movements")
            .select(
              `
                id,
                movement_date,
                movement_type,
                product_id,
                quantity,
                recipient_id,
                area_id,
                reference,
                observations,
                legacy_destination,
                created_by,
                created_at,
                updated_at,
                product:supply_products (
                  id,
                  name,
                  unit,
                  category_id,
                  category:supply_categories (
                    id,
                    name
                  )
                ),
                recipient:supply_recipients (
                  id,
                  full_name
                ),
                area:supply_areas (
                  id,
                  name
                ),
                creator:users (
                  id,
                  full_name
                )
              `,
            )
            .order("movement_date", { ascending: false })
            .order("created_at", { ascending: false })
            .range(from, to);

          if (error) {
            throw error;
          }

          const rows = (data ?? []) as unknown as RawMovement[];

          allMovements.push(...rows);

          hasMore = rows.length === CHUNK_SIZE;
          from += CHUNK_SIZE;
        }

        const normalized = allMovements.map((movement) => {
          const product = getRelation(movement.product);
          const category = getRelation(
            (product as RelationValue & {
              category?: RelationValue | RelationValue[];
            } | null)?.category,
          );
          const recipient = getRelation(movement.recipient);
          const area = getRelation(movement.area);
          const creator = getRelation(movement.creator);

          const recipientName = recipient?.full_name ?? "";
          const areaName = area?.name ?? "";
          const legacyDestination = movement.legacy_destination ?? "";

          const destination =
            [recipientName, areaName].filter(Boolean).join(" · ") ||
            legacyDestination ||
            "—";

          return {
            id: movement.id,
            movement_date: movement.movement_date,
            movement_type: movement.movement_type,
            product_id: movement.product_id,
            product_name: product?.name ?? "Producto no disponible",
            category_id: category?.id ?? product?.category_id ?? "",
            category_name: category?.name ?? "Sin categoría",
            unit: product?.unit ?? "unidad",
            quantity: Number(movement.quantity ?? 0),
            recipient_name: recipientName,
            area_name: areaName,
            destination,
            reference: movement.reference ?? "",
            observations: movement.observations ?? "",
            created_by_name: creator?.full_name ?? "Usuario no disponible",
            created_at: movement.created_at,
          } satisfies HistoryMovement;
        });

        const categoryMap = new Map<string, string>();

        normalized.forEach((movement) => {
          if (movement.category_id && movement.category_name) {
            categoryMap.set(
              movement.category_id,
              movement.category_name,
            );
          }
        });

        setMovements(normalized);
        setCategories(
          Array.from(categoryMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) =>
              a.name.localeCompare(b.name, "es", {
                sensitivity: "base",
              }),
            ),
        );
        setLastUpdated(new Date());
      } catch (loadError) {
        console.error("Error cargando historial:", loadError);
        showToast(
          "error",
          "No se pudo cargar el historial de movimientos.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void loadHistory();

    const supabase = createClient();

    let mounted = true;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    const channelName = `suministros-historial-${crypto.randomUUID()}`;

    const refreshHistory = () => {
      if (!mounted) return;

      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      refreshTimeout = setTimeout(() => {
        if (mounted) {
          void loadHistory(true);
        }
      }, 300);
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supply_movements",
        },
        refreshHistory,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supply_products",
        },
        refreshHistory,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supply_categories",
        },
        refreshHistory,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supply_recipients",
        },
        refreshHistory,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supply_areas",
        },
        refreshHistory,
      )
      .subscribe((status, subscriptionError) => {
        if (status === "CHANNEL_ERROR") {
          console.warn(
            "Realtime del historial tuvo un error.",
            subscriptionError,
          );
        }
      });

    return () => {
      mounted = false;

      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      void supabase.removeChannel(channel);
    };
  }, [loadHistory]);

  const filteredAndSortedMovements = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    const filtered = movements.filter((movement) => {
      const matchesSearch =
        !normalizedSearch ||
        normalizeText(movement.product_name).includes(normalizedSearch) ||
        normalizeText(movement.category_name).includes(normalizedSearch) ||
        normalizeText(movement.reference).includes(normalizedSearch) ||
        normalizeText(movement.observations).includes(normalizedSearch) ||
        normalizeText(movement.destination).includes(normalizedSearch) ||
        normalizeText(movement.created_by_name).includes(normalizedSearch);

      const matchesType =
        movementType === "all" ||
        movement.movement_type === movementType ||
        (movementType === "INITIAL" &&
          movement.movement_type === "INITIAL_STOCK");

      const matchesCategory =
        categoryId === "all" ||
        movement.category_id === categoryId;

      const movementDate = movement.movement_date.slice(0, 10);
      const matchesDateFrom = !dateFrom || movementDate >= dateFrom;
      const matchesDateTo = !dateTo || movementDate <= dateTo;

      return (
        matchesSearch &&
        matchesType &&
        matchesCategory &&
        matchesDateFrom &&
        matchesDateTo
      );
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "date_asc":
          return (
            a.movement_date.localeCompare(b.movement_date) ||
            a.created_at.localeCompare(b.created_at)
          );

        case "product_asc":
          return a.product_name.localeCompare(b.product_name, "es", {
            sensitivity: "base",
          });

        case "product_desc":
          return b.product_name.localeCompare(a.product_name, "es", {
            sensitivity: "base",
          });

        case "quantity_desc":
          return (
            b.quantity - a.quantity ||
            b.movement_date.localeCompare(a.movement_date)
          );

        case "quantity_asc":
          return (
            a.quantity - b.quantity ||
            b.movement_date.localeCompare(a.movement_date)
          );

        case "date_desc":
        default:
          return (
            b.movement_date.localeCompare(a.movement_date) ||
            b.created_at.localeCompare(a.created_at)
          );
      }
    });
  }, [
    movements,
    search,
    movementType,
    categoryId,
    dateFrom,
    dateTo,
    sortBy,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    movementType,
    categoryId,
    dateFrom,
    dateTo,
    sortBy,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSortedMovements.length / PAGE_SIZE),
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedMovements = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return filteredAndSortedMovements.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [filteredAndSortedMovements, page]);

  const summary = useMemo(() => {
    let entries = 0;
    let deliveries = 0;
    let adjustments = 0;

    filteredAndSortedMovements.forEach((movement) => {
      if (
        movement.movement_type === "ENTRY" ||
        movement.movement_type === "INITIAL" ||
        movement.movement_type === "INITIAL_STOCK"
      ) {
        entries += 1;
      } else if (movement.movement_type === "DELIVERY") {
        deliveries += 1;
      } else if (
        movement.movement_type === "ADJUSTMENT_IN" ||
        movement.movement_type === "ADJUSTMENT_OUT"
      ) {
        adjustments += 1;
      }
    });

    return {
      total: filteredAndSortedMovements.length,
      entries,
      deliveries,
      adjustments,
    };
  }, [filteredAndSortedMovements]);

  const hasActiveFilters =
    search.trim() !== "" ||
    movementType !== "all" ||
    categoryId !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    sortBy !== "date_desc";

  const clearFilters = () => {
    setSearch("");
    setMovementType("all");
    setCategoryId("all");
    setDateFrom("");
    setDateTo("");
    setSortBy("date_desc");
    setPage(1);
  };

  const openDetail = (movement: HistoryMovement) => {
    setSelectedMovement(movement);
    setDetailOpen(true);
  };

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[55vh] items-center justify-center p-4 sm:p-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
          <p className="text-sm">Cargando historial...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-3 w-fit"
          >
            <Link href="/dashboard/suministros">
              <ArrowLeft className="mr-2 size-4" />
              Volver al módulo
            </Link>
          </Button>

          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Historial
            </h1>

            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Revisá entradas, entregas y ajustes de stock.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadHistory(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}

            Actualizar
          </Button>

          {lastUpdated && (
            <p className="text-xs text-muted-foreground">
              Actualizado:{" "}
              {lastUpdated.toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-muted">
              <History className="size-5" />
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Movimientos
              </p>
              <p className="text-2xl font-bold">{summary.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10">
              <ArrowDownToLine className="size-5 text-emerald-700 dark:text-emerald-400" />
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Entradas</p>
              <p className="text-2xl font-bold">{summary.entries}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-sky-500/10">
              <ArrowUpFromLine className="size-5 text-sky-700 dark:text-sky-400" />
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Entregas</p>
              <p className="text-2xl font-bold">{summary.deliveries}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-violet-500/10">
              <SlidersHorizontal className="size-5 text-violet-700 dark:text-violet-400" />
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Ajustes</p>
              <p className="text-2xl font-bold">
                {summary.adjustments}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_190px_220px_160px_160px_minmax(230px,270px)_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar producto, referencia, destino..."
                className="pl-9"
              />
            </div>

            <Select
              value={movementType}
              onValueChange={(value) =>
                setMovementType(value as MovementFilter)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tipo de movimiento" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  Todos los movimientos
                </SelectItem>
                <SelectItem value="ENTRY">Entradas</SelectItem>
                <SelectItem value="DELIVERY">Entregas</SelectItem>
                <SelectItem value="ADJUSTMENT_IN">
                  Ajustes de entrada
                </SelectItem>
                <SelectItem value="ADJUSTMENT_OUT">
                  Ajustes de salida
                </SelectItem>
                <SelectItem value="INITIAL">
                  Stock inicial
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={categoryId}
              onValueChange={setCategoryId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  Todas las categorías
                </SelectItem>

                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="pl-9"
                aria-label="Fecha desde"
              />
            </div>

            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="pl-9"
                aria-label="Fecha hasta"
              />
            </div>

            <Select
              value={sortBy}
              onValueChange={(value) =>
                setSortBy(value as SortOption)
              }
            >
              <SelectTrigger className="w-full min-w-0">
                <ArrowUpDown className="mr-2 size-4 shrink-0" />
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="date_desc">
                  Más recientes
                </SelectItem>
                <SelectItem value="date_asc">
                  Más antiguos
                </SelectItem>
                <SelectItem value="product_asc">
                  Producto A–Z
                </SelectItem>
                <SelectItem value="product_desc">
                  Producto Z–A
                </SelectItem>
                <SelectItem value="quantity_desc">
                  Cantidad: mayor a menor
                </SelectItem>
                <SelectItem value="quantity_asc">
                  Cantidad: menor a mayor
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              className="w-full whitespace-nowrap xl:w-auto"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              Limpiar filtros
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {filteredAndSortedMovements.length === 1
              ? "1 movimiento encontrado"
              : `${filteredAndSortedMovements.length} movimientos encontrados`}
          </p>
        </CardContent>
      </Card>

      {paginatedMovements.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <History className="size-10 text-muted-foreground" />
            <div>
              <p className="font-medium">
                No se encontraron movimientos
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Probá modificando los filtros aplicados.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-hidden rounded-2xl md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-5 py-4 text-left">Fecha</th>
                    <th className="px-5 py-4 text-left">Movimiento</th>
                    <th className="px-5 py-4 text-left">Producto</th>
                    <th className="px-5 py-4 text-left">Categoría</th>
                    <th className="px-5 py-4 text-right">Cantidad</th>
                    <th className="px-5 py-4 text-left">Destino</th>
                    <th className="px-5 py-4 text-left">Usuario</th>
                    <th className="px-5 py-4 text-right">Detalle</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedMovements.map((movement) => (
                    <tr
                      key={movement.id}
                      className="border-b last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="whitespace-nowrap px-5 py-4">
                        {formatDate(movement.movement_date)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${getMovementBadgeClasses(
                            movement.movement_type,
                          )}`}
                        >
                          {getMovementLabel(
                            movement.movement_type,
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4 font-medium">
                        {movement.product_name}
                      </td>

                      <td className="px-5 py-4 text-muted-foreground">
                        {movement.category_name}
                      </td>

                      <td
                        className={`px-5 py-4 text-right text-base font-semibold ${
                          isIncomingMovement(
                            movement.movement_type,
                          )
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-sky-700 dark:text-sky-400"
                        }`}
                      >
                        {isIncomingMovement(
                          movement.movement_type,
                        )
                          ? "+"
                          : "-"}
                        {formatQuantity(movement.quantity)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {movement.unit}
                        </span>
                      </td>

                      <td className="max-w-[220px] truncate px-5 py-4 text-muted-foreground">
                        {movement.destination}
                      </td>

                      <td className="max-w-[190px] truncate px-5 py-4 text-muted-foreground">
                        {movement.created_by_name}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => openDetail(movement)}
                          title="Ver detalle"
                        >
                          <Eye className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:hidden">
            {paginatedMovements.map((movement) => (
              <Card key={movement.id} className="rounded-2xl">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {movement.product_name}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {movement.category_name}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getMovementBadgeClasses(
                        movement.movement_type,
                      )}`}
                    >
                      {getMovementLabel(movement.movement_type)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Fecha
                      </p>
                      <p className="mt-1 font-medium">
                        {formatDate(movement.movement_date)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Cantidad
                      </p>
                      <p className="mt-1 font-bold">
                        {isIncomingMovement(
                          movement.movement_type,
                        )
                          ? "+"
                          : "-"}
                        {formatQuantity(movement.quantity)}{" "}
                        {movement.unit}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">
                        Destino:
                      </span>{" "}
                      {movement.destination}
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        Usuario:
                      </span>{" "}
                      {movement.created_by_name}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => openDetail(movement)}
                  >
                    <Eye className="mr-2 size-4" />
                    Ver detalle
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="rounded-2xl">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </p>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage((current) => current - 1)
                  }
                >
                  <ChevronLeft className="mr-1 size-4" />
                  Anterior
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((current) => current + 1)
                  }
                >
                  Siguiente
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);

          if (!open) {
            setSelectedMovement(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle>Detalle del movimiento</DialogTitle>

            <DialogDescription>
              Información completa del registro seleccionado.
            </DialogDescription>
          </DialogHeader>

          {selectedMovement && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 rounded-2xl bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Producto
                  </p>
                  <p className="mt-1 font-semibold">
                    {selectedMovement.product_name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedMovement.category_name}
                  </p>
                </div>

                <div className="sm:text-right">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getMovementBadgeClasses(
                      selectedMovement.movement_type,
                    )}`}
                  >
                    {getMovementLabel(
                      selectedMovement.movement_type,
                    )}
                  </span>

                  <p className="mt-2 text-xl font-bold">
                    {isIncomingMovement(
                      selectedMovement.movement_type,
                    )
                      ? "+"
                      : "-"}
                    {formatQuantity(selectedMovement.quantity)}{" "}
                    {selectedMovement.unit}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailItem
                  label="Fecha del movimiento"
                  value={formatDate(
                    selectedMovement.movement_date,
                  )}
                />
                <DetailItem
                  label="Fecha de registro"
                  value={formatDateTime(
                    selectedMovement.created_at,
                  )}
                />
                <DetailItem
                  label="Persona autorizada"
                  value={selectedMovement.recipient_name || "—"}
                />
                <DetailItem
                  label="Dirección o área"
                  value={selectedMovement.area_name || "—"}
                />
                <DetailItem
                  label="Destino histórico"
                  value={selectedMovement.destination}
                />
                <DetailItem
                  label="Registrado por"
                  value={selectedMovement.created_by_name}
                />
              </div>

              <DetailBlock
                label="Referencia"
                value={selectedMovement.reference || "—"}
              />

              <DetailBlock
                label="Observaciones"
                value={selectedMovement.observations || "—"}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {toast && (
        <div className="fixed bottom-5 right-5 z-[100] w-[calc(100%-2.5rem)] max-w-sm">
          <div
            className={`flex items-start gap-3 rounded-2xl border bg-background p-4 shadow-lg ${
              toast.type === "success"
                ? "border-emerald-500/40"
                : "border-destructive/40"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            )}

            <p
              className={`flex-1 text-sm leading-5 ${
                toast.type === "success"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-destructive"
              }`}
            >
              {toast.message}
            </p>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-2 size-8 shrink-0"
              onClick={() => setToast(null)}
              aria-label="Cerrar notificación"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        El historial se actualiza automáticamente cuando otra cuenta
        registra o modifica movimientos.
        {isReadonly ? " Tu cuenta está en modo solo lectura." : ""}
      </p>
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
        {value}
      </p>
    </div>
  );
}
