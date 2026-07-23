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
  CheckCircle2,
  Loader2,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
};

type ProductOption = {
  product_id: string;
  product_name: string;
  category_id: string;
  category_name: string;
  unit: string;
  current_stock: number;
};

type EntryRow = {
  id: string;
  category_id: string;
  product_id: string;
  quantity: string;
  observation: string;
};

type NewProductForm = {
  name: string;
  category_id: string;
  unit: string;
  minimum_stock: string;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type NewEntryClientProps = {
  userId: string;
  isReadonly: boolean;
};

const CHUNK_SIZE = 1000;
const ALL_CATEGORIES = "all";

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

const INITIAL_NEW_PRODUCT_FORM: NewProductForm = {
  name: "",
  category_id: ALL_CATEGORIES,
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

const getLocalDate = () => {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 10);
};

const createEmptyRow = (): EntryRow => ({
  id: crypto.randomUUID(),
  category_id: "",
  product_id: "",
  quantity: "",
  observation: "",
});

export function NewEntryClient({
  userId,
  isReadonly,
}: NewEntryClientProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [movementDate, setMovementDate] = useState(getLocalDate());
  const [memoNumber, setMemoNumber] = useState("");
  const [fcNumber, setFcNumber] = useState("");
  const [generalObservations, setGeneralObservations] = useState("");
  const [rows, setRows] = useState<EntryRow[]>([createEmptyRow()]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectingRowId, setSelectingRowId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");

  const [newProductDialogOpen, setNewProductDialogOpen] = useState(false);
  const [creatingForRowId, setCreatingForRowId] = useState<string | null>(null);
  const [newProductForm, setNewProductForm] =
    useState<NewProductForm>(INITIAL_NEW_PRODUCT_FORM);
  const [newProductError, setNewProductError] = useState<string | null>(null);
  const [savingNewProduct, setSavingNewProduct] = useState(false);

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

  const loadCatalog = useCallback(async () => {
    setLoading(true);

    try {
      const supabase = createClient();

      const { data: categoryData, error: categoryError } = await supabase
        .from("supply_categories")
        .select("id, name")
        .eq("active", true)
        .order("name", { ascending: true });

      if (categoryError) {
        throw categoryError;
      }

      const allProducts: ProductOption[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const to = from + CHUNK_SIZE - 1;

        const { data, error: productError } = await supabase
          .from("supply_current_stock")
          .select(
            `
              product_id,
              product_name,
              category_id,
              category_name,
              unit,
              current_stock
            `,
          )
          .eq("product_active", true)
          .eq("category_active", true)
          .order("product_name", { ascending: true })
          .range(from, to);

        if (productError) {
          throw productError;
        }

        const pageRows = (data ?? []) as ProductOption[];

        allProducts.push(...pageRows);

        hasMore = pageRows.length === CHUNK_SIZE;
        from += CHUNK_SIZE;
      }

      setCategories((categoryData ?? []) as Category[]);
      setProducts(allProducts);
    } catch (catalogError) {
      console.error("Error cargando catálogo de Suministros:", catalogError);
      showToast(
        "error",
        "No se pudieron cargar las categorías y los productos.",
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadCatalog();

    const supabase = createClient();

    let mounted = true;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    const channelName = `suministros-entrada-catalogo-${crypto.randomUUID()}`;

    const refreshCatalog = () => {
      if (!mounted) return;

      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      refreshTimeout = setTimeout(() => {
        if (mounted) {
          void loadCatalog();
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
          table: "supply_products",
        },
        refreshCatalog,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supply_categories",
        },
        refreshCatalog,
      )
      .subscribe((status, subscriptionError) => {
        if (status === "CHANNEL_ERROR") {
          console.warn(
            "Realtime del catálogo de entradas tuvo un error.",
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
  }, [loadCatalog]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectingRowId) ?? null,
    [rows, selectingRowId],
  );

  const filteredDialogProducts = useMemo(() => {
    const normalizedSearch = normalizeText(productSearch);

    return products
      .filter((product) => {
        const matchesCategory =
          !selectedRow?.category_id ||
          selectedRow.category_id === ALL_CATEGORIES ||
          product.category_id === selectedRow.category_id;

        const matchesSearch =
          !normalizedSearch ||
          normalizeText(product.product_name).includes(normalizedSearch) ||
          normalizeText(product.category_name).includes(normalizedSearch);

        return matchesCategory && matchesSearch;
      })
      .slice(0, 100);
  }, [products, productSearch, selectedRow]);

  const totalQuantity = useMemo(
    () =>
      rows.reduce((total, row) => {
        const quantity = Number(row.quantity);

        return total + (Number.isFinite(quantity) ? quantity : 0);
      }, 0),
    [rows],
  );

  const completedRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.product_id &&
          row.quantity.trim() !== "" &&
          Number(row.quantity) > 0,
      ).length,
    [rows],
  );

  const getProductById = (productId: string) =>
    products.find((product) => product.product_id === productId) ?? null;

  const updateRow = (
    rowId: string,
    field: keyof Omit<EntryRow, "id">,
    value: string,
  ) => {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row;

        if (field === "category_id") {
          const currentProduct = getProductById(row.product_id);

          return {
            ...row,
            category_id: value,
            product_id:
              value === ALL_CATEGORIES ||
              currentProduct?.category_id === value
                ? row.product_id
                : "",
          };
        }

        return {
          ...row,
          [field]: value,
        };
      }),
    );

    if (formError) {
      setFormError(null);
    }
  };

  const addRow = () => {
    setRows((current) => [...current, createEmptyRow()]);
  };

  const removeRow = (rowId: string) => {
    setRows((current) => {
      if (current.length === 1) {
        return [createEmptyRow()];
      }

      return current.filter((row) => row.id !== rowId);
    });
  };

  const openProductDialog = (rowId: string) => {
    setSelectingRowId(rowId);
    setProductSearch("");
    setProductDialogOpen(true);
  };

  const selectProduct = (product: ProductOption) => {
    if (!selectingRowId) return;

    setRows((current) =>
      current.map((row) =>
        row.id === selectingRowId
          ? {
              ...row,
              category_id: product.category_id,
              product_id: product.product_id,
            }
          : row,
      ),
    );

    setProductDialogOpen(false);
    setSelectingRowId(null);
    setProductSearch("");
    setFormError(null);
  };

  const openNewProductDialog = () => {
    if (!selectingRowId) return;

    const currentRow =
      rows.find((row) => row.id === selectingRowId) ?? null;

    setCreatingForRowId(selectingRowId);
    setNewProductForm({
      name: productSearch.trim(),
      category_id:
        currentRow?.category_id &&
        currentRow.category_id !== ALL_CATEGORIES
          ? currentRow.category_id
          : "",
      unit: "unidad",
      minimum_stock: "0",
    });
    setNewProductError(null);
    setProductDialogOpen(false);
    setSelectingRowId(null);
    setNewProductDialogOpen(true);
  };

  const handleCreateProduct = async (event: FormEvent) => {
    event.preventDefault();

    const name = newProductForm.name.trim();
    const minimumStock = Number(newProductForm.minimum_stock);

    if (!name) {
      setNewProductError("El nombre del producto es requerido.");
      return;
    }

    if (!newProductForm.category_id) {
      setNewProductError("Seleccioná una categoría.");
      return;
    }

    if (!newProductForm.unit.trim()) {
      setNewProductError("Seleccioná una unidad.");
      return;
    }

    if (
      newProductForm.minimum_stock.trim() === "" ||
      Number.isNaN(minimumStock) ||
      minimumStock < 0
    ) {
      setNewProductError(
        "El stock mínimo debe ser un número mayor o igual a cero.",
      );
      return;
    }

    const duplicate = products.some(
      (product) =>
        product.category_id === newProductForm.category_id &&
        normalizeText(product.product_name) === normalizeText(name),
    );

    if (duplicate) {
      setNewProductError(
        "Ya existe un producto con ese nombre dentro de la categoría.",
      );
      return;
    }

    if (!creatingForRowId) {
      setNewProductError(
        "No se pudo identificar la fila donde agregar el producto.",
      );
      return;
    }

    setSavingNewProduct(true);
    setNewProductError(null);

    try {
      const supabase = createClient();

      const { data: createdProduct, error: insertError } = await supabase
        .from("supply_products")
        .insert({
          name,
          category_id: newProductForm.category_id,
          unit: newProductForm.unit.trim(),
          minimum_stock: minimumStock,
          active: true,
          created_by: userId,
        })
        .select(
          `
            id,
            name,
            category_id,
            unit,
            minimum_stock,
            category:supply_categories (
              id,
              name
            )
          `,
        )
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          throw new Error(
            "Ya existe un producto con ese nombre dentro de la categoría.",
          );
        }

        throw insertError;
      }

      const categoryData = Array.isArray(createdProduct.category)
        ? createdProduct.category[0]
        : createdProduct.category;

      const newProduct: ProductOption = {
        product_id: createdProduct.id,
        product_name: createdProduct.name,
        category_id: createdProduct.category_id,
        category_name:
          categoryData?.name ??
          categories.find(
            (category) => category.id === createdProduct.category_id,
          )?.name ??
          "Sin categoría",
        unit: createdProduct.unit,
        current_stock: 0,
      };

      setProducts((current) =>
        [...current, newProduct].sort((a, b) =>
          a.product_name.localeCompare(b.product_name, "es", {
            sensitivity: "base",
          }),
        ),
      );

      setRows((current) =>
        current.map((row) =>
          row.id === creatingForRowId
            ? {
                ...row,
                category_id: newProduct.category_id,
                product_id: newProduct.product_id,
              }
            : row,
        ),
      );

      setNewProductDialogOpen(false);
      setCreatingForRowId(null);
      setNewProductForm(INITIAL_NEW_PRODUCT_FORM);
      showToast(
        "success",
        `Producto “${newProduct.product_name}” creado y seleccionado.`,
      );
    } catch (createError) {
      console.error("Error creando producto:", createError);

      setNewProductError(
        createError instanceof Error
          ? createError.message
          : "No se pudo crear el producto.",
      );
    } finally {
      setSavingNewProduct(false);
    }
  };

  const validateForm = () => {
    if (!movementDate) {
      return "La fecha es requerida.";
    }


    const usableRows = rows.filter(
      (row) =>
        row.product_id ||
        row.quantity.trim() !== "" ||
        row.observation.trim() !== "",
    );

    if (usableRows.length === 0) {
      return "Agregá al menos un producto.";
    }

    for (let index = 0; index < usableRows.length; index += 1) {
      const row = usableRows[index];
      const rowNumber = index + 1;

      if (!row.product_id) {
        return `Seleccioná el producto en la fila ${rowNumber}.`;
      }

      const quantity = Number(row.quantity);

      if (
        row.quantity.trim() === "" ||
        Number.isNaN(quantity) ||
        quantity <= 0
      ) {
        return `Ingresá una cantidad mayor a cero en la fila ${rowNumber}.`;
      }
    }

    const productIds = usableRows.map((row) => row.product_id);
    const uniqueProductIds = new Set(productIds);

    if (uniqueProductIds.size !== productIds.length) {
      return "No repitas el mismo producto dentro de una entrada.";
    }

    return null;
  };

  const resetForm = () => {
    setMovementDate(getLocalDate());
    setMemoNumber("");
    setFcNumber("");
    setGeneralObservations("");
    setRows([createEmptyRow()]);
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (isReadonly) {
      showToast(
        "error",
        "Tu cuenta es de solo lectura y no puede registrar entradas.",
      );
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    const usableRows = rows.filter(
      (row) => row.product_id && Number(row.quantity) > 0,
    );

    setSaving(true);
    setFormError(null);

    try {
      const supabase = createClient();

      const operationReference = `ENTRADA_WEB_${Date.now()}_${crypto
        .randomUUID()
        .slice(0, 8)}`;

      const movementPayload = usableRows.map((row) => {
        const observationParts = [
          memoNumber.trim()
            ? `Número de memo: ${memoNumber.trim()}`
            : "",
          fcNumber.trim()
            ? `Número de FC: ${fcNumber.trim()}`
            : "",
          generalObservations.trim()
            ? `Observación general: ${generalObservations.trim()}`
            : "",
          row.observation.trim()
            ? `Observación del producto: ${row.observation.trim()}`
            : "",
        ].filter(Boolean);

        return {
          movement_date: movementDate,
          movement_type: "ENTRY",
          product_id: row.product_id,
          quantity: Number(row.quantity),
          reference: operationReference,
          observations: observationParts.join(" | "),
          created_by: userId,
          legacy_destination: null,
          recipient_id: null,
          area_id: null,
        };
      });

      const { error: insertError } = await supabase
        .from("supply_movements")
        .insert(movementPayload);

      if (insertError) {
        throw insertError;
      }

      showToast(
        "success",
        usableRows.length === 1
          ? "Entrada registrada correctamente."
          : `Entrada registrada con ${usableRows.length} productos.`,
      );

      resetForm();
    } catch (submitError) {
      console.error("Error registrando entrada:", submitError);

      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo registrar la entrada.",
      );
    } finally {
      setSaving(false);
    }
  };

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
            Registrar entrada
          </h1>

          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Cargá el ingreso de productos y asociá sus números de memo y FC.
          </p>
        </div>
      </div>

      {isReadonly && (
        <Card className="border-amber-500/40">
          <CardContent className="py-4 text-sm text-amber-700 dark:text-amber-400">
            Tu cuenta está en modo solo lectura. Podés consultar la
            pantalla, pero no registrar movimientos.
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Datos generales</CardTitle>
          </CardHeader>

          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="movement-date">Fecha *</Label>

              <Input
                id="movement-date"
                type="date"
                value={movementDate}
                onChange={(event) => setMovementDate(event.target.value)}
                disabled={isReadonly || saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="memo-number">Número de memo</Label>

              <Input
                id="memo-number"
                value={memoNumber}
                onChange={(event) => setMemoNumber(event.target.value)}
                placeholder="Ejemplo: 125/2026"
                disabled={isReadonly || saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fc-number">Número de FC</Label>

              <Input
                id="fc-number"
                value={fcNumber}
                onChange={(event) => setFcNumber(event.target.value)}
                placeholder="Ejemplo: FC-4587"
                disabled={isReadonly || saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="general-observations">
                Observación general
              </Label>

              <Input
                id="general-observations"
                value={generalObservations}
                onChange={(event) =>
                  setGeneralObservations(event.target.value)
                }
                placeholder="Opcional"
                disabled={isReadonly || saving}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Productos incluidos</CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                Podés registrar varios productos en una sola entrada.
              </p>
            </div>

            {!isReadonly && (
              <Button
                type="button"
                variant="outline"
                onClick={addRow}
                disabled={saving}
              >
                <Plus className="mr-2 size-4" />
                Agregar producto
              </Button>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {rows.map((row, index) => {
              const selectedProduct = getProductById(row.product_id);

              return (
                <div key={row.id} className="rounded-2xl border p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="font-medium">Producto {index + 1}</p>

                    {!isReadonly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(row.id)}
                        disabled={saving}
                        title="Quitar fila"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(260px,1fr)_150px_minmax(200px,1fr)]">
                    <div className="space-y-2">
                      <Label>Categoría</Label>

                      <Select
                        value={row.category_id}
                        onValueChange={(value) =>
                          updateRow(row.id, "category_id", value)
                        }
                        disabled={isReadonly || saving}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value={ALL_CATEGORIES}>
                            Todas las categorías
                          </SelectItem>

                          {categories.map((categoryItem) => (
                            <SelectItem
                              key={categoryItem.id}
                              value={categoryItem.id}
                            >
                              {categoryItem.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Producto *</Label>

                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-full justify-start overflow-hidden font-normal"
                        onClick={() => openProductDialog(row.id)}
                        disabled={isReadonly || saving}
                      >
                        <Search className="mr-2 size-4 shrink-0" />

                        <span className="truncate">
                          {selectedProduct
                            ? selectedProduct.product_name
                            : "Buscar y seleccionar producto"}
                        </span>
                      </Button>

                      {selectedProduct && (
                        <p className="text-xs text-muted-foreground">
                          Stock actual: {" "}
                          {formatQuantity(
                            Math.max(
                              0,
                              Number(selectedProduct.current_stock),
                            ),
                          )}{" "}
                          {selectedProduct.unit}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`quantity-${row.id}`}>
                        Cantidad *
                      </Label>

                      <Input
                        id={`quantity-${row.id}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={row.quantity}
                        onChange={(event) =>
                          updateRow(
                            row.id,
                            "quantity",
                            event.target.value,
                          )
                        }
                        placeholder="0"
                        disabled={isReadonly || saving}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`observation-${row.id}`}>
                        Observación
                      </Label>

                      <Input
                        id={`observation-${row.id}`}
                        value={row.observation}
                        onChange={(event) =>
                          updateRow(
                            row.id,
                            "observation",
                            event.target.value,
                          )
                        }
                        placeholder="Opcional"
                        disabled={isReadonly || saving}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-2 gap-6 sm:flex sm:items-center">
              <div>
                <p className="text-sm text-muted-foreground">
                  Productos completos
                </p>
                <p className="mt-1 text-xl font-bold">{completedRows}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Cantidad total
                </p>
                <p className="mt-1 text-xl font-bold">
                  {formatQuantity(totalQuantity)}
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                disabled={saving || isReadonly}
              >
                Limpiar formulario
              </Button>

              <Button type="submit" disabled={saving || isReadonly}>
                {saving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <PackagePlus className="mr-2 size-4" />
                )}

                {saving ? "Registrando..." : "Registrar entrada"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {formError && (
          <Card className="border-destructive/40">
            <CardContent className="py-4 text-sm text-destructive">
              {formError}
            </CardContent>
          </Card>
        )}
      </form>

      <Dialog
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open);

          if (!open) {
            setSelectingRowId(null);
            setProductSearch("");
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle>Seleccionar producto</DialogTitle>

            <DialogDescription>
              Buscá por nombre. La categoría elegida funciona como filtro
              y podés seleccionar “Todas las categorías”.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={productSearch}
                onChange={(event) =>
                  setProductSearch(event.target.value)
                }
                placeholder="Buscar producto o categoría..."
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">
              {filteredDialogProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No se encontraron productos con esa búsqueda.
                </div>
              ) : (
                filteredDialogProducts.map((product) => (
                  <button
                    key={product.product_id}
                    type="button"
                    className="flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50"
                    onClick={() => selectProduct(product)}
                  >
                    <span className="font-medium">
                      {product.product_name}
                    </span>

                    <span className="text-xs text-muted-foreground">
                      {product.category_name} · Stock:{" "}
                      {formatQuantity(
                        Math.max(0, Number(product.current_stock)),
                      )}{" "}
                      {product.unit}
                    </span>
                  </button>
                ))
              )}
            </div>

            {!isReadonly && productSearch.trim() && (
              <div className="border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={openNewProductDialog}
                >
                  <Plus className="mr-2 size-4" />
                  Agregar “{productSearch.trim()}” como nuevo producto
                </Button>

                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Vas a poder elegir su categoría, unidad y stock mínimo.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={newProductDialogOpen}
        onOpenChange={(open) => {
          if (!savingNewProduct) {
            setNewProductDialogOpen(open);

            if (!open) {
              setCreatingForRowId(null);
              setNewProductForm(INITIAL_NEW_PRODUCT_FORM);
              setNewProductError(null);
            }
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Agregar nuevo producto</DialogTitle>

            <DialogDescription>
              El producto se incorporará al catálogo y quedará seleccionado
              automáticamente en esta entrada.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateProduct} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="new-product-name">Nombre *</Label>

              <Input
                id="new-product-name"
                value={newProductForm.name}
                onChange={(event) => {
                  setNewProductForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }));
                  setNewProductError(null);
                }}
                placeholder="Nombre del producto"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Categoría *</Label>

              <Select
                value={newProductForm.category_id}
                onValueChange={(value) => {
                  setNewProductForm((current) => ({
                    ...current,
                    category_id: value,
                  }));
                  setNewProductError(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>

                <SelectContent>
                  {categories.map((categoryItem) => (
                    <SelectItem
                      key={categoryItem.id}
                      value={categoryItem.id}
                    >
                      {categoryItem.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Unidad *</Label>

                <Select
                  value={newProductForm.unit}
                  onValueChange={(value) => {
                    setNewProductForm((current) => ({
                      ...current,
                      unit: value,
                    }));
                    setNewProductError(null);
                  }}
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-product-minimum-stock">
                  Stock mínimo *
                </Label>

                <Input
                  id="new-product-minimum-stock"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newProductForm.minimum_stock}
                  onChange={(event) => {
                    setNewProductForm((current) => ({
                      ...current,
                      minimum_stock: event.target.value,
                    }));
                    setNewProductError(null);
                  }}
                />
              </div>
            </div>

            {newProductError && (
              <p className="text-sm text-destructive">
                {newProductError}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewProductDialogOpen(false)}
                disabled={savingNewProduct}
              >
                Cancelar
              </Button>

              <Button type="submit" disabled={savingNewProduct}>
                {savingNewProduct && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}

                Crear y seleccionar
              </Button>
            </div>
          </form>
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
