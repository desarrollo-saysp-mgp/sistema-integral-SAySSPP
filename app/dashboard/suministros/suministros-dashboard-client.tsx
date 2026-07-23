"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  History,
  Loader2,
  PackageSearch,
  Tags,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type StockSummaryRow = {
  product_id: string;
  current_stock: number;
  low_stock: boolean;
  product_active: boolean;
  category_active: boolean;
};

type ModuleCard = {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

type SuministrosDashboardClientProps = {
  isReadonly: boolean;
};

const CHUNK_SIZE = 1000;

const MODULE_CARDS: ModuleCard[] = [
  {
    title: "Stock actual",
    description:
      "Consultá las existencias disponibles, las categorías y los productos con stock bajo.",
    href: "/dashboard/suministros/stock",
    icon: Boxes,
  },
  {
    title: "Registrar entrada",
    description:
      "Cargá compras, reposiciones y otros ingresos de mercadería.",
    href: "/dashboard/suministros/entradas/nueva",
    icon: ArrowDownToLine,
  },
  {
    title: "Registrar entrega",
    description:
      "Registrá la entrega de productos a una persona y dirección o área.",
    href: "/dashboard/suministros/entregas/nueva",
    icon: ArrowUpFromLine,
  },
  {
    title: "Productos y categorías",
    description:
      "Administrá el catálogo, las categorías, las unidades y el stock mínimo.",
    href: "/dashboard/suministros/productos",
    icon: Tags,
  },
  {
    title: "Historial",
    description:
      "Revisá todas las entradas, entregas y ajustes realizados.",
    href: "/dashboard/suministros/historial",
    icon: History,
  },
];

export function SuministrosDashboardClient({
  isReadonly,
}: SuministrosDashboardClientProps) {
  const [stockRows, setStockRows] = useState<StockSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStockSummary = useCallback(
    async (showRefreshLoader = false) => {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const supabase = createClient();

        const allRows: StockSummaryRow[] = [];

        let from = 0;
        let hasMoreRows = true;

        while (hasMoreRows) {
          const to = from + CHUNK_SIZE - 1;

          const { data, error: stockError } = await supabase
            .from("supply_current_stock")
            .select(
              `
                product_id,
                current_stock,
                low_stock,
                product_active,
                category_active
              `,
            )
            .eq("product_active", true)
            .eq("category_active", true)
            .order("product_id", { ascending: true })
            .range(from, to);

          if (stockError) {
            throw stockError;
          }

          const rows = (data ?? []) as StockSummaryRow[];

          allRows.push(...rows);

          hasMoreRows = rows.length === CHUNK_SIZE;
          from += CHUNK_SIZE;
        }

        setStockRows(allRows);
      } catch (loadError) {
        console.error(
          "Error al cargar indicadores de stock:",
          loadError,
        );

        setError(
          "No se pudo cargar el resumen de stock. Intentá nuevamente.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadStockSummary();

    const supabase = createClient();

    let mounted = true;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    /*
      El nombre incluye un identificador único para evitar conflictos
      con React Strict Mode y el Hot Reload de Next.js.
    */
    const channelName = `suministros-panel-${crypto.randomUUID()}`;

    const refreshAfterChange = () => {
      if (!mounted) return;

      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      refreshTimeout = setTimeout(() => {
        if (mounted) {
          void loadStockSummary(true);
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
        refreshAfterChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supply_products",
        },
        refreshAfterChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supply_categories",
        },
        refreshAfterChange,
      )
      .subscribe((status, subscriptionError) => {
        if (status === "SUBSCRIBED") {
          console.log("Realtime de Suministros conectado.");
        }

        if (status === "CHANNEL_ERROR") {
          /*
            Usamos warn para que Next.js no muestre el overlay rojo
            por un problema temporal de conexión.
          */
          console.warn(
            "Realtime de Suministros tuvo un error de conexión.",
            subscriptionError,
          );
        }

        if (status === "TIMED_OUT") {
          console.warn(
            "La conexión Realtime de Suministros demoró demasiado.",
          );
        }

        if (status === "CLOSED") {
          console.log("Canal Realtime de Suministros cerrado.");
        }
      });

    return () => {
      mounted = false;

      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      void supabase.removeChannel(channel);
    };
  }, [loadStockSummary]);

  const indicators = useMemo(() => {
    const totalProducts = stockRows.length;

    const productsWithStock = stockRows.filter(
      (item) => Number(item.current_stock) > 0,
    ).length;

    const lowStockProducts = stockRows.filter(
      (item) =>
        item.low_stock === true &&
        Number(item.current_stock) >= 0,
    ).length;

    return {
      totalProducts,
      productsWithStock,
      lowStockProducts,
    };
  }, [stockRows]);

  const visibleCards = isReadonly
    ? MODULE_CARDS.filter(
      (item) =>
        item.href === "/dashboard/suministros/stock" ||
        item.href === "/dashboard/suministros/historial",
    )
    : MODULE_CARDS;

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[55vh] items-center justify-center p-4 sm:p-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />

          <p className="text-sm">Cargando módulo de Suministros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-8 p-4 sm:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Stock, Inventario y Compras
        </h1>

        <p className="text-sm text-muted-foreground sm:text-base">
          Gestión de productos, movimientos de stock, compras y
          entregas.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col gap-3 py-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadStockSummary(true)}
              disabled={refreshing}
            >
              {refreshing && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}

              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">
            Resumen de stock
          </h2>

          <p className="text-sm text-muted-foreground">
            Estado general de las existencias registradas.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                <PackageSearch className="size-5" />
              </div>

              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  Productos activos
                </p>

                <p className="text-2xl font-bold">
                  {indicators.totalProducts}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Boxes className="size-5" />
              </div>

              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  Con existencias
                </p>

                <p className="text-2xl font-bold">
                  {indicators.productsWithStock}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                <AlertTriangle className="size-5" />
              </div>

              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  Con stock bajo
                </p>

                <p className="text-2xl font-bold">
                  {indicators.lowStockProducts}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">
            Accesos del módulo
          </h2>

          <p className="text-sm text-muted-foreground">
            Seleccioná la operación que querés realizar.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleCards.map((item) => {
            const Icon = item.icon;

            return (
              <Card
                key={item.href}
                className="flex h-full flex-col rounded-2xl transition-colors hover:bg-muted/30"
              >
                <CardHeader className="space-y-4">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-muted">
                    <Icon className="size-5" />
                  </div>

                  <CardTitle className="text-lg">
                    {item.title}
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col justify-between gap-5">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>

                  <Button asChild className="w-full">
                    <Link href={item.href}>Ingresar</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>


    </div>
  );
}