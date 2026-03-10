"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  User,
  MapPin,
  Phone,
  Mail,
  FileText,
  Clock,
  CalendarDays,
} from "lucide-react";
import type { Complaint, Service, Cause, User as UserType } from "@/types";

type ComplaintWithDetails = Complaint & {
  service: Service;
  cause: Cause;
  loaded_by_user: UserType;
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
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "Resuelto":
        return "bg-green-100 text-green-800 border-green-300";
      case "No resuelto":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
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
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/complaints")}
            className="hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 active:scale-95 transition-all -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {complaint.complaint_number}
            </h1>
            <Badge className={`${getStatusColor(complaint.status)} border text-sm px-3 py-1`}>
              {complaint.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Creado el {formatDate(complaint.complaint_date)}
          </p>
        </div>
        <Button onClick={() => router.push(`/dashboard/complaints/${id}`)}>
          <Pencil className="w-4 h-4 mr-2" />
          Editar Reclamo
        </Button>
      </div>

      {/* Complainant + Contact Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5 text-[#5CADEB]" />
            Datos del Reclamante
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <InfoField label="Nombre y Apellido" value={complaint.complainant_name} />
            <InfoField label="DNI" value={complaint.dni || "-"} />
            <InfoField
              label="Dirección"
              value={`${complaint.address} ${complaint.street_number}`}
              icon={<MapPin className="w-4 h-4 text-muted-foreground" />}
            />
            <InfoField label="Medio de Contacto" value={complaint.contact_method} />
            <InfoField
              label="Teléfono"
              value={complaint.phone_number || "-"}
              icon={<Phone className="w-4 h-4 text-muted-foreground" />}
            />
            <InfoField
              label="Email"
              value={complaint.email || "-"}
              icon={<Mail className="w-4 h-4 text-muted-foreground" />}
            />
          </div>
        </CardContent>
      </Card>

      {/* Complaint Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-[#5CADEB]" />
            Detalles del Reclamo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <InfoField label="Servicio" value={complaint.service?.name || "-"} />
            <InfoField label="Causa" value={complaint.cause?.name || "-"} />
            <InfoField label="Zona" value={complaint.zone} />
            <InfoField
              label="Desde Cuándo"
              value={formatDate(complaint.since_when)}
              icon={<CalendarDays className="w-4 h-4 text-muted-foreground" />}
            />
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">Detalle</p>
            <p className="text-sm whitespace-pre-wrap bg-muted/50 p-4 rounded-md leading-relaxed">
              {complaint.details}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status, Follow-up & System Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-[#5CADEB]" />
            Estado y Seguimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Estado</p>
              <Badge className={`${getStatusColor(complaint.status)} border text-sm px-3 py-1`}>
                {complaint.status}
              </Badge>
            </div>
            <InfoField label="Derivado" value={complaint.referred ? "Sí" : "No"} />
            <InfoField label="Responsable de Carga" value={complaint.loaded_by_user?.full_name || "-"} />
          </div>
          <div className="border-t mt-5 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              <p className="text-xs text-muted-foreground">
                Creado: {formatDateTime(complaint.created_at)}
              </p>
              <p className="text-xs text-muted-foreground">
                Última modificación: {formatDateTime(complaint.updated_at)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground mb-0.5">{label}</p>
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}
