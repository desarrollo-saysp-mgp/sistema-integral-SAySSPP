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
  FileText,
  Clock,
  CalendarDays,
  History,
} from "lucide-react";
import type {
  Complaint,
  Service,
  Cause,
  User as UserType,
  ComplaintHistoryWithUser,
} from "@/types";
import { useUser } from "@/hooks/useUser";

type ComplaintWithDetails = Complaint & {
  service: Service | null;
  cause: Cause | null;
  loaded_by_user: UserType;
};

type ComplaintExtraData = {
  department?: unknown;
  description_type?: unknown;
  level?: unknown;
  observations?: unknown;
  solution?: unknown;
  resolution_date?: unknown;
  agent?: unknown;
  resolution_responsible?: unknown;
};

const FIELD_LABELS: Record<string, string> = {
  complaint_date: "Fecha de reclamo",
  complainant_name: "Nombre y apellido",
  address: "Calle",
  street_number: "Número",
  dni: "DNI",
  phone_number: "Teléfono",
  email: "Email",
  service_id: "Servicio",
  cause_id: "Causa",
  zone: "Zona",
  since_when: "Desde cuándo",
  contact_method: "Medio de contacto",
  details: "Detalle",
  status: "Estado",
  referred: "Derivado",
  latlon: "Lat/Lon",
  extra_data: "Datos adicionales",
};

const getExtraData = (complaint: Complaint): ComplaintExtraData => {
  if (
    complaint.extra_data &&
    typeof complaint.extra_data === "object" &&
    !Array.isArray(complaint.extra_data)
  ) {
    return complaint.extra_data as ComplaintExtraData;
  }

  return {};
};

export default function ComplaintViewPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { profile } = useUser();

  const [complaint, setComplaint] = useState<ComplaintWithDetails | null>(null);
  const [history, setHistory] = useState<ComplaintHistoryWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchComplaint();
    }
  }, [id]);

  useEffect(() => {
    if (
      id &&
      (profile?.role === "Admin" || profile?.role === "AdminLectura")
    ) {
      fetchHistory();
    }
  }, [id, profile?.role]);

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

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/complaints/${id}/history`);
      const data = await response.json();

      if (response.ok && data.data) {
        setHistory(data.data);
      } else if (response.status !== 403) {
        toast.error(data.error || "Error al cargar historial");
      }
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error("Error al cargar historial");
    } finally {
      setHistoryLoading(false);
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

  const formatDateOnly = (dateString?: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatHistoryValue = (value: string | null) => {
    if (value === null || value === "") return "-";
    if (value === "true") return "Sí";
    if (value === "false") return "No";
    return value;
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

  const isArbolado = complaint.form_variant === "arbolado";
  const extra = getExtraData(complaint);

  const displayComplaintNumber =
  complaint.form_variant === "arbolado"
    ? complaint.arbolado_number ?? "-"
    : complaint.complaint_number ?? "-";

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/complaints")}
            className="-ml-2 transition-all hover:bg-gray-100 hover:text-gray-900 active:scale-95 active:bg-gray-200"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver
          </Button>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{displayComplaintNumber}</h1>
            <Badge
              className={`${getStatusColor(complaint.status)} border px-3 py-1 text-sm`}
            >
              {complaint.status}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            Creado el {formatDateTime(complaint.created_at)}
          </p>
        </div>

        <Button onClick={() => router.push(`/dashboard/complaints/${id}`)}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar Reclamo
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-[#5CADEB]" />
            Datos del Reclamante
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            <InfoField
              label="Nombre y Apellido"
              value={complaint.complainant_name || "-"}
            />
            <InfoField
              label="Dirección"
              value={`${complaint.address || "-"} ${complaint.street_number || ""}`.trim()}
              icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
            />
            <InfoField
              label="Medio de Contacto"
              value={complaint.contact_method || "-"}
            />
            <InfoField
              label="Teléfono"
              value={complaint.phone_number || "-"}
              icon={<Phone className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-[#5CADEB]" />
            Detalles del Reclamo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isArbolado ? (
            <>
              <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
                <InfoField
                  label="Depto"
                  value={
                    typeof extra.department === "string"
                      ? extra.department
                      : "Arbolado"
                  }
                />
                <InfoField
                  label="Nivel"
                  value={typeof extra.level === "string" ? extra.level : "-"}
                />
                <InfoField
                  label="Descripción"
                  value={
                    typeof extra.description_type === "string"
                      ? extra.description_type
                      : complaint.details || "-"
                  }
                />
                <InfoField
                  label="Solución"
                  value={typeof extra.solution === "string" ? extra.solution : "-"}
                />
                <InfoField
                  label="Agente"
                  value={typeof extra.agent === "string" ? extra.agent : "-"}
                />
                <InfoField
                  label="Responsable de Resolución"
                  value={
                    typeof extra.resolution_responsible === "string"
                      ? extra.resolution_responsible
                      : "-"
                  }
                />
                <InfoField
                  label="Fecha de Resolución"
                  value={formatDateOnly(
                    typeof extra.resolution_date === "string"
                      ? extra.resolution_date
                      : null,
                  )}
                />
              </div>

              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  Observaciones
                </p>
                <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm leading-relaxed">
                  {typeof extra.observations === "string"
                    ? extra.observations
                    : "-"}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
                <InfoField label="Servicio" value={complaint.service?.name || "-"} />
                <InfoField label="Causa" value={complaint.cause?.name || "-"} />
                <InfoField label="Zona" value={complaint.zone || "-"} />
                <InfoField
                  label="Desde Cuándo"
                  value={complaint.since_when || "-"}
                  icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />}
                />
              </div>

              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  Detalle
                </p>
                <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm leading-relaxed">
                  {complaint.details || "-"}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-[#5CADEB]" />
            Estado y Seguimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium text-muted-foreground">
                Estado
              </p>
              <Badge
                className={`${getStatusColor(complaint.status)} border px-3 py-1 text-sm`}
              >
                {complaint.status}
              </Badge>
            </div>

            <InfoField
              label="Responsable de Carga"
              value={complaint.loaded_by_user?.full_name || "-"}
            />
          </div>

          <div className="mt-5 border-t pt-4">
            <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
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

      {(profile?.role === "Admin" || profile?.role === "AdminLectura") && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-[#5CADEB]" />
              Historial de Cambios
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <p className="text-sm text-muted-foreground">
                Cargando historial...
              </p>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay cambios registrados.
              </p>
            ) : (
              <div className="space-y-4">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border bg-muted/20 p-4"
                  >
                    <div className="flex flex-col gap-1">
                      <p className="text-sm">
                        <span className="font-semibold">
                          {item.user?.full_name || "Usuario desconocido"}
                        </span>{" "}
                        modificó{" "}
                        <span className="font-semibold">
                          {FIELD_LABELS[item.field_name] || item.field_name}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Antes:</span>{" "}
                        {formatHistoryValue(item.old_value)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Después:</span>{" "}
                        {formatHistoryValue(item.new_value)}
                      </p>
                      <p className="pt-1 text-xs text-muted-foreground">
                        {formatDateTime(item.changed_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
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
      <p className="mb-0.5 text-sm font-medium text-muted-foreground">
        {label}
      </p>
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}