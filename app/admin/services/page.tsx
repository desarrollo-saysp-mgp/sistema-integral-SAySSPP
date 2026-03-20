"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/hooks/useUser";
import { useRouter } from "next/navigation";
import type { Service, Cause } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus } from "lucide-react";
import { ServiceForm } from "@/components/forms/ServiceForm";
import { CauseForm } from "@/components/forms/CauseForm";
import { ServicesTable } from "@/components/tables/ServicesTable";
import { toast } from "sonner";

export default function ServicesPage() {
  const { profile, isAuthenticated, loading } = useUser();

  const canViewAdmin =
    profile?.role === "Admin" || profile?.role === "AdminLectura";
  const router = useRouter();

  const [services, setServices] = useState<Service[]>([]);
  const [causes, setCauses] = useState<Cause[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [causeDialogOpen, setCauseDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedCause, setSelectedCause] = useState<Cause | null>(null);
  const [selectedServiceForCause, setSelectedServiceForCause] =
    useState<Service | null>(null);

  console.log("SERVICES PAGE RENDER", {
    loading,
    isAuthenticated,
    role: profile?.role,
    canViewAdmin,
  });
  // Redirect non-admin users
  useEffect(() => {
    // Esperar a que cargue el usuario COMPLETAMENTE
    if (loading || !profile) return;

    if (!isAuthenticated || !canViewAdmin) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, canViewAdmin, loading, profile, router]);

  useEffect(() => {
    if (isAuthenticated && canViewAdmin) {
      loadData();
    }
  }, [isAuthenticated, canViewAdmin]);

  const loadData = async () => {
    try {
      setLoadingData(true);

      // Load services
      const servicesResponse = await fetch("/api/services");
      if (!servicesResponse.ok) {
        throw new Error("Error al cargar servicios");
      }
      const servicesData = await servicesResponse.json();
      setServices(servicesData.data || []);

      // Load all causes
      const causesResponse = await fetch("/api/causes");
      if (!causesResponse.ok) {
        throw new Error("Error al cargar causas");
      }
      const causesData = await causesResponse.json();
      setCauses(causesData.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar los datos");
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateService = () => {
    setSelectedService(null);
    setServiceDialogOpen(true);
  };

  const handleEditService = (service: Service) => {
    setSelectedService(service);
    setServiceDialogOpen(true);
  };

  const handleCreateCause = (service: Service) => {
    setSelectedServiceForCause(service);
    setSelectedCause(null);
    setCauseDialogOpen(true);
  };

  const handleEditCause = (cause: Cause) => {
    const service = services.find((s) => s.id === cause.service_id);
    setSelectedServiceForCause(service || null);
    setSelectedCause(cause);
    setCauseDialogOpen(true);
  };

  const handleServiceSubmit = async (data: {
    name: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const url = selectedService
        ? `/api/services/${selectedService.id}`
        : "/api/services";
      const method = selectedService ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error };
      }

      toast.success(
        result.message ||
        (selectedService
          ? "Servicio actualizado exitosamente"
          : "Servicio creado exitosamente"),
      );
      await loadData();
      return { success: true };
    } catch (error) {
      console.error("Error submitting service:", error);
      return { success: false, error: "Error al guardar el servicio" };
    }
  };

  const handleCauseSubmit = async (data: {
    name: string;
    service_id: number;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const url = selectedCause
        ? `/api/causes/${selectedCause.id}`
        : "/api/causes";
      const method = selectedCause ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error };
      }

      toast.success(
        result.message ||
        (selectedCause
          ? "Causa actualizada exitosamente"
          : "Causa creada exitosamente"),
      );
      await loadData();
      return { success: true };
    } catch (error) {
      console.error("Error submitting cause:", error);
      return { success: false, error: "Error al guardar la causa" };
    }
  };

  const handleDeleteService = async (service: Service) => {
    if (
      !confirm(
        `¿Está seguro de que desea desactivar el servicio "${service.name}"? Esto también desactivará todas sus causas asociadas.`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/services/${service.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Error al eliminar el servicio");
        return;
      }

      toast.success(result.message || "Servicio eliminado exitosamente");
      await loadData();
    } catch (error) {
      console.error("Error deleting service:", error);
      toast.error("Error al eliminar el servicio");
    }
  };

  const handleDeleteCause = async (cause: Cause) => {
    if (!confirm(`¿Está seguro de que desea desactivar la causa "${cause.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/causes/${cause.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Error al eliminar la causa");
        return;
      }

      toast.success(result.message || "Causa eliminada exitosamente");
      await loadData();
    } catch (error) {
      console.error("Error deleting cause:", error);
      toast.error("Error al eliminar la causa");
    }
  };

  const handleToggleServiceStatus = async (service: Service) => {
    try {
      const response = await fetch(`/api/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !service.active }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Error al actualizar el servicio");
        return;
      }

      toast.success(result.message || "Servicio actualizado exitosamente");
      await loadData();
    } catch (error) {
      console.error("Error toggling service status:", error);
      toast.error("Error al actualizar el servicio");
    }
  };

  const handleToggleCauseStatus = async (cause: Cause) => {
    try {
      const response = await fetch(`/api/causes/${cause.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !cause.active }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Error al actualizar la causa");
        return;
      }

      toast.success(result.message || "Causa actualizada exitosamente");
      await loadData();
    } catch (error) {
      console.error("Error toggling cause status:", error);
      toast.error("Error al actualizar la causa");
    }
  };

  if (loading || !profile) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Gestión de Servicios
          </h1>
          <p className="text-muted-foreground">
            Administra los servicios y causas del sistema
          </p>
        </div>
        <Button onClick={handleCreateService}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Servicio
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Servicios y Causas</CardTitle>
          <CardDescription>
            Lista de todos los servicios y sus causas asociadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="flex justify-center py-8">
              <p className="text-muted-foreground">Cargando...</p>
            </div>
          ) : (
            <ServicesTable
              services={services}
              causes={causes}
              onEditService={handleEditService}
              onDeleteService={handleDeleteService}
              onToggleServiceStatus={handleToggleServiceStatus}
              onCreateCause={handleCreateCause}
              onEditCause={handleEditCause}
              onDeleteCause={handleDeleteCause}
              onToggleCauseStatus={handleToggleCauseStatus}
            />
          )}
        </CardContent>
      </Card>

      <ServiceForm
        service={selectedService}
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        onSubmit={handleServiceSubmit}
      />

      <CauseForm
        cause={selectedCause}
        service={selectedServiceForCause}
        open={causeDialogOpen}
        onOpenChange={setCauseDialogOpen}
        onSubmit={handleCauseSubmit}
      />
    </div>
  );

}
