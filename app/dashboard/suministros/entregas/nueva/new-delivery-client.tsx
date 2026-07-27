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
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  UserPlus,
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

type Category = { id: string; name: string };
type ProductOption = {
  product_id: string;
  product_name: string;
  category_id: string;
  category_name: string;
  unit: string;
  current_stock: number;
};
type Recipient = { id: string; full_name: string; active: boolean };
type Area = { id: string; name: string; active: boolean };
type DeliveryRow = {
  id: string;
  category_id: string;
  product_id: string;
  quantity: string;
  observation: string;
};
type ManagedEntityType = "recipient" | "area";

type ManagedEntity = {
  id: string;
  name: string;
  active: boolean;
  type: ManagedEntityType;
};

type ToastState = { type: "success" | "error"; message: string } | null;
type NewDeliveryClientProps = { userId: string; isReadonly: boolean };

const CHUNK_SIZE = 1000;
const ALL_CATEGORIES = "all";

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
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

const createEmptyRow = (): DeliveryRow => ({
  id: crypto.randomUUID(),
  category_id: ALL_CATEGORIES,
  product_id: "",
  quantity: "",
  observation: "",
});

export function NewDeliveryClient({ userId, isReadonly }: NewDeliveryClientProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  const [movementDate, setMovementDate] = useState(getLocalDate());
  const [recipientId, setRecipientId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [areaSearch, setAreaSearch] = useState("");
  const [recipientSelectorOpen, setRecipientSelectorOpen] = useState(false);
  const [areaSelectorOpen, setAreaSelectorOpen] = useState(false);
  const [generalObservations, setGeneralObservations] = useState("");
  const [rows, setRows] = useState<DeliveryRow[]>([createEmptyRow()]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectingRowId, setSelectingRowId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");

  const [recipientDialogOpen, setRecipientDialogOpen] = useState(false);
  const [newRecipientName, setNewRecipientName] = useState("");
  const [savingRecipient, setSavingRecipient] = useState(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [savingArea, setSavingArea] = useState(false);
  const [areaError, setAreaError] = useState<string | null>(null);

  const [manageRecipientsOpen, setManageRecipientsOpen] = useState(false);
  const [manageAreasOpen, setManageAreasOpen] = useState(false);
  const [recipientAdminSearch, setRecipientAdminSearch] = useState("");
  const [areaAdminSearch, setAreaAdminSearch] = useState("");

  const [editEntityOpen, setEditEntityOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<ManagedEntity | null>(null);
  const [editingEntityName, setEditingEntityName] = useState("");
  const [editingEntityError, setEditingEntityError] = useState<string | null>(null);
  const [savingEntityEdit, setSavingEntityEdit] = useState(false);

  const [deleteEntityOpen, setDeleteEntityOpen] = useState(false);
  const [deletingEntity, setDeletingEntity] = useState<ManagedEntity | null>(null);
  const [deletingEntityPermanently, setDeletingEntityPermanently] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [categoriesResult, recipientsResult, areasResult] = await Promise.all([
        supabase.from("supply_categories").select("id, name").eq("active", true).order("name"),
        supabase.from("supply_recipients").select("id, full_name, active").order("full_name"),
        supabase.from("supply_areas").select("id, name, active").order("name"),
      ]);

      if (categoriesResult.error) throw categoriesResult.error;
      if (recipientsResult.error) throw recipientsResult.error;
      if (areasResult.error) throw areasResult.error;

      const allProducts: ProductOption[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("supply_current_stock")
          .select("product_id, product_name, category_id, category_name, unit, current_stock")
          .eq("product_active", true)
          .eq("category_active", true)
          .order("product_name")
          .range(from, from + CHUNK_SIZE - 1);
        if (error) throw error;
        const pageRows = (data ?? []) as ProductOption[];
        allProducts.push(...pageRows);
        hasMore = pageRows.length === CHUNK_SIZE;
        from += CHUNK_SIZE;
      }

      setCategories((categoriesResult.data ?? []) as Category[]);
      setRecipients((recipientsResult.data ?? []) as Recipient[]);
      setAreas((areasResult.data ?? []) as Area[]);
      setProducts(allProducts);
    } catch (error) {
      console.error("Error cargando catálogo de entregas:", error);
      showToast("error", "No se pudieron cargar productos, personas y áreas.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadCatalog();
    const supabase = createClient();
    let mounted = true;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    const refreshCatalog = () => {
      if (!mounted) return;
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => mounted && void loadCatalog(), 300);
    };

    const channel = supabase
      .channel(`suministros-entrega-catalogo-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "supply_products" }, refreshCatalog)
      .on("postgres_changes", { event: "*", schema: "public", table: "supply_categories" }, refreshCatalog)
      .on("postgres_changes", { event: "*", schema: "public", table: "supply_recipients" }, refreshCatalog)
      .on("postgres_changes", { event: "*", schema: "public", table: "supply_areas" }, refreshCatalog)
      .on("postgres_changes", { event: "*", schema: "public", table: "supply_movements" }, refreshCatalog)
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR") console.warn("Realtime de entregas tuvo un error.", error);
      });

    return () => {
      mounted = false;
      if (refreshTimeout) clearTimeout(refreshTimeout);
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

  const activeRecipients = useMemo(
    () => recipients.filter((item) => item.active),
    [recipients],
  );

  const activeAreas = useMemo(
    () => areas.filter((item) => item.active),
    [areas],
  );

  const selectedRecipient = useMemo(
    () => activeRecipients.find((item) => item.id === recipientId) ?? null,
    [activeRecipients, recipientId],
  );

  const selectedArea = useMemo(
    () => activeAreas.find((item) => item.id === areaId) ?? null,
    [activeAreas, areaId],
  );

  const filteredRecipientOptions = useMemo(() => {
    const normalizedSearch = normalizeText(recipientSearch);

    return activeRecipients
      .filter(
        (item) =>
          !normalizedSearch ||
          normalizeText(item.full_name).includes(normalizedSearch),
      )
      .slice(0, 100);
  }, [activeRecipients, recipientSearch]);

  const filteredAreaOptions = useMemo(() => {
    const normalizedSearch = normalizeText(areaSearch);

    return activeAreas
      .filter(
        (item) =>
          !normalizedSearch ||
          normalizeText(item.name).includes(normalizedSearch),
      )
      .slice(0, 100);
  }, [activeAreas, areaSearch]);

  const filteredAdminRecipients = useMemo(() => {
    const normalizedSearch = normalizeText(recipientAdminSearch);

    return recipients.filter(
      (item) =>
        !normalizedSearch ||
        normalizeText(item.full_name).includes(normalizedSearch),
    );
  }, [recipients, recipientAdminSearch]);

  const filteredAdminAreas = useMemo(() => {
    const normalizedSearch = normalizeText(areaAdminSearch);

    return areas.filter(
      (item) =>
        !normalizedSearch ||
        normalizeText(item.name).includes(normalizedSearch),
    );
  }, [areas, areaAdminSearch]);

  const completedRows = useMemo(
    () => rows.filter((row) => row.product_id && Number(row.quantity) > 0).length,
    [rows],
  );
  const totalQuantity = useMemo(
    () => rows.reduce((total, row) => total + (Number(row.quantity) || 0), 0),
    [rows],
  );

  const getProductById = (productId: string) =>
    products.find((product) => product.product_id === productId) ?? null;

  const updateRow = (rowId: string, field: keyof Omit<DeliveryRow, "id">, value: string) => {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row;
        if (field === "category_id") {
          const currentProduct = getProductById(row.product_id);
          return {
            ...row,
            category_id: value,
            product_id:
              value === ALL_CATEGORIES || currentProduct?.category_id === value
                ? row.product_id
                : "",
          };
        }
        return { ...row, [field]: value };
      }),
    );
    if (formError) setFormError(null);
  };

  const addRow = () => setRows((current) => [...current, createEmptyRow()]);
  const removeRow = (rowId: string) =>
    setRows((current) =>
      current.length === 1 ? [createEmptyRow()] : current.filter((row) => row.id !== rowId),
    );

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
          ? { ...row, category_id: product.category_id, product_id: product.product_id }
          : row,
      ),
    );
    setProductDialogOpen(false);
    setSelectingRowId(null);
    setProductSearch("");
    setFormError(null);
  };

  const handleCreateRecipient = async (event: FormEvent) => {
    event.preventDefault();
    const fullName = newRecipientName.trim();
    if (!fullName) return setRecipientError("El nombre es requerido.");
    if (recipients.some((item) => normalizeText(item.full_name) === normalizeText(fullName))) {
      return setRecipientError("Esa persona ya está registrada.");
    }
    setSavingRecipient(true);
    setRecipientError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("supply_recipients")
        .insert({ full_name: fullName, active: true, created_by: userId })
        .select("id, full_name, active")
        .single();
      if (error) throw error;
      const created = data as Recipient;
      setRecipients((current) => [...current, created].sort((a, b) => a.full_name.localeCompare(b.full_name, "es")));
      setRecipientId(created.id);
      setRecipientDialogOpen(false);
      setNewRecipientName("");
      showToast("success", `Persona “${created.full_name}” creada y seleccionada.`);
    } catch (error) {
      setRecipientError(error instanceof Error ? error.message : "No se pudo crear la persona.");
    } finally {
      setSavingRecipient(false);
    }
  };

  const handleCreateArea = async (event: FormEvent) => {
    event.preventDefault();
    const name = newAreaName.trim();
    if (!name) return setAreaError("El nombre del área es requerido.");
    if (areas.some((item) => normalizeText(item.name) === normalizeText(name))) {
      return setAreaError("Esa dirección o área ya está registrada.");
    }
    setSavingArea(true);
    setAreaError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("supply_areas")
        .insert({ name, active: true, created_by: userId })
        .select("id, name, active")
        .single();
      if (error) throw error;
      const created = data as Area;
      setAreas((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name, "es")));
      setAreaId(created.id);
      setAreaDialogOpen(false);
      setNewAreaName("");
      showToast("success", `Área “${created.name}” creada y seleccionada.`);
    } catch (error) {
      setAreaError(error instanceof Error ? error.message : "No se pudo crear el área.");
    } finally {
      setSavingArea(false);
    }
  };

  const openEditEntity = (entity: ManagedEntity) => {
    setEditingEntity(entity);
    setEditingEntityName(entity.name);
    setEditingEntityError(null);
    setEditEntityOpen(true);
  };

  const handleEditEntity = async (event: FormEvent) => {
    event.preventDefault();

    if (!editingEntity) return;

    const name = editingEntityName.trim();

    if (!name) {
      setEditingEntityError("El nombre es requerido.");
      return;
    }

    const duplicated =
      editingEntity.type === "recipient"
        ? recipients.some(
            (item) =>
              item.id !== editingEntity.id &&
              normalizeText(item.full_name) === normalizeText(name),
          )
        : areas.some(
            (item) =>
              item.id !== editingEntity.id &&
              normalizeText(item.name) === normalizeText(name),
          );

    if (duplicated) {
      setEditingEntityError(
        editingEntity.type === "recipient"
          ? "Ya existe una persona con ese nombre."
          : "Ya existe una dirección o área con ese nombre.",
      );
      return;
    }

    setSavingEntityEdit(true);
    setEditingEntityError(null);

    try {
      const supabase = createClient();

      const table =
        editingEntity.type === "recipient"
          ? "supply_recipients"
          : "supply_areas";

      const updateData =
        editingEntity.type === "recipient"
          ? { full_name: name }
          : { name };

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq("id", editingEntity.id);

      if (error) {
        if (error.code === "23505") {
          throw new Error(
            editingEntity.type === "recipient"
              ? "Ya existe una persona con ese nombre."
              : "Ya existe una dirección o área con ese nombre.",
          );
        }

        throw error;
      }

      if (editingEntity.type === "recipient") {
        setRecipients((current) =>
          current
            .map((item) =>
              item.id === editingEntity.id
                ? { ...item, full_name: name }
                : item,
            )
            .sort((a, b) =>
              a.full_name.localeCompare(b.full_name, "es", {
                sensitivity: "base",
              }),
            ),
        );
      } else {
        setAreas((current) =>
          current
            .map((item) =>
              item.id === editingEntity.id
                ? { ...item, name }
                : item,
            )
            .sort((a, b) =>
              a.name.localeCompare(b.name, "es", {
                sensitivity: "base",
              }),
            ),
        );
      }

      setEditEntityOpen(false);
      setEditingEntity(null);
      setEditingEntityName("");
      showToast(
        "success",
        editingEntity.type === "recipient"
          ? "Persona actualizada correctamente."
          : "Dirección o área actualizada correctamente.",
      );
    } catch (error) {
      console.error("Error editando registro:", error);
      setEditingEntityError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el cambio.",
      );
    } finally {
      setSavingEntityEdit(false);
    }
  };

  const toggleEntityActive = async (entity: ManagedEntity) => {
    try {
      const supabase = createClient();

      const table =
        entity.type === "recipient"
          ? "supply_recipients"
          : "supply_areas";

      const newActiveState = !entity.active;

      const { error } = await supabase
        .from(table)
        .update({ active: newActiveState })
        .eq("id", entity.id);

      if (error) throw error;

      if (entity.type === "recipient") {
        setRecipients((current) =>
          current.map((item) =>
            item.id === entity.id
              ? { ...item, active: newActiveState }
              : item,
          ),
        );

        if (!newActiveState && recipientId === entity.id) {
          setRecipientId("");
        }
      } else {
        setAreas((current) =>
          current.map((item) =>
            item.id === entity.id
              ? { ...item, active: newActiveState }
              : item,
          ),
        );

        if (!newActiveState && areaId === entity.id) {
          setAreaId("");
        }
      }

      showToast(
        "success",
        newActiveState
          ? entity.type === "recipient"
            ? "Persona restaurada correctamente."
            : "Dirección o área restaurada correctamente."
          : entity.type === "recipient"
            ? "Persona desactivada. El historial se conservó."
            : "Dirección o área desactivada. El historial se conservó.",
      );
    } catch (error) {
      console.error("Error cambiando estado:", error);
      showToast(
        "error",
        entity.type === "recipient"
          ? "No se pudo cambiar el estado de la persona."
          : "No se pudo cambiar el estado de la dirección o área.",
      );
    }
  };

  const openDeleteEntity = (entity: ManagedEntity) => {
    setDeletingEntity(entity);
    setDeleteEntityOpen(true);
  };

  const handleDeleteEntityPermanently = async () => {
    if (!deletingEntity) return;

    setDeletingEntityPermanently(true);

    try {
      const supabase = createClient();

      const foreignKey =
        deletingEntity.type === "recipient"
          ? "recipient_id"
          : "area_id";

      const { count, error: countError } = await supabase
        .from("supply_movements")
        .select("id", { count: "exact", head: true })
        .eq(foreignKey, deletingEntity.id);

      if (countError) throw countError;

      if ((count ?? 0) > 0) {
        throw new Error(
          deletingEntity.type === "recipient"
            ? "No se puede eliminar porque la persona figura en entregas históricas. Podés dejarla inactiva."
            : "No se puede eliminar porque la dirección o área figura en entregas históricas. Podés dejarla inactiva.",
        );
      }

      const table =
        deletingEntity.type === "recipient"
          ? "supply_recipients"
          : "supply_areas";

      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq("id", deletingEntity.id);

      if (deleteError) throw deleteError;

      if (deletingEntity.type === "recipient") {
        setRecipients((current) =>
          current.filter((item) => item.id !== deletingEntity.id),
        );

        if (recipientId === deletingEntity.id) {
          setRecipientId("");
        }
      } else {
        setAreas((current) =>
          current.filter((item) => item.id !== deletingEntity.id),
        );

        if (areaId === deletingEntity.id) {
          setAreaId("");
        }
      }

      setDeleteEntityOpen(false);
      showToast(
        "success",
        deletingEntity.type === "recipient"
          ? "Persona eliminada definitivamente."
          : "Dirección o área eliminada definitivamente.",
      );
      setDeletingEntity(null);
    } catch (error) {
      console.error("Error eliminando registro:", error);
      showToast(
        "error",
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el registro.",
      );
      setDeleteEntityOpen(false);
      setDeletingEntity(null);
    } finally {
      setDeletingEntityPermanently(false);
    }
  };

  const validateForm = () => {
    if (!movementDate) return "La fecha es requerida.";
    if (!recipientId) return "Seleccioná la persona autorizada.";
    if (!areaId) return "Seleccioná la dirección o área.";

    const usableRows = rows.filter(
      (row) => row.product_id || row.quantity.trim() !== "" || row.observation.trim() !== "",
    );
    if (usableRows.length === 0) return "Agregá al menos un producto.";

    for (let index = 0; index < usableRows.length; index += 1) {
      const row = usableRows[index];
      const rowNumber = index + 1;
      if (!row.product_id) return `Seleccioná el producto en la fila ${rowNumber}.`;
      const quantity = Number(row.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return `Ingresá una cantidad mayor a cero en la fila ${rowNumber}.`;
      }
      const product = getProductById(row.product_id);
      const available = Math.max(0, Number(product?.current_stock ?? 0));
      if (quantity > available) {
        return `La cantidad de la fila ${rowNumber} supera el stock disponible de “${product?.product_name ?? "ese producto"}” (${formatQuantity(available)} ${product?.unit ?? ""}).`;
      }
    }

    const ids = usableRows.map((row) => row.product_id);
    if (new Set(ids).size !== ids.length) return "No repitas el mismo producto dentro de una entrega.";
    return null;
  };

  const resetForm = () => {
    setMovementDate(getLocalDate());
    setRecipientId("");
    setAreaId("");
    setRecipientSearch("");
    setAreaSearch("");
    setRecipientSelectorOpen(false);
    setAreaSelectorOpen(false);
    setGeneralObservations("");
    setRows([createEmptyRow()]);
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isReadonly) return showToast("error", "Tu cuenta es de solo lectura y no puede registrar entregas.");
    const validationError = validateForm();
    if (validationError) return setFormError(validationError);

    const usableRows = rows.filter((row) => row.product_id && Number(row.quantity) > 0);
    setSaving(true);
    setFormError(null);

    try {
      const supabase = createClient();
      const operationReference = `ENTREGA_WEB_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
      const payload = usableRows.map((row) => ({
        movement_date: movementDate,
        movement_type: "DELIVERY",
        product_id: row.product_id,
        quantity: Number(row.quantity),
        recipient_id: recipientId,
        area_id: areaId,
        reference: operationReference,
        observations: [
          generalObservations.trim() ? `Observación general: ${generalObservations.trim()}` : "",
          row.observation.trim() ? `Observación del producto: ${row.observation.trim()}` : "",
        ].filter(Boolean).join(" | "),
        created_by: userId,
        legacy_destination: null,
      }));

      const { error } = await supabase.from("supply_movements").insert(payload);
      if (error) throw error;

      showToast(
        "success",
        usableRows.length === 1
          ? "Entrega registrada correctamente."
          : `Entrega registrada con ${usableRows.length} productos.`,
      );
      resetForm();
      await loadCatalog();
    } catch (error) {
      console.error("Error registrando entrega:", error);
      setFormError(error instanceof Error ? error.message : "No se pudo registrar la entrega.");
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
        <Button asChild variant="ghost" size="sm" className="-ml-3 w-fit">
          <Link href="/dashboard/suministros">
            <ArrowLeft className="mr-2 size-4" />
            Volver al módulo
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Registrar entrega</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Registrá productos entregados a una persona y dirección o área.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-lg">Datos de la entrega</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[220px_minmax(290px,1fr)_minmax(390px,1.25fr)_minmax(260px,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="movement-date">Fecha *</Label>
              <Input id="movement-date" type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} disabled={isReadonly || saving} />
            </div>

            <div className="space-y-2">
              <Label>Persona autorizada *</Label>
              <div className="grid grid-cols-1 gap-2">
                <div className="relative">
                  <button
                    type="button"
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      if (isReadonly || saving) return;
                      setRecipientSelectorOpen((current) => !current);
                      setAreaSelectorOpen(false);
                      setRecipientSearch("");
                    }}
                    disabled={isReadonly || saving}
                  >
                    <span className={selectedRecipient ? "truncate" : "truncate text-muted-foreground"}>
                      {selectedRecipient?.full_name ?? "Seleccionar persona"}
                    </span>
                    <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </button>

                  {recipientSelectorOpen && (
                    <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-full min-w-[300px] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
                      <div className="border-b p-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={recipientSearch} onChange={(event) => setRecipientSearch(event.target.value)} placeholder="Escribir persona..." className="pl-9" autoFocus />
                        </div>
                      </div>
                      <div className="max-h-72 overflow-y-auto p-1">
                        {filteredRecipientOptions.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">No se encontraron personas.</div>
                        ) : (
                          filteredRecipientOptions.map((item) => (
                            <button key={item.id} type="button" className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setRecipientId(item.id); setRecipientSelectorOpen(false); setRecipientSearch(""); setFormError(null); }}>
                              <span className="truncate">{item.full_name}</span>
                              {recipientId === item.id && <Check className="size-4 shrink-0 text-emerald-600" />}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {!isReadonly && (
                <div className="flex flex-wrap items-center gap-2 pt-1 xl:flex-nowrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-full px-3 text-xs"
                    onClick={() => {
                      setNewRecipientName("");
                      setRecipientError(null);
                      setRecipientDialogOpen(true);
                    }}
                  >
                    <UserPlus className="mr-1.5 size-4" />
                    Nueva persona
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-full px-3 text-xs"
                    onClick={() => {
                      setRecipientAdminSearch("");
                      setManageRecipientsOpen(true);
                    }}
                  >
                    <Settings2 className="mr-1.5 size-4" />
                    Administrar personas
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Dirección o área *</Label>
              <div className="grid grid-cols-1 gap-2">
                <div className="relative">
                  <button
                    type="button"
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      if (isReadonly || saving) return;
                      setAreaSelectorOpen((current) => !current);
                      setRecipientSelectorOpen(false);
                      setAreaSearch("");
                    }}
                    disabled={isReadonly || saving}
                  >
                    <span className={selectedArea ? "truncate" : "truncate text-muted-foreground"}>
                      {selectedArea?.name ?? "Seleccionar área"}
                    </span>
                    <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </button>

                  {areaSelectorOpen && (
                    <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-full min-w-[300px] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
                      <div className="border-b p-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={areaSearch} onChange={(event) => setAreaSearch(event.target.value)} placeholder="Escribir dirección o área..." className="pl-9" autoFocus />
                        </div>
                      </div>
                      <div className="max-h-72 overflow-y-auto p-1">
                        {filteredAreaOptions.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">No se encontraron direcciones o áreas.</div>
                        ) : (
                          filteredAreaOptions.map((item) => (
                            <button key={item.id} type="button" className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setAreaId(item.id); setAreaSelectorOpen(false); setAreaSearch(""); setFormError(null); }}>
                              <span className="truncate">{item.name}</span>
                              {areaId === item.id && <Check className="size-4 shrink-0 text-emerald-600" />}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {!isReadonly && (
                <div className="flex flex-wrap items-center gap-2 pt-1 xl:flex-nowrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-full px-3 text-xs"
                    onClick={() => {
                      setNewAreaName("");
                      setAreaError(null);
                      setAreaDialogOpen(true);
                    }}
                  >
                    <Building2 className="mr-1.5 size-4" />
                    Nueva área / dirección
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-full px-3 text-xs"
                    onClick={() => {
                      setAreaAdminSearch("");
                      setManageAreasOpen(true);
                    }}
                  >
                    <Settings2 className="mr-1.5 size-4" />
                    Administrar áreas / direcciones
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="general-observations">Observación general</Label>
              <Input id="general-observations" value={generalObservations} onChange={(e) => setGeneralObservations(e.target.value)} placeholder="Opcional" disabled={isReadonly || saving} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Productos entregados</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Podés registrar varios productos en una sola entrega.</p>
            </div>
            {!isReadonly && <Button type="button" variant="outline" onClick={addRow} disabled={saving}><Plus className="mr-2 size-4" />Agregar producto</Button>}
          </CardHeader>

          <CardContent className="space-y-4">
            {rows.map((row, index) => {
              const selectedProduct = getProductById(row.product_id);
              const availableStock = Math.max(0, Number(selectedProduct?.current_stock ?? 0));
              return (
                <div key={row.id} className="rounded-2xl border p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="font-medium">Producto {index + 1}</p>
                    {!isReadonly && <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(row.id)} disabled={saving}><Trash2 className="size-4 text-destructive" /></Button>}
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(260px,1fr)_150px_minmax(200px,1fr)]">
                    <div className="space-y-2">
                      <Label>Categoría</Label>
                      <Select value={row.category_id} onValueChange={(value) => updateRow(row.id, "category_id", value)} disabled={isReadonly || saving}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_CATEGORIES}>Todas las categorías</SelectItem>
                          {categories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Producto *</Label>
                      <Button type="button" variant="outline" className="h-10 w-full justify-start overflow-hidden font-normal" onClick={() => openProductDialog(row.id)} disabled={isReadonly || saving}>
                        <Search className="mr-2 size-4 shrink-0" />
                        <span className="truncate">{selectedProduct ? selectedProduct.product_name : "Buscar y seleccionar producto"}</span>
                      </Button>
                      {selectedProduct && <p className="text-xs text-muted-foreground">Disponible: {formatQuantity(availableStock)} {selectedProduct.unit}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`quantity-${row.id}`}>Cantidad *</Label>
                      <Input id={`quantity-${row.id}`} type="number" min="0.01" max={availableStock} step="0.01" value={row.quantity} onChange={(e) => updateRow(row.id, "quantity", e.target.value)} placeholder="0" disabled={isReadonly || saving} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`observation-${row.id}`}>Observación</Label>
                      <Input id={`observation-${row.id}`} value={row.observation} onChange={(e) => updateRow(row.id, "observation", e.target.value)} placeholder="Opcional" disabled={isReadonly || saving} />
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
              <div><p className="text-sm text-muted-foreground">Productos completos</p><p className="mt-1 text-xl font-bold">{completedRows}</p></div>
              <div><p className="text-sm text-muted-foreground">Cantidad total</p><p className="mt-1 text-xl font-bold">{formatQuantity(totalQuantity)}</p></div>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving || isReadonly}>Limpiar formulario</Button>
              <Button type="submit" disabled={saving || isReadonly}>{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <PackageCheck className="mr-2 size-4" />}{saving ? "Registrando..." : "Registrar entrega"}</Button>
            </div>
          </CardContent>
        </Card>

        {formError && <Card className="border-destructive/40"><CardContent className="py-4 text-sm text-destructive">{formError}</CardContent></Card>}
      </form>

      <Dialog open={productDialogOpen} onOpenChange={(open) => { setProductDialogOpen(open); if (!open) { setSelectingRowId(null); setProductSearch(""); } }}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-[650px]">
          <DialogHeader><DialogTitle>Seleccionar producto</DialogTitle><DialogDescription>Buscá por nombre. Los productos sin existencias aparecen deshabilitados.</DialogDescription></DialogHeader>
          <div className="space-y-4 overflow-hidden">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar producto o categoría..." className="pl-9" autoFocus /></div>
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {filteredDialogProducts.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No se encontraron productos.</div> : filteredDialogProducts.map((product) => {
                const stock = Math.max(0, Number(product.current_stock));
                return <button key={product.product_id} type="button" className="flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => selectProduct(product)} disabled={stock <= 0}><span className="font-medium">{product.product_name}</span><span className="text-xs text-muted-foreground">{product.category_name} · Disponible: {formatQuantity(stock)} {product.unit}</span></button>;
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={recipientDialogOpen} onOpenChange={(open) => { if (!savingRecipient) { setRecipientDialogOpen(open); if (!open) { setNewRecipientName(""); setRecipientError(null); } } }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader><DialogTitle>Nueva persona autorizada</DialogTitle><DialogDescription>La persona quedará disponible para futuras entregas.</DialogDescription></DialogHeader>
          <form onSubmit={handleCreateRecipient} className="space-y-5">
            <div className="space-y-2"><Label htmlFor="new-recipient-name">Nombre completo *</Label><Input id="new-recipient-name" value={newRecipientName} onChange={(e) => { setNewRecipientName(e.target.value); setRecipientError(null); }} placeholder="Nombre y apellido" autoFocus />{recipientError && <p className="text-sm text-destructive">{recipientError}</p>}</div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setRecipientDialogOpen(false)} disabled={savingRecipient}>Cancelar</Button><Button type="submit" disabled={savingRecipient}>{savingRecipient && <Loader2 className="mr-2 size-4 animate-spin" />}Crear persona</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={areaDialogOpen} onOpenChange={(open) => { if (!savingArea) { setAreaDialogOpen(open); if (!open) { setNewAreaName(""); setAreaError(null); } } }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader><DialogTitle>Nueva dirección o área</DialogTitle><DialogDescription>La opción quedará disponible para futuras entregas.</DialogDescription></DialogHeader>
          <form onSubmit={handleCreateArea} className="space-y-5">
            <div className="space-y-2"><Label htmlFor="new-area-name">Nombre de la dirección o área *</Label><Input id="new-area-name" value={newAreaName} onChange={(e) => { setNewAreaName(e.target.value); setAreaError(null); }} placeholder="Ejemplo: Barrido" autoFocus />{areaError && <p className="text-sm text-destructive">{areaError}</p>}</div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setAreaDialogOpen(false)} disabled={savingArea}>Cancelar</Button><Button type="submit" disabled={savingArea}>{savingArea && <Loader2 className="mr-2 size-4 animate-spin" />}Crear área</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={manageRecipientsOpen}
        onOpenChange={setManageRecipientsOpen}
      >
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>Administrar personas autorizadas</DialogTitle>
            <DialogDescription>
              Editá, desactivá, restaurá o eliminá personas que nunca hayan sido usadas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={recipientAdminSearch}
                onChange={(event) =>
                  setRecipientAdminSearch(event.target.value)
                }
                placeholder="Buscar persona..."
                className="pl-9"
              />
            </div>

            <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
              {filteredAdminRecipients.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No se encontraron personas.
                </div>
              ) : (
                filteredAdminRecipients.map((item) => {
                  const entity: ManagedEntity = {
                    id: item.id,
                    name: item.full_name,
                    active: item.active,
                    type: "recipient",
                  };

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {item.full_name}
                        </p>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs ${
                            item.active
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.active ? "Activa" : "Inactiva"}
                        </span>
                      </div>

                      <div className="flex shrink-0 justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Editar"
                          onClick={() => openEditEntity(entity)}
                        >
                          <Pencil className="size-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title={item.active ? "Desactivar" : "Restaurar"}
                          onClick={() => void toggleEntityActive(entity)}
                        >
                          {item.active ? (
                            <X className="size-4 text-amber-600" />
                          ) : (
                            <RotateCcw className="size-4 text-emerald-600" />
                          )}
                        </Button>

                        {!item.active && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Eliminar definitivamente"
                            onClick={() => openDeleteEntity(entity)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manageAreasOpen} onOpenChange={setManageAreasOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>Administrar direcciones y áreas</DialogTitle>
            <DialogDescription>
              Editá, desactivá, restaurá o eliminá opciones que nunca hayan sido usadas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={areaAdminSearch}
                onChange={(event) => setAreaAdminSearch(event.target.value)}
                placeholder="Buscar dirección o área..."
                className="pl-9"
              />
            </div>

            <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
              {filteredAdminAreas.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No se encontraron direcciones o áreas.
                </div>
              ) : (
                filteredAdminAreas.map((item) => {
                  const entity: ManagedEntity = {
                    id: item.id,
                    name: item.name,
                    active: item.active,
                    type: "area",
                  };

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.name}</p>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs ${
                            item.active
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.active ? "Activa" : "Inactiva"}
                        </span>
                      </div>

                      <div className="flex shrink-0 justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Editar"
                          onClick={() => openEditEntity(entity)}
                        >
                          <Pencil className="size-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title={item.active ? "Desactivar" : "Restaurar"}
                          onClick={() => void toggleEntityActive(entity)}
                        >
                          {item.active ? (
                            <X className="size-4 text-amber-600" />
                          ) : (
                            <RotateCcw className="size-4 text-emerald-600" />
                          )}
                        </Button>

                        {!item.active && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Eliminar definitivamente"
                            onClick={() => openDeleteEntity(entity)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editEntityOpen}
        onOpenChange={(open) => {
          if (!savingEntityEdit) {
            setEditEntityOpen(open);

            if (!open) {
              setEditingEntity(null);
              setEditingEntityName("");
              setEditingEntityError(null);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingEntity?.type === "recipient"
                ? "Editar persona"
                : "Editar dirección o área"}
            </DialogTitle>
            <DialogDescription>
              El cambio también se verá en los registros históricos relacionados.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditEntity} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="managed-entity-name">Nombre *</Label>
              <Input
                id="managed-entity-name"
                value={editingEntityName}
                onChange={(event) => {
                  setEditingEntityName(event.target.value);
                  setEditingEntityError(null);
                }}
                autoFocus
              />

              {editingEntityError && (
                <p className="text-sm text-destructive">
                  {editingEntityError}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditEntityOpen(false)}
                disabled={savingEntityEdit}
              >
                Cancelar
              </Button>

              <Button type="submit" disabled={savingEntityEdit}>
                {savingEntityEdit && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Guardar cambios
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteEntityOpen}
        onOpenChange={(open) => {
          if (!deletingEntityPermanently) {
            setDeleteEntityOpen(open);

            if (!open) {
              setDeletingEntity(null);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Eliminar definitivamente</DialogTitle>
            <DialogDescription className="leading-6">
              Se intentará eliminar “{deletingEntity?.name ?? ""}”. Esta acción
              solo se permite si nunca fue utilizada en una entrega. Si tiene
              historial, deberá permanecer inactiva.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteEntityOpen(false)}
              disabled={deletingEntityPermanently}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteEntityPermanently()}
              disabled={deletingEntityPermanently}
            >
              {deletingEntityPermanently && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Eliminar definitivamente
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {toast && <div className="fixed bottom-5 right-5 z-[100] w-[calc(100%-2.5rem)] max-w-sm"><div className={`flex items-start gap-3 rounded-2xl border bg-background p-4 shadow-lg ${toast.type === "success" ? "border-emerald-500/40" : "border-destructive/40"}`}>{toast.type === "success" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />}<p className={`flex-1 text-sm leading-5 ${toast.type === "success" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>{toast.message}</p><Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-2 size-8 shrink-0" onClick={() => setToast(null)}><X className="size-4" /></Button></div></div>}
    </div>
  );
}
