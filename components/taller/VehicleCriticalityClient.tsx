"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { WorkOrder } from "@/types";
import { VEHICLE_OPTIONS } from "@/lib/taller/options";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  Gauge,
  Loader2,
  Pencil,
  RefreshCcw,
  Search,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";

type VehicleCriticalityStatus = "BUENO" | "REGULAR" | "MALO" | "SIN DATOS";

type VehicleCriticalitySetting = {
  id: string;
  vehicle_code: string;
  vehicle: string | null;
  license_plate: string | null;
  service_criticality: number | null;
  replacement_score: number | null;
  security_score: number | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

type VehicleCriticalityRow = {
  vehicle_code: string;
  vehicle: string;
  license_plate: string;
  work_orders_count: number;
  mechanical_reliability_score: number;
  service_criticality: number;
  replacement_score: number;
  security_score: number;
  total_criticality: number;
  notes: string;
  status_label: VehicleCriticalityStatus;
};

type EditingValues = {
  replacement_score: string;
  notes: string;
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const toNumber = (value: unknown) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return 0;

  return numberValue;
};

const getVehicleFromCode = (vehicleCode?: string | null) => {
  if (!vehicleCode) return null;

  return VEHICLE_OPTIONS.find(
    (item) => normalizeText(item.code) === normalizeText(vehicleCode),
  );
};

const getVehicleLabelFromOrder = (order?: WorkOrder | null) => {
  if (!order) return "-";

  if (order.vehicle && order.vehicle.trim()) return order.vehicle;

  const matchedVehicle = getVehicleFromCode(order.vehicle_code);
  return matchedVehicle?.vehicle || "-";
};

const getLicensePlateLabelFromOrder = (order?: WorkOrder | null) => {
  if (!order) return "-";

  if (order.license_plate && order.license_plate.trim()) {
    return order.license_plate;
  }

  const matchedVehicle = getVehicleFromCode(order.vehicle_code);
  return matchedVehicle?.licensePlate || "-";
};

const getSixMonthsAgo = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  date.setHours(0, 0, 0, 0);

  return date;
};

const getDateValue = (dateString?: string | null) => {
  if (!dateString) return null;

  const [year, month, day] = dateString.split("-").map(Number);

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) return null;

  return date;
};

const getMechanicalReliabilityScore = (count: number) => {
  if (count <= 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  if (count <= 12) return 4;
  return 5;
};

const getCriticalityStatus = (
  criticality: number,
  hasAnyCriticalityData = true,
): VehicleCriticalityStatus => {
  if (!hasAnyCriticalityData) return "SIN DATOS";

  if (criticality >= 13) return "MALO";
  if (criticality >= 10) return "REGULAR";
  return "BUENO";
};

const getStatusBadgeClass = (status: VehicleCriticalityStatus) => {
  switch (status) {
    case "BUENO":
      return "border-green-200 bg-green-100 text-green-800";
    case "REGULAR":
      return "border-yellow-200 bg-yellow-100 text-yellow-800";
    case "MALO":
      return "border-red-200 bg-red-100 text-red-800";
    case "SIN DATOS":
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};

const getScoreBadgeClass = (score: number) => {
  if (score >= 4) return "border-red-200 bg-red-100 text-red-800";
  if (score >= 2) return "border-yellow-200 bg-yellow-100 text-yellow-800";
  return "border-green-200 bg-green-100 text-green-800";
};

export function VehicleCriticalityClient() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [settings, setSettings] = useState<VehicleCriticalitySetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingVehicleCode, setSavingVehicleCode] = useState<string | null>(
    null,
  );
  const [editingVehicleCode, setEditingVehicleCode] = useState<string | null>(
    null,
  );
  const [editingValues, setEditingValues] = useState<EditingValues>({
    replacement_score: "0",
    notes: "",
  });
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);

      const [workOrdersResponse, settingsResponse] = await Promise.all([
        fetch("/api/work-orders", { cache: "no-store" }),
        fetch("/api/taller/criticidad", { cache: "no-store" }),
      ]);

      const workOrdersResult = await workOrdersResponse.json();
      const settingsResult = await settingsResponse.json();

      if (!workOrdersResponse.ok) {
        throw new Error(
          workOrdersResult.error || "Error al cargar órdenes de trabajo",
        );
      }

      if (!settingsResponse.ok) {
        throw new Error(
          settingsResult.error || "Error al cargar criticidad vehicular",
        );
      }

      setWorkOrders(workOrdersResult.data || []);
      setSettings(settingsResult.data || []);
    } catch (error) {
      console.error("Error fetching vehicle criticality data:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al cargar criticidad vehicular",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const rows = useMemo<VehicleCriticalityRow[]>(() => {
    const sixMonthsAgo = getSixMonthsAgo();
    const workOrdersByVehicle = new Map<string, WorkOrder[]>();

    workOrders.forEach((order) => {
      const vehicleCode = String(order.vehicle_code || "").trim();

      if (!vehicleCode) return;

      const currentOrders = workOrdersByVehicle.get(vehicleCode) || [];
      currentOrders.push(order);
      workOrdersByVehicle.set(vehicleCode, currentOrders);
    });

    const vehicleCodes = new Set<string>();

    settings.forEach((setting) => {
      if (setting.vehicle_code?.trim()) {
        vehicleCodes.add(setting.vehicle_code.trim());
      }
    });

    workOrdersByVehicle.forEach((_orders, vehicleCode) => {
      vehicleCodes.add(vehicleCode);
    });

    return Array.from(vehicleCodes)
      .map((vehicleCode) => {
        const orders = workOrdersByVehicle.get(vehicleCode) || [];
        const setting = settings.find(
          (item) =>
            normalizeText(item.vehicle_code) === normalizeText(vehicleCode),
        );

        const latestOrder = [...orders].sort((a, b) => {
          const dateA = getDateValue(a.entry_date)?.getTime() ?? 0;
          const dateB = getDateValue(b.entry_date)?.getTime() ?? 0;

          return dateB - dateA;
        })[0];

        const validOtCount = orders.filter((order) => {
          const date = getDateValue(order.entry_date);

          if (!date || date < sixMonthsAgo) return false;

          const failureType = normalizeText(order.failure_type);
          const repairType = normalizeText(order.repair_type);

          return (
            !failureType.includes("mantenimiento") &&
            !repairType.includes("mantenimiento")
          );
        }).length;

        const mechanicalScore = getMechanicalReliabilityScore(validOtCount);
        const serviceCriticality = toNumber(setting?.service_criticality);
        const replacementScore = toNumber(setting?.replacement_score);
        const securityScore = toNumber(setting?.security_score);

        const totalCriticality =
          mechanicalScore +
          serviceCriticality +
          replacementScore +
          securityScore;

        const hasAnyCriticalityData =
          serviceCriticality > 0 || replacementScore > 0 || securityScore > 0;

        const matchedVehicle = getVehicleFromCode(vehicleCode);

        return {
          vehicle_code: vehicleCode,
          vehicle:
            setting?.vehicle ||
            getVehicleLabelFromOrder(latestOrder) ||
            matchedVehicle?.vehicle ||
            "-",
          license_plate:
            setting?.license_plate ||
            getLicensePlateLabelFromOrder(latestOrder) ||
            matchedVehicle?.licensePlate ||
            "-",
          work_orders_count: validOtCount,
          mechanical_reliability_score: mechanicalScore,
          service_criticality: serviceCriticality,
          replacement_score: replacementScore,
          security_score: securityScore,
          total_criticality: totalCriticality,
          notes: setting?.notes || "",
          status_label: getCriticalityStatus(
            totalCriticality,
            hasAnyCriticalityData || mechanicalScore > 0,
          ),
        };
      })
      .sort((a, b) => {
        if (a.total_criticality !== b.total_criticality) {
          return b.total_criticality - a.total_criticality;
        }

        return a.vehicle_code.localeCompare(b.vehicle_code, "es", {
          numeric: true,
        });
      });
  }, [workOrders, settings]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    if (!normalizedSearch) return rows;

    return rows.filter((row) => {
      return (
        normalizeText(row.vehicle_code).includes(normalizedSearch) ||
        normalizeText(row.vehicle).includes(normalizedSearch) ||
        normalizeText(row.license_plate).includes(normalizedSearch) ||
        normalizeText(row.status_label).includes(normalizedSearch)
      );
    });
  }, [rows, search]);

  const totalVehicles = rows.length;
  const goodVehicles = rows.filter((row) => row.status_label === "BUENO").length;
  const regularVehicles = rows.filter(
    (row) => row.status_label === "REGULAR",
  ).length;
  const badVehicles = rows.filter((row) => row.status_label === "MALO").length;

  const startEditing = (row: VehicleCriticalityRow) => {
    setEditingVehicleCode(row.vehicle_code);
    setEditingValues({
      replacement_score: String(row.replacement_score),
      notes: row.notes,
    });
  };

  const cancelEditing = () => {
    setEditingVehicleCode(null);
    setEditingValues({
      replacement_score: "0",
      notes: "",
    });
  };

  const updateEditingValue = (field: keyof EditingValues, value: string) => {
    setEditingValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveEditing = async (vehicleCode: string) => {
    try {
      setSavingVehicleCode(vehicleCode);

      const response = await fetch(
        `/api/taller/criticidad/${encodeURIComponent(vehicleCode)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            replacement_score: editingValues.replacement_score,
            notes: editingValues.notes,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Error al actualizar criticidad vehicular",
        );
      }

      setSettings((prev) =>
        prev.map((setting) =>
          normalizeText(setting.vehicle_code) === normalizeText(vehicleCode)
            ? {
                ...setting,
                replacement_score: result.data?.replacement_score,
                notes: result.data?.notes,
                updated_at: result.data?.updated_at,
              }
            : setting,
        ),
      );

      toast.success("Reemplazo actualizado");
      cancelEditing();
      fetchData();
    } catch (error) {
      console.error("Error updating vehicle criticality:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al actualizar criticidad vehicular",
      );
    } finally {
      setSavingVehicleCode(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-2 mb-3 gap-2">
            <Link href="/dashboard/taller/ordenes-trabajo">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>

          <h1 className="text-3xl font-bold tracking-tight">
            Criticidad Vehicular
          </h1>

          <p className="mt-2 text-muted-foreground">
            Gestión y cálculo de criticidad de la planta vehicular.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="gap-2 rounded-xl">
            <Link href="/dashboard/taller/ordenes-trabajo/criticidad/estado-general">
              <ClipboardCheck className="h-4 w-4" />
              Checklist Vehicular
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="gap-2 rounded-xl"
          >
            <RefreshCcw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard
          title="Vehículos analizados"
          value={totalVehicles}
          description="Con configuración de criticidad"
        />

        <SummaryCard
          title="Buenos"
          value={goodVehicles}
          description="Criticidad menor a 10"
        />

        <SummaryCard
          title="Regulares"
          value={regularVehicles}
          description="Criticidad entre 10 y 12"
        />

        <SummaryCard
          title="Malos"
          value={badVehicles}
          description="Criticidad 13 o superior"
        />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-[#00A27F]" />
                Panel de criticidad
              </CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                Criticidad total = confiabilidad mecánica + criticidad servicio
                + reemplazo + seguridad.
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Criticidad servicio y seguridad son solo lectura. La seguridad
                se alimenta desde la última checklist vehicular.
              </p>
            </div>

            <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
              {filteredRows.length} de {rows.length} vehículos
            </Badge>
          </div>

          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por código, vehículo o dominio..."
              className="h-10 rounded-xl pl-9"
            />
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Cargando criticidad vehicular...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Truck className="mb-3 h-10 w-10" />
              <p>No hay vehículos para mostrar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold">
                      Código
                    </th>
                    <th className="px-3 py-3 text-left font-semibold">
                      Vehículo
                    </th>
                    <th className="px-3 py-3 text-left font-semibold">
                      Dominio
                    </th>
                    <th className="px-3 py-3 text-center font-semibold">
                      OT 6 meses
                    </th>
                    <th className="px-3 py-3 text-center font-semibold">
                      Conf. mecánica
                    </th>
                    <th className="px-3 py-3 text-center font-semibold">
                      Crit. servicio
                    </th>
                    <th className="px-3 py-3 text-center font-semibold">
                      Reemplazo
                    </th>
                    <th className="px-3 py-3 text-center font-semibold">
                      Seguridad
                    </th>
                    <th className="px-3 py-3 text-center font-semibold">
                      Total
                    </th>
                    <th className="px-3 py-3 text-center font-semibold">
                      Estado
                    </th>
                    <th className="px-3 py-3 text-center font-semibold">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map((row) => {
                    const isEditing = editingVehicleCode === row.vehicle_code;
                    const isSaving = savingVehicleCode === row.vehicle_code;

                    return (
                      <tr key={row.vehicle_code} className="border-t align-top">
                        <td className="px-3 py-3 font-semibold">
                          {row.vehicle_code}
                        </td>

                        <td className="px-3 py-3">{row.vehicle}</td>

                        <td className="px-3 py-3">{row.license_plate}</td>

                        <td className="px-3 py-3 text-center">
                          {row.work_orders_count}
                        </td>

                        <ReadOnlyScoreCell value={row.mechanical_reliability_score} />

                        <ReadOnlyScoreCell value={row.service_criticality} />

                        <EditableReplacementCell
                          isEditing={isEditing}
                          value={row.replacement_score}
                          inputValue={editingValues.replacement_score}
                          onChange={(value) =>
                            updateEditingValue("replacement_score", value)
                          }
                        />

                        <ReadOnlyScoreCell value={row.security_score} />

                        <td className="px-3 py-3 text-center">
                          <Badge
                            className={`${getScoreBadgeClass(
                              row.total_criticality,
                            )} border`}
                          >
                            {row.total_criticality}
                          </Badge>
                        </td>

                        <td className="px-3 py-3 text-center">
                          <Badge
                            className={`${getStatusBadgeClass(
                              row.status_label,
                            )} border`}
                          >
                            {row.status_label}
                          </Badge>
                        </td>

                        <td className="px-3 py-3">
                          {isEditing ? (
                            <div className="flex justify-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => saveEditing(row.vehicle_code)}
                                disabled={isSaving}
                                className="h-8 gap-1 rounded-lg"
                              >
                                {isSaving ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                                Guardar
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={cancelEditing}
                                disabled={isSaving}
                                className="h-8 gap-1 rounded-lg"
                              >
                                <X className="h-4 w-4" />
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => startEditing(row)}
                                className="h-8 gap-1 rounded-lg"
                              >
                                <Pencil className="h-4 w-4" />
                                Editar reemplazo
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReadOnlyScoreCell({ value }: { value: number }) {
  return (
    <td className="px-3 py-3 text-center">
      <Badge className={`${getScoreBadgeClass(value)} border`}>{value}</Badge>
    </td>
  );
}

function EditableReplacementCell({
  isEditing,
  value,
  inputValue,
  onChange,
}: {
  isEditing: boolean;
  value: number;
  inputValue: string;
  onChange: (value: string) => void;
}) {
  if (isEditing) {
    return (
      <td className="px-3 py-3 text-center">
        <Input
          type="number"
          min={0}
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
          className="mx-auto h-8 w-20 rounded-lg text-center"
        />
      </td>
    );
  }

  return (
    <td className="px-3 py-3 text-center">
      <Badge className={`${getScoreBadgeClass(value)} border`}>{value}</Badge>
    </td>
  );
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Gauge className="h-5 w-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}