"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpDown,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PackageOpen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
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
import { Label } from "@/components/ui/label";
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

type Category = {
  id: string;
  name: string;
  active: boolean;
};

type StockClientProps = {
  isReadonly: boolean;
};

type StockStatus = "all" | "available" | "without_stock" | "low_stock";

type SortOption =
  | "name_asc"
  | "name_desc"
  | "category_asc"
  | "category_desc"
  | "stock_asc"
  | "stock_desc"
  | "minimum_stock_asc"
  | "minimum_stock_desc";

type StockAction = "add" | "adjust";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type EditProductForm = {
  name: string;
  category_id: string;
  unit: string;
  minimum_stock: string;
};

const PAGE_SIZE = 20;
const CHUNK_SIZE = 1000;

const UNIT_OPTIONS = [
  "unidad",
  "litro",
  "kilogramo",
  "metro",
  "rollo",
  "caja",
  "bolsa",
  "paquete",
  "par",
  "juego",
];

const INITIAL_EDIT_FORM: EditProductForm = {
  name: "",
  category_id: "",
  unit: "unidad",
  minimum_stock: "0",
};

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
    Por ahora, las cantidades históricas menores a cero se muestran
    como cero disponible. El valor real continúa guardado en la base.
  */
  return Math.max(0, quantity);
};

const getLocalDate = () => {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 10);
};

export function StockClient({ isReadonly }: StockClientProps) {
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<Category[]>([]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<StockStatus>("all");
  const [sortBy, setSortBy] = useState<SortOption>("name_asc");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [toast, setToast] = useState<ToastState>(null);

  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockAction, setStockAction] = useState<StockAction>("add");
  const [selectedStockRow, setSelectedStockRow] =
    useState<StockRow | null>(null);
  const [stockValue, setStockValue] = useState("");
  const [stockObservations, setStockObservations] = useState("");
  const [stockFormError, setStockFormError] = useState<string | null>(null);
  const [savingStock, setSavingStock] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<StockRow | null>(null);
  const [editForm, setEditForm] =
    useState<EditProductForm>(INITIAL_EDIT_FORM);
  const [editErrors, setEditErrors] = useState<
    Partial<Record<keyof EditProductForm, string>>
  >({});
  const [savingProduct, setSavingProduct] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState<StockRow | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);

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

  const loadStock = useCallback(
    async (showRefreshLoader = false) => {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const supabase = createClient();

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
            .order("product_id", { ascending: true })
            .range(from, to);

          if (stockError) {
            throw stockError;
          }

          const rows = (data ?? []) as StockRow[];

          allRows.push(...rows);

          hasMoreRows = rows.length === CHUNK_SIZE;
          from += CHUNK_SIZE;
        }

        const { data: categoriesData, error: categoriesError } =
          await supabase
            .from("supply_categories")
            .select("id, name, active")
            .eq("active", true)
            .order("name", { ascending: true });

        if (categoriesError) {
          throw categoriesError;
        }

        setStockRows(allRows);
        setCategoryOptions((categoriesData ?? []) as Category[]);
        setLastUpdated(new Date());
      } catch (loadError) {
        console.error("Error al cargar el stock:", loadError);
        showToast(
          "error",
          "No se pudo cargar el stock. Intentá nuevamente.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void loadStock();

    const supabase = createClient();

    let mounted = true;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    const channelName = `suministros-stock-${crypto.randomUUID()}`;

    const refreshAfterRealtimeChange = () => {
      if (!mounted) return;

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

  const filteredAndSortedRows = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    const filtered = stockRows.filter((row) => {
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
        matchesStatus =
          displayedStock > 0 && displayedStock <= minimumStock;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      const stockA = getDisplayedStock(a.current_stock);
      const stockB = getDisplayedStock(b.current_stock);
      const minimumA = Number(a.minimum_stock || 0);
      const minimumB = Number(b.minimum_stock || 0);

      switch (sortBy) {
        case "name_desc":
          return b.product_name.localeCompare(a.product_name, "es", {
            sensitivity: "base",
          });

        case "category_asc":
          return (
            a.category_name.localeCompare(b.category_name, "es", {
              sensitivity: "base",
            }) ||
            a.product_name.localeCompare(b.product_name, "es", {
              sensitivity: "base",
            })
          );

        case "category_desc":
          return (
            b.category_name.localeCompare(a.category_name, "es", {
              sensitivity: "base",
            }) ||
            a.product_name.localeCompare(b.product_name, "es", {
              sensitivity: "base",
            })
          );

        case "stock_asc":
          return (
            stockA - stockB ||
            a.product_name.localeCompare(b.product_name, "es", {
              sensitivity: "base",
            })
          );

        case "stock_desc":
          return (
            stockB - stockA ||
            a.product_name.localeCompare(b.product_name, "es", {
              sensitivity: "base",
            })
          );

        case "minimum_stock_asc":
          return (
            minimumA - minimumB ||
            a.product_name.localeCompare(b.product_name, "es", {
              sensitivity: "base",
            })
          );

        case "minimum_stock_desc":
          return (
            minimumB - minimumA ||
            a.product_name.localeCompare(b.product_name, "es", {
              sensitivity: "base",
            })
          );

        case "name_asc":
        default:
          return a.product_name.localeCompare(b.product_name, "es", {
            sensitivity: "base",
          });
      }
    });
  }, [stockRows, search, category, status, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search, category, status, sortBy]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSortedRows.length / PAGE_SIZE),
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return filteredAndSortedRows.slice(start, start + PAGE_SIZE);
  }, [filteredAndSortedRows, page]);

  const totalProducts = filteredAndSortedRows.length;

  const productsWithStock = filteredAndSortedRows.filter(
    (row) => getDisplayedStock(row.current_stock) > 0,
  ).length;

  const productsWithoutStock = filteredAndSortedRows.filter(
    (row) => getDisplayedStock(row.current_stock) === 0,
  ).length;

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setStatus("all");
    setSortBy("name_asc");
    setPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    category !== "all" ||
    status !== "all" ||
    sortBy !== "name_asc";

  const openAddStockDialog = (row: StockRow) => {
    setSelectedStockRow(row);
    setStockAction("add");
    setStockValue("");
    setStockObservations("");
    setStockFormError(null);
    setStockDialogOpen(true);
  };

  const openAdjustStockDialog = (row: StockRow) => {
    setSelectedStockRow(row);
    setStockAction("adjust");
    setStockValue(String(getDisplayedStock(row.current_stock)));
    setStockObservations("");
    setStockFormError(null);
    setStockDialogOpen(true);
  };

  const handleStockSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedStockRow) return;

    const enteredValue = Number(stockValue);

    if (
      stockValue.trim() === "" ||
      Number.isNaN(enteredValue) ||
      enteredValue < 0
    ) {
      setStockFormError(
        "Ingresá una cantidad válida mayor o igual a cero.",
      );
      return;
    }

    if (stockAction === "add" && enteredValue <= 0) {
      setStockFormError("La cantidad a sumar debe ser mayor a cero.");
      return;
    }

    const realCurrentStock = Number(
      selectedStockRow.current_stock || 0,
    );

    let movementType: "ENTRY" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
    let movementQuantity: number;
    let successMessage: string;

    if (stockAction === "add") {
      movementType = "ENTRY";
      movementQuantity = enteredValue;
      successMessage = `Se sumaron ${formatQuantity(
        enteredValue,
      )} ${selectedStockRow.unit} al stock.`;
    } else {
      const difference = enteredValue - realCurrentStock;

      if (difference === 0) {
        setStockFormError(
          "El stock indicado es igual al stock actual.",
        );
        return;
      }

      movementType =
        difference > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
      movementQuantity = Math.abs(difference);
      successMessage = `El stock quedó ajustado en ${formatQuantity(
        enteredValue,
      )} ${selectedStockRow.unit}.`;
    }

    setSavingStock(true);
    setStockFormError(null);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("No se pudo identificar al usuario.");
      }

      const automaticObservation =
        stockAction === "add"
          ? "Entrada cargada desde la pantalla Stock actual"
          : `Ajuste manual desde ${formatQuantity(
              realCurrentStock,
            )} hasta ${formatQuantity(enteredValue)}`;

      const { error: insertError } = await supabase
        .from("supply_movements")
        .insert({
          movement_date: getLocalDate(),
          movement_type: movementType,
          product_id: selectedStockRow.product_id,
          quantity: movementQuantity,
          reference: `WEB_STOCK_${movementType}_${Date.now()}`,
          observations:
            stockObservations.trim() || automaticObservation,
          created_by: user.id,
        });

      if (insertError) {
        throw insertError;
      }

      setStockDialogOpen(false);
      setSelectedStockRow(null);
      setStockValue("");
      setStockObservations("");
      showToast("success", successMessage);

      await loadStock(true);
    } catch (submitError) {
      console.error("Error modificando stock:", submitError);

      setStockFormError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo modificar el stock.",
      );
    } finally {
      setSavingStock(false);
    }
  };

  const openEditDialog = (row: StockRow) => {
    setEditingRow(row);
    setEditForm({
      name: row.product_name,
      category_id: row.category_id,
      unit: row.unit,
      minimum_stock: String(row.minimum_stock ?? 0),
    });
    setEditErrors({});
    setEditDialogOpen(true);
  };

  const validateEditForm = () => {
    const errors: Partial<
      Record<keyof EditProductForm, string>
    > = {};

    if (!editForm.name.trim()) {
      errors.name = "El nombre es requerido.";
    }

    if (!editForm.category_id) {
      errors.category_id = "La categoría es requerida.";
    }

    if (!editForm.unit.trim()) {
      errors.unit = "La unidad es requerida.";
    }

    const minimumStock = Number(editForm.minimum_stock);

    if (
      editForm.minimum_stock.trim() === "" ||
      Number.isNaN(minimumStock) ||
      minimumStock < 0
    ) {
      errors.minimum_stock =
        "El stock mínimo debe ser mayor o igual a cero.";
    }

    setEditErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const handleEditSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!editingRow || !validateEditForm()) return;

    setSavingProduct(true);

    try {
      const supabase = createClient();

      const { error: updateError } = await supabase
        .from("supply_products")
        .update({
          name: editForm.name.trim(),
          category_id: editForm.category_id,
          unit: editForm.unit.trim(),
          minimum_stock: Number(editForm.minimum_stock),
        })
        .eq("id", editingRow.product_id);

      if (updateError) {
        if (updateError.code === "23505") {
          throw new Error(
            "Ya existe un producto con ese nombre dentro de la categoría.",
          );
        }

        throw updateError;
      }

      setEditDialogOpen(false);
      setEditingRow(null);
      showToast("success", "Producto actualizado correctamente.");

      await loadStock(true);
    } catch (editError) {
      console.error("Error editando producto:", editError);

      showToast(
        "error",
        editError instanceof Error
          ? editError.message
          : "No se pudo editar el producto.",
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const openDeleteDialog = (row: StockRow) => {
    setDeletingRow(row);
    setDeleteDialogOpen(true);
  };

  const handleDeactivateProduct = async () => {
    if (!deletingRow) return;

    setDeletingProduct(true);

    try {
      const supabase = createClient();

      const { error: updateError } = await supabase
        .from("supply_products")
        .update({ active: false })
        .eq("id", deletingRow.product_id);

      if (updateError) {
        throw updateError;
      }

      setDeleteDialogOpen(false);
      setDeletingRow(null);
      showToast(
        "success",
        "Producto quitado del stock activo. Su historial se conservó.",
      );

      await loadStock(true);
    } catch (deleteError) {
      console.error("Error quitando producto del stock:", deleteError);

      showToast(
        "error",
        "No se pudo quitar el producto del stock.",
      );
    } finally {
      setDeletingProduct(false);
    }
  };

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
              Consultá y administrá las existencias por producto y
              categoría.
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
              <p className="text-2xl font-bold">
                {productsWithoutStock}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_220px_190px_minmax(250px,290px)_auto]">
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
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  Todas las categorías
                </SelectItem>

                {categoryOptions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as StockStatus)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="available">
                  Con existencias
                </SelectItem>
                <SelectItem value="without_stock">
                  Sin existencias
                </SelectItem>
                <SelectItem value="low_stock">Stock bajo</SelectItem>
              </SelectContent>
            </Select>

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
                <SelectItem value="name_asc">Nombre A–Z</SelectItem>
                <SelectItem value="name_desc">Nombre Z–A</SelectItem>
                <SelectItem value="category_asc">
                  Categoría A–Z
                </SelectItem>
                <SelectItem value="category_desc">
                  Categoría Z–A
                </SelectItem>
                <SelectItem value="stock_asc">
                  Stock: menor a mayor
                </SelectItem>
                <SelectItem value="stock_desc">
                  Stock: mayor a menor
                </SelectItem>
                <SelectItem value="minimum_stock_asc">
                  Stock mínimo: menor a mayor
                </SelectItem>
                <SelectItem value="minimum_stock_desc">
                  Stock mínimo: mayor a menor
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              className="w-full whitespace-nowrap xl:w-auto"
              variant="outline"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              Limpiar filtros
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            {filteredAndSortedRows.length === 1
              ? "1 producto encontrado"
              : `${filteredAndSortedRows.length} productos encontrados`}
          </div>
        </CardContent>
      </Card>

      {paginatedRows.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <PackageOpen className="size-10 text-muted-foreground" />

            <div>
              <p className="font-medium">
                No se encontraron productos
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Probá modificando los filtros de búsqueda.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-hidden rounded-2xl md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-sm">
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

                    {!isReadonly && (
                      <th className="px-5 py-4 text-right font-medium">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {paginatedRows.map((row) => {
                    const displayedStock = getDisplayedStock(
                      row.current_stock,
                    );
                    const minimumStock = Number(
                      row.minimum_stock || 0,
                    );

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

                        {!isReadonly && (
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Sumar stock"
                                onClick={() =>
                                  openAddStockDialog(row)
                                }
                              >
                                <Plus className="size-4" />
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Ajustar stock"
                                onClick={() =>
                                  openAdjustStockDialog(row)
                                }
                              >
                                <SlidersHorizontal className="size-4" />
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Editar producto"
                                onClick={() => openEditDialog(row)}
                              >
                                <Pencil className="size-4" />
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Quitar del stock"
                                onClick={() =>
                                  openDeleteDialog(row)
                                }
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:hidden">
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
                        <p className="mt-1 font-medium">
                          {row.unit}
                        </p>
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

                    {!isReadonly && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openAddStockDialog(row)}
                        >
                          <Plus className="mr-2 size-4" />
                          Sumar stock
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openAdjustStockDialog(row)
                          }
                        >
                          <SlidersHorizontal className="mr-2 size-4" />
                          Ajustar
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(row)}
                        >
                          <Pencil className="mr-2 size-4" />
                          Editar
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openDeleteDialog(row)}
                        >
                          <Trash2 className="mr-2 size-4 text-destructive" />
                          Quitar
                        </Button>
                      </div>
                    )}
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
                  onClick={() =>
                    setPage((current) => current - 1)
                  }
                  disabled={page <= 1}
                >
                  <ChevronLeft className="mr-1 size-4" />
                  Anterior
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((current) => current + 1)
                  }
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


      <Dialog
        open={stockDialogOpen}
        onOpenChange={(open) => {
          if (!savingStock) {
            setStockDialogOpen(open);

            if (!open) {
              setSelectedStockRow(null);
              setStockValue("");
              setStockObservations("");
              setStockFormError(null);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {stockAction === "add"
                ? "Sumar stock"
                : "Ajustar stock"}
            </DialogTitle>

            <DialogDescription>
              {stockAction === "add"
                ? `Agregá existencias a “${
                    selectedStockRow?.product_name ?? ""
                  }”.`
                : `Indicá la cantidad exacta que debe quedar disponible para “${
                    selectedStockRow?.product_name ?? ""
                  }”.`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleStockSubmit} className="space-y-5">
            {selectedStockRow && (
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Stock actual
                  </p>
                  <p className="mt-1 text-lg font-bold">
                    {formatQuantity(
                      getDisplayedStock(
                        selectedStockRow.current_stock,
                      ),
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Unidad
                  </p>
                  <p className="mt-1 font-medium">
                    {selectedStockRow.unit}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="stock-value">
                {stockAction === "add"
                  ? "Cantidad a sumar *"
                  : "Nuevo stock total *"}
              </Label>

              <Input
                id="stock-value"
                type="number"
                min="0"
                step="0.01"
                value={stockValue}
                onChange={(event) => {
                  setStockValue(event.target.value);

                  if (stockFormError) {
                    setStockFormError(null);
                  }
                }}
                placeholder={
                  stockAction === "add"
                    ? "Ejemplo: 10"
                    : "Cantidad exacta disponible"
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock-observations">
                Observaciones
              </Label>

              <Input
                id="stock-observations"
                value={stockObservations}
                onChange={(event) =>
                  setStockObservations(event.target.value)
                }
                placeholder="Opcional"
              />
            </div>

            {stockFormError && (
              <p className="text-sm text-destructive">
                {stockFormError}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStockDialogOpen(false)}
                disabled={savingStock}
              >
                Cancelar
              </Button>

              <Button type="submit" disabled={savingStock}>
                {savingStock && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}

                {stockAction === "add"
                  ? "Sumar al stock"
                  : "Guardar ajuste"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (!savingProduct) {
            setEditDialogOpen(open);

            if (!open) {
              setEditingRow(null);
              setEditForm(INITIAL_EDIT_FORM);
              setEditErrors({});
            }
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Editar producto</DialogTitle>

            <DialogDescription>
              Modificá los datos generales del producto. Para cambiar
              la cantidad disponible utilizá Ajustar stock.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="edit-product-name">Nombre *</Label>

              <Input
                id="edit-product-name"
                value={editForm.name}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />

              {editErrors.name && (
                <p className="text-sm text-destructive">
                  {editErrors.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Categoría *</Label>

              <Select
                value={editForm.category_id}
                onValueChange={(value) =>
                  setEditForm((current) => ({
                    ...current,
                    category_id: value,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>

                <SelectContent>
                  {categoryOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {editErrors.category_id && (
                <p className="text-sm text-destructive">
                  {editErrors.category_id}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Unidad *</Label>

                <Select
                  value={editForm.unit}
                  onValueChange={(value) =>
                    setEditForm((current) => ({
                      ...current,
                      unit: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {UNIT_OPTIONS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {editErrors.unit && (
                  <p className="text-sm text-destructive">
                    {editErrors.unit}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-minimum-stock">
                  Stock mínimo *
                </Label>

                <Input
                  id="edit-minimum-stock"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.minimum_stock}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      minimum_stock: event.target.value,
                    }))
                  }
                />

                {editErrors.minimum_stock && (
                  <p className="text-sm text-destructive">
                    {editErrors.minimum_stock}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={savingProduct}
              >
                Cancelar
              </Button>

              <Button type="submit" disabled={savingProduct}>
                {savingProduct && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}

                Guardar cambios
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!deletingProduct) {
            setDeleteDialogOpen(open);

            if (!open) {
              setDeletingRow(null);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Quitar producto del stock</DialogTitle>

            <DialogDescription className="leading-6">
              El producto “{deletingRow?.product_name ?? ""}” dejará
              de aparecer en el stock activo y en los desplegables. No
              se eliminarán sus movimientos ni su historial, y podrá
              restaurarse desde Productos y categorías.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deletingProduct}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeactivateProduct()}
              disabled={deletingProduct}
            >
              {deletingProduct && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}

              Quitar del stock
            </Button>
          </div>
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
    </div>
  );
}
