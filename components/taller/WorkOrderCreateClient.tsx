"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Check, ChevronDown, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  AREA_SOLICITANTE_OPTIONS,
  CRITICIDAD_OPTIONS,
  DRIVER_OPTIONS,
  FAILURE_REPORT_OPTIONS,
  LOCALIZACION_FALLA_OPTIONS,
  PROVIDER_OPTIONS,
  REPAIR_TYPE_OPTIONS,
  REQUIRES_SPARE_PART_OPTIONS,
  SPARE_PART_OPTIONS,
  STATUS_OPTIONS,
  TIPO_FALLA_OPTIONS,
  VEHICLE_OPTIONS,
} from "@/lib/taller/options";

type WorkOrderFormData = {
  order_number: string;
  entry_date: string;
  requesting_area: string;
  failure_report: string;
  repair_type: string;
  vehicle_code: string;
  criticality: string;
  failure_type: string;
  failure_location: string;
  requires_spare_part: string;
  vehicle: string;
  license_plate: string;
  exit_date: string;
  spare_part_detail: string;
  spare_part_code: string;
  units: string;
  provider: string;
  amount: string;
  observations: string;
  driver: string;
  status: string;
};

const initialFormData: WorkOrderFormData = {
  order_number: "",
  entry_date: "",
  requesting_area: "",
  failure_report: "",
  repair_type: "",
  vehicle_code: "",
  criticality: "",
  failure_type: "",
  failure_location: "",
  requires_spare_part: "",
  vehicle: "",
  license_plate: "",
  exit_date: "",
  spare_part_detail: "",
  spare_part_code: "",
  units: "",
  provider: "",
  amount: "",
  observations: "",
  driver: "",
  status: "INICIADO",
};

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getUniqueOptions = (options: readonly string[]) => {
  const seen = new Set<string>();

  return options
    .map((option) => String(option || "").trim())
    .filter((option) => {
      if (!option) return false;

      const normalized = normalizeText(option);

      if (seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
};

export function WorkOrderCreateClient() {
  const router = useRouter();

  const [formData, setFormData] = useState<WorkOrderFormData>(initialFormData);
  const [saving, setSaving] = useState(false);

  const vehicleCodeOptions = useMemo(
    () => getUniqueOptions(VEHICLE_OPTIONS.map((item) => item.code)),
    [],
  );

  const vehicleNameOptions = useMemo(
    () => getUniqueOptions(VEHICLE_OPTIONS.map((item) => item.vehicle)),
    [],
  );

  const sparePartDetailOptions = useMemo(
    () => getUniqueOptions(SPARE_PART_OPTIONS.map((item) => item.detail)),
    [],
  );

  const sparePartCodeOptions = useMemo(
    () => getUniqueOptions(SPARE_PART_OPTIONS.map((item) => item.code)),
    [],
  );

  const handleChange = (field: keyof WorkOrderFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleVehicleCodeChange = (value: string) => {
    const selectedVehicle = VEHICLE_OPTIONS.find(
      (item) => normalizeText(item.code) === normalizeText(value),
    );

    setFormData((prev) => ({
      ...prev,
      vehicle_code: value,
      vehicle: selectedVehicle?.vehicle ?? prev.vehicle,
      license_plate: selectedVehicle?.licensePlate ?? prev.license_plate,
      criticality: selectedVehicle?.criticality ?? prev.criticality,
    }));
  };

  const handleVehicleNameChange = (value: string) => {
    const selectedVehicle = VEHICLE_OPTIONS.find(
      (item) => normalizeText(item.vehicle) === normalizeText(value),
    );

    setFormData((prev) => ({
      ...prev,
      vehicle: value,
      vehicle_code: selectedVehicle?.code ?? prev.vehicle_code,
      license_plate: selectedVehicle?.licensePlate ?? prev.license_plate,
      criticality: selectedVehicle?.criticality ?? prev.criticality,
    }));
  };

  const handleSparePartDetailChange = (value: string) => {
    const selectedPart = SPARE_PART_OPTIONS.find(
      (item) => normalizeText(item.detail) === normalizeText(value),
    );

    setFormData((prev) => ({
      ...prev,
      spare_part_detail: value,
      spare_part_code: selectedPart?.code ?? prev.spare_part_code,
    }));
  };

  const handleSparePartCodeChange = (value: string) => {
    const selectedPart = SPARE_PART_OPTIONS.find(
      (item) => normalizeText(item.code) === normalizeText(value),
    );

    setFormData((prev) => ({
      ...prev,
      spare_part_code: value,
      spare_part_detail: selectedPart?.detail ?? prev.spare_part_detail,
    }));
  };

  const hasAtLeastOneValue = () => {
    return Object.values(formData).some(
      (value) => String(value || "").trim() !== "",
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!hasAtLeastOneValue()) {
      toast.error("Cargá al menos un dato para guardar la orden de trabajo");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/work-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          units: formData.units ? Number(formData.units) : null,
          amount: formData.amount ? Number(formData.amount) : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al crear orden de trabajo");
      }

      toast.success("Orden de trabajo creada correctamente");
      router.push("/dashboard/taller/ordenes-trabajo");
      router.refresh();
    } catch (error) {
      console.error("Error creating work order:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al crear orden de trabajo",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Button
        type="button"
        variant="ghost"
        onClick={() => router.push("/dashboard/taller/ordenes-trabajo")}
        className="-ml-2 gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al registro
      </Button>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Información básica</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-0">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Field label="N° orden de trabajo">
              <Input
                value={formData.order_number}
                onChange={(event) =>
                  handleChange("order_number", event.target.value)
                }
                placeholder="Ej: 1"
              />
            </Field>

            <Field label="Fecha de ingreso">
              <Input
                type="date"
                value={formData.entry_date}
                onChange={(event) =>
                  handleChange("entry_date", event.target.value)
                }
              />
            </Field>

            <ComboField
              label="Estado"
              value={formData.status}
              onChange={(value) => handleChange("status", value)}
              options={STATUS_OPTIONS}
              placeholder="Seleccione o escriba"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ComboField
              label="Área solicitante"
              value={formData.requesting_area}
              onChange={(value) => handleChange("requesting_area", value)}
              options={AREA_SOLICITANTE_OPTIONS}
              placeholder="Ej: GIRSU"
            />

            <ComboField
              label="Tipo de reparación"
              value={formData.repair_type}
              onChange={(value) => handleChange("repair_type", value)}
              options={REPAIR_TYPE_OPTIONS}
              placeholder="Seleccione o escriba"
            />
          </div>

          <ComboField
            label="Reporte de falla"
            value={formData.failure_report}
            onChange={(value) => handleChange("failure_report", value)}
            options={FAILURE_REPORT_OPTIONS}
            placeholder="Si / No"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Vehículo y falla</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-0">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <ComboField
              label="Código de vehículo"
              value={formData.vehicle_code}
              onChange={handleVehicleCodeChange}
              options={vehicleCodeOptions}
              placeholder="Ej: RD.4"
            />

            <ComboField
              label="Vehículo"
              value={formData.vehicle}
              onChange={handleVehicleNameChange}
              options={vehicleNameOptions}
              placeholder="Ej: IVECO"
            />

            <Field label="Dominio">
              <Input
                value={formData.license_plate}
                onChange={(event) =>
                  handleChange("license_plate", event.target.value)
                }
                placeholder="Ej: AB123CD"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ComboField
              label="Criticidad"
              value={formData.criticality}
              onChange={(value) => handleChange("criticality", value)}
              options={CRITICIDAD_OPTIONS}
              placeholder="Seleccione o escriba"
            />

            <ComboField
              label="Tipo de falla"
              value={formData.failure_type}
              onChange={(value) => handleChange("failure_type", value)}
              options={TIPO_FALLA_OPTIONS}
              placeholder="Ej: Alternador"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ComboField
              label="Localización de falla"
              value={formData.failure_location}
              onChange={(value) => handleChange("failure_location", value)}
              options={LOCALIZACION_FALLA_OPTIONS}
              placeholder="Ej: Motor"
            />

            <Field label="Fecha de salida">
              <Input
                type="date"
                value={formData.exit_date}
                onChange={(event) =>
                  handleChange("exit_date", event.target.value)
                }
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Repuestos y proveedor</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-0">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <ComboField
              label="Requiere repuesto"
              value={formData.requires_spare_part}
              onChange={(value) => handleChange("requires_spare_part", value)}
              options={REQUIRES_SPARE_PART_OPTIONS}
              placeholder="SI / NO"
            />

            <ComboField
              label="Detalle de repuesto"
              value={formData.spare_part_detail}
              onChange={handleSparePartDetailChange}
              options={sparePartDetailOptions}
              placeholder="Ej: BATERIA 12*110"
            />

            <ComboField
              label="Código de repuesto"
              value={formData.spare_part_code}
              onChange={handleSparePartCodeChange}
              options={sparePartCodeOptions}
              placeholder="Ej: BAT12101"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Field label="Unidades">
              <Input
                type="number"
                inputMode="decimal"
                value={formData.units}
                onChange={(event) => handleChange("units", event.target.value)}
                placeholder="0"
              />
            </Field>

            <ComboField
              label="Proveedor"
              value={formData.provider}
              onChange={(value) => handleChange("provider", value)}
              options={PROVIDER_OPTIONS}
              placeholder="Proveedor"
            />

            <Field label="Monto">
              <Input
                type="number"
                inputMode="decimal"
                value={formData.amount}
                onChange={(event) => handleChange("amount", event.target.value)}
                placeholder="0"
              />
            </Field>
          </div>

          <ComboField
            label="Chofer"
            value={formData.driver}
            onChange={(value) => handleChange("driver", value)}
            options={DRIVER_OPTIONS}
            placeholder="Chofer"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Observaciones</CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          <Field label="Detalle / observaciones">
            <textarea
              value={formData.observations}
              onChange={(event) =>
                handleChange("observations", event.target.value)
              }
              rows={5}
              placeholder="Escribí observaciones de la orden de trabajo..."
              className="w-full min-h-[120px] resize-none rounded-md border border-input bg-background px-3 py-3 text-sm ring-offset-background placeholder:text-muted-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-20 -mx-6 border-t bg-background/95 px-6 py-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/taller/ordenes-trabajo")}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>

          <Button type="submit" disabled={saving} className="w-full gap-2 sm:w-auto">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Guardar OT
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ComboField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const uniqueOptions = useMemo(() => getUniqueOptions(options), [options]);

  const visibleOptions = useMemo(() => {
    const query = normalizeText(searchText);

    if (!query) {
      return uniqueOptions;
    }

    return uniqueOptions.filter((option) =>
      normalizeText(option).includes(query),
    );
  }, [uniqueOptions, searchText]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchText("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const openDropdown = () => {
    setSearchText("");
    setIsOpen(true);
  };

  const handleSelect = (option: string) => {
    onChange(option);
    setSearchText("");
    setIsOpen(false);
  };

  return (
    <Field label={label}>
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Input
            value={isOpen && searchText ? searchText : value}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSearchText(nextValue);
              onChange(nextValue);
              setIsOpen(true);
            }}
            onFocus={openDropdown}
            placeholder={placeholder}
            autoComplete="off"
            className="h-10 pr-10"
          />

          <button
            type="button"
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
                setSearchText("");
              } else {
                openDropdown();
              }
            }}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label={`Abrir opciones de ${label}`}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {isOpen && (
          <div className="absolute z-[80] mt-1 max-h-[260px] w-full overflow-y-auto rounded-md border border-border bg-background shadow-lg">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => {
                const isSelected =
                  normalizeText(option) === normalizeText(value);

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`flex min-h-9 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${isSelected ? "bg-muted" : ""
                      }`}
                  >
                    <span className="break-words leading-snug">{option}</span>

                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No se encontraron opciones
              </div>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}