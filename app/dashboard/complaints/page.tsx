"use client";

import { useState, useEffect } from "react";
import { ComplaintsTable } from "@/components/tables/ComplaintsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Plus, Filter } from "lucide-react";
import type { Service } from "@/types";
import { toast } from "sonner";

export default function ComplaintsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [complaints, setComplaints] = useState([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    const statusFromUrl = searchParams.get("status");
    if (
      statusFromUrl &&
      ["En proceso", "Resuelto", "No resuelto"].includes(statusFromUrl)
    ) {
      setStatusFilter(statusFromUrl);
    } else {
      setStatusFilter("all");
    }
  }, [searchParams]);

  useEffect(() => {
    fetchComplaints();
  }, [searchTerm, statusFilter, serviceFilter, dateFromFilter, dateToFilter]);

  const fetchServices = async () => {
    try {
      const response = await fetch("/api/services");
      const data = await response.json();
      if (data.data) {
        setServices(data.data.filter((s: Service) => s.active));
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  };

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (serviceFilter && serviceFilter !== "all") {
        params.append("service_id", serviceFilter);
      }
      if (dateFromFilter) params.append("date_from", dateFromFilter);
      if (dateToFilter) params.append("date_to", dateToFilter);

      const response = await fetch(`/api/complaints?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (response.ok && data.data) {
        setComplaints(data.data);
      } else {
        toast.error(data.error || "Error al cargar reclamos");
      }
    } catch (error) {
      console.error("Error fetching complaints:", error);
      toast.error("Error al cargar reclamos");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (
    complaintId: number,
    newStatus: string,
  ) => {
    try {
      const response = await fetch(`/api/complaints/${complaintId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al actualizar");
      }

      await fetchComplaints();
    } catch (error) {
      throw error;
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setServiceFilter("all");
    setDateFromFilter("");
    setDateToFilter("");
    router.push("/dashboard/complaints");
  };

  const hasActiveFilters =
    searchTerm ||
    statusFilter !== "all" ||
    serviceFilter !== "all" ||
    dateFromFilter ||
    dateToFilter;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Reclamos</h1>
          <p className="text-muted-foreground mt-2">
            Gestión y seguimiento de reclamos ciudadanos
          </p>
        </div>
        <Button
          onClick={() => router.push("/dashboard/complaints/new")}
          className="h-12 rounded-xl bg-[#00A27F] px-6 text-white font-semibold shadow-md transition-all hover:bg-[#008568] hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="mr-2 h-5 w-5" />
          Nuevo Reclamo
        </Button>
      </div>

      <Card>
        <CardContent className="pt-5 pb-5 space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Filtros
            </h2>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-end">
            <div className="xl:col-span-4 flex flex-col gap-1.5">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>

            <div className="xl:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="status-filter">Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter" className="h-11 w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="En proceso">En proceso</SelectItem>
                  <SelectItem value="Resuelto">Resuelto</SelectItem>
                  <SelectItem value="No resuelto">No resuelto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="xl:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="service-filter">Servicio</Label>
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger id="service-filter" className="h-11 w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id.toString()}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="xl:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="date-from">Desde</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                className="h-11"
              />
            </div>

            <div className="xl:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="date-to">Hasta</Label>
              <Input
                id="date-to"
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-end pt-1">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="rounded-xl"
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && (
        <div className="text-sm text-muted-foreground">
          {complaints.length} reclamo{complaints.length !== 1 ? "s" : ""}{" "}
          encontrado{complaints.length !== 1 ? "s" : ""}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="text-muted-foreground">Cargando reclamos...</div>
        </div>
      ) : (
        <ComplaintsTable
          complaints={complaints}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}