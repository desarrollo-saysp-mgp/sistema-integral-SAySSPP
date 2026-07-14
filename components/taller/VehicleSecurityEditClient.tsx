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

type VehicleSecurityInspection = {
    id: string;
    inspection_date: string;
    vehicle_code: string;
    vehicle: string | null;
    vehicle_type: string | null;
    license_plate: string | null;
    area: string | null;
    observations: string | null;

    [key: string]: any;
};

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

const CHECKLIST_FIELDS = CHECKLIST_SECTIONS.flatMap((section) =>
    section.items.map((item) => item.key),
);

const normalizeText = (value: unknown) =>
    String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

const getVehicleByCode = (code: string) => {
    return VEHICLE_OPTIONS.find(
        (vehicle) => normalizeText(vehicle.code) === normalizeText(code),
    );
};

export function VehicleSecurityEditClient({
    inspection,
}: {
    inspection: VehicleSecurityInspection;
}) {
    const router = useRouter();

    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState<FormState>({
        inspection_date: inspection.inspection_date || "",
        vehicle_code: inspection.vehicle_code || "",
        vehicle: inspection.vehicle || "",
        vehicle_type: inspection.vehicle_type || "",
        license_plate: inspection.license_plate || "",
        area: inspection.area || "",
        observations: inspection.observations || "",
    });

    const [checklist, setChecklist] = useState<Record<string, ChecklistValue>>(
        () => {
            const initial: Record<string, ChecklistValue> = {};

            CHECKLIST_FIELDS.forEach((field) => {
                initial[field] = (inspection[field] || "") as ChecklistValue;
            });

            return initial;
        },
    );

    const uniqueVehicleOptions = useMemo(() => {
        const map = new Map<string, (typeof VEHICLE_OPTIONS)[number]>();

        VEHICLE_OPTIONS.forEach((vehicle) => {
            const code = String(vehicle.code || "").trim();

            if (!code) return;

            if (!map.has(code)) {
                map.set(code, vehicle);
            }
        });

        return Array.from(map.values()).sort((a, b) =>
            a.code.localeCompare(b.code, "es", { numeric: true }),
        );
    }, []);

    const updateForm = (field: keyof FormState, value: string) => {
        setForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleVehicleCodeChange = (vehicleCode: string) => {
        const selectedVehicle = getVehicleByCode(vehicleCode);

        setForm((prev) => ({
            ...prev,
            vehicle_code: vehicleCode,
            vehicle: selectedVehicle?.vehicle || "",
            license_plate: selectedVehicle?.licensePlate || "",
            vehicle_type: selectedVehicle?.vehicleType || "",
            area: getVehicleDirection(vehicleCode),
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

            const response = await fetch(`/api/taller/estado-general/${inspection.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Error al actualizar checklist");
            }

            toast.success(
                `Checklist actualizado. Seguridad calculada: ${result.result.security_score}`,
            );

            router.push("/dashboard/taller/ordenes-trabajo/criticidad/estado-general");
            router.refresh();
        } catch (error) {
            console.error("Error updating checklist:", error);

            toast.error(
                error instanceof Error
                    ? error.message
                    : "Error al actualizar checklist",
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <Button asChild variant="ghost" className="-ml-2 mb-3 gap-2">
                    <Link href="/dashboard/taller/ordenes-trabajo/criticidad/estado-general">
                        <ArrowLeft className="h-4 w-4" />
                        Volver a Estado general
                    </Link>
                </Button>

                <h1 className="text-3xl font-bold tracking-tight">
                    Editar Checklist Vehicular
                </h1>

                <p className="mt-2 text-muted-foreground">
                    Modificá los datos del estado general del vehículo.
                </p>
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
                    {saving ? "Guardando..." : "Guardar cambios"}
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