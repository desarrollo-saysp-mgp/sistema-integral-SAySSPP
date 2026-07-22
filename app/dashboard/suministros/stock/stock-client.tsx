"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ArrowLeft,
    Boxes,
    ChevronLeft,
    ChevronRight,
    Loader2,
    PackageOpen,
    RefreshCw,
    Search,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type StockRow = {
    product_id: string;
    product_name: string;
    unit: string;
    minimum_stock: number;
    product_active: boolean;
    category_id: string;
    category_name: string;
    category_active: boolean;
    current_stock: number;
    initial_stock: number;
    total_entries: number;
    total_deliveries: number;
    total_adjustments_in: number;
    total_adjustments_out: number;
    low_stock: boolean;
};

type StockClientProps = {
    isReadonly: boolean;
};

type StockStatus = "all" | "available" | "without_stock" | "low_stock";

const PAGE_SIZE = 20;

const normalizeText = (value: unknown) =>
    String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

const formatQuantity = (value: number | string | null) => {
    const quantity = Number(value || 0);

    return new Intl.NumberFormat("es-AR", {
        minimumFractionDigits: Number.isInteger(quantity) ? 0 : 2,
        maximumFractionDigits: 2,
    }).format(quantity);
};

const getDisplayedStock = (value: number | string | null) => {
    const quantity = Number(value || 0);

    /*
      Por ahora, para no generar confusión con los registros históricos,
      las cantidades menores a cero se muestran como cero disponible.
      El valor real sigue conservado en la base.
    */
    return Math.max(0, quantity);
};

export function StockClient({ isReadonly }: StockClientProps) {
    const [stockRows, setStockRows] = useState<StockRow[]>([]);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("all");
    const [status, setStatus] = useState<StockStatus>("all");
    const [page, setPage] = useState(1);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const loadStock = useCallback(async (showRefreshLoader = false) => {
        if (showRefreshLoader) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError(null);

        try {
            const supabase = createClient();

            const CHUNK_SIZE = 1000;

            const allRows: StockRow[] = [];
            let from = 0;
            let hasMoreRows = true;

            while (hasMoreRows) {
                const to = from + CHUNK_SIZE - 1;

                const { data, error: stockError } = await supabase
                    .from("supply_current_stock")
                    .select(
                        `
        product_id,
        product_name,
        unit,
        minimum_stock,
        product_active,
        category_id,
        category_name,
        category_active,
        current_stock,
        initial_stock,
        total_entries,
        total_deliveries,
        total_adjustments_in,
        total_adjustments_out,
        low_stock
      `,
                    )
                    .eq("product_active", true)
                    .eq("category_active", true)
                    .order("category_name", { ascending: true })
                    .order("product_name", { ascending: true })
                    .range(from, to);

                if (stockError) {
                    throw stockError;
                }

                const rows = (data ?? []) as StockRow[];

                allRows.push(...rows);

                hasMoreRows = rows.length === CHUNK_SIZE;
                from += CHUNK_SIZE;
            }

            setStockRows(allRows);
            setLastUpdated(new Date());
        } catch (loadError) {
            console.error("Error al cargar el stock:", loadError);
            setError("No se pudo cargar el stock. Intentá nuevamente.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void loadStock();

        const supabase = createClient();

        let mounted = true;
        let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

        const channelName = `suministros-stock-${crypto.randomUUID()}`;

        const refreshAfterRealtimeChange = () => {
            if (!mounted) {
                return;
            }

            /*
              Agrupamos eventos muy cercanos para evitar varias consultas
              seguidas cuando una misma operación genera más de un cambio.
            */
            if (refreshTimeout) {
                clearTimeout(refreshTimeout);
            }

            refreshTimeout = setTimeout(() => {
                if (mounted) {
                    void loadStock(true);
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
                refreshAfterRealtimeChange,
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "supply_products",
                },
                refreshAfterRealtimeChange,
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "supply_categories",
                },
                refreshAfterRealtimeChange,
            )
            .subscribe((subscriptionStatus, subscriptionError) => {
                if (subscriptionStatus === "SUBSCRIBED") {
                    console.info("Realtime de stock conectado.");
                }

                if (subscriptionStatus === "CHANNEL_ERROR") {
                    console.warn(
                        "Realtime de stock tuvo un error de conexión.",
                        subscriptionError,
                    );
                }

                if (subscriptionStatus === "TIMED_OUT") {
                    console.warn(
                        "La conexión Realtime de stock demoró demasiado.",
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
    }, [loadStock]);

    const categories = useMemo(() => {
        const categoryMap = new Map<string, string>();

        stockRows.forEach((row) => {
            categoryMap.set(row.category_id, row.category_name);
        });

        return Array.from(categoryMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, "es"));
    }, [stockRows]);

    const filteredRows = useMemo(() => {
        const normalizedSearch = normalizeText(search);

        return stockRows.filter((row) => {
            const matchesSearch =
                !normalizedSearch ||
                normalizeText(row.product_name).includes(normalizedSearch) ||
                normalizeText(row.category_name).includes(normalizedSearch);

            const matchesCategory =
                category === "all" || row.category_id === category;

            const currentStock = Number(row.current_stock || 0);
            const displayedStock = getDisplayedStock(currentStock);
            const minimumStock = Number(row.minimum_stock || 0);

            let matchesStatus = true;

            if (status === "available") {
                matchesStatus = displayedStock > 0;
            }

            if (status === "without_stock") {
                matchesStatus = displayedStock === 0;
            }

            if (status === "low_stock") {
                matchesStatus = displayedStock <= minimumStock;
            }

            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [stockRows, search, category, status]);

    useEffect(() => {
        setPage(1);
    }, [search, category, status]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredRows.length / PAGE_SIZE),
    );

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const paginatedRows = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;

        return filteredRows.slice(start, end);
    }, [filteredRows, page]);

    const totalProducts = filteredRows.length;

    const productsWithStock = filteredRows.filter(
        (row) => getDisplayedStock(row.current_stock) > 0,
    ).length;

    const productsWithoutStock = filteredRows.filter(
        (row) => getDisplayedStock(row.current_stock) === 0,
    ).length;

    const clearFilters = () => {
        setSearch("");
        setCategory("all");
        setStatus("all");
        setPage(1);
    };

    const hasActiveFilters =
        search.trim() !== "" || category !== "all" || status !== "all";

    if (loading) {
        return (
            <div className="container mx-auto flex min-h-[55vh] items-center justify-center p-4 sm:p-6">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="size-8 animate-spin" />
                    <p className="text-sm">Cargando stock...</p>
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
                            Stock actual
                        </h1>

                        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                            Consultá las existencias disponibles por producto y categoría.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col items-start gap-2 sm:items-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => void loadStock(true)}
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

            {error && (
                <Card className="border-destructive/40">
                    <CardContent className="py-4 text-sm text-destructive">
                        {error}
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="rounded-2xl">
                    <CardContent className="flex items-center gap-4 p-5">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                            <Boxes className="size-5" />
                        </div>

                        <div>
                            <p className="text-sm text-muted-foreground">
                                Productos encontrados
                            </p>
                            <p className="text-2xl font-bold">{totalProducts}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardContent className="flex items-center gap-4 p-5">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                            <PackageOpen className="size-5" />
                        </div>

                        <div>
                            <p className="text-sm text-muted-foreground">
                                Con existencias
                            </p>
                            <p className="text-2xl font-bold">{productsWithStock}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardContent className="flex items-center gap-4 p-5">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                            <PackageOpen className="size-5" />
                        </div>

                        <div>
                            <p className="text-sm text-muted-foreground">
                                Sin existencias
                            </p>
                            <p className="text-2xl font-bold">{productsWithoutStock}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-2xl">
                <CardContent className="space-y-4 p-4 sm:p-5">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(240px,1fr)_260px_220px_auto]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Buscar producto o categoría..."
                                className="pl-9"
                            />
                        </div>

                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="Todas las categorías" />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value="all">Todas las categorías</SelectItem>

                                {categories.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                        {item.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={status}
                            onValueChange={(value) => setStatus(value as StockStatus)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Todos los estados" />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value="all">Todos los estados</SelectItem>
                                <SelectItem value="available">Con existencias</SelectItem>
                                <SelectItem value="without_stock">Sin existencias</SelectItem>
                                <SelectItem value="low_stock">Stock bajo</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={clearFilters}
                            disabled={!hasActiveFilters}
                        >
                            Limpiar filtros
                        </Button>
                    </div>

                    <div className="text-sm text-muted-foreground">
                        {filteredRows.length === 1
                            ? "1 producto encontrado"
                            : `${filteredRows.length} productos encontrados`}
                    </div>
                </CardContent>
            </Card>

            {paginatedRows.length === 0 ? (
                <Card className="rounded-2xl">
                    <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                        <PackageOpen className="size-10 text-muted-foreground" />

                        <div>
                            <p className="font-medium">No se encontraron productos</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Probá modificando los filtros de búsqueda.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Tabla para escritorio */}
                    <Card className="hidden overflow-hidden rounded-2xl md:block">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[850px] text-sm">
                                <thead className="border-b bg-muted/40">
                                    <tr>
                                        <th className="px-5 py-4 text-left font-medium">
                                            Producto
                                        </th>
                                        <th className="px-5 py-4 text-left font-medium">
                                            Categoría
                                        </th>
                                        <th className="px-5 py-4 text-left font-medium">
                                            Unidad
                                        </th>
                                        <th className="px-5 py-4 text-right font-medium">
                                            Stock actual
                                        </th>
                                        <th className="px-5 py-4 text-right font-medium">
                                            Stock mínimo
                                        </th>
                                        <th className="px-5 py-4 text-center font-medium">
                                            Estado
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {paginatedRows.map((row) => {
                                        const displayedStock = getDisplayedStock(
                                            row.current_stock,
                                        );

                                        const minimumStock = Number(row.minimum_stock || 0);

                                        const isWithoutStock = displayedStock === 0;
                                        const isLowStock =
                                            displayedStock > 0 &&
                                            displayedStock <= minimumStock;

                                        return (
                                            <tr
                                                key={row.product_id}
                                                className="border-b last:border-b-0 hover:bg-muted/30"
                                            >
                                                <td className="px-5 py-4 font-medium">
                                                    {row.product_name}
                                                </td>

                                                <td className="px-5 py-4 text-muted-foreground">
                                                    {row.category_name}
                                                </td>

                                                <td className="px-5 py-4 text-muted-foreground">
                                                    {row.unit}
                                                </td>

                                                <td className="px-5 py-4 text-right text-base font-semibold">
                                                    {formatQuantity(displayedStock)}
                                                </td>

                                                <td className="px-5 py-4 text-right text-muted-foreground">
                                                    {formatQuantity(minimumStock)}
                                                </td>

                                                <td className="px-5 py-4 text-center">
                                                    {isWithoutStock ? (
                                                        <span className="inline-flex rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                                                            Sin existencias
                                                        </span>
                                                    ) : isLowStock ? (
                                                        <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                                                            Stock bajo
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                                            Disponible
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Tarjetas para celular */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                        {paginatedRows.map((row) => {
                            const displayedStock = getDisplayedStock(row.current_stock);
                            const minimumStock = Number(row.minimum_stock || 0);

                            const isWithoutStock = displayedStock === 0;
                            const isLowStock =
                                displayedStock > 0 && displayedStock <= minimumStock;

                            return (
                                <Card key={row.product_id} className="rounded-2xl">
                                    <CardContent className="space-y-4 p-4">
                                        <div className="space-y-1">
                                            <h3 className="font-semibold leading-5">
                                                {row.product_name}
                                            </h3>

                                            <p className="text-sm text-muted-foreground">
                                                {row.category_name}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3">
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    Stock actual
                                                </p>
                                                <p className="mt-1 text-xl font-bold">
                                                    {formatQuantity(displayedStock)}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    Unidad
                                                </p>
                                                <p className="mt-1 font-medium">{row.unit}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-xs text-muted-foreground">
                                                Mínimo: {formatQuantity(minimumStock)}
                                            </span>

                                            {isWithoutStock ? (
                                                <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                                                    Sin existencias
                                                </span>
                                            ) : isLowStock ? (
                                                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                                                    Stock bajo
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                                    Disponible
                                                </span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    <Card className="rounded-2xl">
                        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-muted-foreground">
                                Página {page} de {totalPages}
                            </p>

                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((current) => current - 1)}
                                    disabled={page <= 1}
                                >
                                    <ChevronLeft className="mr-1 size-4" />
                                    Anterior
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((current) => current + 1)}
                                    disabled={page >= totalPages}
                                >
                                    Siguiente
                                    <ChevronRight className="ml-1 size-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {!isReadonly && (
                <p className="text-center text-xs text-muted-foreground">
                    Los cambios realizados desde otra cuenta se actualizan
                    automáticamente.
                </p>
            )}
        </div>
    );
}