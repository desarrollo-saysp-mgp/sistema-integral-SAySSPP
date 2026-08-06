"use client";

import { useEffect, useState } from "react";

import type {
  Personnel,
  PersonnelInsert,
} from "@/types";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type ContractType =
  | "PLANTA_PERMANENTE"
  | "MONOTRIBUTISTA"
  | "CONTRATO_CON_APORTES";

type FormState = {
  legajo: string;
  nombre_completo: string;
  area_rrhh: string;
  codigo_direccion: string;
  direccion: string;
  tarea: string;
  tipo_contrato: ContractType;
  convenio: boolean;
  numero_resolucion: string;
};

interface PersonnelFormProps {
  open: boolean;
  person?: Personnel | null;
  directionOptions: string[];
  areaOptions: string[];
  taskOptions: string[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    data: PersonnelInsert,
  ) => Promise<{ success: boolean; error?: string }>;
}

const OTHER_OPTION = "__OTHER__";

const EMPTY_FORM: FormState = {
  legajo: "",
  nombre_completo: "",
  area_rrhh: "",
  codigo_direccion: "",
  direccion: "",
  tarea: "",
  tipo_contrato: "PLANTA_PERMANENTE",
  convenio: false,
  numero_resolucion: "",
};

const includesOption = (
  options: string[],
  value: string,
) =>
  options.some(
    (option) =>
      option.localeCompare(value, "es", {
        sensitivity: "base",
      }) === 0,
  );

export function PersonnelForm({
  open,
  person,
  directionOptions,
  areaOptions,
  taskOptions,
  onOpenChange,
  onSubmit,
}: PersonnelFormProps) {
  const isEditing = Boolean(person);

  const [formData, setFormData] =
    useState<FormState>(EMPTY_FORM);

  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [customArea, setCustomArea] =
    useState(false);
  const [customDirection, setCustomDirection] =
    useState(false);
  const [customTask, setCustomTask] =
    useState(false);

  const isPermanent =
    formData.tipo_contrato === "PLANTA_PERMANENTE";

  const isMonotributist =
    formData.tipo_contrato === "MONOTRIBUTISTA";

  const shouldShowResolution =
    isPermanent ||
    (isMonotributist && formData.convenio);

  useEffect(() => {
    if (person) {
      const area = person.area_rrhh ?? "";
      const direction = person.direccion ?? "";
      const task = person.tarea ?? "";

      setFormData({
        legajo: String(person.legajo ?? ""),
        nombre_completo:
          person.nombre_completo ?? "",
        area_rrhh: area,
        codigo_direccion:
          person.codigo_direccion != null
            ? String(person.codigo_direccion)
            : "",
        direccion: direction,
        tarea: task,
        tipo_contrato: person.tipo_contrato,
        convenio:
          person.tipo_contrato ===
          "MONOTRIBUTISTA"
            ? Boolean(person.convenio)
            : false,
        numero_resolucion:
          person.numero_resolucion ?? "",
      });

      setCustomArea(
        Boolean(area) &&
          !includesOption(areaOptions, area),
      );
      setCustomDirection(
        Boolean(direction) &&
          !includesOption(
            directionOptions,
            direction,
          ),
      );
      setCustomTask(
        Boolean(task) &&
          !includesOption(taskOptions, task),
      );
    } else {
      setFormData(EMPTY_FORM);
      setCustomArea(false);
      setCustomDirection(false);
      setCustomTask(false);
    }

    setErrors({});
  }, [
    person,
    open,
    areaOptions,
    directionOptions,
    taskOptions,
  ]);

  const handleChange = (
    field: keyof FormState,
    value: string | boolean,
  ) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  };

  const handleAreaSelect = (value: string) => {
    if (value === OTHER_OPTION) {
      setCustomArea(true);
      handleChange("area_rrhh", "");
      return;
    }

    setCustomArea(false);
    handleChange("area_rrhh", value);
  };

  const handleDirectionSelect = (
    value: string,
  ) => {
    if (value === OTHER_OPTION) {
      setCustomDirection(true);
      handleChange("direccion", "");
      return;
    }

    setCustomDirection(false);
    handleChange("direccion", value);
  };

  const handleTaskSelect = (value: string) => {
    if (value === OTHER_OPTION) {
      setCustomTask(true);
      handleChange("tarea", "");
      return;
    }

    setCustomTask(false);
    handleChange("tarea", value);
  };

  const handleContractTypeChange = (
    value: ContractType,
  ) => {
    setFormData((current) => ({
      ...current,
      tipo_contrato: value,
      convenio:
        value === "MONOTRIBUTISTA"
          ? current.convenio
          : false,
      numero_resolucion:
        value === "CONTRATO_CON_APORTES"
          ? ""
          : current.numero_resolucion,
    }));

    setErrors((current) => {
      const next = { ...current };
      delete next.tipo_contrato;
      delete next.numero_resolucion;
      return next;
    });
  };

  const handleConvenioChange = (
    checked: boolean,
  ) => {
    setFormData((current) => ({
      ...current,
      convenio: checked,
      numero_resolucion:
        checked
          ? current.numero_resolucion
          : "",
    }));

    if (
      !checked &&
      errors.numero_resolucion
    ) {
      setErrors((current) => {
        const next = { ...current };
        delete next.numero_resolucion;
        return next;
      });
    }
  };

  const validateForm = () => {
    const nextErrors: Partial<
      Record<keyof FormState, string>
    > = {};

    if (!formData.legajo.trim()) {
      nextErrors.legajo =
        "El legajo es requerido";
    } else if (
      !Number.isInteger(
        Number(formData.legajo),
      ) ||
      Number(formData.legajo) <= 0
    ) {
      nextErrors.legajo =
        "El legajo debe ser un número entero válido";
    }

    if (
      !formData.nombre_completo.trim()
    ) {
      nextErrors.nombre_completo =
        "El nombre completo es requerido";
    }

    if (!formData.tipo_contrato) {
      nextErrors.tipo_contrato =
        "El tipo de contratación es requerido";
    }

    if (
      formData.codigo_direccion &&
      !/^\d+(\/\d+)*$/.test(
        formData.codigo_direccion,
      )
    ) {
      nextErrors.codigo_direccion =
        "Ingresá uno o más códigos separados por /";
    }

    if (
      isMonotributist &&
      formData.convenio &&
      !formData.numero_resolucion.trim()
    ) {
      nextErrors.numero_resolucion =
        "El número de resolución es requerido cuando tiene convenio";
    }

    setErrors(nextErrors);

    return (
      Object.keys(nextErrors).length === 0
    );
  };

  const handleSubmit = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    const payload: PersonnelInsert = {
      legajo: Number(formData.legajo),

      nombre_completo:
        formData.nombre_completo.trim(),

      area_rrhh:
        formData.area_rrhh.trim() || null,

      codigo_direccion:
        formData.codigo_direccion.trim() ||
        null,

      direccion:
        formData.direccion.trim() || null,

      tarea:
        formData.tarea.trim() || null,

      tipo_contrato:
        formData.tipo_contrato,

      convenio:
        isMonotributist
          ? formData.convenio
          : null,

      numero_resolucion:
        shouldShowResolution
          ? formData.numero_resolucion.trim() ||
            null
          : null,

      regimen_especial: null,
      hora_ingreso: null,
      hora_salida: null,
      horas_arregladas: null,
      fecha_actualizacion: null,
    };

    try {
      const result =
        await onSubmit(payload);

      if (result.success) {
        onOpenChange(false);
        return;
      }

      setErrors((current) => ({
        ...current,
        legajo:
          result.error ||
          "No se pudo guardar el registro",
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden sm:max-w-[1050px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? "Editar personal"
              : "Nuevo personal"}
          </DialogTitle>

          <DialogDescription>
            {isEditing
              ? "Actualizá la información laboral de la persona."
              : "Completá los datos para incorporar una persona al listado."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legajo">
                Legajo *
              </Label>

              <Input
                id="legajo"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.legajo}
                onChange={(event) => {
                  const value =
                    event.target.value.replace(
                      /\D/g,
                      "",
                    );

                  handleChange(
                    "legajo",
                    value,
                  );
                }}
                disabled={isSubmitting}
              />

              {errors.legajo && (
                <p className="text-sm text-destructive">
                  {errors.legajo}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre_completo">
                Nombre completo *
              </Label>

              <Input
                id="nombre_completo"
                value={
                  formData.nombre_completo
                }
                onChange={(event) =>
                  handleChange(
                    "nombre_completo",
                    event.target.value,
                  )
                }
                disabled={isSubmitting}
              />

              {errors.nombre_completo && (
                <p className="text-sm text-destructive">
                  {errors.nombre_completo}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="area_rrhh">
                Área RR. HH.
              </Label>

              {!customArea ? (
                <Select
                  value={
                    formData.area_rrhh ||
                    undefined
                  }
                  onValueChange={
                    handleAreaSelect
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id="area_rrhh"
                    className="w-full min-w-0 [&>span]:truncate"
                  >
                    <SelectValue placeholder="Seleccionar área" />
                  </SelectTrigger>

                  <SelectContent className="max-h-[320px]">
                    {areaOptions.map(
                      (option) => (
                        <SelectItem
                          key={option}
                          value={option}
                        >
                          {option}
                        </SelectItem>
                      ),
                    )}

                    <SelectItem
                      value={OTHER_OPTION}
                    >
                      Otra área...
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="area_rrhh"
                    value={
                      formData.area_rrhh
                    }
                    onChange={(event) =>
                      handleChange(
                        "area_rrhh",
                        event.target.value,
                      )
                    }
                    placeholder="Escribí el área"
                    disabled={isSubmitting}
                    className="min-w-0"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCustomArea(false);
                      handleChange(
                        "area_rrhh",
                        "",
                      );
                    }}
                    disabled={isSubmitting}
                    className="shrink-0"
                  >
                    Lista
                  </Button>
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-2">
              <Label htmlFor="codigo_direccion">
                Código
              </Label>

              <Input
                id="codigo_direccion"
                type="text"
                inputMode="text"
                value={
                  formData.codigo_direccion
                }
                onChange={(event) => {
                  const value =
                    event.target.value
                      .replace(
                        /[^0-9/]/g,
                        "",
                      )
                      .replace(
                        /\/{2,}/g,
                        "/",
                      )
                      .replace(/^\/+/, "");

                  handleChange(
                    "codigo_direccion",
                    value,
                  );
                }}
                placeholder="Ej.: 52 o 52/56"
                disabled={isSubmitting}
              />

              {errors.codigo_direccion && (
                <p className="text-sm text-destructive">
                  {
                    errors.codigo_direccion
                  }
                </p>
              )}
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <Label htmlFor="direccion">
              Dirección
            </Label>

            {!customDirection ? (
              <Select
                value={
                  formData.direccion ||
                  undefined
                }
                onValueChange={
                  handleDirectionSelect
                }
                disabled={isSubmitting}
              >
                <SelectTrigger
                  id="direccion"
                  className="w-full min-w-0 [&>span]:truncate"
                >
                  <SelectValue placeholder="Seleccionar dirección" />
                </SelectTrigger>

                <SelectContent className="max-h-[320px]">
                  {directionOptions.map(
                    (option) => (
                      <SelectItem
                        key={option}
                        value={option}
                      >
                        {option}
                      </SelectItem>
                    ),
                  )}

                  <SelectItem
                    value={OTHER_OPTION}
                  >
                    Otra dirección...
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-2">
                <Input
                  id="direccion"
                  value={
                    formData.direccion
                  }
                  onChange={(event) =>
                    handleChange(
                      "direccion",
                      event.target.value,
                    )
                  }
                  placeholder="Escribí la dirección"
                  disabled={isSubmitting}
                  className="min-w-0"
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCustomDirection(
                      false,
                    );
                    handleChange(
                      "direccion",
                      "",
                    );
                  }}
                  disabled={isSubmitting}
                  className="shrink-0"
                >
                  Lista
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              El código se carga manualmente y puede contener más de uno, por ejemplo 52/56.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tarea">
              Tarea que realiza
            </Label>

            {!customTask ? (
              <Select
                value={
                  formData.tarea || undefined
                }
                onValueChange={
                  handleTaskSelect
                }
                disabled={isSubmitting}
              >
                <SelectTrigger id="tarea">
                  <SelectValue placeholder="Seleccionar tarea" />
                </SelectTrigger>

                <SelectContent className="max-h-[320px]">
                  {taskOptions.map(
                    (option) => (
                      <SelectItem
                        key={option}
                        value={option}
                      >
                        {option}
                      </SelectItem>
                    ),
                  )}

                  <SelectItem
                    value={OTHER_OPTION}
                  >
                    Otra tarea...
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <textarea
                  id="tarea"
                  value={formData.tarea}
                  onChange={(
                    event: React.ChangeEvent<HTMLTextAreaElement>,
                  ) =>
                    handleChange(
                      "tarea",
                      event.target.value,
                    )
                  }
                  rows={3}
                  placeholder="Escribí la tarea"
                  disabled={isSubmitting}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCustomTask(false);
                    handleChange(
                      "tarea",
                      "",
                    );
                  }}
                  disabled={isSubmitting}
                >
                  Volver a la lista
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo_contrato">
              Tipo de contratación *
            </Label>

            <Select
              value={
                formData.tipo_contrato
              }
              onValueChange={(value) =>
                handleContractTypeChange(
                  value as ContractType,
                )
              }
              disabled={isSubmitting}
            >
              <SelectTrigger id="tipo_contrato">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="PLANTA_PERMANENTE">
                  Planta permanente
                </SelectItem>

                <SelectItem value="MONOTRIBUTISTA">
                  Monotributista
                </SelectItem>

                <SelectItem value="CONTRATO_CON_APORTES">
                  Contrato con aportes
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isMonotributist && (
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Checkbox
                id="convenio"
                checked={
                  formData.convenio
                }
                onCheckedChange={(
                  checked,
                ) =>
                  handleConvenioChange(
                    checked === true,
                  )
                }
                disabled={isSubmitting}
              />

              <Label
                htmlFor="convenio"
                className="cursor-pointer"
              >
                Tiene convenio
              </Label>
            </div>
          )}

          {shouldShowResolution && (
            <div className="space-y-2">
              <Label htmlFor="numero_resolucion">
                N.º de resolución
                {isMonotributist &&
                formData.convenio
                  ? " *"
                  : ""}
              </Label>

              <Input
                id="numero_resolucion"
                value={
                  formData.numero_resolucion
                }
                onChange={(event) =>
                  handleChange(
                    "numero_resolucion",
                    event.target.value,
                  )
                }
                disabled={isSubmitting}
              />

              {errors.numero_resolucion && (
                <p className="text-sm text-destructive">
                  {
                    errors.numero_resolucion
                  }
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onOpenChange(false)
              }
              disabled={isSubmitting}
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Guardando..."
                : isEditing
                  ? "Guardar cambios"
                  : "Crear personal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
