"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { WorkOrder } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PlusCircle,
  Search,
  Loader2,
  ClipboardList,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

const statusOptions = ["Iniciado", "En proceso", "Finalizado", "Cancelado"];

export function WorkOrdersClient() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (search.trim()) {
        params.append("search", search.trim());
      }

      if (statusFilter !== "Todos") {
        params.append("status", statusFilter);
      }

      const response = await fetch(`/api/work-orders?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al cargar órdenes de trabajo");
      }

      setWorkOrders(result.data || []);
    } catch (error) {
      console.error("Error fetching work orders:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al cargar órdenes de trabajo",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, [statusFilter]);

  const filteredWorkOrders = useMemo(() => {
    return workOrders;
  }, [workOrders]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";

    const [year, month, day] = dateString.split("-").map(Number);

    if (year && month && day) {
      return new Date(year, month - 1, day).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }

    return dateString;
  };

  const formatMoney = (value?: number | null) => {
    if (value === null || value === undefined) return "-";

    return value.toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Finalizado":
        return "border-green-200 bg-green-100 text-green-800";
      case "En proceso":
        return "border-yellow-200 bg-yellow-100 text-yellow-800";
      case "Cancelado":
        return "border-red-200 bg-red-100 text-red-800";
      default:
        return "border-blue-200 bg-blue-100 text-blue-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Registro de OT</h2>
          <p className="text-sm text-muted-foreground">
            Consultá y seguí las órdenes de trabajo cargadas.
          </p>
        </div>

        <Button asChild className="gap-2">
          <Link href="/dashboard/taller/ordenes-trabajo/nueva">
            <PlusCircle className="h-4 w-4" />
            Cargar nueva OT
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>Órdenes cargadas</CardTitle>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") fetchWorkOrders();
                  }}
                  placeholder="Buscar OT, vehículo, chofer..."
                  className="pl-9 sm:w-[280px]"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value)}
              >
                <SelectTrigger className="sm:w-[180px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  {statusOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                onClick={fetchWorkOrders}
                disabled={loading}
              >
                Buscar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Cargando órdenes...
            </div>
          ) : filteredWorkOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <ClipboardList className="mb-3 h-10 w-10" />
              <p>No hay órdenes de trabajo cargadas.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filteredWorkOrders.map((order) => (
                  <Card key={order.id} className="rounded-xl">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">OT</p>
                          <p className="text-lg font-bold">
                            {order.order_number || "-"}
                          </p>
                        </div>

                        <Badge
                          className={`${getStatusBadgeClass(
                            order.status,
                          )} border`}
                        >
                          {order.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <Info label="Fecha" value={formatDate(order.entry_date)} />
                        <Info label="Código" value={order.vehicle_code || "-"} />
                        <Info label="Vehículo" value={order.vehicle || "-"} />
                        <Info label="Dominio" value={order.license_plate || "-"} />
                        <Info
                          label="Falla"
                          value={order.failure_type || order.failure_report || "-"}
                        />
                        <Info
                          label="Monto"
                          value={formatMoney(order.amount)}
                        />
                      </div>

                      <Button variant="outline" size="sm" className="w-full gap-2">
                        <Eye className="h-4 w-4" />
                        Ver detalle
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-xl border md:block">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-3 text-left font-semibold">OT</th>
                      <th className="px-3 py-3 text-left font-semibold">
                        Fecha ingreso
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">
                        Vehículo
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">
                        Dominio
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">
                        Falla
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">
                        Repuesto
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">
                        Proveedor
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">
                        Monto
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">
                        Estado
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredWorkOrders.map((order) => (
                      <tr key={order.id} className="border-t">
                        <td className="px-3 py-3 font-medium">
                          {order.order_number || "-"}
                        </td>
                        <td className="px-3 py-3">
                          {formatDate(order.entry_date)}
                        </td>
                        <td className="px-3 py-3">
                          <div>
                            <p>{order.vehicle || "-"}</p>
                            <p className="text-xs text-muted-foreground">
                              Código: {order.vehicle_code || "-"}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {order.license_plate || "-"}
                        </td>
                        <td className="px-3 py-3">
                          {order.failure_type || order.failure_report || "-"}
                        </td>
                        <td className="px-3 py-3">
                          {order.requires_spare_part || "-"}
                        </td>
                        <td className="px-3 py-3">{order.provider || "-"}</td>
                        <td className="px-3 py-3">{formatMoney(order.amount)}</td>
                        <td className="px-3 py-3">
                          <Badge
                            className={`${getStatusBadgeClass(
                              order.status,
                            )} border`}
                          >
                            {order.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="break-words text-sm">{value}</p>
    </div>
  );
}