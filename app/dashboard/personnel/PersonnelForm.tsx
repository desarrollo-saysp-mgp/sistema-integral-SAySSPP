"use client";

import { useEffect, useState } from "react";

import { PersonnelCatalogField } from "./PersonnelCatalogField";

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

  hora_ingreso: string;

  hora_salida: string;

  modalidad_horas_extra: string;

  horas_50: string;

  horas_100: string;

  horas_arregladas: string;

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

const OTHER_OPTION = "\_\_OTHER\_\_";

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

  hora_ingreso: "",

  hora_salida: "",

  modalidad_horas_extra: "NO",

  horas_50: "",

  horas_100: "",

  horas_arregladas: "",

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

const [customDirection, setCustomDirection] =

    useState(false);

const isPermanent =

    formData.tipo_contrato === "PLANTA_PERMANENTE";

  const isMonotributist =

    formData.tipo_contrato === "MONOTRIBUTISTA";

  const shouldShowResolution = !isMonotributist; // Solo planta permanente y contrato con aportes.

  const isExtraHours = formData.modalidad_horas_extra === "SI";

  const isArrangement = formData.modalidad_horas_extra === "ARREGLO";

  // Cada porcentaje se selecciona de manera independiente.
  // Es posible marcar 50 %, 100 %, ambos o ninguno.
  const handleExtraRateChange = (rate: "50" | "100", checked: boolean) => {
    setFormData((current) => ({
      ...current,
      [rate === "50" ? "horas_50" : "horas_100"]: checked ? "1" : "",
    }));
  };

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

        numero_resolucion: person.numero_resolucion ?? "",

        hora_ingreso: (person as Personnel & { hora_ingreso?: string | null }).hora_ingreso?.slice(0, 5) ?? "",

        hora_salida: (person as Personnel & { hora_salida?: string | null }).hora_salida?.slice(0, 5) ?? "",

        modalidad_horas_extra: (person as Personnel & { modalidad_horas_extra?: string | null }).modalidad_horas_extra ?? "NO",

        horas_50: String((person as Personnel & { horas_50?: number | null }).horas_50 ?? ""),

        horas_100: String((person as Personnel & { horas_100?: number | null }).horas_100 ?? ""),

        horas_arregladas: String((person as Personnel & { horas_arregladas?: number | null }).horas_arregladas ?? ""),

      });

      setCustomDirection(

        Boolean(direction) &&

          !includesOption(

            directionOptions,

            direction,

          ),

      );

    } else {

      setFormData(EMPTY_FORM);

      setCustomDirection(false);

    }

    setErrors({});

  }, [

    person,

    open,

    directionOptions,

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

  const handleContractTypeChange = (

    value: ContractType,

  ) => {

    setFormData((current) => ({

      ...current,

      tipo_contrato: value,

      convenio: false,

      numero_resolucion: value === "MONOTRIBUTISTA" ? "" : current.numero_resolucion,

    }));

    setErrors((current) => {

      const next = { ...current };

      delete next.tipo_contrato;

      delete next.numero_resolucion;

      return next;

    });

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

    // La cantidad de horas arregladas solo se valida si la modalidad es Arreglo.
    if (isArrangement && formData.horas_arregladas.trim() !== "") {
      const cantidad = Number(formData.horas_arregladas.trim().replace(",", "."));
      if (!/^\d+(?:[.,]\d+)?$/.test(formData.horas_arregladas.trim()) || !Number.isFinite(cantidad) || cantidad < 0) {
        nextErrors.horas_arregladas =
          "Ingresá una cantidad válida, por ejemplo 12,5 o 12.5.";
      }
    }

    if (formData.hora_ingreso && !/^([01]\d|2[0-3]):[0-5]\d$/.test(formData.hora_ingreso)) {

      nextErrors.hora_ingreso = "Ingresá una hora válida";

    }

    if (formData.hora_salida && !/^([01]\d|2[0-3]):[0-5]\d$/.test(formData.hora_salida)) {

      nextErrors.hora_salida = "Ingresá una hora válida";

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

    const payload = {

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

      convenio: null,

      numero_resolucion: shouldShowResolution

        ? formData.numero_resolucion.trim() || null

        : null,

      regimen_especial: person?.regimen_especial ?? null,

      modalidad_horas_extra: formData.modalidad_horas_extra,

      hora_ingreso: formData.hora_ingreso || null,

      hora_salida: formData.hora_salida || null,

      horas_arregladas: isArrangement && formData.horas_arregladas.trim() !== ""
        ? Number(formData.horas_arregladas.trim().replace(",", "."))
        : null,

      horas_50: (isExtraHours || isArrangement) && Number(formData.horas_50 || 0) > 0

        ? 1 : null,

      horas_100: (isExtraHours || isArrangement) && Number(formData.horas_100 || 0) > 0

        ? 1 : null,

      fecha_actualizacion: null,

    } as PersonnelInsert;

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

      <DialogContent className="max-h-[94vh] w-[calc(100vw-2rem)] overflow-y-auto overflow-x-hidden sm:max-w-[1200px]">

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

              <PersonnelCatalogField

                kind="area"

                id="area_rrhh"

                value={formData.area_rrhh}

                onChange={(value) => handleChange("area_rrhh", value)}

                disabled={isSubmitting}

                open={open}

              />

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

            <p className="text-xs text-muted-foreground">

              El código se carga manualmente y puede contener más de uno, por ejemplo 52/56.

            </p>

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

          </div>

          <div className="space-y-2">

            <Label htmlFor="tarea">

              Tarea que realiza

            </Label>

            <PersonnelCatalogField

              kind="task"

              id="tarea"

              value={formData.tarea}

              onChange={(value) => handleChange("tarea", value)}

              disabled={isSubmitting}

              open={open}

            />

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

          {shouldShowResolution && (

            <div className="space-y-2">

              <Label htmlFor="numero_resolucion">

                N.º de resolución

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

                      <div className="space-y-4 rounded-xl border p-4">

              <h3 className="font-semibold">Horarios y horas extras</h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                <div className="space-y-2">

                  <Label htmlFor="hora_ingreso">Hora de entrada</Label>

                  <Input id="hora_ingreso" type="time" value={formData.hora_ingreso}

                    onChange={(e) => handleChange("hora_ingreso", e.target.value)} disabled={isSubmitting} />

                </div>

                <div className="space-y-2">

                  <Label htmlFor="hora_salida">Hora de salida</Label>

                  <Input id="hora_salida" type="time" value={formData.hora_salida}

                    onChange={(e) => handleChange("hora_salida", e.target.value)} disabled={isSubmitting} />

                </div>

              </div>

              <div className="space-y-2">

                <Label>Horas extras</Label>

                <Select value={formData.modalidad_horas_extra} onValueChange={(v) => handleChange("modalidad_horas_extra", v)} disabled={isSubmitting}>

                  <SelectTrigger><SelectValue /></SelectTrigger>

                  <SelectContent>

                    <SelectItem value="NO">No</SelectItem>

                    <SelectItem value="SI">Sí</SelectItem>

                    <SelectItem value="ARREGLO">Arreglo</SelectItem>

                  </SelectContent>

                </Select>

              </div>

              {isArrangement && (
                <div className="space-y-2">
                  <Label htmlFor="horas_arregladas">Horas arregladas</Label>
                  <Input
                    id="horas_arregladas"
                    type="text"
                    inputMode="decimal"
                    placeholder="Ej.: 12 o 12.5"
                    value={formData.horas_arregladas}
                    onChange={(event) =>
                      handleChange("horas_arregladas", event.target.value)
                    }
                    disabled={isSubmitting}
                  />
                  {errors.horas_arregladas && (
                    <p className="text-sm text-destructive">
                      {errors.horas_arregladas}
                    </p>
                  )}
                </div>
              )}

              {(isExtraHours || isArrangement) && (

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

                  <div className="flex items-center gap-3 rounded-lg border p-3">

                    <Checkbox

                      id="horas_50"

                      checked={Number(formData.horas_50 || 0) > 0}

                      onCheckedChange={(checked) =>

                        handleExtraRateChange("50", checked === true)

                      }

                      disabled={isSubmitting}

                    />

                    <Label htmlFor="horas_50" className="cursor-pointer">

                      Horas al 50 %

                    </Label>

                  </div>

                  <div className="flex items-center gap-3 rounded-lg border p-3">

                    <Checkbox

                      id="horas_100"

                      checked={Number(formData.horas_100 || 0) > 0}

                      onCheckedChange={(checked) =>

                        handleExtraRateChange("100", checked === true)

                      }

                      disabled={isSubmitting}

                    />

                    <Label htmlFor="horas_100" className="cursor-pointer">

                      Horas al 100 %

                    </Label>

                  </div>

                </div>

              )}

            </div>

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
