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
  ArrowUpFromLine,
  BarChart3,
  Boxes,
  CalendarDays,
  ChevronDown,
  Loader2,
  PackageSearch,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  product?: RelationValue | RelationValue[];
  recipient?: RelationValue | RelationValue[];
  area?: RelationValue | RelationValue[];
};

type MovementRow = {
  id: string;
  movementDate: string;
  movementType: string;
  productId: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  quantity: number;
  recipientName: string;
  areaName: string;
  reference: string;
};

type StockRow = {
  product_id: string;
  product_name: string;
  current_stock: number;
  minimum_stock: number;
  low_stock: boolean;
  product_active: boolean;
  category_id: string;
  category_name: string;
  category_active: boolean;
};

type CategoryOption = {
  id: string;
  name: string;
};

type ProductOption = {
  id: string;
  name: string;
  categoryId: string;
};

type ToastState = {
  type: "error";
  message: string;
} | null;

const CHUNK_SIZE = 1000;
const TOP_LIMIT = 10;

const getRelation = (
  value: RelationValue | RelationValue[] | undefined,
): RelationValue => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const formatQuantity = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);

const toMonthKey = (value: string) => value.slice(0, 7);

const formatMonth = (monthKey: string) => {
  const [year, month] = monthKey.split("-");

  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    "es-AR",
    {
      month: "short",
      year: "2-digit",
    },
  );
};

const defaultDateFrom = () => {
  const now = new Date();
  now.setMonth(now.getMonth() - 5);
  now.setDate(1);

  return now.toISOString().slice(0, 10);
};

const today = () => new Date().toISOString().slice(0, 10);

export function StatisticsClient() {
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(today);
  const [categoryId, setCategoryId] = useState("all");
  const [productId, setProductId] = useState("all");
  const [movementType, setMovementType] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedDeliveryMonth, setSelectedDeliveryMonth] = useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 4000);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const loadData = useCallback(async (showRefreshLoader = false) => {
    if (showRefreshLoader) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const supabase = createClient();

      const allMovements: RawMovement[] = [];
      let movementFrom = 0;
      let hasMoreMovements = true;

      while (hasMoreMovements) {
        const movementTo = movementFrom + CHUNK_SIZE - 1;

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
              product:supply_products (
                id,
                name,
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
              )
            `,
          )
          .order("movement_date", { ascending: true })
          .range(movementFrom, movementTo);

        if (error) throw error;

        const rows = (data ?? []) as unknown as RawMovement[];

        allMovements.push(...rows);
        hasMoreMovements = rows.length === CHUNK_SIZE;
        movementFrom += CHUNK_SIZE;
      }

      const allStockRows: StockRow[] = [];
      let stockFrom = 0;
      let hasMoreStockRows = true;

      while (hasMoreStockRows) {
        const stockTo = stockFrom + CHUNK_SIZE - 1;

        const { data, error } = await supabase
          .from("supply_current_stock")
          .select(
            `
              product_id,
              product_name,
              current_stock,
              minimum_stock,
              low_stock,
              product_active,
              category_id,
              category_name,
              category_active
            `,
          )
          .eq("product_active", true)
          .eq("category_active", true)
          .order("product_name", { ascending: true })
          .range(stockFrom, stockTo);

        if (error) throw error;

        const rows = (data ?? []) as StockRow[];

        allStockRows.push(...rows);
        hasMoreStockRows = rows.length === CHUNK_SIZE;
        stockFrom += CHUNK_SIZE;
      }

      const normalizedMovements = allMovements.map((movement) => {
        const product = getRelation(movement.product);
        const category = getRelation(
          (
            product as RelationValue & {
              category?: RelationValue | RelationValue[];
            } | null
          )?.category,
        );
        const recipient = getRelation(movement.recipient);
        const area = getRelation(movement.area);

        const importedMovement =
          movement.reference?.startsWith("IMPORT_") === true;
        const importedDelivery =
          importedMovement && movement.movement_type === "DELIVERY";

        // En las entregas históricas importadas:
        // legacy_destination contiene la persona
        // observations contiene la dirección o área
        const recipientName =
          recipient?.full_name ??
          (importedDelivery ? movement.legacy_destination ?? "" : "");

        const areaName =
          area?.name ??
          (importedDelivery ? movement.observations ?? "" : "");

        return {
          id: movement.id,
          movementDate: movement.movement_date,
          movementType: movement.movement_type,
          productId: movement.product_id,
          productName: product?.name ?? "Producto no disponible",
          categoryId: category?.id ?? product?.category_id ?? "",
          categoryName: category?.name ?? "Sin categoría",
          quantity: Number(movement.quantity ?? 0),
          recipientName,
          areaName,
          reference: movement.reference ?? "",
        } satisfies MovementRow;
      });

      const categoryMap = new Map<string, string>();
      const productMap = new Map<string, ProductOption>();

      allStockRows.forEach((row) => {
        categoryMap.set(row.category_id, row.category_name);
        productMap.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          categoryId: row.category_id,
        });
      });

      setMovements(normalizedMovements);
      setStockRows(allStockRows);
      setCategories(
        Array.from(categoryMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) =>
            a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
          ),
      );
      setProducts(
        Array.from(productMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
        ),
      );
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error cargando estadísticas:", error);
      setToast({
        type: "error",
        message: "No se pudieron cargar las estadísticas.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();

    const supabase = createClient();
    let mounted = true;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (!mounted) return;

      if (refreshTimeout) clearTimeout(refreshTimeout);

      refreshTimeout = setTimeout(() => {
        if (mounted) void loadData(true);
      }, 350);
    };

    const channel = supabase
      .channel(`suministros-estadisticas-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supply_movements",
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supply_products",
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supply_categories",
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      mounted = false;

      if (refreshTimeout) clearTimeout(refreshTimeout);

      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  useEffect(() => {
    if (
      productId !== "all" &&
      !products.some(
        (product) =>
          product.id === productId &&
          (categoryId === "all" || product.categoryId === categoryId),
      )
    ) {
      setProductId("all");
    }
  }, [categoryId, productId, products]);

  const visibleProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          categoryId === "all" || product.categoryId === categoryId,
      ),
    [products, categoryId],
  );

  const filteredMovements = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    return movements.filter((movement) => {
      const movementDate = movement.movementDate.slice(0, 10);
      const matchesDateFrom = !dateFrom || movementDate >= dateFrom;
      const matchesDateTo = !dateTo || movementDate <= dateTo;
      const matchesCategory =
        categoryId === "all" || movement.categoryId === categoryId;
      const matchesProduct =
        productId === "all" || movement.productId === productId;
      const matchesType =
        movementType === "all" || movement.movementType === movementType;
      const matchesSearch =
        !normalizedSearch ||
        normalizeText(movement.productName).includes(normalizedSearch) ||
        normalizeText(movement.categoryName).includes(normalizedSearch) ||
        normalizeText(movement.recipientName).includes(normalizedSearch) ||
        normalizeText(movement.areaName).includes(normalizedSearch);

      return (
        matchesDateFrom &&
        matchesDateTo &&
        matchesCategory &&
        matchesProduct &&
        matchesType &&
        matchesSearch
      );
    });
  }, [
    movements,
    dateFrom,
    dateTo,
    categoryId,
    productId,
    movementType,
    search,
  ]);

  const filteredStockRows = useMemo(
    () =>
      stockRows.filter(
        (row) =>
          (categoryId === "all" || row.category_id === categoryId) &&
          (productId === "all" || row.product_id === productId),
      ),
    [stockRows, categoryId, productId],
  );

  const indicators = useMemo(() => {
    const entries = filteredMovements
      .filter(
        (movement) =>
          movement.movementType === "ENTRY" ||
          movement.movementType === "INITIAL" ||
          movement.movementType === "INITIAL_STOCK",
      )
      .reduce((sum, movement) => sum + movement.quantity, 0);

    const deliveries = filteredMovements
      .filter((movement) => movement.movementType === "DELIVERY")
      .reduce((sum, movement) => sum + movement.quantity, 0);

    const stockTotal = filteredStockRows.reduce(
      (sum, row) => sum + Number(row.current_stock ?? 0),
      0,
    );

    const withStock = filteredStockRows.filter(
      (row) => Number(row.current_stock) > 0,
    ).length;

    const withoutStock = filteredStockRows.filter(
      (row) => Number(row.current_stock) <= 0,
    ).length;

    const lowStock = filteredStockRows.filter(
      (row) =>
        row.low_stock === true &&
        Number(row.current_stock) > 0,
    ).length;

    return {
      entries,
      deliveries,
      stockTotal,
      withStock,
      withoutStock,
      lowStock,
    };
  }, [filteredMovements, filteredStockRows]);

  const monthlySeries = useMemo(() => {
    const months = new Map<
      string,
      { month: string; entries: number; deliveries: number }
    >();

    filteredMovements.forEach((movement) => {
      const month = toMonthKey(movement.movementDate);
      const current = months.get(month) ?? {
        month,
        entries: 0,
        deliveries: 0,
      };

      if (
        movement.movementType === "ENTRY" ||
        movement.movementType === "INITIAL" ||
        movement.movementType === "INITIAL_STOCK"
      ) {
        current.entries += movement.quantity;
      }

      if (movement.movementType === "DELIVERY") {
        current.deliveries += movement.quantity;
      }

      months.set(month, current);
    });

    return Array.from(months.values()).sort((a, b) =>
      a.month.localeCompare(b.month),
    );
  }, [filteredMovements]);

  const categoryDeliveries = useMemo(() => {
    const values = new Map<string, number>();

    filteredMovements
      .filter((movement) => movement.movementType === "DELIVERY")
      .forEach((movement) => {
        values.set(
          movement.categoryName,
          (values.get(movement.categoryName) ?? 0) + movement.quantity,
        );
      });

    return Array.from(values.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_LIMIT);
  }, [filteredMovements]);

  const topProducts = useMemo(() => {
    const values = new Map<string, number>();

    filteredMovements
      .filter((movement) => movement.movementType === "DELIVERY")
      .forEach((movement) => {
        values.set(
          movement.productName,
          (values.get(movement.productName) ?? 0) + movement.quantity,
        );
      });

    return Array.from(values.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_LIMIT);
  }, [filteredMovements]);

  const topAreas = useMemo(() => {
    const values = new Map<string, number>();

    filteredMovements
      .filter(
        (movement) =>
          movement.movementType === "DELIVERY" &&
          movement.areaName.trim() !== "",
      )
      .forEach((movement) => {
        values.set(
          movement.areaName,
          (values.get(movement.areaName) ?? 0) + movement.quantity,
        );
      });

    return Array.from(values.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_LIMIT);
  }, [filteredMovements]);

  const availableDeliveryMonths = useMemo(() => {
    const months = new Set<string>();

    movements
      .filter((movement) => movement.movementType === "DELIVERY")
      .forEach((movement) => months.add(toMonthKey(movement.movementDate)));

    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [movements]);

  const productsByCategoryAndMonth = useMemo(() => {
    const categoryMap = new Map<
      string,
      Map<string, number>
    >();

    filteredMovements
      .filter((movement) => {
        if (movement.movementType !== "DELIVERY") return false;

        return (
          selectedDeliveryMonth === "all" ||
          toMonthKey(movement.movementDate) === selectedDeliveryMonth
        );
      })
      .forEach((movement) => {
        const productMap =
          categoryMap.get(movement.categoryName) ?? new Map<string, number>();

        productMap.set(
          movement.productName,
          (productMap.get(movement.productName) ?? 0) + movement.quantity,
        );

        categoryMap.set(movement.categoryName, productMap);
      });

    return Array.from(categoryMap.entries())
      .map(([categoryName, productMap]) => ({
        categoryName,
        products: Array.from(productMap.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value),
      }))
      .filter((category) => category.products.length > 0)
      .sort((a, b) => {
        const totalA = a.products.reduce((sum, item) => sum + item.value, 0);
        const totalB = b.products.reduce((sum, item) => sum + item.value, 0);

        return totalB - totalA;
      });
  }, [filteredMovements, selectedDeliveryMonth]);

  const clearFilters = () => {
    setDateFrom(defaultDateFrom());
    setDateTo(today());
    setCategoryId("all");
    setProductId("all");
    setMovementType("all");
    setSearch("");
    setSelectedDeliveryMonth("all");
  };

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[55vh] items-center justify-center p-4 sm:p-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
          <p className="text-sm">Cargando estadísticas...</p>
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
              Estadísticas de Suministros
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Analizá el stock, las entradas, las entregas y el consumo.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadData(true)}
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

      <Card className="rounded-2xl">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_160px_160px_210px_220px_190px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar producto, categoría, persona o área..."
                className="pl-9"
              />
            </div>

            <DateInput
              value={dateFrom}
              onChange={setDateFrom}
              label="Fecha desde"
            />

            <DateInput
              value={dateTo}
              onChange={setDateTo}
              label="Fecha hasta"
            />

            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todos los productos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los productos</SelectItem>
                {visibleProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={movementType} onValueChange={setMovementType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tipo de movimiento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los movimientos</SelectItem>
                <SelectItem value="ENTRY">Entradas</SelectItem>
                <SelectItem value="DELIVERY">Entregas</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              className="w-full whitespace-nowrap xl:w-auto"
              onClick={clearFilters}
            >
              Limpiar filtros
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {filteredMovements.length} movimientos dentro del período
            seleccionado.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <SummaryCard
          title="Stock disponible"
          value={formatQuantity(indicators.stockTotal)}
          icon={Boxes}
        />
        <SummaryCard
          title="Con existencias"
          value={formatQuantity(indicators.withStock)}
          icon={PackageSearch}
        />
        <SummaryCard
          title="Sin existencias"
          value={formatQuantity(indicators.withoutStock)}
          icon={AlertCircle}
        />
        <SummaryCard
          title="Stock bajo"
          value={formatQuantity(indicators.lowStock)}
          icon={TrendingUp}
        />
        <SummaryCard
          title="Entradas"
          value={formatQuantity(indicators.entries)}
          icon={ArrowDownToLine}
        />
        <SummaryCard
          title="Entregas"
          value={formatQuantity(indicators.deliveries)}
          icon={ArrowUpFromLine}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="size-5" />
              Entradas y entregas por mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyBars data={monthlySeries} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Boxes className="size-5" />
              Estado actual del stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StockStatusChart
              withStock={indicators.withStock}
              withoutStock={indicators.withoutStock}
              lowStock={indicators.lowStock}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="size-5" />
              Productos entregados por categoría
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Compará cuáles fueron los productos más entregados dentro de cada
              categoría.
            </p>
          </div>

          <Select
            value={selectedDeliveryMonth}
            onValueChange={setSelectedDeliveryMonth}
          >
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Seleccionar mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los meses</SelectItem>
              {availableDeliveryMonths.map((month) => (
                <SelectItem key={month} value={month}>
                  {formatMonth(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>

        <CardContent>
          {productsByCategoryAndMonth.length === 0 ? (
            <EmptyChart message="No hay entregas para el mes y los filtros seleccionados." />
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {productsByCategoryAndMonth.map((category) => (
                <CategoryProductChart
                  key={category.categoryName}
                  title={category.categoryName}
                  rows={category.products}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <RankingCard
          title="Categorías con más entregas"
          icon={BarChart3}
          rows={categoryDeliveries}
        />
        <RankingCard
          title="Productos más entregados"
          icon={PackageSearch}
          rows={topProducts}
        />
        <RankingCard
          title="Áreas con más entregas"
          icon={Users}
          rows={topAreas}
        />
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 z-[100] w-[calc(100%-2.5rem)] max-w-sm">
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-background p-4 shadow-lg">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="flex-1 text-sm leading-5 text-destructive">
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
    </div>
  );
}

function DateInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="relative">
      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pl-9"
        aria-label={label}
      />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof Boxes;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="truncate text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyBars({
  data,
}: {
  data: Array<{ month: string; entries: number; deliveries: number }>;
}) {
  const [activeMonth, setActiveMonth] = useState<string | null>(null);

  if (data.length === 0) {
    return <EmptyChart message="No hay movimientos para este período." />;
  }

  const maximum = Math.max(
    ...data.flatMap((item) => [item.entries, item.deliveries]),
    1,
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-emerald-500" />
          Entradas
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-sky-500" />
          Entregas
        </span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div
          className="flex min-w-[600px] items-end gap-4"
          style={{ height: 270 }}
        >
          {data.map((item) => {
            const active = activeMonth === item.month;

            return (
              <button
                key={item.month}
                type="button"
                className={`group flex h-full min-w-[62px] flex-1 flex-col justify-end rounded-xl p-2 transition-colors ${
                  active ? "bg-muted" : "hover:bg-muted/50"
                }`}
                onClick={() =>
                  setActiveMonth((current) =>
                    current === item.month ? null : item.month,
                  )
                }
              >
                <div className="flex h-[210px] items-end justify-center gap-2">
                  <div
                    className="w-4 rounded-t-md bg-emerald-500 transition-all"
                    style={{
                      height: `${Math.max(
                        4,
                        (item.entries / maximum) * 100,
                      )}%`,
                    }}
                    title={`Entradas: ${formatQuantity(item.entries)}`}
                  />
                  <div
                    className="w-4 rounded-t-md bg-sky-500 transition-all"
                    style={{
                      height: `${Math.max(
                        4,
                        (item.deliveries / maximum) * 100,
                      )}%`,
                    }}
                    title={`Entregas: ${formatQuantity(item.deliveries)}`}
                  />
                </div>
                <span className="mt-3 text-xs font-medium capitalize">
                  {formatMonth(item.month)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {activeMonth && (
        <div className="rounded-xl border bg-muted/30 p-3 text-sm">
          {(() => {
            const item = data.find((row) => row.month === activeMonth);

            if (!item) return null;

            return (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-medium capitalize">
                  {formatMonth(item.month)}
                </span>
                <span>Entradas: {formatQuantity(item.entries)}</span>
                <span>Entregas: {formatQuantity(item.deliveries)}</span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function StockStatusChart({
  withStock,
  withoutStock,
  lowStock,
}: {
  withStock: number;
  withoutStock: number;
  lowStock: number;
}) {
  const total = Math.max(withStock + withoutStock, 1);
  const withStockPercent = (withStock / total) * 100;
  const withoutStockPercent = (withoutStock / total) * 100;
  const lowStockPercent = (lowStock / total) * 100;

  return (
    <div className="space-y-5">
      <ProgressRow
        label="Con existencias"
        value={withStock}
        percent={withStockPercent}
      />
      <ProgressRow
        label="Sin existencias"
        value={withoutStock}
        percent={withoutStockPercent}
      />
      <ProgressRow
        label="Stock bajo"
        value={lowStock}
        percent={lowStockPercent}
      />

      <div className="rounded-xl bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">
          Productos incluidos en el análisis
        </p>
        <p className="mt-1 text-3xl font-bold">
          {formatQuantity(withStock + withoutStock)}
        </p>
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  percent,
}: {
  label: string;
  value: number;
  percent: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="font-semibold">{formatQuantity(value)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

function CategoryProductChart({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
}) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const maximum = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="rounded-2xl border p-4 sm:p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Cantidad total entregada por producto
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
          {rows.length} productos
        </span>
      </div>

      <div className="space-y-3">
        {rows.map((row) => {
          const active = selectedProduct === row.label;

          return (
            <button
              key={row.label}
              type="button"
              className={`w-full rounded-xl p-2 text-left transition-colors ${
                active ? "bg-muted" : "hover:bg-muted/50"
              }`}
              onClick={() =>
                setSelectedProduct((current) =>
                  current === row.label ? null : row.label,
                )
              }
            >
              <div className="mb-2 flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">
                  {row.label}
                </span>
                <span className="shrink-0 font-bold">
                  {formatQuantity(row.value)}
                </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(row.value / maximum) * 100}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {selectedProduct && (
        <div className="mt-4 rounded-xl bg-muted/40 p-3 text-sm">
          <span className="font-medium">{selectedProduct}</span>
          <span className="ml-2 text-muted-foreground">
            fue seleccionado dentro de {title}.
          </span>
        </div>
      )}
    </div>
  );
}

function RankingCard({
  title,
  rows,
  icon: Icon,
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
  icon: typeof Boxes;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded ? rows : rows.slice(0, 5);
  const maximum = Math.max(...rows.map((row) => row.value), 1);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="size-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {visibleRows.length === 0 ? (
          <EmptyChart message="No hay entregas para mostrar." />
        ) : (
          visibleRows.map((row, index) => (
            <div key={row.label} className="space-y-2">
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {index + 1}. {row.label}
                </span>
                <span className="shrink-0 font-semibold">
                  {formatQuantity(row.value)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(row.value / maximum) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}

        {rows.length > 5 && (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Ver menos" : "Ver ranking completo"}
            <ChevronDown
              className={`ml-2 size-4 transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
