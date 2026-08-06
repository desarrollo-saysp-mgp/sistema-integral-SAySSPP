"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Search,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";

import type { Personnel } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ITEMS_PER_PAGE = 15;

type ContractFilter =
  | "all"
  | "PLANTA_PERMANENTE"
  | "MONOTRIBUTISTA"
  | "CONTRATO_CON_APORTES";

type StatusFilter = "active" | "inactive" | "all";

interface PersonnelTableProps {
  personnel: Personnel[];
  updatingId?: string | null;
  onEdit: (person: Personnel) => void;
  onDeactivate: (person: Personnel) => void;
  onReactivate?: (person: Personnel) => void;
  onDelete?: (person: Personnel) => void;
  onFilteredChange?: (
    personnel: Personnel[],
    filters: string[],
  ) => void;
}

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const formatContractType = (
  contractType: Personnel["tipo_contrato"],
) => {
  switch (contractType) {
    case "PLANTA_PERMANENTE":
      return "Planta permanente";

    case "MONOTRIBUTISTA":
      return "Monotributista";

    case "CONTRATO_CON_APORTES":
      return "Contrato con aportes";

    default:
      return contractType;
  }
};

const getContractBadgeVariant = (
  contractType: Personnel["tipo_contrato"],
): "default" | "secondary" | "outline" => {
  switch (contractType) {
    case "PLANTA_PERMANENTE":
      return "default";

    case "MONOTRIBUTISTA":
      return "secondary";

    case "CONTRATO_CON_APORTES":
      return "outline";

    default:
      return "outline";
  }
};

export function PersonnelTable({
  personnel,
  updatingId,
  onEdit,
  onDeactivate,
  onReactivate,
  onDelete,
  onFilteredChange,
}: PersonnelTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [contractFilter, setContractFilter] =
    useState<ContractFilter>("all");
  const [directionFilter, setDirectionFilter] =
    useState("all");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("active");
  const [currentPage, setCurrentPage] = useState(1);

  const directions = useMemo(() => {
    const values = personnel
      .map((person) => person.direccion?.trim())
      .filter(
        (value): value is string =>
          Boolean(value),
      );

    return [...new Set(values)].sort((a, b) =>
      a.localeCompare(b, "es"),
    );
  }, [personnel]);

  const filteredPersonnel = useMemo(() => {
    const normalizedSearch =
      normalizeText(searchTerm);

    return personnel
      .filter((person) => {
        const matchesSearch =
          !normalizedSearch ||
          normalizeText(
            person.nombre_completo,
          ).includes(normalizedSearch) ||
          normalizeText(person.legajo).includes(
            normalizedSearch,
          ) ||
          normalizeText(
            person.codigo_direccion,
          ).includes(normalizedSearch) ||
          normalizeText(
            person.area_rrhh,
          ).includes(normalizedSearch) ||
          normalizeText(
            person.direccion,
          ).includes(normalizedSearch) ||
          normalizeText(person.tarea).includes(
            normalizedSearch,
          ) ||
          normalizeText(
            person.numero_resolucion,
          ).includes(normalizedSearch);

        const matchesContract =
          contractFilter === "all" ||
          person.tipo_contrato === contractFilter;

        const matchesDirection =
          directionFilter === "all" ||
          person.direccion === directionFilter;

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" &&
            person.activo) ||
          (statusFilter === "inactive" &&
            !person.activo);

        return (
          matchesSearch &&
          matchesContract &&
          matchesDirection &&
          matchesStatus
        );
      })
      .sort((a, b) =>
        a.nombre_completo.localeCompare(
          b.nombre_completo,
          "es",
          {
            sensitivity: "base",
          },
        ),
      );
  }, [
    personnel,
    searchTerm,
    contractFilter,
    directionFilter,
    statusFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredPersonnel.length /
        ITEMS_PER_PAGE,
    ),
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    contractFilter,
    directionFilter,
    statusFilter,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedPersonnel = useMemo(() => {
    const start =
      (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;

    return filteredPersonnel.slice(start, end);
  }, [filteredPersonnel, currentPage]);

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    contractFilter !== "all" ||
    directionFilter !== "all" ||
    statusFilter !== "active";

  const clearFilters = () => {
    setSearchTerm("");
    setContractFilter("all");
    setDirectionFilter("all");
    setStatusFilter("active");
    setCurrentPage(1);
  };

  const visiblePages = useMemo(() => {
    const maxVisiblePages = 7;

    if (totalPages <= maxVisiblePages) {
      return Array.from(
        { length: totalPages },
        (_, index) => index + 1,
      );
    }

    let startPage = Math.max(
      1,
      currentPage - Math.floor(maxVisiblePages / 2),
    );

    let endPage = startPage + maxVisiblePages - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = endPage - maxVisiblePages + 1;
    }

    return Array.from(
      { length: endPage - startPage + 1 },
      (_, index) => startPage + index,
    );
  }, [currentPage, totalPages]);

  const appliedFilters = useMemo(() => {
    const filters: string[] = [];

    if (searchTerm.trim()) {
      filters.push(`Búsqueda: ${searchTerm.trim()}`);
    }

    if (contractFilter !== "all") {
      filters.push(
        `Contratación: ${formatContractType(contractFilter)}`,
      );
    }

    if (directionFilter !== "all") {
      filters.push(`Dirección: ${directionFilter}`);
    }

    if (statusFilter !== "all") {
      filters.push(
        `Estado: ${statusFilter === "active" ? "Activos" : "Dados de baja"}`,
      );
    }

    return filters;
  }, [
    searchTerm,
    contractFilter,
    directionFilter,
    statusFilter,
  ]);

  useEffect(() => {
    onFilteredChange?.(
      filteredPersonnel,
      appliedFilters,
    );
  }, [
    filteredPersonnel,
    appliedFilters,
    onFilteredChange,
  ]);

  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              placeholder="Buscar por nombre, legajo, código, área, dirección, tarea o resolución..."
              className="pl-9"
            />
          </div>

          <Select
            value={contractFilter}
            onValueChange={(value) =>
              setContractFilter(
                value as ContractFilter,
              )
            }
          >
            <SelectTrigger className="w-full lg:w-[220px]">
              <SelectValue placeholder="Tipo de contratación" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">
                Todos los contratos
              </SelectItem>

              <SelectItem value="PLANTA_PERMANENTE">
                Planta permanente
              </SelectItem>

              <SelectItem value="MONOTRIBUTISTA">
                Monotributistas
              </SelectItem>

              <SelectItem value="CONTRATO_CON_APORTES">
                Contratos con aportes
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={directionFilter}
            onValueChange={setDirectionFilter}
          >
            <SelectTrigger className="w-full lg:w-[240px]">
              <SelectValue placeholder="Dirección" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">
                Todas las direcciones
              </SelectItem>

              {directions.map((direction) => (
                <SelectItem
                  key={direction}
                  value={direction}
                >
                  {direction}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(
                value as StatusFilter,
              )
            }
          >
            <SelectTrigger className="w-full lg:w-[170px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="active">
                Activos
              </SelectItem>

              <SelectItem value="inactive">
                Dados de baja
              </SelectItem>

              <SelectItem value="all">
                Todos
              </SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              onClick={clearFilters}
            >
              Limpiar
            </Button>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <Table className="text-[11px] xl:text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[78px] min-w-[78px] px-2">
                    Legajo
                  </TableHead>

                  <TableHead className="min-w-[170px] px-2">
                    Nombre completo
                  </TableHead>

                  <TableHead className="w-[72px] min-w-[72px] px-2">
                    Código
                  </TableHead>

                  <TableHead className="min-w-[140px] px-2">
                    Dirección
                  </TableHead>

                  <TableHead className="min-w-[155px] px-2">
                    Área RR. HH.
                  </TableHead>

                  <TableHead className="min-w-[175px] px-2">
                    Contratación / detalle
                  </TableHead>

                  <TableHead className="min-w-[170px] px-2">
                    Tarea que realiza
                  </TableHead>

                  <TableHead className="w-[76px] min-w-[76px] px-2">
                    Estado
                  </TableHead>

                  <TableHead className="w-[110px] min-w-[110px] px-2 text-right">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginatedPersonnel.length ===
                0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No se encontraron registros de
                      personal.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPersonnel.map(
                    (person) => {
                      const isUpdating =
                        updatingId === person.id;

                      return (
                        <TableRow
                          key={person.id}
                          className="align-top"
                        >
                          <TableCell className="px-2 py-2 font-medium">
                            {person.legajo}
                          </TableCell>

                          <TableCell className="px-2 py-2 font-medium">
                            <p className="max-w-[180px] whitespace-normal leading-4">
                              {person.nombre_completo}
                            </p>
                          </TableCell>

                          <TableCell className="px-2 py-2 font-medium">
                            {person.codigo_direccion || "-"}
                          </TableCell>

                          <TableCell className="px-2 py-2">
                            <p className="max-w-[165px] whitespace-normal leading-4">
                              {person.direccion || "-"}
                            </p>
                          </TableCell>

                          <TableCell className="px-2 py-2">
                            <p className="max-w-[185px] whitespace-normal leading-4">
                              {person.area_rrhh || "-"}
                            </p>
                          </TableCell>

                          <TableCell className="px-2 py-2">
                            <div className="space-y-1">
                              <Badge
                                variant={getContractBadgeVariant(
                                  person.tipo_contrato,
                                )}
                              >
                                {formatContractType(
                                  person.tipo_contrato,
                                )}
                              </Badge>

                              {person.tipo_contrato ===
                                "PLANTA_PERMANENTE" && (
                                <p className="text-xs text-muted-foreground">
                                  {person.numero_resolucion
                                    ? `Resolución: ${person.numero_resolucion}`
                                    : "Sin resolución"}
                                </p>
                              )}

                              {person.tipo_contrato ===
                                "MONOTRIBUTISTA" && (
                                <div className="space-y-1 text-xs text-muted-foreground">
                                  <p>
                                    {person.convenio
                                      ? "Con convenio"
                                      : "Sin convenio"}
                                  </p>

                                  {person.convenio && (
                                    <p>
                                      {person.numero_resolucion
                                        ? `Resolución: ${person.numero_resolucion}`
                                        : "Resolución no informada"}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="px-2 py-2">
                            <p className="max-w-[210px] whitespace-normal leading-4">
                              {person.tarea || "-"}
                            </p>
                          </TableCell>

                          <TableCell className="px-2 py-2">
                            {person.activo ? (
                              <Badge variant="default">
                                Activo
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                Baja
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="px-2 py-2 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  onEdit(person)
                                }
                                disabled={isUpdating}
                                className="size-7"
                                title="Editar personal"
                              >
                                <Pencil className="size-4" />
                              </Button>

                              {person.activo ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    onDeactivate(person)
                                  }
                                  disabled={isUpdating}
                                  title="Dar de baja"
                                  className="size-7 text-destructive hover:text-destructive"
                                >
                                  <UserX className="size-4" />
                                </Button>
                              ) : (
                                <>
                                  {onReactivate && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        onReactivate(
                                          person,
                                        )
                                      }
                                      disabled={isUpdating}
                                      title="Reactivar personal"
                                      className="size-7"
                                    >
                                      <UserCheck className="size-4" />
                                    </Button>
                                  )}

                                  {onDelete && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        onDelete(person)
                                      }
                                      disabled={isUpdating}
                                      title="Eliminar definitivamente"
                                      className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    },
                  )
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando{" "}
            <span className="font-medium text-foreground">
              {paginatedPersonnel.length}
            </span>{" "}
            de{" "}
            <span className="font-medium text-foreground">
              {filteredPersonnel.length}
            </span>{" "}
            registros
          </p>

          <div className="flex flex-wrap items-center justify-center gap-1 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() =>
                setCurrentPage((page) =>
                  Math.max(1, page - 1),
                )
              }
              disabled={currentPage === 1}
              className="size-8"
              title="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>

            {visiblePages[0] > 1 && (
              <>
                <Button
                  type="button"
                  variant={
                    currentPage === 1
                      ? "default"
                      : "outline"
                  }
                  size="icon"
                  onClick={() => setCurrentPage(1)}
                  className="size-8 text-xs"
                >
                  1
                </Button>

                {visiblePages[0] > 2 && (
                  <span className="px-1 text-sm text-muted-foreground">
                    …
                  </span>
                )}
              </>
            )}

            {visiblePages.map((page) => (
              <Button
                key={page}
                type="button"
                variant={
                  currentPage === page
                    ? "default"
                    : "outline"
                }
                size="icon"
                onClick={() => setCurrentPage(page)}
                className="size-8 text-xs"
              >
                {page}
              </Button>
            ))}

            {visiblePages[visiblePages.length - 1] <
              totalPages && (
              <>
                {visiblePages[
                  visiblePages.length - 1
                ] <
                  totalPages - 1 && (
                  <span className="px-1 text-sm text-muted-foreground">
                    …
                  </span>
                )}

                <Button
                  type="button"
                  variant={
                    currentPage === totalPages
                      ? "default"
                      : "outline"
                  }
                  size="icon"
                  onClick={() =>
                    setCurrentPage(totalPages)
                  }
                  className="size-8 text-xs"
                >
                  {totalPages}
                </Button>
              </>
            )}

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(totalPages, page + 1),
                )
              }
              disabled={currentPage === totalPages}
              className="size-8"
              title="Página siguiente"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
