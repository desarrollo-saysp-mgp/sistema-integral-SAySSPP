"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

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
  repair_type: "Externa",
  vehicle_code: "",
  criticality: "",
  failure_type: "",
  failure_location: "",
  requires_spare_part: "NO",
  vehicle: "",
  license_plate: "",
  exit_date: "",
  spare_part_code: "",
  units: "",
  provider: "",
  amount: "",
  observations: "",
  driver: "",
  status: "Iniciado",
};

const statusOptions = ["Iniciado", "En proceso", "Finalizado", "Cancelado"];
const repairTypeOptions = ["Externa", "Interna"];
const yesNoOptions = ["SI", "NO"];
const criticalityOptions = ["Baja", "Media", "Alta", "Crítica"];

export function WorkOrderCreateClient() {
  const router = useRouter();
  const [formData, setFormData] = useState<WorkOrderFormData>(initialFormData);
  const [saving, setSaving] = useState(false);

  const handleChange = (field: keyof WorkOrderFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const hasAtLeastOneValue = () => {
    return Object.entries(formData).some(([key, value]) => {
      if (key === "repair_type" && value === "Externa") return false;
      if (key === "requires_spare_part" && value === "NO") return false;
      if (key === "status" && value === "Iniciado") return false;

      return String(value || "").trim() !== "";
    });
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
    <div className="space-y-6">
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
        <CardHeader>
          <CardTitle>Cargar nueva OT</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-xl border bg-muted/20 p-4">
              <h2 className="mb-4 text-base font-semibold">
                Datos principales
              </h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="N° orden de trabajo">
                  <Input
                    value={formData.order_number}
                    onChange={(e) =>
                      handleChange("order_number", e.target.value)
                    }
                    placeholder="Ej: 1"
                  />
                </Field>

                <Field label="Fecha de ingreso">
                  <Input
                    type="date"
                    value={formData.entry_date}
                    onChange={(e) =>
                      handleChange("entry_date", e.target.value)
                    }
                  />
                </Field>

                <Field label="Área solicitante">
                  <Input
                    value={formData.requesting_area}
                    onChange={(e) =>
                      handleChange("requesting_area", e.target.value)
                    }
                    placeholder="Ej: GIRSU"
                  />
                </Field>

                <Field label="Reporte de falla">
                  <Input
                    value={formData.failure_report}
                    onChange={(e) =>
                      handleChange("failure_report", e.target.value)
                    }
                    placeholder="Ej: NO / descripción"
                  />
                </Field>

                <Field label="Tipo de reparación">
                  <Select
                    value={formData.repair_type}
                    onValueChange={(value) =>
                      handleChange("repair_type", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      {repairTypeOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Estado">
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleChange("status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <h2 className="mb-4 text-base font-semibold">
                Vehículo y falla
              </h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Código de vehículo">
                  <Input
                    value={formData.vehicle_code}
                    onChange={(e) =>
                      handleChange("vehicle_code", e.target.value)
                    }
                    placeholder="Ej: RD.4"
                  />
                </Field>

                <Field label="Vehículo">
                  <Input
                    value={formData.vehicle}
                    onChange={(e) => handleChange("vehicle", e.target.value)}
                    placeholder="Ej: IVECO"
                  />
                </Field>

                <Field label="Dominio">
                  <Input
                    value={formData.license_plate}
                    onChange={(e) =>
                      handleChange("license_plate", e.target.value)
                    }
                    placeholder="Ej: AB123CD"
                  />
                </Field>

                <Field label="Criticidad">
                  <Select
                    value={formData.criticality}
                    onValueChange={(value) =>
                      handleChange("criticality", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      {criticalityOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Tipo de falla">
                  <Input
                    value={formData.failure_type}
                    onChange={(e) =>
                      handleChange("failure_type", e.target.value)
                    }
                    placeholder="Ej: Alternador"
                  />
                </Field>

                <Field label="Localización de falla">
                  <Input
                    value={formData.failure_location}
                    onChange={(e) =>
                      handleChange("failure_location", e.target.value)
                    }
                    placeholder="Ej: Motor"
                  />
                </Field>

                <Field label="Fecha de salida">
                  <Input
                    type="date"
                    value={formData.exit_date}
                    onChange={(e) => handleChange("exit_date", e.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <h2 className="mb-4 text-base font-semibold">
                Repuestos y proveedor
              </h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Requiere repuesto">
                  <Select
                    value={formData.requires_spare_part}
                    onValueChange={(value) =>
                      handleChange("requires_spare_part", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      {yesNoOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Código de repuesto">
                  <Input
                    value={formData.spare_part_code}
                    onChange={(e) =>
                      handleChange("spare_part_code", e.target.value)
                    }
                    placeholder="Código"
                  />
                </Field>

                <Field label="Unidades">
                  <Input
                    type="number"
                    value={formData.units}
                    onChange={(e) => handleChange("units", e.target.value)}
                    placeholder="0"
                  />
                </Field>

                <Field label="Proveedor">
                  <Input
                    value={formData.provider}
                    onChange={(e) => handleChange("provider", e.target.value)}
                    placeholder="Proveedor"
                  />
                </Field>

                <Field label="Monto">
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => handleChange("amount", e.target.value)}
                    placeholder="0"
                  />
                </Field>

                <Field label="Chofer">
                  <Input
                    value={formData.driver}
                    onChange={(e) => handleChange("driver", e.target.value)}
                    placeholder="Chofer"
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <Field label="Observaciones">
                <textarea
                  value={formData.observations}
                  onChange={(e) =>
                    handleChange("observations", e.target.value)
                  }
                  rows={5}
                  placeholder="Escribí observaciones de la orden de trabajo..."
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
              </Field>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/taller/ordenes-trabajo")}
                disabled={saving}
              >
                Cancelar
              </Button>

              <Button type="submit" disabled={saving} className="gap-2">
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}