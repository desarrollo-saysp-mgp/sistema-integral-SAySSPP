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
import { useRouter } from "next/navigation";
import { Search, Plus, Filter } from "lucide-react";
import type { Service } from "@/types";
import { toast } from "sonner";

export default function ComplaintsPage() {
  const router = useRouter();
  const [complaints, setComplaints] = useState([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");

  useEffect(() => {
    fetchServices();
  }, []);

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
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (serviceFilter && serviceFilter !== "all") params.append("service_id", serviceFilter);
      if (dateFromFilter) params.append("date_from", dateFromFilter);
      if (dateToFilter) params.append("date_to", dateToFilter);

      const response = await fetch(`/api/complaints?${params.toString()}`);
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

  const handleStatusChange = async (complaintId: number, newStatus: string) => {
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

      // Refresh the complaints list
      await fetchComplaints();
    } catch (error) {
      throw error;
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setServiceFilter("");
    setDateFromFilter("");
    setDateToFilter("");
  };

  const hasActiveFilters =
    searchTerm ||
    statusFilter ||
    serviceFilter ||
    dateFromFilter ||
    dateToFilter;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Reclamos</h1>
          <p className="text-muted-foreground mt-2">
            Gestión y seguimiento de reclamos ciudadanos
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/complaints/new")}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Reclamo
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Search Bar */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por número, nombre o dirección..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t items-end">
              <div className="flex flex-col gap-2">
                <Label htmlFor="status-filter" className="text-sm font-medium">
                  Estado
                </Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter" className="h-10">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="En proceso">En proceso</SelectItem>
                    <SelectItem value="Resuelto">Resuelto</SelectItem>
                    <SelectItem value="No resuelto">No resuelto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="service-filter" className="text-sm font-medium">
                  Servicio
                </Label>
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                  <SelectTrigger id="service-filter" className="h-10">
                    <SelectValue placeholder="Todos los servicios" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los servicios</SelectItem>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id.toString()}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="date-from" className="text-sm font-medium">
                  Desde
                </Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="date-to" className="text-sm font-medium">
                  Hasta
                </Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                  className="h-10"
                />
              </div>

              {hasActiveFilters && (
                <div className="md:col-span-4 flex justify-end">
                  <Button variant="ghost" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Count */}
      {!loading && (
        <div className="text-sm text-muted-foreground">
          {complaints.length} reclamo{complaints.length !== 1 ? "s" : ""}{" "}
          encontrado{complaints.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Complaints Table */}
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
