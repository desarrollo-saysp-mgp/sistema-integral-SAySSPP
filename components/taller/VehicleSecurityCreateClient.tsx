"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VEHICLE_OPTIONS } from "@/lib/taller/options";
import { getVehicleDirection } from "@/lib/taller/vehicle-directions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Save,
} from "lucide-react";
import { toast } from "sonner";

type ChecklistValue = "ok" | "bad" | "obs" | "";

type FormState = {
  inspection_date: string;
  vehicle_code: string;
  vehicle: string;
  vehicle_type: string;
  license_plate: string;
  area: string;
  observations: string;
};

type ChecklistItem = {
  key: string;
  label: string;
};

type ChecklistSection = {
  title: string;
  items: ChecklistItem[];
};

const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    title: "Luces delanteras",
    items: [
      { key: "micas_del", label: "Micas Del." },
      { key: "balizas_del", label: "Balizas Del." },
      { key: "altas_del", label: "Altas Del." },
      { key: "bajas_del", label: "Bajas Del." },
      { key: "posicion_del", label: "Posición Del." },
      { key: "ginios_del", label: "Guiños Del." },
    ],
  },
  {
    title: "Luces traseras",
    items: [
      { key: "micas_tras", label: "Micas Tras." },
      { key: "balizas_tras", label: "Balizas Tras." },
      { key: "ginios_tras", label: "Guiños Tras." },
      { key: "posicion_tras", label: "Posición Tras." },
      { key: "stop_tras", label: "Stop Tras." },
      { key: "reversa_tras", label: "Reversa Tras." },
      { key: "alarma_retro", label: "Alarma Retro." },
    ],
  },
  {
    title: "Parabrisas / Espejos",
    items: [
      { key: "parabrisa_delantero", label: "Parabrisa Delantero" },
      { key: "parabrisa_trasero", label: "Parabrisa Trasero" },
      { key: "parabrisas_laterales", label: "Parabrisas Laterales" },
      { key: "limpia_parabrisas", label: "Limpia Parabrisas" },
      { key: "espejos", label: "Espejos" },
    ],
  },
  {
    title: "Interior",
    items: [
      { key: "anclaje_asientos", label: "Anclaje asientos" },
      { key: "cinturones_seguridad", label: "Cinturones de seguridad" },
      { key: "bocina", label: "Bocina" },
      { key: "espejo_ret_central", label: "Espejo Ret. Central" },
      { key: "freno_mano_bloqueo", label: "Freno de Mano / Bloqueo" },
      { key: "tablero_indicadores", label: "Tablero / indicadores" },
    ],
  },
  {
    title: "Puertas",
    items: [
      { key: "puerta_lado_conductor", label: "Puerta Lado Conductor" },
      { key: "puerta_lado_acompanante", label: "Puerta Lado Acompañante" },
      { key: "baul_porton_trasero", label: "Baúl / Portón trasero" },
    ],
  },
  {
    title: "Neumáticos / Llantas",
    items: [
      { key: "eje_delantero", label: "Eje Delantero" },
      { key: "eje_trasero", label: "Eje Trasero" },
      { key: "eje_dual", label: "Eje Dual" },
    ],
  },
  {
    title: "Reglamentarios",
    items: [
      { key: "documentacion_completa", label: "Documentación Completa" },
      { key: "chapa_patente_delantera", label: "Chapa Patente Delantera" },
      { key: "chapa_patente_trasera", label: "Chapa Patente Trasera" },
      { key: "calcos_reflectivos", label: "Calcos Reflectivos" },
      { key: "extintor", label: "Extintor" },
      { key: "conos_balizas", label: "Conos / Balizas" },
      { key: "guardabarros_barreros", label: "Guardabarros / Barreros" },
    ],
  },
  {
    title: "Otros",
    items: [
      { key: "botiquin", label: "Botiquín" },
      { key: "calcos_municipio", label: "Calcos del Municipio" },
      { key: "calco_codigo_vehiculo", label: "Calco Código Vehículo" },
    ],
  },
];

const VEHICLE_DIRECTIONS_FALLBACK: Record<string, string> = {
  "S.P.1": "Girsu",
  "S.P.2": "Dir. General",
  "S.P.4": "Girsu",
  "S.P.5": "Girsu",
  "S.P.6": "Girsu",
  "S.P.7": "Dir. General",
  "S.P.8": "Serv. Pub.",
  "S.P.9": "Girsu",
  "S.P.10": "Serv. Pub.",
  "S.P.11": "Girsu",
  "S.P.12": "Serv. Pub.",

  "P.C.1": "Girsu",
  "P.C.2": "Girsu",
  "P.C.3": "Girsu",
  "P.C.4": "Girsu",
  "P.C.5": "Girsu",
  "P.C.6": "Girsu",

  "R.D.1": "Girsu",
  "R.D.2": "Girsu",
  "R.D.3": "Girsu",
  "R.D.4": "Girsu",
  "R.D.5": "Girsu",
  "R.D.6": "Girsu",
  "R.D.7": "Girsu",
  "R.D.8": "Girsu",
  "R.D.9": "Girsu",
  "R.D.10": "Girsu",

  "R.E. P.C.1": "Girsu",
  "R.E. P.C.2": "Girsu",
  "R.E. P.C.3": "Serv. Pub.",
  "R.E. P.C.4": "Girsu",
  "R.E. P.C.5": "Girsu",
  "R.E. P.C.6": "Girsu",
  "R.E. P.C.7": "Dir. General",
  "R.E. P.C.8": "Serv. Pub.",
  "R.E. P.C.9": "Girsu",
  "R.E. P.C.11": "Girsu",
  "R.E. P.C.12": "Girsu",

  "A.6": "Serv. Pub.",
  "B.P2": "Serv. Pub.",
  "B.P3": "Serv. Pub.",
  "B.P4": "Serv. Pub.",

  "B.2": "Serv. Pub.",
  "B.3": "Serv. Pub.",
  "B.4": "Serv. Pub.",
  "B.5": "Serv. Pub.",
  "B.6": "Serv. Pub.",
  "B.7": "Serv. Pub.",

  "BT.1": "Serv. Pub.",
  "BT.2": "Arbolado",
  "B.C1": "",

  "R.E. V.2": "Girsu",
  "R.E. V.3": "Girsu",
  "R.E. V.5": "Girsu",
  "R.E. V.6": "Girsu",
  "R.E. V.7": "Girsu",
  "R.E. V.8": "Serv. Pub.",
  "R.E. V.9": "Girsu",
  "R.E. V.10": "Girsu",
  "R.E. V.11": "Girsu",
  "R.E. V.12": "Girsu",
  "R.E. V.13": "Girsu",
  "R.E. V.14": "Girsu",

  "M.C. V.1": "Serv. Pub.",
  "M.C. P.R.1": "Serv. Pub.",

  "M.C.1": "Serv. Pub.",
  "M.C.2": "Serv. Pub.",
  "M.C.3": "Serv. Pub.",
  "M.C.4": "Serv. Pub.",
  "M.C.5": "Serv. Pub.",
  "M.C.6": "Serv. Pub.",

  "A.P.U.V.1": "Arbolado",
  "A.P.U.1": "Serv. Pub.",
  "A.P.U.2": "Arbolado",
  "A.P.U.3": "Arbolado",
  "A.P.U.4": "Arbolado",
  "A.P.U.5": "Arbolado",
  "A.P.U.6": "Arbolado",
  "A.P.U.7": "Arbolado",
  "A.P.U.8": "Arbolado",
  "A.P.U.9": "Arbolado",
  "A.P.U.10": "Dir. General",
  "A.P.U.11": "Arbolado",
  "A.P.U.12": "Arbolado",
  "A.P.U.13": "Arbolado",
  "A.P.U.14": "Arbolado",
  "A.P.U.16": "Arbolado",
  "A.P.U.17": "Arbolado",
  "A.P.U.18": "Arbolado",
  "Massey 2": "Arbolado",

  "A.1": "Girsu",
  "A.2": "Dir. General",
  "A.3": "Girsu",
  "A.4": "Dir. General",
  "A.5": "Girsu",
  "A.7": "Serv. Pub.",

  "G.A.1": "Dir. General",
  "G.A.2": "Dir. General",
  "G.A.3": "Dir. General",
  "G.A.4": "Dir. General",
  "G.A.5": "",

  "Z.V.1": "",
  "Z.V.2": "Zoo. y Vec.",

  "R.3": "Serv. Pub.",
  "R.4": "Serv. Pub.",
  "R.5": "Serv. Pub.",
  "R.6": "Serv. Pub.",
  "R.7": "Serv. Pub.",
  "R.8": "Serv. Pub.",
  "R.9": "Serv. Pub.",
  "R.10": "Serv. Pub.",
  "R.11": "Serv. Pub.",

  "I 1": "Dir. General",
  "I 2": "Dir. General",
  "I 3": "Dir. General",
  "I 4": "Dir. General",
};

const getTodayForInput = () => {
  const date = new Date();

  return date.toISOString().slice(0, 10);
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizeVehicleCode = (value: unknown) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const getVehicleByCode = (code: string) => {
  const normalizedCode = normalizeText(code);

  return VEHICLE_OPTIONS.find(
    (vehicle) => normalizeText(vehicle.code) === normalizedCode,
  );
};

const resolveVehicleDirection = (vehicleCode: string) => {
  const cleanCode = normalizeVehicleCode(vehicleCode);

  const directionFromHelper = getVehicleDirection(cleanCode);

  if (directionFromHelper) return directionFromHelper;

  return VEHICLE_DIRECTIONS_FALLBACK[cleanCode] || "";
};

export function VehicleSecurityCreateClient() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>({
    inspection_date: getTodayForInput(),
    vehicle_code: "",
    vehicle: "",
    vehicle_type: "",
    license_plate: "",
    area: "",
    observations: "",
  });

  const [checklist, setChecklist] = useState<Record<string, ChecklistValue>>({});

  const uniqueVehicleOptions = useMemo(() => {
    const map = new Map<string, (typeof VEHICLE_OPTIONS)[number]>();

    VEHICLE_OPTIONS.forEach((vehicle) => {
      const code = normalizeVehicleCode(vehicle.code);

      if (!code) return;

      if (!map.has(code)) {
        map.set(code, vehicle);
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      String(a.code).localeCompare(String(b.code), "es", { numeric: true }),
    );
  }, []);

  const updateForm = (field: keyof FormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleVehicleCodeChange = (vehicleCode: string) => {
    const cleanVehicleCode = normalizeVehicleCode(vehicleCode);
    const selectedVehicle = getVehicleByCode(cleanVehicleCode);

    setForm((prev) => ({
      ...prev,
      vehicle_code: cleanVehicleCode,
      vehicle: selectedVehicle?.vehicle || "",
      license_plate: selectedVehicle?.licensePlate || "",
      vehicle_type: selectedVehicle?.vehicleType || "",
      area: resolveVehicleDirection(cleanVehicleCode),
    }));
  };

  const updateChecklist = (key: string, value: ChecklistValue) => {
    setChecklist((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!form.inspection_date) {
      toast.error("La fecha es obligatoria");
      return;
    }

    if (!form.vehicle_code) {
      toast.error("El código de vehículo es obligatorio");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...form,
        ...checklist,
      };

      const response = await fetch("/api/taller/estado-general", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al guardar checklist");
      }

      toast.success(
        `Checklist guardado. Seguridad calculada: ${result.result.security_score}`,
      );

      router.push("/dashboard/taller/ordenes-trabajo/criticidad/estado-general");
      router.refresh();
    } catch (error) {
      console.error("Error saving checklist:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Error al guardar checklist",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-2 mb-3 gap-2">
            <Link href="/dashboard/taller/ordenes-trabajo/criticidad/estado-general">
              <ArrowLeft className="h-4 w-4" />
              Volver a Estado general
            </Link>
          </Button>

          <h1 className="text-3xl font-bold tracking-tight">
            Nuevo Checklist Vehicular
          </h1>

          <p className="mt-2 text-muted-foreground">
            Carga del estado general del vehículo.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-[#00A27F]" />
            Datos del vehículo
          </CardTitle>
        </CardHeader>

        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Fecha</label>
            <Input
              type="date"
              value={form.inspection_date}
              onChange={(event) =>
                updateForm("inspection_date", event.target.value)
              }
              className="h-10 rounded-xl"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Código de vehículo
            </label>

            <select
              value={form.vehicle_code}
              onChange={(event) => handleVehicleCodeChange(event.target.value)}
              className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
            >
              <option value="">Seleccione un código</option>

              {uniqueVehicleOptions.map((vehicle) => (
                <option key={vehicle.code} value={vehicle.code}>
                  {vehicle.code} - {vehicle.vehicle}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Vehículo</label>
            <Input
              value={form.vehicle}
              onChange={(event) => updateForm("vehicle", event.target.value)}
              className="h-10 rounded-xl"
              placeholder="Vehículo"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Tipo de vehículo
            </label>
            <Input
              value={form.vehicle_type}
              onChange={(event) =>
                updateForm("vehicle_type", event.target.value)
              }
              className="h-10 rounded-xl"
              placeholder="Tipo de vehículo"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Dominio</label>
            <Input
              value={form.license_plate}
              onChange={(event) =>
                updateForm("license_plate", event.target.value)
              }
              className="h-10 rounded-xl"
              placeholder="Dominio"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Dirección</label>
            <Input
              value={form.area}
              onChange={(event) => updateForm("area", event.target.value)}
              className="h-10 rounded-xl"
              placeholder="Ej: Girsu, Serv. Pub., Arbolado, Dir. General"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {CHECKLIST_SECTIONS.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5 text-[#00A27F]" />
                {section.title}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {section.items.map((item) => (
                <div
                  key={item.key}
                  className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-sm font-medium">{item.label}</p>

                  <div className="flex gap-2">
                    <ChecklistButton
                      label="✓"
                      value="ok"
                      activeValue={checklist[item.key] || ""}
                      onClick={() => updateChecklist(item.key, "ok")}
                    />

                    <ChecklistButton
                      label="X"
                      value="bad"
                      activeValue={checklist[item.key] || ""}
                      onClick={() => updateChecklist(item.key, "bad")}
                    />

                    <ChecklistButton
                      label="O"
                      value="obs"
                      activeValue={checklist[item.key] || ""}
                      onClick={() => updateChecklist(item.key, "obs")}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Observaciones</CardTitle>
        </CardHeader>

        <CardContent>
          <textarea
            value={form.observations}
            onChange={(event) => updateForm("observations", event.target.value)}
            placeholder="Escribí observaciones del checklist..."
            className="min-h-[120px] w-full rounded-xl border bg-background p-3 text-sm"
          />
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-end">
        <Button asChild type="button" variant="outline" className="rounded-xl">
          <Link href="/dashboard/taller/ordenes-trabajo/criticidad/estado-general">
            Cancelar
          </Link>
        </Button>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="gap-2 rounded-xl"
        >
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar checklist"}
        </Button>
      </div>
    </div>
  );
}

function ChecklistButton({
  label,
  value,
  activeValue,
  onClick,
}: {
  label: string;
  value: ChecklistValue;
  activeValue: ChecklistValue;
  onClick: () => void;
}) {
  const isActive = value === activeValue;

  return (
    <Button
      type="button"
      variant={isActive ? "default" : "outline"}
      onClick={onClick}
      className="h-9 w-12 rounded-xl"
    >
      {label}
    </Button>
  );
}