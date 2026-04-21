"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FC_SECTOR_LABELS: Record<string, string> = {
  ana: "FC - ANA",
  arbolado: "FC - ARBOLADO",
  secretaria: "FC - SECRETARÍA",
  suministros: "FC - SUMINISTROS",
  zv: "FC - ZOONOSIS Y VECTORES",
  sp: "FC - SERVICIOS PÚBLICOS",
  girsu: "FC - GIRSU",
};

type PurchaseRequest = {
  id: string;
  sector: string;
  fc_date: string | null;
  fc_number: string | null;
  supplier_name: string | null;
  cuit: string | null;
  dependency: string | null;
  expense_type: string | null;
  code: string | null;
  affectation: string | null;
  amount: number | null;
  invoice_date: string | null;
  invoice_number: string | null;
  detail: string | null;
  memo: string | null;
  extra_data: Record<string, unknown> | null;
};

type ProviderOption = {
  id: string;
  cuit: string;
  name: string;
};

type FiltersState = {
  cuit: string;
  supplier: string;
  month: string;
  expense_type: string;
  sort: "asc" | "desc";
};

const ARBOLADO_EXPENSE_TYPES = ["32", "21", "51"];
const ARBOLADO_CODES = [
  "1",
  "2",
  "3",
  "4",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "20",
  "21",
  "28",
  "30",
  "33",
  "35",
  "36",
  "39",
  "52",
  "99",
];
const ARBOLADO_CATEGORIES = [
  "Mantenimiento de espacios verdes",
  "Mantenimiento de arbolado",
  "Insumos",
  "Bienes de capital",
  "Varios",
  "RNU Delfin Perez",
  "Disfruta Pico",
  "Administracion y Gestion",
];

function normalizeCuit(value: string) {
  return value.replace(/\D/g, "").trim();
}

function formatDateForInput(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function formatDateDisplay(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function FCSectorPage() {
  const params = useParams<{ sector: string }>();
  const sector = params?.sector ?? "";
  const lookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [items, setItems] = useState<PurchaseRequest[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lookingUpProvider, setLookingUpProvider] = useState(false);
  const [providerLookupMessage, setProviderLookupMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
    limit: 20,
  });

  const [totals, setTotals] = useState<Record<string, number>>({
    "32": 0,
    "21": 0,
    "51": 0,
  });

  // Selector independiente para las tarjetas
  const [cardsMonth, setCardsMonth] = useState(getCurrentMonth());

  const [filters, setFilters] = useState<FiltersState>({
    cuit: "",
    supplier: "",
    month: "",
    expense_type: "",
    sort: "desc",
  });

  const [form, setForm] = useState({
    fc_date: "",
    fc_number: "",
    cuit: "",
    supplier_name: "",
    dependency: "53",
    expense_type: "",
    code: "",
    affectation: "",
    amount: "",
    invoice_date: "",
    invoice_number: "",
    category: "",
    detail: "",
    memo: "",
  });

  useEffect(() => {
    if (sector) {
      fetchItems();
      fetchProviders();
    }
  }, [sector, page, filters, cardsMonth]);

  useEffect(() => {
    const cuit = normalizeCuit(form.cuit);

    if (lookupTimeoutRef.current) {
      clearTimeout(lookupTimeoutRef.current);
    }

    if (cuit.length !== 11) {
      setProviderLookupMessage("");
      return;
    }

    lookupTimeoutRef.current = setTimeout(() => {
      lookupProviderByCuit(cuit);
    }, 350);

    return () => {
      if (lookupTimeoutRef.current) {
        clearTimeout(lookupTimeoutRef.current);
      }
    };
  }, [form.cuit]);

  const fetchItems = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      params.set("sector", sector);
      params.set("page", String(page));
      params.set("limit", "20");
      params.set("sort", filters.sort);
      params.set("card_month", cardsMonth);

      if (filters.cuit) params.set("cuit", filters.cuit);
      if (filters.supplier) params.set("supplier", filters.supplier);
      if (filters.month) params.set("month", filters.month);
      if (filters.expense_type) {
        params.set("expense_type", filters.expense_type);
      }

      const response = await fetch(
        `/api/purchase-requests?${params.toString()}`,
        {
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al cargar FC");
      }

      setItems(result.data || []);
      setTotals(
        result.totals || {
          "32": 0,
          "21": 0,
          "51": 0,
        },
      );
      setPagination(
        result.pagination || {
          total: 0,
          totalPages: 1,
          limit: 20,
        },
      );
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar formularios de compra");
    } finally {
      setLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await fetch("/api/providers", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al cargar proveedores");
      }

      setProviders(result.data || []);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar proveedores");
    }
  };

  const lookupProviderByCuit = async (cuit: string) => {
    try {
      setLookingUpProvider(true);
      setProviderLookupMessage("");

      const response = await fetch(
        `/api/providers?cuit=${encodeURIComponent(cuit)}`,
        {
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al buscar proveedor");
      }

      if (!result.data?.name) {
        setProviderLookupMessage(
          "CUIT no encontrado. Podés escribir el proveedor manualmente.",
        );
        return;
      }

      const provider: ProviderOption = {
        id: result.data.id ?? `temp-${result.data.cuit}`,
        cuit: result.data.cuit,
        name: result.data.name,
      };

      setProviders((prev) => {
        const alreadyExists = prev.some(
          (item) =>
            normalizeCuit(item.cuit) === normalizeCuit(provider.cuit) ||
            item.name.toLowerCase() === provider.name.toLowerCase(),
        );

        if (alreadyExists) return prev;
        return [provider, ...prev];
      });

      setForm((prev) => ({
        ...prev,
        cuit: provider.cuit,
        supplier_name: provider.name,
      }));

      setProviderLookupMessage(
        result.source === "database"
          ? "Proveedor encontrado en base."
          : "Proveedor encontrado automáticamente por CUIT.",
      );
    } catch (error) {
      console.error(error);
      setProviderLookupMessage("No se pudo verificar el CUIT.");
    } finally {
      setLookingUpProvider(false);
    }
  };

  const filteredProviders = useMemo(() => {
    const normalizedCuit = normalizeCuit(form.cuit);

    if (!normalizedCuit) return providers;

    const exactMatches = providers.filter(
      (provider) => normalizeCuit(provider.cuit) === normalizedCuit,
    );

    if (exactMatches.length > 0) return exactMatches;

    return providers.filter((provider) =>
      normalizeCuit(provider.cuit).includes(normalizedCuit),
    );
  }, [providers, form.cuit]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    }).format(value);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      dependency: sector === "arbolado" ? "53" : prev.dependency,
    }));

    if (field === "cuit") {
      setProviderLookupMessage("");
    }
  };

  const handleSupplierInputChange = (value: string) => {
    const selectedProvider = providers.find(
      (provider) => provider.name.toLowerCase() === value.toLowerCase(),
    );

    setForm((prev) => ({
      ...prev,
      supplier_name: value,
      cuit: selectedProvider ? selectedProvider.cuit : prev.cuit,
    }));
  };

  const resetForm = () => {
    setForm({
      fc_date: "",
      fc_number: "",
      cuit: "",
      supplier_name: "",
      dependency: "53",
      expense_type: "",
      code: "",
      affectation: "",
      amount: "",
      invoice_date: "",
      invoice_number: "",
      category: "",
      detail: "",
      memo: "",
    });
    setEditingId(null);
    setProviderLookupMessage("");
  };

  const resetFilters = () => {
    setFilters({
      cuit: "",
      supplier: "",
      expense_type: "",
      month: "",
      sort: "desc",
    });
    setPage(1);
  };

  const handleEdit = (item: PurchaseRequest) => {
    const category =
      item.extra_data &&
      typeof item.extra_data === "object" &&
      "category" in item.extra_data
        ? String(item.extra_data.category ?? "")
        : "";

    setEditingId(item.id);
    setForm({
      fc_date: formatDateForInput(item.fc_date),
      fc_number: item.fc_number || "",
      cuit: item.cuit || "",
      supplier_name: item.supplier_name || "",
      dependency: "53",
      expense_type: item.expense_type || "",
      code: item.code || "",
      affectation: item.affectation || "",
      amount: item.amount ? String(item.amount) : "",
      invoice_date: formatDateForInput(item.invoice_date),
      invoice_number: item.invoice_number || "",
      category,
      detail: item.detail || "",
      memo: item.memo || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("¿Querés eliminar este FC?");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/purchase-requests/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al eliminar FC");
      }

      toast.success("FC eliminado correctamente");
      await fetchItems();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Error al eliminar FC",
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !form.fc_date ||
      !form.fc_number ||
      !form.supplier_name ||
      !form.amount
    ) {
      toast.error("Completá los campos obligatorios");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        sector,
        form_variant: sector === "arbolado" ? "arbolado" : "standard",
        fc_date: form.fc_date,
        fc_number: form.fc_number,
        supplier_name: form.supplier_name,
        cuit: normalizeCuit(form.cuit),
        dependency: "53",
        expense_type: form.expense_type,
        code: form.code,
        affectation: form.affectation,
        amount: form.amount,
        invoice_date: form.invoice_date,
        invoice_number: form.invoice_number,
        detail: form.detail,
        memo: form.memo,
        extra_data: {
          category: form.category,
        },
      };

      const response = await fetch(
        editingId
          ? `/api/purchase-requests/${editingId}`
          : "/api/purchase-requests",
        {
          method: editingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al guardar FC");
      }

      toast.success(
        editingId
          ? "FC actualizado correctamente"
          : "FC cargado correctamente",
      );
      resetForm();
      await fetchItems();
      await fetchProviders();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Error al guardar FC",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {FC_SECTOR_LABELS[sector] || "Formularios de Compra"}
        </h1>
        <p className="mt-2 text-muted-foreground">Carga y control del sector.</p>
      </div>

      {sector === "arbolado" && (
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <CardTitle>Totales por tipo de gasto</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Calculados según mes de factura.
                </p>
              </div>

              <div className="w-full md:w-[260px]">
                <label className="mb-1 block text-sm font-medium">
                  Mes de gastos
                </label>
                <Input
                  type="month"
                  value={cardsMonth}
                  onChange={(e) => setCardsMonth(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {ARBOLADO_EXPENSE_TYPES.map((type) => (
                <Card key={type}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      Tipo de gasto {type}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(totals[type] || 0)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Editar FC" : "Nuevo FC"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <div>
              <label className="mb-1 block text-sm font-medium">
                Fecha de FC *
              </label>
              <Input
                type="date"
                value={form.fc_date}
                onChange={(e) => handleChange("fc_date", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">N° FC *</label>
              <Input
                value={form.fc_number}
                onChange={(e) => handleChange("fc_number", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">CUIT</label>
              <Input
                value={form.cuit}
                onChange={(e) => handleChange("cuit", e.target.value)}
                placeholder="Ingresá CUIT"
              />
              {lookingUpProvider && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Buscando proveedor...
                </p>
              )}
              {!lookingUpProvider && providerLookupMessage && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {providerLookupMessage}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Proveedor *
              </label>
              <Input
                list="providers-list"
                value={form.supplier_name}
                onChange={(e) => handleSupplierInputChange(e.target.value)}
                placeholder="Seleccioná o escribí proveedor"
              />
              <datalist id="providers-list">
                {filteredProviders.map((provider) => (
                  <option key={provider.id} value={provider.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Dependencia
              </label>
              <Input value="53" disabled />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Tipo de gasto
              </label>
              <Select
                value={form.expense_type}
                onValueChange={(value) => handleChange("expense_type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná tipo de gasto" />
                </SelectTrigger>
                <SelectContent>
                  {ARBOLADO_EXPENSE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Código</label>
              <Select
                value={form.code}
                onValueChange={(value) => handleChange("code", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná código" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {ARBOLADO_CODES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Afectación
              </label>
              <Input
                value={form.affectation}
                onChange={(e) => handleChange("affectation", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Importe *</label>
              <Input
                value={form.amount}
                onChange={(e) => handleChange("amount", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Fecha de factura
              </label>
              <Input
                type="date"
                value={form.invoice_date}
                onChange={(e) => handleChange("invoice_date", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                N° Factura
              </label>
              <Input
                value={form.invoice_number}
                onChange={(e) => handleChange("invoice_number", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Rubro</label>
              <Select
                value={form.category}
                onValueChange={(value) => handleChange("category", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná rubro" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {ARBOLADO_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="xl:col-span-2">
              <label className="mb-1 block text-sm font-medium">Detalle</label>
              <Input
                value={form.detail}
                onChange={(e) => handleChange("detail", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">N° Memo</label>
              <Input
                value={form.memo}
                onChange={(e) => handleChange("memo", e.target.value)}
              />
            </div>

            <div className="xl:col-span-4 flex justify-end gap-2">
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar edición
                </Button>
              )}
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Guardando..."
                  : editingId
                    ? "Actualizar FC"
                    : "Guardar FC"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de FC</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Filtros</h3>
                <p className="text-xs text-muted-foreground">
                  Buscá y ordená los formularios cargados.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="space-y-1">
                <label className="text-sm font-medium">CUIT</label>
                <Input
                  placeholder="Ej: 30712409742"
                  value={filters.cuit}
                  onChange={(e) => {
                    setPage(1);
                    setFilters((prev) => ({ ...prev, cuit: e.target.value }));
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Proveedor</label>
                <Input
                  placeholder="Nombre del proveedor"
                  value={filters.supplier}
                  onChange={(e) => {
                    setPage(1);
                    setFilters((prev) => ({
                      ...prev,
                      supplier: e.target.value,
                    }));
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Mes de Factura</label>
                <Input
                  type="month"
                  value={filters.month}
                  onChange={(e) => {
                    setPage(1);
                    setFilters((prev) => ({ ...prev, month: e.target.value }));
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Tipo de gasto</label>
                <Select
                  value={filters.expense_type || "all"}
                  onValueChange={(value) => {
                    setPage(1);
                    setFilters((prev) => ({
                      ...prev,
                      expense_type: value === "all" ? "" : value,
                    }));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    {ARBOLADO_EXPENSE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        Tipo {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Ordenar por fecha</label>
                <Select
                  value={filters.sort}
                  onValueChange={(value: "asc" | "desc") => {
                    setPage(1);
                    setFilters((prev) => ({ ...prev, sort: value }));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar orden" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Más reciente primero</SelectItem>
                    <SelectItem value="asc">Más antiguo primero</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={resetFilters}
                >
                  Limpiar filtros
                </Button>
              </div>
            </div>

            {(filters.cuit ||
              filters.supplier ||
              filters.month ||
              filters.expense_type) && (
              <div className="flex flex-wrap gap-2">
                {filters.cuit && (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs">
                    CUIT: {filters.cuit}
                  </span>
                )}
                {filters.supplier && (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs">
                    Proveedor: {filters.supplier}
                  </span>
                )}
                {filters.month && (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs">
                    Mes de factura: {filters.month}
                  </span>
                )}
                {filters.expense_type && (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs">
                    Tipo de gasto: {filters.expense_type}
                  </span>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="py-8 text-sm text-muted-foreground">
              Cargando registros...
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-sm text-muted-foreground">
              No hay registros cargados todavía.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1350px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">N° FC</th>
                      <th className="px-3 py-2">Proveedor</th>
                      <th className="px-3 py-2">Dependencia</th>
                      <th className="px-3 py-2">Tipo gasto</th>
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Afectación</th>
                      <th className="px-3 py-2">Importe</th>
                      <th className="px-3 py-2">Fecha factura</th>
                      <th className="px-3 py-2">N° Factura</th>
                      <th className="px-3 py-2">Rubro</th>
                      <th className="px-3 py-2">Detalle</th>
                      <th className="px-3 py-2">Memo</th>
                      <th className="px-3 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const category =
                        item.extra_data &&
                        typeof item.extra_data === "object" &&
                        "category" in item.extra_data
                          ? String(item.extra_data.category ?? "")
                          : "";

                      return (
                        <tr
                          key={item.id}
                          className="border-b odd:bg-muted/30 even:bg-background hover:bg-muted/50"
                        >
                          <td className="px-3 py-2">
                            {formatDateDisplay(item.fc_date)}
                          </td>
                          <td className="px-3 py-2">{item.fc_number || ""}</td>
                          <td className="px-3 py-2">
                            {item.supplier_name || ""}
                          </td>
                          <td className="px-3 py-2">
                            {item.dependency || ""}
                          </td>
                          <td className="px-3 py-2">
                            {item.expense_type || ""}
                          </td>
                          <td className="px-3 py-2">{item.code || ""}</td>
                          <td className="px-3 py-2">
                            {item.affectation || ""}
                          </td>
                          <td className="px-3 py-2">
                            {formatCurrency(Number(item.amount || 0))}
                          </td>
                          <td className="px-3 py-2">
                            {formatDateDisplay(item.invoice_date)}
                          </td>
                          <td className="px-3 py-2">
                            {item.invoice_number || ""}
                          </td>
                          <td className="px-3 py-2">{category}</td>
                          <td className="px-3 py-2">{item.detail || ""}</td>
                          <td className="px-3 py-2">{item.memo || ""}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(item)}
                              >
                                Editar
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(item.id)}
                              >
                                Eliminar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Página {page} de {pagination.totalPages} · {pagination.total}{" "}
                  registros
                </p>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => prev - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((prev) => prev + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}