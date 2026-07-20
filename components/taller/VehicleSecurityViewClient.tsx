"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    ClipboardCheck,
    Download,
    Pencil,
    ShieldCheck,
    XCircle,
    AlertCircle,
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
    raw_score: number | null;
    state_percent: number | null;
    security_score: number | null;
    observations: string | null;
    created_at: string;
    updated_at: string;

    [key: string]: any;
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

const cleanValue = (value?: string | number | null) => {
    if (value === null || value === undefined || value === "") return "-";
    return String(value);
};

const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";

    const [year, month, day] = dateString.split("-").map(Number);

    if (year && month && day) {
        return new Date(year, month - 1, day).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    }

    return dateString;
};

const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return "-";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("es-AR");
};

const getSecurityBadgeClass = (score?: number | null) => {
    if (score === null || score === undefined) {
        return "border-slate-200 bg-slate-100 text-slate-700";
    }

    if (score >= 4) return "border-red-200 bg-red-100 text-red-800";
    if (score >= 2) return "border-yellow-200 bg-yellow-100 text-yellow-800";

    return "border-green-200 bg-green-100 text-green-800";
};

const getChecklistBadge = (value: ChecklistValue) => {
    if (value === "ok") {
        return {
            label: "✓ Bueno",
            pdfLabel: "Bueno",
            className: "border-green-200 bg-green-100 text-green-800",
            icon: CheckCircle2,
        };
    }

    if (value === "bad") {
        return {
            label: "X Malo",
            pdfLabel: "Malo",
            className: "border-red-200 bg-red-100 text-red-800",
            icon: XCircle,
        };
    }

    if (value === "obs") {
        return {
            label: "O Observación",
            pdfLabel: "Observación",
            className: "border-yellow-200 bg-yellow-100 text-yellow-800",
            icon: AlertCircle,
        };
    }

    return {
        label: "-",
        pdfLabel: "-",
        className: "border-slate-200 bg-slate-100 text-slate-700",
        icon: AlertCircle,
    };
};

const getChecklistPdfColor = (value: ChecklistValue): [number, number, number] => {
    if (value === "ok") return [22, 163, 74];
    if (value === "bad") return [220, 38, 38];
    if (value === "obs") return [202, 138, 4];

    return [100, 116, 139];
};

const getStatusSummary = (inspection: VehicleSecurityInspection) => {
    let good = 0;
    let bad = 0;
    let obs = 0;
    let empty = 0;

    CHECKLIST_SECTIONS.forEach((section) => {
        section.items.forEach((item) => {
            const value = (inspection[item.key] || "") as ChecklistValue;

            if (value === "ok") good += 1;
            else if (value === "bad") bad += 1;
            else if (value === "obs") obs += 1;
            else empty += 1;
        });
    });

    return { good, bad, obs, empty };
};

export function VehicleSecurityViewClient({
    inspection,
}: {
    inspection: VehicleSecurityInspection;
}) {
    const exportChecklistPdf = async () => {
        try {
            const { default: jsPDF } = await import("jspdf");

            const doc = new jsPDF("p", "mm", "a4");

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const marginX = 13;
            const bottomMargin = 12;
            let y = 14;

            const addPageIfNeeded = (neededHeight = 15) => {
                if (y + neededHeight <= pageHeight - bottomMargin) return;

                doc.addPage();
                y = 14;
            };

            const addText = (
                text: string,
                x: number,
                options?: {
                    fontSize?: number;
                    bold?: boolean;
                    color?: [number, number, number];
                    maxWidth?: number;
                    lineGap?: number;
                },
            ) => {
                const fontSize = options?.fontSize ?? 9;
                const maxWidth = options?.maxWidth ?? pageWidth - marginX * 2;
                const lineGap = options?.lineGap ?? 4.3;

                doc.setFontSize(fontSize);
                doc.setFont("helvetica", options?.bold ? "bold" : "normal");

                if (options?.color) {
                    doc.setTextColor(...options.color);
                } else {
                    doc.setTextColor(20, 20, 20);
                }

                const lines = doc.splitTextToSize(text, maxWidth);
                addPageIfNeeded(lines.length * lineGap);

                doc.text(lines, x, y);
                y += lines.length * lineGap;
            };

            const addInfoBox = (
                label: string,
                value: string,
                x: number,
                boxY: number,
                width: number,
            ) => {
                doc.setDrawColor(225, 231, 235);
                doc.setFillColor(248, 250, 252);
                doc.roundedRect(x, boxY, width, 16, 2.7, 2.7, "FD");

                doc.setFontSize(7);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 116, 139);
                doc.text(label, x + 3, boxY + 5.4);

                doc.setFontSize(10.2);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(17, 24, 39);
                doc.text(value, x + 3, boxY + 12);
            };

            const summary = getStatusSummary(inspection);

            doc.setFillColor(0, 162, 127);
            doc.rect(0, 0, pageWidth, 8.5, "F");

            y = 16;

            addText("CHECKLIST VEHICULAR", marginX, {
                fontSize: 15,
                bold: true,
                lineGap: 5,
            });

            addText("Estado general del vehículo", marginX, {
                fontSize: 8.7,
                color: [100, 116, 139],
                lineGap: 4.2,
            });

            y += 2;

            const boxWidth = (pageWidth - marginX * 2 - 9) / 4;

            addInfoBox(
                "Puntaje",
                cleanValue(inspection.raw_score),
                marginX,
                y,
                boxWidth,
            );

            addInfoBox(
                "% Estado",
                inspection.state_percent !== null && inspection.state_percent !== undefined
                    ? `${inspection.state_percent}%`
                    : "-",
                marginX + boxWidth + 3,
                y,
                boxWidth,
            );

            addInfoBox(
                "Seguridad",
                cleanValue(inspection.security_score),
                marginX + (boxWidth + 3) * 2,
                y,
                boxWidth,
            );

            addInfoBox(
                "Fecha",
                formatDate(inspection.inspection_date),
                marginX + (boxWidth + 3) * 3,
                y,
                boxWidth,
            );

            y += 22.5;

            addText("Datos del vehículo", marginX, {
                fontSize: 11,
                bold: true,
                lineGap: 4.2,
            });

            const vehicleInfo = [
                ["Código", cleanValue(inspection.vehicle_code)],
                ["Vehículo", cleanValue(inspection.vehicle)],
                ["Dominio", cleanValue(inspection.license_plate)],
                ["Tipo", cleanValue(inspection.vehicle_type)],
                ["Dirección", cleanValue(inspection.area)],
            ];

            doc.setFontSize(8.7);

            vehicleInfo.forEach(([label, value], index) => {
                const rowY = y + Math.floor(index / 2) * 6;
                const colX = index % 2 === 0 ? marginX : marginX + 88;

                doc.setFont("helvetica", "bold");
                doc.setTextColor(100, 116, 139);
                doc.text(`${label}:`, colX, rowY);

                doc.setFont("helvetica", "normal");
                doc.setTextColor(17, 24, 39);
                doc.text(value, colX + 24, rowY);
            });

            y += 19;

            addText("Resumen de checklist", marginX, {
                fontSize: 11,
                bold: true,
                lineGap: 4.2,
            });

            doc.setFontSize(8.8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(17, 24, 39);
            doc.text(
                `Buenos: ${summary.good}    |    Malos: ${summary.bad}    |    Observados: ${summary.obs}    |    Sin dato: ${summary.empty}`,
                marginX,
                y,
            );

            y += 8;

            CHECKLIST_SECTIONS.forEach((section) => {
                addPageIfNeeded(14);

                doc.setFillColor(230, 247, 243);
                doc.setDrawColor(0, 162, 127);
                doc.roundedRect(marginX, y, pageWidth - marginX * 2, 7.8, 2.2, 2.2, "FD");

                doc.setFontSize(9.2);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(0, 120, 95);
                doc.text(section.title, marginX + 3, y + 5.3);

                y += 10;

                section.items.forEach((item) => {
                    addPageIfNeeded(6.7);

                    const value = (inspection[item.key] || "") as ChecklistValue;
                    const badge = getChecklistBadge(value);
                    const [red, green, blue] = getChecklistPdfColor(value);

                    doc.setDrawColor(232, 232, 232);
                    doc.line(marginX, y - 2, pageWidth - marginX, y - 2);

                    doc.setFontSize(8.7);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(17, 24, 39);
                    doc.text(item.label, marginX + 2, y + 2.2);

                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(red, green, blue);
                    doc.text(badge.pdfLabel, pageWidth - marginX - 2, y + 2.2, {
                        align: "right",
                    });

                    y += 6.15;
                });

                y += 2.4;
            });

            addPageIfNeeded(32);

            addText("Observaciones", marginX, {
                fontSize: 11,
                bold: true,
                lineGap: 4.2,
            });

            const observationText = cleanValue(inspection.observations);
            const observationLines = doc.splitTextToSize(
                observationText,
                pageWidth - marginX * 2 - 7,
            );

            const observationBoxHeight = Math.max(
                20,
                Math.min(31, observationLines.length * 4.4 + 9),
            );

            doc.setDrawColor(225, 231, 235);
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(
                marginX,
                y,
                pageWidth - marginX * 2,
                observationBoxHeight,
                3,
                3,
                "FD",
            );

            doc.setFontSize(8.8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(17, 24, 39);

            doc.text(observationLines.slice(0, 6), marginX + 3.5, y + 6);

            y += observationBoxHeight + 4;

            const totalPages = doc.getNumberOfPages();

            for (let page = 1; page <= totalPages; page += 1) {
                doc.setPage(page);

                doc.setFontSize(7);
                doc.setTextColor(120, 120, 120);

                doc.text(
                    `Creado: ${formatDateTime(inspection.created_at)} | Última modificación: ${formatDateTime(
                        inspection.updated_at,
                    )}`,
                    marginX,
                    pageHeight - 7,
                );

                doc.text(
                    `Página ${page} de ${totalPages}`,
                    pageWidth - marginX,
                    pageHeight - 7,
                    { align: "right" },
                );
            }

            const fileName = `checklist_${cleanValue(inspection.vehicle_code)
                .replaceAll(" ", "_")
                .replaceAll("/", "-")}_${formatDate(inspection.inspection_date).replaceAll(
                    "/",
                    "-",
                )}.pdf`;

            doc.save(fileName);
            toast.success("Checklist exportada correctamente");
        } catch (error) {
            console.error("Error exporting checklist PDF:", error);
            toast.error("No se pudo exportar la checklist");
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
                        Checklist Vehicular
                    </h1>

                    <p className="mt-2 text-muted-foreground">
                        Vista detallada del estado general del vehículo.
                    </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={exportChecklistPdf}
                        className="gap-2 rounded-xl"
                    >
                        <Download className="h-4 w-4" />
                        Exportar PDF
                    </Button>

                    <Button asChild className="gap-2 rounded-xl">
                        <Link
                            href={`/dashboard/taller/ordenes-trabajo/criticidad/estado-general/${inspection.id}/edit`}
                        >
                            <Pencil className="h-4 w-4" />
                            Editar checklist
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <SummaryCard
                    title="Puntaje"
                    value={cleanValue(inspection.raw_score)}
                    description="Puntaje obtenido"
                />

                <SummaryCard
                    title="% Estado"
                    value={
                        inspection.state_percent !== null &&
                            inspection.state_percent !== undefined
                            ? `${inspection.state_percent}%`
                            : "-"
                    }
                    description="Estado general"
                />

                <Card>
                    <CardContent className="flex items-center justify-between gap-4 p-5">
                        <div>
                            <p className="text-sm text-muted-foreground">Seguridad</p>

                            <Badge
                                className={`${getSecurityBadgeClass(
                                    inspection.security_score,
                                )} mt-2 border px-3 py-1 text-base`}
                            >
                                {inspection.security_score ?? "-"}
                            </Badge>

                            <p className="mt-2 text-xs text-muted-foreground">
                                Puntaje para criticidad
                            </p>
                        </div>

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                        </div>
                    </CardContent>
                </Card>

                <SummaryCard
                    title="Fecha"
                    value={formatDate(inspection.inspection_date)}
                    description="Fecha de checklist"
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5 text-[#00A27F]" />
                        Datos del vehículo
                    </CardTitle>
                </CardHeader>

                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Info label="Código" value={cleanValue(inspection.vehicle_code)} />
                    <Info label="Vehículo" value={cleanValue(inspection.vehicle)} />
                    <Info label="Dominio" value={cleanValue(inspection.license_plate)} />
                    <Info
                        label="Tipo de vehículo"
                        value={cleanValue(inspection.vehicle_type)}
                    />
                    <Info label="Dirección" value={cleanValue(inspection.area)} />
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
                            {section.items.map((item) => {
                                const value = (inspection[item.key] || "") as ChecklistValue;
                                const badge = getChecklistBadge(value);
                                const Icon = badge.icon;

                                return (
                                    <div
                                        key={item.key}
                                        className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <p className="text-sm font-medium">{item.label}</p>

                                        <Badge className={`${badge.className} w-fit border`}>
                                            <Icon className="mr-1 h-3.5 w-3.5" />
                                            {badge.label}
                                        </Badge>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Observaciones</CardTitle>
                </CardHeader>

                <CardContent>
                    <p className="min-h-[100px] whitespace-pre-wrap rounded-xl bg-muted/50 p-4 text-sm leading-relaxed">
                        {cleanValue(inspection.observations)}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="grid grid-cols-1 gap-3 py-5 text-xs text-muted-foreground md:grid-cols-2">
                    <p className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Creado: {formatDateTime(inspection.created_at)}
                    </p>

                    <p className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Última modificación: {formatDateTime(inspection.updated_at)}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

function SummaryCard({
    title,
    value,
    description,
}: {
    title: string;
    value: string;
    description: string;
}) {
    return (
        <Card>
            <CardContent className="flex items-center justify-between gap-4 p-5">
                <div>
                    <p className="text-sm text-muted-foreground">{title}</p>
                    <p className="mt-2 text-2xl font-bold">{value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
            </CardContent>
        </Card>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="mb-1 text-sm font-medium text-muted-foreground">{label}</p>
            <p className="break-words text-sm">{value}</p>
        </div>
    );
}