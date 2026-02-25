"use client";

import { useState } from "react";
import type { Complaint, Service, Cause, User } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Pencil } from "lucide-react";

type ComplaintWithDetails = Complaint & {
  service: Service;
  cause: Cause;
  loaded_by_user: User;
};

interface ComplaintsTableProps {
  complaints: ComplaintWithDetails[];
  onStatusChange?: (complaintId: number, newStatus: string) => Promise<void>;
}

export function ComplaintsTable({
  complaints,
  onStatusChange,
}: ComplaintsTableProps) {
  const router = useRouter();
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

  const handleStatusChange = async (
    complaintId: number,
    newStatus: string,
  ) => {
    if (!onStatusChange) return;

    setUpdatingStatus(complaintId);
    try {
      await onStatusChange(complaintId, newStatus);
      toast.success("Estado actualizado exitosamente");
    } catch (error) {
      toast.error("Error al actualizar el estado");
      console.error("Error updating status:", error);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleView = (complaintId: number) => {
    router.push(`/dashboard/complaints/${complaintId}/view`);
  };

  const handleEdit = (complaintId: number) => {
    router.push(`/dashboard/complaints/${complaintId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "En proceso":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "Resuelto":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "No resuelto":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
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

  const formatTimeSince = (dateString: string): string => {
    const sinceDate = new Date(dateString);
    const today = new Date();

    // Reset time to midnight for accurate day calculation
    today.setHours(0, 0, 0, 0);
    sinceDate.setHours(0, 0, 0, 0);

    // Calculate total days difference
    const diffTime = today.getTime() - sinceDate.getTime();
    const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Handle same day or future dates
    if (totalDays <= 0) {
      return "Hoy";
    }

    // Less than 30 days: show in days
    if (totalDays < 30) {
      return totalDays === 1 ? "1 día" : `${totalDays} días`;
    }

    // 30+ days: calculate months and remaining days
    const months = Math.floor(totalDays / 30);
    const remainingDays = totalDays % 30;

    // Build the display string
    let result = months === 1 ? "1 mes" : `${months} meses`;

    if (remainingDays > 0) {
      const daysText = remainingDays === 1 ? "1 día" : `${remainingDays} días`;
      result += ` y ${daysText}`;
    }

    return result;
  };

  if (complaints.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No se encontraron reclamos que coincidan con los filtros.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Servicio</TableHead>
            <TableHead>Causa</TableHead>
            <TableHead>Zona</TableHead>
            <TableHead>Desde Cuándo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Cargado por</TableHead>
            <TableHead className="text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {complaints.map((complaint) => (
            <TableRow
              key={complaint.id}
              className="hover:bg-muted/50"
            >
              <TableCell className="font-medium">
                {complaint.complaint_number}
              </TableCell>
              <TableCell>{formatDate(complaint.complaint_date)}</TableCell>
              <TableCell>{complaint.complainant_name}</TableCell>
              <TableCell>{complaint.service.name}</TableCell>
              <TableCell>{complaint.cause.name}</TableCell>
              <TableCell>{complaint.zone}</TableCell>
              <TableCell>{formatTimeSince(complaint.since_when)}</TableCell>
              <TableCell>
                <div>
                  {onStatusChange ? (
                    <Select
                      value={complaint.status}
                      onValueChange={(value) =>
                        handleStatusChange(complaint.id, value)
                      }
                      disabled={updatingStatus === complaint.id}
                    >
                      <SelectTrigger
                        className={`w-[140px] ${getStatusColor(complaint.status)}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="En proceso">En proceso</SelectItem>
                        <SelectItem value="Resuelto">Resuelto</SelectItem>
                        <SelectItem value="No resuelto">No resuelto</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={getStatusColor(complaint.status)}>
                      {complaint.status}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{complaint.loaded_by_user.full_name}</TableCell>
              <TableCell>
                <div className="flex justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleView(complaint.id)}
                    title="Ver reclamo"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(complaint.id)}
                    title="Editar reclamo"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
