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
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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

  const handleRowClick = (complaintId: number) => {
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
            <TableHead>Estado</TableHead>
            <TableHead>Cargado por</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {complaints.map((complaint) => (
            <TableRow
              key={complaint.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={(e) => {
                // Don't navigate if clicking on the status dropdown
                if ((e.target as HTMLElement).closest(".status-select")) {
                  return;
                }
                handleRowClick(complaint.id);
              }}
            >
              <TableCell className="font-medium">
                {complaint.complaint_number}
              </TableCell>
              <TableCell>{formatDate(complaint.complaint_date)}</TableCell>
              <TableCell>{complaint.complainant_name}</TableCell>
              <TableCell>{complaint.service.name}</TableCell>
              <TableCell>{complaint.cause.name}</TableCell>
              <TableCell>{complaint.zone}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="status-select">
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
