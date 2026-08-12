"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  Loader2,
  ReceiptText,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/useUser";
import type { Personnel } from "@/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/page-loader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DirectionSummary = {
  direction: string;
  permanent: number;
  monotributists: number;
  contributions: number;
  total: number;
};

const normalizeValue = (
  value: string | null | undefined,
) => value?.trim() || "Sin informar";

const normalizeSearch = (value: unknown) =>
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

export function PersonnelDataClient() {
  const { canManagePersonnel } = useUser();

  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDirection, setSelectedDirection] =
    useState<string | null>(null);
  const [directionSearch, setDirectionSearch] = useState("");
  const [personSearch, setPersonSearch] = useState("");

  const loadPersonnel = useCallback(
    async (showRefreshLoader = false) => {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const supabase = createClient();

        const { data, error: personnelError } = await supabase
          .from("personnel")
          .select("*")
          .order("nombre_completo", { ascending: true });

        if (personnelError) {
          throw personnelError;
        }

        setPersonnel((data ?? []) as Personnel[]);
      } catch (loadError) {
        console.error(
          "Error al cargar los datos del personal:",
          loadError,
        );

        setError(
          "No se pudieron cargar los datos del personal.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadPersonnel();
  }, [loadPersonnel]);

  const activePersonnel = useMemo(
    () => personnel.filter((person) => person.activo),
    [personnel],
  );

  const indicators = useMemo(
    () => ({
      total: activePersonnel.length,
      permanent: activePersonnel.filter(
        (person) =>
          person.tipo_contrato === "PLANTA_PERMANENTE",
      ).length,
      monotributists: activePersonnel.filter(
        (person) =>
          person.tipo_contrato === "MONOTRIBUTISTA",
      ).length,
      contributions: activePersonnel.filter(
        (person) =>
          person.tipo_contrato ===
          "CONTRATO_CON_APORTES",
      ).length,
    }),
    [activePersonnel],
  );

  const directionSummary = useMemo<DirectionSummary[]>(() => {
    const groups = new Map<string, DirectionSummary>();

    activePersonnel.forEach((person) => {
      const direction = normalizeValue(person.direccion);

      const current = groups.get(direction) ?? {
        direction,
        permanent: 0,
        monotributists: 0,
        contributions: 0,
        total: 0,
      };

      current.total += 1;

      if (
        person.tipo_contrato === "PLANTA_PERMANENTE"
      ) {
        current.permanent += 1;
      } else if (
        person.tipo_contrato === "MONOTRIBUTISTA"
      ) {
        current.monotributists += 1;
      } else {
        current.contributions += 1;
      }

      groups.set(direction, current);
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.direction.localeCompare(b.direction, "es", {
        sensitivity: "base",
      }),
    );
  }, [activePersonnel]);

  const filteredDirections = useMemo(() => {
    const search = normalizeSearch(directionSearch);

    if (!search) return directionSummary;

    return directionSummary.filter((item) =>
      normalizeSearch(item.direction).includes(search),
    );
  }, [directionSearch, directionSummary]);

  const selectedPersonnel = useMemo(() => {
    if (!selectedDirection) return [];

    const search = normalizeSearch(personSearch);

    return activePersonnel
      .filter(
        (person) =>
          normalizeValue(person.direccion) ===
          selectedDirection,
      )
      .filter((person) => {
        if (!search) return true;

        return (
          normalizeSearch(
            person.nombre_completo,
          ).includes(search) ||
          normalizeSearch(person.legajo).includes(search) ||
          normalizeSearch(
            person.codigo_direccion,
          ).includes(search) ||
          normalizeSearch(person.area_rrhh).includes(search) ||
          normalizeSearch(person.tarea).includes(search)
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
    activePersonnel,
    personSearch,
    selectedDirection,
  ]);

  const selectDirection = (direction: string) => {
    setSelectedDirection(direction);
    setPersonSearch("");

    window.setTimeout(() => {
      document
        .getElementById("detalle-direccion")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 50);
  };

  if (loading) {
    return (
      <>
        <PageLoader show />

        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            <p className="text-sm">
              Cargando datos del personal...
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!canManagePersonnel) {
    return null;
  }

  return (
    <>
      <PageLoader show={false} />

      <div className="mx-auto w-full max-w-[1800px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              asChild
              className="-ml-3"
            >
              <Link href="/dashboard/personnel">
                <ArrowLeft className="mr-2 size-4" />
                Volver a Personal
              </Link>
            </Button>

            <h1 className="text-2xl font-bold sm:text-3xl">
              Datos del personal
            </h1>

            <p className="text-muted-foreground">
              Resumen de los registros activos agrupados por
              dirección. Seleccioná una dirección para ver su
              personal.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void loadPersonnel(true)}
            disabled={refreshing}
            className="w-full sm:w-auto"
          >
            {refreshing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Actualizar
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/40">
            <CardContent className="py-4 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Personal activo
                </p>
                <p className="text-2xl font-bold">
                  {indicators.total}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                <BadgeCheck className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Planta permanente
                </p>
                <p className="text-2xl font-bold">
                  {indicators.permanent}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                <ReceiptText className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Monotributistas
                </p>
                <p className="text-2xl font-bold">
                  {indicators.monotributists}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                <BriefcaseBusiness className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Contratos con aportes
                </p>
                <p className="text-2xl font-bold">
                  {indicators.contributions}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Personal por dirección
                </h2>
                <p className="text-sm text-muted-foreground">
                  Cada persona se cuenta una sola vez, sin importar
                  el código asignado.
                </p>
              </div>

              <div className="relative w-full sm:max-w-[360px]">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={directionSearch}
                  onChange={(event) =>
                    setDirectionSearch(event.target.value)
                  }
                  placeholder="Buscar dirección..."
                  className="pl-9"
                />
              </div>
            </div>

            {/* DESKTOP / TABLET */}
            <div className="hidden overflow-hidden rounded-xl border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      Dirección
                    </TableHead>
                    <TableHead className="w-[130px] text-center">
                      Planta
                    </TableHead>
                    <TableHead className="w-[150px] text-center">
                      Monotributistas
                    </TableHead>
                    <TableHead className="w-[130px] text-center">
                      Con aportes
                    </TableHead>
                    <TableHead className="w-[100px] text-center">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredDirections.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-28 text-center text-muted-foreground"
                      >
                        No se encontraron direcciones.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDirections.map((item) => (
                      <TableRow
                        key={item.direction}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          selectDirection(item.direction)
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" ||
                            event.key === " "
                          ) {
                            event.preventDefault();
                            selectDirection(item.direction);
                          }
                        }}
                        className={
                          selectedDirection === item.direction
                            ? "cursor-pointer bg-muted/70"
                            : "cursor-pointer transition-colors hover:bg-muted/40"
                        }
                      >
                        <TableCell className="font-medium">
                          {item.direction}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.permanent}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.monotributists}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.contributions}
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {item.total}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* MOBILE: CARDS, SIN SCROLL HORIZONTAL */}
            <div className="grid gap-3 md:hidden">
              {filteredDirections.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No se encontraron direcciones.
                </div>
              ) : (
                filteredDirections.map((item) => {
                  const isSelected =
                    selectedDirection === item.direction;

                  return (
                    <button
                      key={item.direction}
                      type="button"
                      onClick={() =>
                        selectDirection(item.direction)
                      }
                      className={
                        isSelected
                          ? "w-full rounded-2xl border border-primary/30 bg-muted/70 p-4 text-left shadow-sm transition"
                          : "w-full rounded-2xl border bg-background p-4 text-left shadow-sm transition hover:bg-muted/40"
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-base font-semibold leading-5 text-foreground">
                            {item.direction}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            Tocá para ver el personal de esta dirección
                          </p>
                        </div>

                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted font-bold text-foreground">
                          {item.total}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-muted/40 p-2 text-center">
                          <p className="text-[11px] leading-4 text-muted-foreground">
                            Planta
                          </p>

                          <p className="mt-1 text-lg font-bold text-foreground">
                            {item.permanent}
                          </p>
                        </div>

                        <div className="rounded-xl bg-muted/40 p-2 text-center">
                          <p className="text-[11px] leading-4 text-muted-foreground">
                            Monotrib.
                          </p>

                          <p className="mt-1 text-lg font-bold text-foreground">
                            {item.monotributists}
                          </p>
                        </div>

                        <div className="rounded-xl bg-muted/40 p-2 text-center">
                          <p className="text-[11px] leading-4 text-muted-foreground">
                            Con aportes
                          </p>

                          <p className="mt-1 text-lg font-bold text-foreground">
                            {item.contributions}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {selectedDirection && (
          <Card
            id="detalle-direccion"
            className="scroll-mt-24 rounded-2xl"
          >
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Personal de la dirección
                  </p>
                  <h2 className="break-words text-xl font-semibold sm:text-2xl">
                    {selectedDirection}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedPersonnel.length}{" "}
                    {selectedPersonnel.length === 1
                      ? "resultado"
                      : "resultados"}
                  </p>
                </div>

                <div className="relative w-full lg:max-w-[420px]">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={personSearch}
                    onChange={(event) =>
                      setPersonSearch(event.target.value)
                    }
                    placeholder="Buscar persona, legajo, área o tarea..."
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="hidden overflow-hidden rounded-xl border md:block">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">
                        Legajo
                      </TableHead>
                      <TableHead className="min-w-[210px]">
                        Nombre completo
                      </TableHead>
                      <TableHead className="w-[90px]">
                        Código
                      </TableHead>
                      <TableHead className="min-w-[190px]">
                        Área RR. HH.
                      </TableHead>
                      <TableHead className="min-w-[170px]">
                        Contratación
                      </TableHead>
                      <TableHead className="min-w-[220px]">
                        Tarea
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {selectedPersonnel.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-28 text-center text-muted-foreground"
                        >
                          No se encontraron personas.
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedPersonnel.map((person) => (
                        <TableRow key={person.id}>
                          <TableCell className="font-medium">
                            {person.legajo}
                          </TableCell>
                          <TableCell className="font-medium">
                            {person.nombre_completo}
                          </TableCell>
                          <TableCell>
                            {person.codigo_direccion || "-"}
                          </TableCell>
                          <TableCell>
                            {person.area_rrhh || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {formatContractType(
                                person.tipo_contrato,
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {person.tarea || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 md:hidden">
                {selectedPersonnel.length === 0 ? (
                  <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
                    No se encontraron personas.
                  </div>
                ) : (
                  selectedPersonnel.map((person) => (
                    <div
                      key={person.id}
                      className="space-y-3 rounded-xl border p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {person.nombre_completo}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Legajo {person.legajo}
                          </p>
                        </div>

                        <Badge variant="outline">
                          {formatContractType(
                            person.tipo_contrato,
                          )}
                        </Badge>
                      </div>

                      <div className="grid gap-2 text-sm">
                        <p>
                          <span className="text-muted-foreground">
                            Código:
                          </span>{" "}
                          {person.codigo_direccion || "-"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">
                            Área:
                          </span>{" "}
                          {person.area_rrhh || "-"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">
                            Tarea:
                          </span>{" "}
                          {person.tarea || "-"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
