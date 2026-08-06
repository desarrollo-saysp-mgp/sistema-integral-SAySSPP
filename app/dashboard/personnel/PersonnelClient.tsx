"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  FileDown,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/useUser";

import type {
  Personnel,
  PersonnelInsert,
  PersonnelUpdate,
} from "@/types";

import { PersonnelTable } from "./PersonnelTable";
import { PersonnelForm } from "./PersonnelForm";
import { exportPersonnelToPdf } from "./personnelPdf";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const getUniqueSortedValues = (
  values: Array<string | null | undefined>,
) =>
  [
    ...new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) =>
    a.localeCompare(b, "es", {
      sensitivity: "base",
    }),
  );

type ConfirmationAction =
  | "deactivate"
  | "reactivate"
  | "delete"
  | null;

export function PersonnelClient() {
  const { user, canManagePersonnel } = useUser();

  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [filteredPersonnelForExport, setFilteredPersonnelForExport] =
    useState<Personnel[]>([]);
  const [appliedFiltersForExport, setAppliedFiltersForExport] =
    useState<string[]>([]);
  const [selectedPerson, setSelectedPerson] =
    useState<Personnel | null>(null);

  const [confirmationAction, setConfirmationAction] =
    useState<ConfirmationAction>(null);
  const [confirmationPerson, setConfirmationPerson] =
    useState<Personnel | null>(null);

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
        console.error("Error al cargar el personal:", loadError);

        setError(
          "No se pudo cargar el listado de personal. Intentá nuevamente.",
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

  const indicators = useMemo(() => {
    const activePersonnel = personnel.filter((item) => item.activo);

    return {
      total: activePersonnel.length,

      permanent: activePersonnel.filter(
        (item) =>
          item.tipo_contrato === "PLANTA_PERMANENTE",
      ).length,

      monotributists: activePersonnel.filter(
        (item) =>
          item.tipo_contrato === "MONOTRIBUTISTA",
      ).length,

      contributionsContract: activePersonnel.filter(
        (item) =>
          item.tipo_contrato === "CONTRATO_CON_APORTES",
      ).length,
    };
  }, [personnel]);

  const directionOptions = useMemo(
    () =>
      getUniqueSortedValues(
        personnel.map((item) => item.direccion),
      ),
    [personnel],
  );

  const areaOptions = useMemo(
    () =>
      getUniqueSortedValues(
        personnel.map((item) => item.area_rrhh),
      ),
    [personnel],
  );

  const taskOptions = useMemo(
    () =>
      getUniqueSortedValues(
        personnel.map((item) => item.tarea),
      ),
    [personnel],
  );

  const handleFilteredChange = useCallback(
    (
      filteredPersonnel: Personnel[],
      filters: string[],
    ) => {
      setFilteredPersonnelForExport(filteredPersonnel);
      setAppliedFiltersForExport(filters);
    },
    [],
  );

  const handleExportPdf = () => {
    exportPersonnelToPdf(filteredPersonnelForExport, {
      filters: appliedFiltersForExport,
      title: "Listado de personal",
    });
  };

  const handleNewPersonnel = () => {
    setSelectedPerson(null);
    setFormOpen(true);
  };

  const handleEditPersonnel = (person: Personnel) => {
    setSelectedPerson(person);
    setFormOpen(true);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);

    if (!open) {
      setSelectedPerson(null);
    }
  };

  const handleSavePersonnel = async (
    formData: PersonnelInsert,
  ): Promise<{ success: boolean; error?: string }> => {
    const supabase = createClient();

    try {
      if (selectedPerson) {
        const updateData: PersonnelUpdate = {
          ...formData,
          actualizado_por: user?.id ?? null,
        };

        const { data, error: updateError } = await supabase
          .from("personnel")
          .update(updateData)
          .eq("id", selectedPerson.id)
          .select("*")
          .single();

        if (updateError) {
          if (updateError.code === "23505") {
            return {
              success: false,
              error:
                "Ya existe otra persona con ese número de legajo.",
            };
          }

          throw updateError;
        }

        const updatedPerson = data as Personnel;

        setPersonnel((currentPersonnel) =>
          currentPersonnel.map((item) =>
            item.id === updatedPerson.id
              ? updatedPerson
              : item,
          ),
        );

        toast.success("Personal actualizado correctamente.");

        return { success: true };
      }

      const insertData: PersonnelInsert = {
        ...formData,
        activo: true,
        creado_por: user?.id ?? null,
        actualizado_por: user?.id ?? null,
      };

      const { data, error: insertError } = await supabase
        .from("personnel")
        .insert(insertData)
        .select("*")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          return {
            success: false,
            error:
              "Ya existe una persona con ese número de legajo.",
          };
        }

        throw insertError;
      }

      const newPerson = data as Personnel;

      setPersonnel((currentPersonnel) =>
        [...currentPersonnel, newPerson].sort((a, b) =>
          a.nombre_completo.localeCompare(
            b.nombre_completo,
            "es",
            {
              sensitivity: "base",
            },
          ),
        ),
      );

      toast.success("Personal creado correctamente.");

      return { success: true };
    } catch (saveError) {
      console.error(
        "Error al guardar el personal:",
        saveError,
      );

      return {
        success: false,
        error:
          "No se pudo guardar el registro. Intentá nuevamente.",
      };
    }
  };

  const openConfirmation = (
    action: Exclude<ConfirmationAction, null>,
    person: Personnel,
  ) => {
    if (updatingId) return;

    setConfirmationAction(action);
    setConfirmationPerson(person);
  };

  const closeConfirmation = () => {
    if (updatingId) return;

    setConfirmationAction(null);
    setConfirmationPerson(null);
  };

  const deactivatePersonnel = async (
    person: Personnel,
  ) => {
    if (!person.activo || updatingId) return;

    setUpdatingId(person.id);

    const toastId = toast.loading(
      `Dando de baja a ${person.nombre_completo}...`,
    );

    try {
      const supabase = createClient();
      const deactivationDate = new Date().toISOString();

      const { data, error: updateError } = await supabase
        .from("personnel")
        .update({
          activo: false,
          fecha_baja: deactivationDate,
          motivo_baja: null,
          dado_de_baja_por: user?.id ?? null,
          actualizado_por: user?.id ?? null,
        })
        .eq("id", person.id)
        .select("*")
        .single();

      if (updateError) {
        throw updateError;
      }

      const updatedPerson = data as Personnel;

      setPersonnel((currentPersonnel) =>
        currentPersonnel.map((item) =>
          item.id === updatedPerson.id
            ? updatedPerson
            : item,
        ),
      );

      toast.success(
        "La persona fue dada de baja correctamente.",
        {
          id: toastId,
        },
      );
    } catch (deactivateError) {
      console.error(
        "Error al dar de baja al personal:",
        deactivateError,
      );

      toast.error(
        "No se pudo dar de baja el registro.",
        {
          id: toastId,
        },
      );
    } finally {
      setUpdatingId(null);
      setConfirmationAction(null);
      setConfirmationPerson(null);
    }
  };

  const reactivatePersonnel = async (
    person: Personnel,
  ) => {
    if (person.activo || updatingId) return;

    setUpdatingId(person.id);

    const toastId = toast.loading(
      `Reactivando a ${person.nombre_completo}...`,
    );

    try {
      const supabase = createClient();

      const { data, error: updateError } = await supabase
        .from("personnel")
        .update({
          activo: true,
          fecha_baja: null,
          motivo_baja: null,
          dado_de_baja_por: null,
          actualizado_por: user?.id ?? null,
        })
        .eq("id", person.id)
        .select("*")
        .single();

      if (updateError) {
        throw updateError;
      }

      const updatedPerson = data as Personnel;

      setPersonnel((currentPersonnel) =>
        currentPersonnel.map((item) =>
          item.id === updatedPerson.id
            ? updatedPerson
            : item,
        ),
      );

      toast.success(
        "La persona fue reactivada correctamente.",
        {
          id: toastId,
        },
      );
    } catch (reactivateError) {
      console.error(
        "Error al reactivar al personal:",
        reactivateError,
      );

      toast.error(
        "No se pudo reactivar el registro.",
        {
          id: toastId,
        },
      );
    } finally {
      setUpdatingId(null);
      setConfirmationAction(null);
      setConfirmationPerson(null);
    }
  };

  const deletePersonnel = async (
    person: Personnel,
  ) => {
    if (person.activo || updatingId) return;

    setUpdatingId(person.id);

    const toastId = toast.loading(
      `Eliminando a ${person.nombre_completo}...`,
    );

    try {
      const supabase = createClient();

      const { error: deleteError } = await supabase
        .from("personnel")
        .delete()
        .eq("id", person.id)
        .eq("activo", false);

      if (deleteError) {
        throw deleteError;
      }

      setPersonnel((currentPersonnel) =>
        currentPersonnel.filter(
          (item) => item.id !== person.id,
        ),
      );

      toast.success(
        "El registro fue eliminado definitivamente.",
        {
          id: toastId,
        },
      );
    } catch (deleteError) {
      console.error(
        "Error al eliminar el personal:",
        deleteError,
      );

      toast.error(
        "No se pudo eliminar el registro.",
        {
          id: toastId,
        },
      );
    } finally {
      setUpdatingId(null);
      setConfirmationAction(null);
      setConfirmationPerson(null);
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmationPerson || !confirmationAction) return;

    if (confirmationAction === "deactivate") {
      await deactivatePersonnel(confirmationPerson);
      return;
    }

    if (confirmationAction === "reactivate") {
      await reactivatePersonnel(confirmationPerson);
      return;
    }

    await deletePersonnel(confirmationPerson);
  };

  const confirmationContent = useMemo(() => {
    if (!confirmationPerson || !confirmationAction) {
      return null;
    }

    if (confirmationAction === "deactivate") {
      return {
        icon: UserX,
        title: "Dar de baja al personal",
        description: (
          <>
            Vas a dar de baja a{" "}
            <strong>{confirmationPerson.nombre_completo}</strong>.
            El registro seguirá guardado y podrás reactivarlo más adelante.
          </>
        ),
        actionLabel: "Dar de baja",
        actionClassName:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      };
    }

    if (confirmationAction === "reactivate") {
      return {
        icon: UserCheck,
        title: "Reactivar personal",
        description: (
          <>
            ¿Querés reactivar a{" "}
            <strong>{confirmationPerson.nombre_completo}</strong>?
            La persona volverá a aparecer entre los registros activos.
          </>
        ),
        actionLabel: "Reactivar",
        actionClassName: "",
      };
    }

    return {
      icon: Trash2,
      title: "Eliminar definitivamente",
      description: (
        <>
          Vas a eliminar a{" "}
          <strong>{confirmationPerson.nombre_completo}</strong>.
          Esta acción es permanente y no se puede deshacer.
        </>
      ),
      actionLabel: "Eliminar definitivamente",
      actionClassName:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    };
  }, [confirmationAction, confirmationPerson]);

  if (loading) {
    return (
      <>
        <PageLoader show />

        <div className="mx-auto flex min-h-[55vh] w-full max-w-[1600px] items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />

            <p className="text-sm">
              Cargando módulo de Personal...
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!canManagePersonnel) {
    return null;
  }

  const ConfirmationIcon =
    confirmationContent?.icon ?? AlertTriangle;

  return (
    <>
      <PageLoader show={false} />

      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Personal
            </h1>

            <p className="mt-2 text-muted-foreground">
              Administración del personal de la Secretaría.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              asChild
            >
              <Link href="/dashboard/personnel/datos">
                <BarChart3 className="mr-2 size-4" />
                Datos
              </Link>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleExportPdf}
              disabled={filteredPersonnelForExport.length === 0}
            >
              <FileDown className="mr-2 size-4" />
              Exportar PDF
            </Button>

            <Button
              type="button"
              onClick={handleNewPersonnel}
            >
              <Plus className="mr-2 size-4" />
              Nuevo personal
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive/40">
            <CardContent className="flex flex-col gap-3 py-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
              <span>{error}</span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void loadPersonnel(true)
                }
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 size-4" />
                )}

                Reintentar
              </Button>
            </CardContent>
          </Card>
        )}

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">
              Resumen del personal
            </h2>

            <p className="text-sm text-muted-foreground">
              Cantidades correspondientes a los registros activos.
            </p>
          </div>

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
                    {indicators.contributionsContract}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">
              Listado de personal
            </h2>

            <p className="text-sm text-muted-foreground">
              Buscá, filtrá, editá o administrá las bajas del personal.
            </p>
          </div>

          <PersonnelTable
            personnel={personnel}
            updatingId={updatingId}
            onEdit={handleEditPersonnel}
            onDeactivate={(person) =>
              openConfirmation("deactivate", person)
            }
            onReactivate={(person) =>
              openConfirmation("reactivate", person)
            }
            onDelete={(person) =>
              openConfirmation("delete", person)
            }
            onFilteredChange={handleFilteredChange}
          />
        </section>
      </div>

      <PersonnelForm
        open={formOpen}
        person={selectedPerson}
        directionOptions={directionOptions}
        areaOptions={areaOptions}
        taskOptions={taskOptions}
        onOpenChange={handleFormOpenChange}
        onSubmit={handleSavePersonnel}
      />

      <AlertDialog
        open={Boolean(
          confirmationAction && confirmationPerson,
        )}
        onOpenChange={(open) => {
          if (!open) {
            closeConfirmation();
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-[500px]">
          <AlertDialogHeader>
            <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <ConfirmationIcon
                className={
                  confirmationAction === "reactivate"
                    ? "size-6"
                    : "size-6 text-destructive"
                }
              />
            </div>

            <AlertDialogTitle>
              {confirmationContent?.title}
            </AlertDialogTitle>

            <AlertDialogDescription className="leading-6">
              {confirmationContent?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={Boolean(updatingId)}
            >
              Cancelar
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void executeConfirmedAction();
              }}
              disabled={Boolean(updatingId)}
              className={
                confirmationContent?.actionClassName
              }
            >
              {updatingId && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}

              {confirmationContent?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
