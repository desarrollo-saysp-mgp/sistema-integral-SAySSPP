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
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleOff,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Tags,
  Trash2,
  X,
  XCircle,
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

type SortOption =
  | "name_asc"
  | "name_desc"
  | "category_asc"
  | "category_desc"
  | "minimum_stock_asc"
  | "minimum_stock_desc"
  | "newest"
  | "oldest";

type ConfirmAction = "deactivate" | "restore" | "delete";

type ConfirmationState = {
  open: boolean;
  action: ConfirmAction | null;
  product: Product | null;
};

type CategoryAction = "deactivate" | "restore" | "delete";

type CategoryConfirmationState = {
  open: boolean;
  action: CategoryAction | null;
  category: Category | null;
};

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

const INITIAL_CONFIRMATION: ConfirmationState = {
  open: false,
  action: null,
  product: null,
};

const INITIAL_CATEGORY_CONFIRMATION: CategoryConfirmationState = {
  open: false,
  action: null,
  category: null,
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

const formatNumber = (value: number | string | null | undefined) => {
  const number = Number(value ?? 0);

  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(number);
};

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
  const [sortBy, setSortBy] = useState<SortOption>("name_asc");

  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editCategoryOpen, setEditCategoryOpen] = useState(false);
  const [savingCategoryEdit, setSavingCategoryEdit] = useState(false);
  const [editCategoryError, setEditCategoryError] = useState<string | null>(null);
  const [processingCategoryAction, setProcessingCategoryAction] =
    useState(false);
  const [categoryConfirmation, setCategoryConfirmation] =
    useState<CategoryConfirmationState>(INITIAL_CATEGORY_CONFIRMATION);

  const [confirmation, setConfirmation] =
    useState<ConfirmationState>(INITIAL_CONFIRMATION);

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

    let mounted = true;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    const channelName = `suministros-productos-${crypto.randomUUID()}`;

    const refreshData = () => {
      if (!mounted) return;

      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      refreshTimeout = setTimeout(() => {
        if (mounted) {
          void loadAll();
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
      .subscribe((status, subscriptionError) => {
        if (status === "SUBSCRIBED") {
          console.log("Realtime de productos conectado.");
        }

        if (status === "CHANNEL_ERROR") {
          console.warn(
            "Realtime de productos tuvo un error de conexión.",
            subscriptionError,
          );
        }

        if (status === "TIMED_OUT") {
          console.warn(
            "La conexión Realtime de productos demoró demasiado.",
          );
        }

        if (status === "CLOSED") {
          console.log("Canal Realtime de productos cerrado.");
        }
      });

    return () => {
      mounted = false;

      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      void supabase.removeChannel(channel);
    };
  }, [loadAll]);

  useEffect(() => {
    if (!successMessage && !error) return;

    const timeout = setTimeout(() => {
      setSuccessMessage(null);
      setError(null);
    }, 4000);

    return () => clearTimeout(timeout);
  }, [successMessage, error]);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.active),
    [categories],
  );

  const filteredCategories = useMemo(() => {
    const normalizedSearch = normalizeText(categorySearch);

    return categories
      .filter(
        (category) =>
          !normalizedSearch ||
          normalizeText(category.name).includes(normalizedSearch),
      )
      .sort((a, b) =>
        a.name.localeCompare(b.name, "es", {
          sensitivity: "base",
        }),
      );
  }, [categories, categorySearch]);

  const productCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();

    products.forEach((product) => {
      counts.set(
        product.category_id,
        (counts.get(product.category_id) ?? 0) + 1,
      );
    });

    return counts;
  }, [products]);

  const filteredAndSortedProducts = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    const filtered = products.filter((product) => {
      const categoryName = product.category?.name ?? "";

      const matchesSearch =
        !normalizedSearch ||
        normalizeText(product.name).includes(normalizedSearch) ||
        normalizeText(categoryName).includes(normalizedSearch) ||
        normalizeText(product.unit).includes(normalizedSearch);

      const matchesCategory =
        categoryFilter === "all" ||
        product.category_id === categoryFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && product.active) ||
        (statusFilter === "inactive" && !product.active);

      return matchesSearch && matchesCategory && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      const categoryA = a.category?.name ?? "";
      const categoryB = b.category?.name ?? "";

      switch (sortBy) {
        case "name_desc":
          return b.name.localeCompare(a.name, "es", {
            sensitivity: "base",
          });

        case "category_asc":
          return (
            categoryA.localeCompare(categoryB, "es", {
              sensitivity: "base",
            }) ||
            a.name.localeCompare(b.name, "es", {
              sensitivity: "base",
            })
          );

        case "category_desc":
          return (
            categoryB.localeCompare(categoryA, "es", {
              sensitivity: "base",
            }) ||
            a.name.localeCompare(b.name, "es", {
              sensitivity: "base",
            })
          );

        case "minimum_stock_asc":
          return (
            Number(a.minimum_stock) - Number(b.minimum_stock) ||
            a.name.localeCompare(b.name, "es", {
              sensitivity: "base",
            })
          );

        case "minimum_stock_desc":
          return (
            Number(b.minimum_stock) - Number(a.minimum_stock) ||
            a.name.localeCompare(b.name, "es", {
              sensitivity: "base",
            })
          );

        case "newest":
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );

        case "oldest":
          return (
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
          );

        case "name_asc":
        default:
          return a.name.localeCompare(b.name, "es", {
            sensitivity: "base",
          });
      }
    });
  }, [
    products,
    search,
    categoryFilter,
    statusFilter,
    sortBy,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    categoryFilter,
    statusFilter,
    sortBy,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSortedProducts.length / PAGE_SIZE),
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return filteredAndSortedProducts.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [filteredAndSortedProducts, page]);

  const activeCount = products.filter((product) => product.active).length;
  const inactiveCount = products.filter((product) => !product.active).length;

  const openNewProduct = () => {
    setEditingProduct(null);
    setFormData(INITIAL_FORM);
    setFormErrors({});
    setSuccessMessage(null);
    setError(null);
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
    setError(null);
    setDialogOpen(true);
  };

  const openNewCategoryDialog = () => {
    setNewCategoryName("");
    setCategoryError(null);
    setCategoryDialogOpen(true);
  };

  const handleCreateCategory = async (event: FormEvent) => {
    event.preventDefault();

    const categoryName = newCategoryName.trim();

    if (!categoryName) {
      setCategoryError("El nombre de la categoría es requerido.");
      return;
    }

    const duplicatedCategory = categories.some(
      (category) =>
        normalizeText(category.name) === normalizeText(categoryName),
    );

    if (duplicatedCategory) {
      setCategoryError("Ya existe una categoría con ese nombre.");
      return;
    }

    setSavingCategory(true);
    setCategoryError(null);
    setError(null);
    setSuccessMessage(null);

    try {
      const supabase = createClient();

      const { data: createdCategory, error: insertError } = await supabase
        .from("supply_categories")
        .insert({
          name: categoryName,
          active: true,
          created_by: userId,
        })
        .select("id, name, active")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          throw new Error("Ya existe una categoría con ese nombre.");
        }

        throw insertError;
      }

      const newCategory = createdCategory as Category;

      setCategories((current) =>
        [...current, newCategory].sort((a, b) =>
          a.name.localeCompare(b.name, "es", {
            sensitivity: "base",
          }),
        ),
      );

      setFormData((current) => ({
        ...current,
        category_id: newCategory.id,
      }));

      setCategoryDialogOpen(false);
      setNewCategoryName("");
      setSuccessMessage(
        `Categoría “${newCategory.name}” creada y seleccionada.`,
      );
    } catch (createError) {
      console.error("Error creando categoría:", createError);

      setCategoryError(
        createError instanceof Error
          ? createError.message
          : "No se pudo crear la categoría.",
      );
    } finally {
      setSavingCategory(false);
    }
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setEditingCategoryName(category.name);
    setEditCategoryError(null);
    setEditCategoryOpen(true);
  };

  const handleEditCategory = async (event: FormEvent) => {
    event.preventDefault();

    if (!editingCategory) return;

    const categoryName = editingCategoryName.trim();

    if (!categoryName) {
      setEditCategoryError("El nombre de la categoría es requerido.");
      return;
    }

    const duplicatedCategory = categories.some(
      (category) =>
        category.id !== editingCategory.id &&
        normalizeText(category.name) === normalizeText(categoryName),
    );

    if (duplicatedCategory) {
      setEditCategoryError("Ya existe una categoría con ese nombre.");
      return;
    }

    setSavingCategoryEdit(true);
    setEditCategoryError(null);

    try {
      const supabase = createClient();

      const { error: updateError } = await supabase
        .from("supply_categories")
        .update({ name: categoryName })
        .eq("id", editingCategory.id);

      if (updateError) {
        if (updateError.code === "23505") {
          throw new Error("Ya existe una categoría con ese nombre.");
        }

        throw updateError;
      }

      await loadCategories();
      await loadProducts();

      setEditCategoryOpen(false);
      setEditingCategory(null);
      setEditingCategoryName("");
      setSuccessMessage("Categoría actualizada correctamente.");
    } catch (updateError) {
      console.error("Error actualizando categoría:", updateError);

      setEditCategoryError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar la categoría.",
      );
    } finally {
      setSavingCategoryEdit(false);
    }
  };

  const openCategoryConfirmation = (
    category: Category,
    action: CategoryAction,
  ) => {
    setCategoryConfirmation({
      open: true,
      action,
      category,
    });
  };

  const closeCategoryConfirmation = () => {
    if (processingCategoryAction) return;

    setCategoryConfirmation(INITIAL_CATEGORY_CONFIRMATION);
  };

  const processCategoryConfirmation = async () => {
    const category = categoryConfirmation.category;
    const action = categoryConfirmation.action;

    if (!category || !action) return;

    setProcessingCategoryAction(true);

    try {
      const supabase = createClient();

      if (action === "deactivate" || action === "restore") {
        const { error: updateError } = await supabase
          .from("supply_categories")
          .update({ active: action === "restore" })
          .eq("id", category.id);

        if (updateError) throw updateError;

        setSuccessMessage(
          action === "restore"
            ? "Categoría restaurada correctamente."
            : "Categoría desactivada correctamente.",
        );
      }

      if (action === "delete") {
        const { count, error: countError } = await supabase
          .from("supply_products")
          .select("id", { count: "exact", head: true })
          .eq("category_id", category.id);

        if (countError) throw countError;

        if ((count ?? 0) > 0) {
          throw new Error(
            "No se puede eliminar esta categoría porque tiene productos asociados. Podés mantenerla inactiva.",
          );
        }

        const { error: deleteError } = await supabase
          .from("supply_categories")
          .delete()
          .eq("id", category.id);

        if (deleteError) throw deleteError;

        setSuccessMessage("Categoría eliminada definitivamente.");
      }

      await loadCategories();
      await loadProducts();
      setCategoryConfirmation(INITIAL_CATEGORY_CONFIRMATION);
    } catch (actionError) {
      console.error("Error procesando categoría:", actionError);

      setCategoryConfirmation(INITIAL_CATEGORY_CONFIRMATION);
      setError(
        actionError instanceof Error
          ? actionError.message
          : "No se pudo completar la operación.",
      );
    } finally {
      setProcessingCategoryAction(false);
    }
  };

  const categoryConfirmationContent = useMemo(() => {
    const categoryName =
      categoryConfirmation.category?.name ?? "esta categoría";

    if (categoryConfirmation.action === "deactivate") {
      return {
        title: "Desactivar categoría",
        description: `La categoría “${categoryName}” dejará de estar disponible para nuevos productos. Los productos existentes conservarán su categoría.`,
        confirmLabel: "Desactivar",
        confirmVariant: "destructive" as const,
      };
    }

    if (categoryConfirmation.action === "restore") {
      return {
        title: "Restaurar categoría",
        description: `La categoría “${categoryName}” volverá a estar disponible para crear y editar productos.`,
        confirmLabel: "Restaurar",
        confirmVariant: "default" as const,
      };
    }

    return {
      title: "Eliminar categoría definitivamente",
      description: `La categoría “${categoryName}” solo se eliminará si no tiene productos asociados. Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar definitivamente",
      confirmVariant: "destructive" as const,
    };
  }, [categoryConfirmation]);

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

  const openConfirmation = (
    product: Product,
    action: ConfirmAction,
  ) => {
    setError(null);
    setSuccessMessage(null);

    setConfirmation({
      open: true,
      action,
      product,
    });
  };

  const closeConfirmation = () => {
    if (processingAction) return;

    setConfirmation(INITIAL_CONFIRMATION);
  };

  const processConfirmation = async () => {
    const product = confirmation.product;
    const action = confirmation.action;

    if (!product || !action) {
      return;
    }

    setProcessingAction(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const supabase = createClient();

      if (action === "deactivate" || action === "restore") {
        const newActiveValue = action === "restore";

        const { error: updateError } = await supabase
          .from("supply_products")
          .update({
            active: newActiveValue,
          })
          .eq("id", product.id);

        if (updateError) {
          throw updateError;
        }

        setSuccessMessage(
          action === "restore"
            ? "Producto restaurado correctamente."
            : "Producto desactivado correctamente.",
        );
      }

      if (action === "delete") {
        const {
          count: movementsCount,
          error: countError,
        } = await supabase
          .from("supply_movements")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("product_id", product.id);

        if (countError) {
          throw countError;
        }

        if ((movementsCount ?? 0) > 0) {
          throw new Error(
            "Este producto tiene movimientos registrados y no puede eliminarse definitivamente. Podés mantenerlo inactivo para conservar el historial.",
          );
        }

        const { error: deleteError } = await supabase
          .from("supply_products")
          .delete()
          .eq("id", product.id);

        if (deleteError) {
          throw deleteError;
        }

        setSuccessMessage("Producto eliminado definitivamente.");
      }

      await loadProducts();
      setConfirmation(INITIAL_CONFIRMATION);
    } catch (actionError) {
      console.error("Error procesando acción del producto:", actionError);

      setConfirmation(INITIAL_CONFIRMATION);

      setError(
        actionError instanceof Error
          ? actionError.message
          : "No se pudo completar la operación.",
      );
    } finally {
      setProcessingAction(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("active");
    setSortBy("name_asc");
    setPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    categoryFilter !== "all" ||
    statusFilter !== "active" ||
    sortBy !== "name_asc";

  const confirmationContent = useMemo(() => {
    const productName = confirmation.product?.name ?? "este producto";

    if (confirmation.action === "deactivate") {
      return {
        title: "Desactivar producto",
        description: `El producto “${productName}” dejará de aparecer en los desplegables y en el stock activo, pero conservará todo su historial.`,
        confirmLabel: "Desactivar",
        confirmVariant: "destructive" as const,
      };
    }

    if (confirmation.action === "restore") {
      return {
        title: "Restaurar producto",
        description: `El producto “${productName}” volverá a estar activo y disponible en los desplegables del módulo.`,
        confirmLabel: "Restaurar",
        confirmVariant: "default" as const,
      };
    }

    return {
      title: "Eliminar producto definitivamente",
      description: `Esta acción eliminará “${productName}” de la base solamente si nunca tuvo movimientos de stock. Esta operación no se puede deshacer.`,
      confirmLabel: "Eliminar definitivamente",
      confirmVariant: "destructive" as const,
    };
  }, [confirmation]);

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
      {(successMessage || error) && (
        <div className="fixed bottom-5 right-4 z-[100] w-[calc(100%-2rem)] max-w-sm sm:right-6">
          <div
            className={
              successMessage
                ? "flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-background p-4 shadow-lg"
                : "flex items-start gap-3 rounded-xl border border-destructive/30 bg-background p-4 shadow-lg"
            }
          >
            {successMessage ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            ) : (
              <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            )}

            <p className="flex-1 text-sm leading-5">
              {successMessage ?? error}
            </p>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-2 size-8 shrink-0"
              onClick={() => {
                setSuccessMessage(null);
                setError(null);
              }}
              aria-label="Cerrar notificación"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}

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
              Productos y categorías
            </h1>

            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Administrá el catálogo de productos del módulo.
            </p>
          </div>
        </div>

        {!isReadonly && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setManageCategoriesOpen(true)}
            >
              <Settings2 className="mr-2 size-4" />
              Administrar categorías
            </Button>

            <Button onClick={openNewProduct}>
              <Plus className="mr-2 size-4" />
              Nuevo producto
            </Button>
          </div>
        )}
      </div>


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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_220px_180px_minmax(260px,300px)_auto]">
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

            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as StatusFilter)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
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
                <SelectItem value="minimum_stock_asc">
                  Stock mínimo: menor a mayor
                </SelectItem>
                <SelectItem value="minimum_stock_desc">
                  Stock mínimo: mayor a menor
                </SelectItem>
                <SelectItem value="newest">Más recientes</SelectItem>
                <SelectItem value="oldest">Más antiguos</SelectItem>
              </SelectContent>
            </Select>

            <Button
              className="w-full whitespace-nowrap xl:w-auto"
              variant="outline"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              Limpiar filtros
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {filteredAndSortedProducts.length === 1
              ? "1 producto encontrado"
              : `${filteredAndSortedProducts.length} productos encontrados`}
          </p>
        </CardContent>
      </Card>

      {paginatedProducts.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <Search className="size-10 text-muted-foreground" />

            <div>
              <p className="font-medium">
                No se encontraron productos
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
              <table className="w-full min-w-[980px] text-sm">
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
                      <th className="px-5 py-4 text-right">
                        Acciones
                      </th>
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
                        {formatNumber(product.minimum_stock)}
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
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditProduct(product)}
                              title="Editar producto"
                            >
                              <Pencil className="size-4" />
                            </Button>

                            {product.active ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  openConfirmation(
                                    product,
                                    "deactivate",
                                  )
                                }
                                title="Desactivar producto"
                              >
                                <CircleOff className="size-4 text-destructive" />
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    openConfirmation(
                                      product,
                                      "restore",
                                    )
                                  }
                                  title="Restaurar producto"
                                >
                                  <RotateCcw className="size-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    openConfirmation(
                                      product,
                                      "delete",
                                    )
                                  }
                                  title="Eliminar definitivamente"
                                >
                                  <Trash2 className="size-4 text-destructive" />
                                </Button>
                              </>
                            )}
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

                      <p className="mt-1 font-medium">
                        {product.unit}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Stock mínimo
                      </p>

                      <p className="mt-1 font-medium">
                        {formatNumber(product.minimum_stock)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={
                        product.active
                          ? "rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                          : "rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {product.active ? "Activo" : "Inactivo"}
                    </span>

                    {!isReadonly && (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditProduct(product)}
                        >
                          <Pencil className="mr-2 size-4" />
                          Editar
                        </Button>

                        {product.active ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              openConfirmation(
                                product,
                                "deactivate",
                              )
                            }
                          >
                            <CircleOff className="mr-2 size-4 text-destructive" />
                            Desactivar
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                openConfirmation(
                                  product,
                                  "restore",
                                )
                              }
                            >
                              <RotateCcw className="mr-2 size-4" />
                              Restaurar
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                openConfirmation(
                                  product,
                                  "delete",
                                )
                              }
                            >
                              <Trash2 className="mr-2 size-4 text-destructive" />
                              Eliminar
                            </Button>
                          </>
                        )}
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
        </>
      )}

      <Dialog
        open={manageCategoriesOpen}
        onOpenChange={setManageCategoriesOpen}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Administrar categorías</DialogTitle>

            <DialogDescription>
              Editá, desactivá, restaurá o eliminá categorías sin afectar el
              historial de productos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  placeholder="Buscar categoría..."
                  className="pl-9"
                />
              </div>

              <Button
                type="button"
                onClick={openNewCategoryDialog}
              >
                <Plus className="mr-2 size-4" />
                Nueva categoría
              </Button>
            </div>

            <div className="overflow-hidden rounded-xl border">
              {filteredCategories.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No se encontraron categorías.
                </div>
              ) : (
                <div className="divide-y">
                  {filteredCategories.map((category) => {
                    const associatedProducts =
                      productCountByCategory.get(category.id) ?? 0;

                    return (
                      <div
                        key={category.id}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{category.name}</p>

                            <span
                              className={
                                category.active
                                  ? "rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                                  : "rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                              }
                            >
                              {category.active ? "Activa" : "Inactiva"}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {associatedProducts === 1
                              ? "1 producto asociado"
                              : `${associatedProducts} productos asociados`}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditCategory(category)}
                          >
                            <Pencil className="mr-2 size-4" />
                            Editar
                          </Button>

                          {category.active ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                openCategoryConfirmation(
                                  category,
                                  "deactivate",
                                )
                              }
                            >
                              <CircleOff className="mr-2 size-4 text-destructive" />
                              Desactivar
                            </Button>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  openCategoryConfirmation(
                                    category,
                                    "restore",
                                  )
                                }
                              >
                                <RotateCcw className="mr-2 size-4" />
                                Restaurar
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  openCategoryConfirmation(
                                    category,
                                    "delete",
                                  )
                                }
                              >
                                <Trash2 className="mr-2 size-4 text-destructive" />
                                Eliminar
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editCategoryOpen}
        onOpenChange={(open) => {
          if (!savingCategoryEdit) {
            setEditCategoryOpen(open);

            if (!open) {
              setEditingCategory(null);
              setEditingCategoryName("");
              setEditCategoryError(null);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Editar categoría</DialogTitle>

            <DialogDescription>
              Modificá el nombre de la categoría seleccionada.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditCategory} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="edit-category-name">
                Nombre de la categoría *
              </Label>

              <Input
                id="edit-category-name"
                value={editingCategoryName}
                onChange={(event) => {
                  setEditingCategoryName(event.target.value);

                  if (editCategoryError) {
                    setEditCategoryError(null);
                  }
                }}
                autoFocus
              />

              {editCategoryError && (
                <p className="text-sm text-destructive">
                  {editCategoryError}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditCategoryOpen(false)}
                disabled={savingCategoryEdit}
              >
                Cancelar
              </Button>

              <Button type="submit" disabled={savingCategoryEdit}>
                {savingCategoryEdit && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}

                Guardar cambios
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={categoryConfirmation.open}
        onOpenChange={(open) => {
          if (!open) {
            closeCategoryConfirmation();
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {categoryConfirmationContent.title}
            </DialogTitle>

            <DialogDescription className="leading-6">
              {categoryConfirmationContent.description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={closeCategoryConfirmation}
              disabled={processingCategoryAction}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant={categoryConfirmationContent.confirmVariant}
              onClick={() => void processCategoryConfirmation()}
              disabled={processingCategoryAction}
            >
              {processingCategoryAction && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}

              {categoryConfirmationContent.confirmLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Select
                  value={formData.category_id}
                  onValueChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      category_id: value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
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

                <Button
                  type="button"
                  variant="outline"
                  className="w-full whitespace-nowrap sm:w-auto"
                  onClick={openNewCategoryDialog}
                >
                  <Plus className="mr-2 size-4" />
                  Nueva categoría
                </Button>
              </div>

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

      <Dialog
        open={categoryDialogOpen}
        onOpenChange={(open) => {
          if (!savingCategory) {
            setCategoryDialogOpen(open);

            if (!open) {
              setNewCategoryName("");
              setCategoryError(null);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Nueva categoría</DialogTitle>

            <DialogDescription>
              Creá una categoría para clasificar el producto. Al guardarla,
              quedará seleccionada automáticamente.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleCreateCategory}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="new-category-name">
                Nombre de la categoría *
              </Label>

              <Input
                id="new-category-name"
                value={newCategoryName}
                onChange={(event) => {
                  setNewCategoryName(event.target.value);

                  if (categoryError) {
                    setCategoryError(null);
                  }
                }}
                placeholder="Ejemplo: Papelería"
                autoFocus
              />

              {categoryError && (
                <p className="text-sm text-destructive">
                  {categoryError}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCategoryDialogOpen(false)}
                disabled={savingCategory}
              >
                Cancelar
              </Button>

              <Button
                type="submit"
                disabled={savingCategory}
              >
                {savingCategory && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}

                Crear categoría
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmation.open}
        onOpenChange={(open) => {
          if (!open) {
            closeConfirmation();
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{confirmationContent.title}</DialogTitle>

            <DialogDescription className="leading-6">
              {confirmationContent.description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={closeConfirmation}
              disabled={processingAction}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant={confirmationContent.confirmVariant}
              onClick={() => void processConfirmation()}
              disabled={processingAction}
            >
              {processingAction && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}

              {confirmationContent.confirmLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
