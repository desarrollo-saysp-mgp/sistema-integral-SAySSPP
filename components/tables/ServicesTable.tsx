"use client";

import type { Service, Cause } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronRight,
  Edit,
  MoreVertical,
  Plus,
  Trash,
} from "lucide-react";
import { useState } from "react";

interface ServicesTableProps {
  services: Service[];
  causes: Cause[];
  onEditService: (service: Service) => void;
  onDeleteService: (service: Service) => void;
  onToggleServiceStatus: (service: Service) => void;
  onCreateCause: (service: Service) => void;
  onEditCause: (cause: Cause) => void;
  onDeleteCause: (cause: Cause) => void;
  onToggleCauseStatus: (cause: Cause) => void;
}

export function ServicesTable({
  services,
  causes,
  onEditService,
  onDeleteService,
  onToggleServiceStatus,
  onCreateCause,
  onEditCause,
  onDeleteCause,
  onToggleCauseStatus,
}: ServicesTableProps) {
  const [expandedServices, setExpandedServices] = useState<Set<number>>(
    new Set(),
  );

  const toggleServiceExpanded = (serviceId: number) => {
    const newExpanded = new Set(expandedServices);
    if (newExpanded.has(serviceId)) {
      newExpanded.delete(serviceId);
    } else {
      newExpanded.add(serviceId);
    }
    setExpandedServices(newExpanded);
  };

  const getCausesForService = (serviceId: number) => {
    return causes.filter((cause) => cause.service_id === serviceId);
  };

  if (services.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          No hay servicios registrados. Crea uno para comenzar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {services.map((service) => {
        const serviceCauses = getCausesForService(service.id);
        const isExpanded = expandedServices.has(service.id);

        return (
          <div
            key={service.id}
            className="border rounded-lg overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 bg-muted/50">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleServiceExpanded(service.id)}
                  className="h-6 w-6 p-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{service.name}</span>
                    <Badge
                      variant={service.active ? "default" : "secondary"}
                    >
                      {service.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {serviceCauses.length}{" "}
                    {serviceCauses.length === 1 ? "causa" : "causas"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCreateCause(service)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Nueva Causa
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditService(service)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onToggleServiceStatus(service)}
                    >
                      {service.active ? "Desactivar" : "Activar"}
                    </DropdownMenuItem>
                    {!service.active && (
                      <DropdownMenuItem
                        onClick={() => onDeleteService(service)}
                        className="text-destructive"
                      >
                        <Trash className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {isExpanded && (
              <div className="p-4 pt-0">
                {serviceCauses.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    No hay causas para este servicio.
                    <Button
                      variant="link"
                      onClick={() => onCreateCause(service)}
                      className="ml-2"
                    >
                      Crear la primera causa
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre de la Causa</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-[100px]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serviceCauses.map((cause) => (
                        <TableRow key={cause.id}>
                          <TableCell>{cause.name}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                cause.active ? "default" : "secondary"
                              }
                            >
                              {cause.active ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => onEditCause(cause)}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onToggleCauseStatus(cause)}
                                >
                                  {cause.active ? "Desactivar" : "Activar"}
                                </DropdownMenuItem>
                                {!cause.active && (
                                  <DropdownMenuItem
                                    onClick={() => onDeleteCause(cause)}
                                    className="text-destructive"
                                  >
                                    <Trash className="h-4 w-4 mr-2" />
                                    Eliminar
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
