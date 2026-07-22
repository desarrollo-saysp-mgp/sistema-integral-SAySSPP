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
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Tags,
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

type Category = {
  id: string;
  name: string;
  active: boolean;
};

type Product = {
  id: string;
  category_id: string;
  name: string;
  unit: string;
  minimum_stock: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  category?: Category | null;
};

type ProductFormState = {
  name: string;
  category_id: string;
  unit: string;
  minimum_stock: string;
};

type ProductsClientProps = {
  isReadonly: boolean;
  userId: string;
};

type StatusFilter = "all" | "active" | "inactive";

const PAGE_SIZE = 20;
const CHUNK_SIZE = 1000;

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const INITIAL_FORM: ProductFormState = {
  name: "",
  category_id: "",
  unit: "unidad",
  minimum_stock: "0",
};

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

export function ProductsClient({
  isReadonly,
  userId,
}: ProductsClientProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("active");

  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingStatusId, setChangingStatusId] =
    useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null);

  const [formData, setFormData] =
    useState<ProductFormState>(INITIAL_FORM);

  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof ProductFormState, string>>
  >({});

  const loadCategories = useCallback(async () => {
    const supabase = createClient();

    const { data, error: categoriesError } = await supabase
      .from("supply_categories")
      .select("id, name, active")
      .order("name", { ascending: true });

    if (categoriesError) {
      throw categoriesError;
    }

    setCategories((data ?? []) as Category[]);
  }, []);

  const loadProducts = useCallback(async () => {
    const supabase = createClient();

    const allProducts: Product[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const to = from + CHUNK_SIZE - 1;

      const { data, error: productsError } = await supabase
        .from("supply_products")
        .select(
          `
            id,
            category_id,
            name,
            unit,
            minimum_stock,
            active,
            created_by,
            created_at,
            updated_at,
            category:supply_categories (
              id,
              name,
              active
            )
          `,
        )
        .order("name", { ascending: true })
        .range(from, to);

      if (productsError) {
        throw productsError;
      }

      const rows = (data ?? []) as unknown as Product[];

      allProducts.push(...rows);

      hasMore = rows.length === CHUNK_SIZE;
      from += CHUNK_SIZE;
    }

    setProducts(allProducts);
  }, []);

  const loadAll = useCallback(async () => {
    setError(null);

    try {
      await Promise.all([loadCategories(), loadProducts()]);
    } catch (loadError) {
      console.error("Error cargando productos:", loadError);
      setError("No se pudieron cargar los productos.");
    } finally {
      setLoading(false);
    }
  }, [loadCategories, loadProducts]);

  useEffect(() => {
    void loadAll();

    const supabase = createClient();

    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    const refreshData = () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      refreshTimeout = setTimeout(() => {
        void loadAll();
      }, 250);
    };

    const channel = supabase
      .channel("suministros-productos-tiempo-real")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supply_products",
        },
        refreshData,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supply_categories",
        },
        refreshData,
      )
      .subscribe();

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      void supabase.removeChannel(channel);
    };
  }, [loadAll]);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.active),
    [categories],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    return products.filter((product) => {
      const categoryName = product.category?.name ?? "";

      const matchesSearch =
        !normalizedSearch ||
        normalizeText(product.name).includes(normalizedSearch) ||
        normalizeText(categoryName).includes(normalizedSearch);

      const matchesCategory =
        categoryFilter === "all" ||
        product.category_id === categoryFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && product.active) ||
        (statusFilter === "inactive" && !product.active);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, search, categoryFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PAGE_SIZE),
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, page]);

  const activeCount = products.filter((product) => product.active).length;
  const inactiveCount = products.filter((product) => !product.active).length;

  const openNewProduct = () => {
    setEditingProduct(null);
    setFormData(INITIAL_FORM);
    setFormErrors({});
    setSuccessMessage(null);
    setDialogOpen(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);

    setFormData({
      name: product.name,
      category_id: product.category_id,
      unit: product.unit,
      minimum_stock: String(product.minimum_stock ?? 0),
    });

    setFormErrors({});
    setSuccessMessage(null);
    setDialogOpen(true);
  };

  const validateForm = () => {
    const errors: Partial<
      Record<keyof ProductFormState, string>
    > = {};

    if (!formData.name.trim()) {
      errors.name = "El nombre es requerido";
    }

    if (!formData.category_id) {
      errors.category_id = "La categoría es requerida";
    }

    if (!formData.unit.trim()) {
      errors.unit = "La unidad es requerida";
    }

    const minimumStock = Number(formData.minimum_stock);

    if (
      formData.minimum_stock.trim() === "" ||
      Number.isNaN(minimumStock) ||
      minimumStock < 0
    ) {
      errors.minimum_stock =
        "El stock mínimo debe ser un número mayor o igual a cero";
    }

    setFormErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const supabase = createClient();

      const payload = {
        name: formData.name.trim(),
        category_id: formData.category_id,
        unit: formData.unit.trim(),
        minimum_stock: Number(formData.minimum_stock),
      };

      if (editingProduct) {
        const { error: updateError } = await supabase
          .from("supply_products")
          .update(payload)
          .eq("id", editingProduct.id);

        if (updateError) {
          throw updateError;
        }

        setSuccessMessage("Producto actualizado correctamente.");
      } else {
        const { error: insertError } = await supabase
          .from("supply_products")
          .insert({
            ...payload,
            active: true,
            created_by: userId,
          });

        if (insertError) {
          if (insertError.code === "23505") {
            throw new Error(
              "Ya existe un producto con ese nombre dentro de la categoría.",
            );
          }

          throw insertError;
        }

        setSuccessMessage("Producto creado correctamente.");
      }

      await loadProducts();
      setDialogOpen(false);
    } catch (submitError) {
      console.error("Error guardando producto:", submitError);

      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar el producto.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleProductStatus = async (product: Product) => {
    const action = product.active ? "desactivar" : "reactivar";

    const confirmed = window.confirm(
      `¿Seguro que querés ${action} el producto "${product.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    setChangingStatusId(product.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const supabase = createClient();

      const { error: updateError } = await supabase
        .from("supply_products")
        .update({
          active: !product.active,
        })
        .eq("id", product.id);

      if (updateError) {
        throw updateError;
      }

      setSuccessMessage(
        product.active
          ? "Producto desactivado correctamente."
          : "Producto reactivado correctamente.",
      );

      await loadProducts();
    } catch (statusError) {
      console.error("Error cambiando estado:", statusError);
      setError("No se pudo modificar el estado del producto.");
    } finally {
      setChangingStatusId(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("active");
    setPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    categoryFilter !== "all" ||
    statusFilter !== "active";

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[55vh] items-center justify-center p-4 sm:p-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
          <p className="text-sm">Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
              Productos
            </h1>

            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Administrá el catálogo de productos del módulo.
            </p>
          </div>
        </div>

        {!isReadonly && (
          <Button onClick={openNewProduct}>
            <Plus className="mr-2 size-4" />
            Nuevo producto
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card className="border-emerald-500/40">
          <CardContent className="py-4 text-sm text-emerald-700 dark:text-emerald-400">
            {successMessage}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-muted">
              <Tags className="size-5" />
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Total de productos
              </p>
              <p className="text-2xl font-bold">{products.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Activos</p>
            <p className="mt-1 text-2xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Inactivos</p>
            <p className="mt-1 text-2xl font-bold">{inactiveCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(250px,1fr)_260px_220px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar producto o categoría..."
                className="pl-9"
              />
            </div>

            <Select
              value={categoryFilter}
              onValueChange={setCategoryFilter}
            >
              <SelectTrigger>
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

            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as StatusFilter)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              Limpiar filtros
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {filteredProducts.length} productos encontrados
          </p>
        </CardContent>
      </Card>

      <Card className="hidden overflow-hidden rounded-2xl md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-5 py-4 text-left">Producto</th>
                <th className="px-5 py-4 text-left">Categoría</th>
                <th className="px-5 py-4 text-left">Unidad</th>
                <th className="px-5 py-4 text-right">
                  Stock mínimo
                </th>
                <th className="px-5 py-4 text-center">Estado</th>
                {!isReadonly && (
                  <th className="px-5 py-4 text-right">Acciones</th>
                )}
              </tr>
            </thead>

            <tbody>
              {paginatedProducts.map((product) => (
                <tr
                  key={product.id}
                  className="border-b last:border-b-0 hover:bg-muted/30"
                >
                  <td className="px-5 py-4 font-medium">
                    {product.name}
                  </td>

                  <td className="px-5 py-4 text-muted-foreground">
                    {product.category?.name ?? "Sin categoría"}
                  </td>

                  <td className="px-5 py-4 text-muted-foreground">
                    {product.unit}
                  </td>

                  <td className="px-5 py-4 text-right">
                    {product.minimum_stock}
                  </td>

                  <td className="px-5 py-4 text-center">
                    <span
                      className={
                        product.active
                          ? "rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                          : "rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {product.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>

                  {!isReadonly && (
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditProduct(product)}
                          title="Editar producto"
                        >
                          <Pencil className="size-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={changingStatusId === product.id}
                          onClick={() =>
                            void toggleProductStatus(product)
                          }
                          title={
                            product.active
                              ? "Desactivar producto"
                              : "Reactivar producto"
                          }
                        >
                          {changingStatusId === product.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : product.active ? (
                            <CircleOff className="size-4 text-destructive" />
                          ) : (
                            <RotateCcw className="size-4" />
                          )}
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:hidden">
        {paginatedProducts.map((product) => (
          <Card key={product.id} className="rounded-2xl">
            <CardContent className="space-y-4 p-4">
              <div>
                <h3 className="font-semibold">{product.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {product.category?.name ?? "Sin categoría"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Unidad
                  </p>
                  <p className="mt-1 font-medium">{product.unit}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Stock mínimo
                  </p>
                  <p className="mt-1 font-medium">
                    {product.minimum_stock}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span
                  className={
                    product.active
                      ? "rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700"
                      : "rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                  }
                >
                  {product.active ? "Activo" : "Inactivo"}
                </span>

                {!isReadonly && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditProduct(product)}
                    >
                      <Pencil className="mr-2 size-4" />
                      Editar
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void toggleProductStatus(product)
                      }
                    >
                      {product.active ? (
                        <CircleOff className="size-4 text-destructive" />
                      ) : (
                        <RotateCcw className="size-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
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
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              <ChevronLeft className="mr-1 size-4" />
              Anterior
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {editingProduct
                ? "Editar producto"
                : "Nuevo producto"}
            </DialogTitle>

            <DialogDescription>
              {editingProduct
                ? "Modificá los datos del producto seleccionado."
                : "Completá los datos para incorporar un producto."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="product-name">Nombre *</Label>

              <Input
                id="product-name"
                value={formData.name}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Nombre del producto"
              />

              {formErrors.name && (
                <p className="text-sm text-destructive">
                  {formErrors.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Categoría *</Label>

              <Select
                value={formData.category_id}
                onValueChange={(value) =>
                  setFormData((current) => ({
                    ...current,
                    category_id: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>

                <SelectContent>
                  {activeCategories.map((category) => (
                    <SelectItem
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {formErrors.category_id && (
                <p className="text-sm text-destructive">
                  {formErrors.category_id}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Unidad *</Label>

                <Select
                  value={formData.unit}
                  onValueChange={(value) =>
                    setFormData((current) => ({
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

                {formErrors.unit && (
                  <p className="text-sm text-destructive">
                    {formErrors.unit}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="minimum-stock">
                  Stock mínimo *
                </Label>

                <Input
                  id="minimum-stock"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.minimum_stock}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      minimum_stock: event.target.value,
                    }))
                  }
                />

                {formErrors.minimum_stock && (
                  <p className="text-sm text-destructive">
                    {formErrors.minimum_stock}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>

              <Button type="submit" disabled={saving}>
                {saving && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}

                {editingProduct
                  ? "Guardar cambios"
                  : "Crear producto"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}