"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Pencil } from "lucide-react";
import type { Complaint, Service, Cause, User } from "@/types";

type ComplaintWithDetails = Complaint & {
  service: Service;
  cause: Cause;
  loaded_by_user: User;
};

export default function ComplaintViewPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [complaint, setComplaint] = useState<ComplaintWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchComplaint();
    }
  }, [id]);

  const fetchComplaint = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/complaints/${id}`);
      const data = await response.json();

      if (response.ok && data.data) {
        setComplaint(data.data);
      } else {
        toast.error(data.error || "Error al cargar reclamo");
        router.push("/dashboard/complaints");
      }
    } catch (error) {
      console.error("Error fetching complaint:", error);
      toast.error("Error al cargar reclamo");
      router.push("/dashboard/complaints");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "En proceso":
        return "bg-yellow-100 text-yellow-800";
      case "Resuelto":
        return "bg-green-100 text-green-800";
      case "No resuelto":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Cargando reclamo...</div>
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Reclamo no encontrado</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard/complaints")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </div>
          <h1 className="text-3xl font-bold">
            Reclamo {complaint.complaint_number}
          </h1>
          <p className="text-muted-foreground">
            Detalle del reclamo
          </p>
        </div>

        {/* Edit button */}
        <Button onClick={() => router.push(`/dashboard/complaints/${id}`)}>
          <Pencil className="w-4 h-4 mr-2" />
          Editar Reclamo
        </Button>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información Básica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Número de Reclamo</p>
              <p className="text-lg font-semibold">{complaint.complaint_number}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fecha de Reclamo</p>
              <p className="text-lg">{formatDate(complaint.complaint_date)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Estado</p>
              <Badge className={`${getStatusColor(complaint.status)} mt-1`}>
                {complaint.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Complainant Information */}
      <Card>
        <CardHeader>
          <CardTitle>Datos del Reclamante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nombre y Apellido</p>
              <p className="text-lg">{complaint.complainant_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">DNI</p>
              <p className="text-lg">{complaint.dni || "-"}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">Dirección</p>
              <p className="text-lg">{complaint.address}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Número</p>
              <p className="text-lg">{complaint.street_number}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Medio de Contacto</p>
              <p className="text-lg">{complaint.contact_method}</p>
            </div>
            {(complaint.contact_method === "Telefono" || complaint.contact_method === "WhatsApp") && complaint.phone_number && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {complaint.contact_method === "WhatsApp" ? "WhatsApp" : "Teléfono"}
                </p>
                <p className="text-lg">{complaint.phone_number}</p>
              </div>
            )}
            {complaint.contact_method === "Email" && complaint.email && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-lg">{complaint.email}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Complaint Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles del Reclamo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Servicio</p>
              <p className="text-lg">{complaint.service?.name || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Causa</p>
              <p className="text-lg">{complaint.cause?.name || "-"}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Zona</p>
              <p className="text-lg">{complaint.zone}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Desde Cuándo</p>
              <p className="text-lg">{formatDate(complaint.since_when)}</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Detalle</p>
            <p className="text-lg whitespace-pre-wrap bg-muted/50 p-4 rounded-md mt-2">
              {complaint.details}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status and Follow-up */}
      <Card>
        <CardHeader>
          <CardTitle>Estado y Seguimiento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Estado</p>
              <Badge className={`${getStatusColor(complaint.status)} mt-1`}>
                {complaint.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Derivado</p>
              <p className="text-lg">{complaint.referred ? "Sí" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Responsable de Carga</p>
              <p className="text-lg">{complaint.loaded_by_user?.full_name || "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timestamps */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fecha de Creación</p>
              <p className="text-lg">{formatDateTime(complaint.created_at)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Última Modificación</p>
              <p className="text-lg">{formatDateTime(complaint.updated_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
