"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
    Activity,
    AlertTriangle,
    ArrowLeft,
    CalendarDays,
    Camera,
    Car,
    ChevronLeft,
    ChevronRight,
    CircleOff,
    Clock3,
    Edit,
    FilePenLine,
    Filter,
    Gauge,
    History,
    IdCard,
    Loader2,
    MapPin,
    PlusCircle,
    Radio,
    RotateCcw,
    Truck,
    Trash2,
    UserRound,
    UsersRound,
    Wrench,
    X,
} from "lucide-react";

import { toast } from "sonner";

import type { WorkOrder } from "@/types";

import { createClient } from "@/lib/supabase/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type PdfDocument = jsPDF & {
    lastAutoTable?: {
        finalY: number;
    };
};

const loadImageAsDataUrl = (
    src: string,
    maxWidth = 700,
    quality = 0.72,
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.crossOrigin = "anonymous";

        image.onload = () => {
            const originalWidth =
                image.naturalWidth || image.width;

            const originalHeight =
                image.naturalHeight || image.height;

            const targetWidth = Math.min(
                originalWidth,
                maxWidth,
            );

            const scale =
                originalWidth > 0
                    ? targetWidth / originalWidth
                    : 1;

            const targetHeight = Math.max(
                1,
                Math.round(originalHeight * scale),
            );

            const canvas =
                document.createElement("canvas");

            canvas.width = Math.max(
                1,
                Math.round(targetWidth),
            );

            canvas.height = targetHeight;

            const context =
                canvas.getContext("2d");

            if (!context) {
                reject(
                    new Error(
                        "No se pudo procesar la imagen.",
                    ),
                );

                return;
            }

            context.fillStyle = "#ffffff";

            context.fillRect(
                0,
                0,
                canvas.width,
                canvas.height,
            );

            context.drawImage(
                image,
                0,
                0,
                canvas.width,
                canvas.height,
            );

            resolve(
                canvas.toDataURL(
                    "image/jpeg",
                    quality,
                ),
            );
        };

        image.onerror = () => {
            reject(
                new Error(
                    "No se pudo cargar la imagen.",
                ),
            );
        };

        image.src = src;
    });
};

/* =========================================================
   TYPES
========================================================= */

type Vehicle = {
    id: string;

    code: string;
    vehicle: string;
    license_plate: string | null;

    vehicle_type: string | null;
    year: number | null;
    department: string | null;

    operational_status: string | null;

    repair_reason: string | null;
    out_of_service_reason: string | null;
    observations: string | null;

    rfid_tag: string | null;

    has_alltrack: boolean;
    has_ibutton_reader: boolean;
    has_camera: boolean;

    utilization: string | null;
    schedule: string | null;

    primary_driver_1: string | null;
    primary_driver_2: string | null;
    backup_driver: string | null;

    image_path: string | null;
    image_thumb_path: string | null;

    active: boolean;

    deactivation_date: string | null;
    deactivation_reason: string | null;

    created_at: string;
    updated_at: string;

    created_by: string | null;
    updated_by: string | null;
};

type VehicleHistoryEventType =
    | "created"
    | "updated"
    | "status_change"
    | "deactivated"
    | "reactivated";

type VehicleHistory = {
    id: string;
    vehicle_id: string;

    event_type: VehicleHistoryEventType;

    title: string;
    description: string | null;

    metadata: {
        before?: Partial<Vehicle>;
        after?: Partial<Vehicle>;
    } | null;

    performed_by: string | null;

    created_at: string;
};

type FichaVehiculoClientProps = {
    vehicle: Vehicle;
    canManage: boolean;
    isReadonly: boolean;
};

type VehicleCriticalityStatus =
    | "BUENO"
    | "REGULAR"
    | "MALO"
    | "SIN DATOS"
    | "SIN CHECKLIST"
    | "FUERA DE SERVICIO"
    | "DADO DE BAJA";

type VehicleCriticalitySummary = {
    vehicle_code: string;
    vehicle: string;
    license_plate: string;
    work_orders_count: number;
    mechanical_reliability_score: number;
    service_criticality: number;
    replacement_score: number;
    security_score: number;
    has_checklist: boolean;
    is_retired: boolean;
    total_criticality: number | null;
    notes: string;
    status_label: VehicleCriticalityStatus;
    status_display: string;
};

type AlltrackLocationData = {
    vehicle: {
        id: string;
        code: string;
        name: string;
        license_plate: string | null;
        alltrack_vehicle_id:
            | string
            | number
            | null;
    };
    position: {
        latitude: number | null;
        longitude: number | null;
        status: string | null;
        speed: number | null;
        driver: string | null;
        date: string | null;
        time: string | null;
        address: string | null;
        odometer: string | number | null;
        hourmeter: string | number | null;
        heading: number | null;
        timeout: number | null;
    };
};

type AlltrackLocationResponse = {
    meta?: {
        alltrack_token_cache?: boolean;
    };
    data?: AlltrackLocationData;
    error?: string;
};

type ChangedField = {
    key: keyof Vehicle;
    label: string;
    before: unknown;
    after: unknown;
    type?: "text" | "boolean" | "date" | "status";
};

/* =========================================================
   CONSTANTES
========================================================= */

const HISTORY_PAGE_SIZE = 10;

const HISTORY_ALL = "all";

const VEHICLE_FIELDS: Array<{
    key: keyof Vehicle;
    label: string;
    type?: "text" | "boolean" | "date" | "status";
}> = [
        {
            key: "code",
            label: "Código",
        },
        {
            key: "vehicle",
            label: "Vehículo",
        },
        {
            key: "license_plate",
            label: "Dominio",
        },
        {
            key: "vehicle_type",
            label: "Tipo de vehículo",
        },
        {
            key: "year",
            label: "Año",
        },
        {
            key: "department",
            label: "Dirección",
        },
        {
            key: "operational_status",
            label: "Estado operativo",
            type: "status",
        },
        {
            key: "repair_reason",
            label: "Motivo de reparación",
        },
        {
            key: "out_of_service_reason",
            label: "Motivo fuera de servicio",
        },
        {
            key: "observations",
            label: "Observaciones",
        },
        {
            key: "rfid_tag",
            label: "TAG RFID",
        },
        {
            key: "has_alltrack",
            label: "ALLTRACK",
            type: "boolean",
        },
        {
            key: "has_ibutton_reader",
            label: "Lector iButton",
            type: "boolean",
        },
        {
            key: "has_camera",
            label: "Cámara",
            type: "boolean",
        },
        {
            key: "utilization",
            label: "Utilización",
        },
        {
            key: "schedule",
            label: "Franja horaria",
        },
        {
            key: "primary_driver_1",
            label: "Chofer titular 1",
        },
        {
            key: "primary_driver_2",
            label: "Chofer titular 2",
        },
        {
            key: "backup_driver",
            label: "Chofer suplente",
        },
        {
            key: "active",
            label: "Situación",
            type: "boolean",
        },
        {
            key: "deactivation_date",
            label: "Fecha de baja",
            type: "date",
        },
        {
            key: "deactivation_reason",
            label: "Motivo de baja",
        },
    ];

const HISTORY_TYPE_OPTIONS: Array<{
    value: VehicleHistoryEventType;
    label: string;
}> = [
        {
            value: "created",
            label: "Alta / incorporación",
        },
        {
            value: "updated",
            label: "Modificación de datos",
        },
        {
            value: "status_change",
            label: "Cambio de estado",
        },
        {
            value: "deactivated",
            label: "Baja",
        },
        {
            value: "reactivated",
            label: "Reactivación",
        },
    ];

/* =========================================================
   HELPERS
========================================================= */

const normalizeText = (value: unknown) =>
    String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

const normalizeVehicleCode = (
    value: unknown,
) =>
    normalizeText(value).replace(
        /[\s.\-]/g,
        "",
    );

const getCriticalityBadgeClass = (
    status?: string | null,
) => {
    const normalized =
        normalizeText(status);

    if (
        normalized === "critico" ||
        normalized === "malo"
    ) {
        return "border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300";
    }

    if (normalized === "regular") {
        return "border-yellow-200 bg-yellow-100 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300";
    }

    if (normalized === "bueno") {
        return "border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300";
    }

    if (
        normalized ===
        "sin checklist"
    ) {
        return "border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300";
    }

    if (
        normalized ===
        "dado de baja"
    ) {
        return "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
    }

    return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
};

const getStatusLabel = (
    status?: string | null,
) => {
    const normalized = normalizeText(status);

    if (!normalized) {
        return "Sin estado";
    }

    if (normalized.includes("fuera")) {
        return "Fuera de servicio";
    }

    if (normalized.includes("reparacion")) {
        return "En reparación";
    }

    if (normalized.includes("arreglos")) {
        return "En funcionamiento con arreglos pendientes";
    }

    if (
        normalized.includes("funcionando") ||
        normalized.includes("funcionamiento")
    ) {
        return "Funcionando";
    }

    return String(status);
};

const getStatusBadgeClass = (
    status?: string | null,
) => {
    const normalized = normalizeText(status);

    if (normalized.includes("fuera")) {
        return "border-red-200 bg-red-100 text-red-800";
    }

    if (normalized.includes("reparacion")) {
        return "border-yellow-200 bg-yellow-100 text-yellow-800";
    }

    if (normalized.includes("arreglos")) {
        return "border-orange-200 bg-orange-100 text-orange-800";
    }

    if (
        normalized.includes("funcionando") ||
        normalized.includes("funcionamiento")
    ) {
        return "border-green-200 bg-green-100 text-green-800";
    }

    return "border-slate-200 bg-slate-100 text-slate-700";
};

const formatBoolean = (
    value?: boolean | null,
) => {
    if (value === null || value === undefined) {
        return "Sin dato";
    }

    return value ? "Sí" : "No";
};

const formatDate = (
    value?: string | null,
) => {
    if (!value) return "-";

    const [year, month, day] = value
        .slice(0, 10)
        .split("-")
        .map(Number);

    if (!year || !month || !day) {
        return value;
    }

    return new Date(
        year,
        month - 1,
        day,
    ).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
};

const formatDateTime = (
    value?: string | null,
) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const isMaintenanceWorkOrder = (
    order: WorkOrder,
) => {
    return (
        normalizeText(
            order.failure_type,
        ).includes("mantenimiento") ||
        normalizeText(
            order.repair_type,
        ).includes("mantenimiento")
    );
};

const getSixMonthsAgoDate = () => {
    const date = new Date();

    date.setMonth(
        date.getMonth() - 6,
    );

    const year =
        date.getFullYear();

    const month = String(
        date.getMonth() + 1,
    ).padStart(2, "0");

    const day = String(
        date.getDate(),
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const getWorkOrderDateValue = (
    value?: string | null,
) => {
    if (!value) {
        return 0;
    }

    const [year, month, day] =
        value
            .slice(0, 10)
            .split("-")
            .map(Number);

    if (!year || !month || !day) {
        return 0;
    }

    return new Date(
        year,
        month - 1,
        day,
    ).getTime();
};

const getWorkOrderSummary = (
    order: WorkOrder,
) => {
    const observation =
        String(
            order.observations || "",
        ).trim();

    if (observation) {
        return observation.replace(
            /\n?\[\[amount_currency:(ARS|USD)\]\]/g,
            "",
        ).trim();
    }

    const failureReport =
        String(
            order.failure_report || "",
        ).trim();

    if (failureReport) {
        return failureReport;
    }

    const failureType =
        String(
            order.failure_type || "",
        ).trim();

    if (failureType) {
        return failureType;
    }

    return "Sin detalle";
};

const getTodayDate = () => {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(
        now.getMonth() + 1,
    ).padStart(2, "0");

    const day = String(
        now.getDate(),
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const getComparableValue = (
    value: unknown,
) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "string") {
        return value.trim();
    }

    return value;
};

const valuesAreDifferent = (
    before: unknown,
    after: unknown,
) => {
    return (
        JSON.stringify(
            getComparableValue(before),
        ) !==
        JSON.stringify(
            getComparableValue(after),
        )
    );
};

const getChangedFields = (
    event: VehicleHistory,
): ChangedField[] => {
    const before =
        event.metadata?.before;

    const after =
        event.metadata?.after;

    if (!before || !after) {
        return [];
    }

    return VEHICLE_FIELDS.flatMap(
        (field) => {
            const beforeValue =
                before[field.key];

            const afterValue =
                after[field.key];

            if (
                !valuesAreDifferent(
                    beforeValue,
                    afterValue,
                )
            ) {
                return [];
            }

            return [
                {
                    key: field.key,
                    label: field.label,
                    before: beforeValue,
                    after: afterValue,
                    type: field.type,
                },
            ];
        },
    );
};

const formatHistoryValue = (
    value: unknown,
    type?: ChangedField["type"],
) => {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "Sin dato";
    }

    if (type === "boolean") {
        return formatBoolean(
            Boolean(value),
        );
    }

    if (type === "date") {
        return formatDate(
            String(value),
        );
    }

    if (type === "status") {
        return getStatusLabel(
            String(value),
        );
    }

    return String(value);
};

/* =========================================================
   COMPONENT PRINCIPAL
========================================================= */

export function FichaVehiculoClient({
    vehicle,
    canManage,
    isReadonly,
}: FichaVehiculoClientProps) {
    const router = useRouter();
    const pathname = usePathname();

    const [
        navigationLoading,
        setNavigationLoading,
    ] = useState(false);

    const [
        isExportingPdf,
        setIsExportingPdf,
    ] = useState(false);

    useEffect(() => {
        setNavigationLoading(false);
    }, [pathname]);

    const navigateWithLoader = (
        href: string,
    ) => {
        if (pathname === href) {
            return;
        }

        setNavigationLoading(true);
        router.push(href);
    };

    const handleEditVehicle = () => {
        navigateWithLoader(
            `/dashboard/planta-vehicular/${vehicle.id}/editar`,
        );
    };

    /* =======================================================
       RASTREO ALLTRACK
    ======================================================= */

    const [
        trackingOpen,
        setTrackingOpen,
    ] = useState(false);

    const [
        trackingLoading,
        setTrackingLoading,
    ] = useState(false);

    const [
        trackingError,
        setTrackingError,
    ] = useState<string | null>(
        null,
    );

    const [
        trackingData,
        setTrackingData,
    ] = useState<
        AlltrackLocationData | null
    >(null);

    const fetchTrackingLocation =
        useCallback(async () => {
            if (
                trackingLoading ||
                !vehicle.has_alltrack
            ) {
                return;
            }

            try {
                setTrackingLoading(
                    true,
                );

                setTrackingError(
                    null,
                );

                const response =
                    await fetch(
                        `/api/alltrack/location/${encodeURIComponent(
                            vehicle.code,
                        )}`,
                        {
                            method: "GET",
                            cache: "no-store",
                        },
                    );

                const result =
                    (await response.json()) as AlltrackLocationResponse;

                if (
                    !response.ok ||
                    !result.data
                ) {
                    throw new Error(
                        result.error ||
                            "No se pudo obtener la ubicación del vehículo.",
                    );
                }

                setTrackingData(
                    result.data,
                );
            } catch (error) {
                console.error(
                    `Error rastreando ${vehicle.code}:`,
                    error,
                );

                setTrackingError(
                    error instanceof Error
                        ? error.message
                        : "No se pudo obtener la ubicación del vehículo.",
                );
            } finally {
                setTrackingLoading(
                    false,
                );
            }
        }, [
            trackingLoading,
            vehicle.code,
            vehicle.has_alltrack,
        ]);

    const handleOpenTracking =
        () => {
            setTrackingOpen(true);

            void fetchTrackingLocation();
        };

    const trackingPosition =
        trackingData?.position;

    const hasTrackingCoordinates =
        typeof trackingPosition?.latitude ===
            "number" &&
        typeof trackingPosition?.longitude ===
            "number";

    const trackingMapUrl =
        hasTrackingCoordinates
            ? (() => {
                const latitude =
                    trackingPosition
                        ?.latitude as number;

                const longitude =
                    trackingPosition
                        ?.longitude as number;

                const delta = 0.008;

                const bbox = [
                    longitude - delta,
                    latitude - delta,
                    longitude + delta,
                    latitude + delta,
                ].join(",");

                const params =
                    new URLSearchParams({
                        bbox,
                        layer: "mapnik",
                        marker: `${latitude},${longitude}`,
                    });

                return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
            })()
            : null;

    const trackingExternalMapUrl =
        hasTrackingCoordinates
            ? `https://www.openstreetmap.org/?mlat=${trackingPosition?.latitude}&mlon=${trackingPosition?.longitude}#map=17/${trackingPosition?.latitude}/${trackingPosition?.longitude}`
            : null;

    const [
        criticality,
        setCriticality,
    ] = useState<
        VehicleCriticalitySummary | null
    >(null);

    const [
        criticalityLoading,
        setCriticalityLoading,
    ] = useState(true);

    const [
        criticalityError,
        setCriticalityError,
    ] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadCriticality =
            async () => {
                try {
                    setCriticalityLoading(
                        true,
                    );
                    setCriticalityError(
                        null,
                    );

                    const response =
                        await fetch(
                            `/api/taller/criticidad/resumen?code=${encodeURIComponent(
                                vehicle.code,
                            )}`,
                            {
                                cache: "no-store",
                            },
                        );

                    const result =
                        await response.json();

                    if (!response.ok) {
                        throw new Error(
                            result?.error ||
                                "No se pudo cargar la criticidad del vehículo",
                        );
                    }

                    const rows =
                        (result?.data ||
                            []) as VehicleCriticalitySummary[];

                    const matched =
                        rows[0] || null;

                    if (!cancelled) {
                        setCriticality(
                            matched,
                        );
                    }
                } catch (error) {
                    console.error(
                        "Error cargando criticidad en la ficha del vehículo:",
                        error,
                    );

                    if (!cancelled) {
                        setCriticality(null);
                        setCriticalityError(
                            error instanceof Error
                                ? error.message
                                : "No se pudo cargar la criticidad del vehículo",
                        );
                    }
                } finally {
                    if (!cancelled) {
                        setCriticalityLoading(
                            false,
                        );
                    }
                }
            };

        void loadCriticality();

        return () => {
            cancelled = true;
        };
    }, [vehicle.code]);

    /* =======================================================
       ÓRDENES DE TRABAJO DEL VEHÍCULO
    ======================================================= */

    const [
        vehicleWorkOrders,
        setVehicleWorkOrders,
    ] = useState<WorkOrder[]>([]);

    const [
        workOrdersLoading,
        setWorkOrdersLoading,
    ] = useState(true);

    const [
        workOrdersError,
        setWorkOrdersError,
    ] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadVehicleWorkOrders =
            async () => {
                try {
                    setWorkOrdersLoading(
                        true,
                    );

                    setWorkOrdersError(
                        null,
                    );

                    const response =
                        await fetch(
                            `/api/work-orders?code=${encodeURIComponent(
                                vehicle.code,
                            )}`,
                            {
                                cache: "no-store",
                            },
                        );

                    const result =
                        await response.json();

                    if (!response.ok) {
                        throw new Error(
                            result?.error ||
                                "No se pudieron cargar las órdenes de trabajo",
                        );
                    }

                    const rows =
                        (
                            (result?.data ||
                                []) as WorkOrder[]
                        ).sort(
                            (a, b) =>
                                getWorkOrderDateValue(
                                    b.entry_date,
                                ) -
                                    getWorkOrderDateValue(
                                        a.entry_date,
                                    ) ||
                                Number(
                                    b.order_number ||
                                        0,
                                ) -
                                    Number(
                                        a.order_number ||
                                            0,
                                    ),
                        );

                    if (!cancelled) {
                        setVehicleWorkOrders(
                            rows,
                        );
                    }
                } catch (error) {
                    console.error(
                        "Error cargando OT del vehículo:",
                        error,
                    );

                    if (!cancelled) {
                        setVehicleWorkOrders(
                            [],
                        );

                        setWorkOrdersError(
                            error instanceof Error
                                ? error.message
                                : "No se pudieron cargar las órdenes de trabajo",
                        );
                    }
                } finally {
                    if (!cancelled) {
                        setWorkOrdersLoading(
                            false,
                        );
                    }
                }
            };

        void loadVehicleWorkOrders();

        return () => {
            cancelled = true;
        };
    }, [vehicle.code]);

    const sixMonthsAgo =
        getSixMonthsAgoDate();

    const sixMonthsAgoValue =
        getWorkOrderDateValue(
            sixMonthsAgo,
        );

    const latestRegularWorkOrders =
        useMemo(
            () =>
                vehicleWorkOrders.filter(
                    (order) =>
                        !isMaintenanceWorkOrder(
                            order,
                        ) &&
                        getWorkOrderDateValue(
                            order.entry_date,
                        ) >=
                            sixMonthsAgoValue,
                ),
            [
                vehicleWorkOrders,
                sixMonthsAgoValue,
            ],
        );

    const latestMaintenance =
        useMemo(
            () =>
                vehicleWorkOrders.find(
                    isMaintenanceWorkOrder,
                ) || null,
            [vehicleWorkOrders],
        );

    const workOrdersHistoryHref =
        `/dashboard/taller/ordenes-trabajo?code=${encodeURIComponent(
            vehicle.code,
        )}`;

    const workOrdersSixMonthsHref =
        `${workOrdersHistoryHref}&date_from=${encodeURIComponent(
            sixMonthsAgo,
        )}`;

    const maintenanceHistoryHref =
        `${workOrdersHistoryHref}&maintenance=1`;

    const [
        vehicleImageUrl,
        setVehicleImageUrl,
    ] = useState<string | null>(null);

    const [
        vehicleImageLoading,
        setVehicleImageLoading,
    ] = useState(
        Boolean(
            vehicle.image_thumb_path ||
                vehicle.image_path,
        ),
    );

    /*
     * En la ficha usamos primero el thumbnail WEBP optimizado.
     * Si un vehículo todavía no tiene thumbnail, usamos la
     * fotografía original como respaldo.
     */
    useEffect(() => {
        let cancelled = false;

        const loadVehicleImage =
            async () => {
                const imagePath =
                    vehicle.image_thumb_path ||
                    vehicle.image_path;

                if (!imagePath) {
                    setVehicleImageUrl(null);
                    setVehicleImageLoading(false);
                    return;
                }

                try {
                    setVehicleImageLoading(true);

                    const supabase =
                        createClient();

                    const {
                        data,
                        error,
                    } =
                        await supabase.storage
                            .from(
                                "vehicle-images",
                            )
                            .createSignedUrl(
                                imagePath,
                                60 * 60 * 24,
                            );

                    if (error) {
                        throw error;
                    }

                    if (!cancelled) {
                        setVehicleImageUrl(
                            data?.signedUrl ||
                            null,
                        );
                    }
                } catch (error) {
                    console.error(
                        "Error cargando la fotografía del vehículo:",
                        error,
                    );

                    if (!cancelled) {
                        setVehicleImageUrl(null);
                    }
                } finally {
                    if (!cancelled) {
                        setVehicleImageLoading(false);
                    }
                }
            };

        void loadVehicleImage();

        return () => {
            cancelled = true;
        };
    }, [
        vehicle.image_thumb_path,
        vehicle.image_path,
    ]);

    /* =======================================================
       HISTORIAL
    ======================================================= */

    const [history, setHistory] =
        useState<VehicleHistory[]>([]);

    const [
        historyLoading,
        setHistoryLoading,
    ] = useState(true);

    const [
        historyPage,
        setHistoryPage,
    ] = useState(1);

    const [
        historyTotal,
        setHistoryTotal,
    ] = useState(0);



    const [
        historyType,
        setHistoryType,
    ] = useState(HISTORY_ALL);

    const [
        historyDateFrom,
        setHistoryDateFrom,
    ] = useState("");

    const [
        historyDateTo,
        setHistoryDateTo,
    ] = useState("");

    const historyTotalPages =
        Math.max(
            1,
            Math.ceil(
                historyTotal /
                HISTORY_PAGE_SIZE,
            ),
        );

    const historyFirstResult =
        historyTotal === 0
            ? 0
            : (historyPage - 1) *
            HISTORY_PAGE_SIZE +
            1;

    const historyLastResult =
        Math.min(
            historyPage *
            HISTORY_PAGE_SIZE,
            historyTotal,
        );

    const hasHistoryFilters =
        historyType !== HISTORY_ALL ||
        historyDateFrom !== "" ||
        historyDateTo !== "";

    const fetchHistory =
        useCallback(async () => {
            try {
                setHistoryLoading(true);

                const supabase =
                    createClient();

                const from =
                    (historyPage - 1) *
                    HISTORY_PAGE_SIZE;

                const to =
                    from +
                    HISTORY_PAGE_SIZE -
                    1;

                let query = supabase
                    .from("vehicle_history")
                    .select(
                        `
              id,
              vehicle_id,
              event_type,
              title,
              description,
              metadata,
              performed_by,
              created_at
            `,
                        {
                            count: "exact",
                        },
                    )
                    .eq(
                        "vehicle_id",
                        vehicle.id,
                    );

                if (
                    historyType !==
                    HISTORY_ALL
                ) {
                    query = query.eq(
                        "event_type",
                        historyType,
                    );
                }

                if (historyDateFrom) {
                    query = query.gte(
                        "created_at",
                        `${historyDateFrom}T00:00:00`,
                    );
                }

                if (historyDateTo) {
                    query = query.lte(
                        "created_at",
                        `${historyDateTo}T23:59:59.999`,
                    );
                }

                const {
                    data,
                    error,
                    count,
                } = await query
                    .order("created_at", {
                        ascending: false,
                    })
                    .range(from, to);

                if (error) {
                    throw error;
                }

                setHistory(
                    (data ||
                        []) as VehicleHistory[],
                );

                setHistoryTotal(
                    count || 0,
                );
            } catch (error) {
                console.error(
                    "Error cargando historial del vehículo:",
                    error,
                );

                toast.error(
                    "No se pudo cargar el historial del vehículo",
                );
            } finally {
                setHistoryLoading(false);
            }
        }, [
            vehicle.id,
            vehicle.updated_at,
            historyPage,
            historyType,
            historyDateFrom,
            historyDateTo,
        ]);

    useEffect(() => {
        void fetchHistory();
    }, [fetchHistory]);

    /*
     * Si un filtro cambia y estábamos,
     * por ejemplo, en la página 6,
     * volvemos a la página 1.
     */
    useEffect(() => {
        setHistoryPage(1);
    }, [
        historyType,
        historyDateFrom,
        historyDateTo,
    ]);

    const clearHistoryFilters = () => {
        setHistoryType(HISTORY_ALL);
        setHistoryDateFrom("");
        setHistoryDateTo("");
        setHistoryPage(1);
    };

    /* =======================================================
       BAJA
    ======================================================= */

    const [
        deactivationOpen,
        setDeactivationOpen,
    ] = useState(false);

    const [
        deactivationDate,
        setDeactivationDate,
    ] = useState(
        getTodayDate(),
    );

    const [
        deactivationReason,
        setDeactivationReason,
    ] = useState("");

    const [
        deactivating,
        setDeactivating,
    ] = useState(false);

    /* =======================================================
       REACTIVACIÓN
    ======================================================= */

    const [
        reactivationOpen,
        setReactivationOpen,
    ] = useState(false);

    const [
        reactivating,
        setReactivating,
    ] = useState(false);

    /* =======================================================
       ELIMINACIÓN DEFINITIVA
    ======================================================= */

    const [
        deleteOpen,
        setDeleteOpen,
    ] = useState(false);

    const [
        deleteConfirmation,
        setDeleteConfirmation,
    ] = useState("");

    const [
        deleting,
        setDeleting,
    ] = useState(false);

    const handleOpenDelete = () => {
        setDeleteConfirmation("");
        setDeleteOpen(true);
    };

    const handleOpenDeactivation =
        () => {
            setDeactivationDate(
                getTodayDate(),
            );

            setDeactivationReason("");

            setDeactivationOpen(true);
        };

    const handleDeactivateVehicle =
        async () => {
            if (!deactivationDate) {
                toast.error(
                    "Ingresá la fecha de baja",
                );

                return;
            }

            if (
                !deactivationReason.trim()
            ) {
                toast.error(
                    "Ingresá el motivo de la baja",
                );

                return;
            }

            try {
                setDeactivating(true);

                const supabase =
                    createClient();

                const {
                    data: { user },
                    error: authError,
                } =
                    await supabase.auth.getUser();

                if (
                    authError ||
                    !user
                ) {
                    toast.error(
                        "No se pudo validar el usuario actual",
                    );

                    return;
                }

                const { error } =
                    await supabase
                        .from("vehicles")
                        .update({
                            active: false,

                            deactivation_date:
                                deactivationDate,

                            deactivation_reason:
                                deactivationReason.trim(),

                            updated_by:
                                user.id,
                        })
                        .eq(
                            "id",
                            vehicle.id,
                        )
                        .eq(
                            "active",
                            true,
                        );

                if (error) {
                    throw error;
                }

                toast.success(
                    "Vehículo dado de baja correctamente",
                );

                setDeactivationOpen(false);

                router.refresh();
            } catch (error) {
                console.error(
                    "Error dando de baja el vehículo:",
                    error,
                );

                toast.error(
                    error instanceof Error
                        ? error.message
                        : "No se pudo dar de baja el vehículo",
                );
            } finally {
                setDeactivating(false);
            }
        };

    const handleReactivateVehicle =
        async () => {
            try {
                setReactivating(true);

                const supabase =
                    createClient();

                const {
                    data: { user },
                    error: authError,
                } =
                    await supabase.auth.getUser();

                if (
                    authError ||
                    !user
                ) {
                    toast.error(
                        "No se pudo validar el usuario actual",
                    );

                    return;
                }

                const { error } =
                    await supabase
                        .from("vehicles")
                        .update({
                            active: true,

                            deactivation_date:
                                null,

                            deactivation_reason:
                                null,

                            updated_by:
                                user.id,
                        })
                        .eq(
                            "id",
                            vehicle.id,
                        )
                        .eq(
                            "active",
                            false,
                        );

                if (error) {
                    throw error;
                }

                toast.success(
                    "Vehículo reactivado correctamente",
                );

                setReactivationOpen(false);

                router.refresh();
            } catch (error) {
                console.error(
                    "Error reactivando el vehículo:",
                    error,
                );

                toast.error(
                    error instanceof Error
                        ? error.message
                        : "No se pudo reactivar el vehículo",
                );
            } finally {
                setReactivating(false);
            }
        };

    const handleDeleteVehicle =
        async () => {
            const expectedCode =
                vehicle.code
                    .trim()
                    .toUpperCase();

            const typedCode =
                deleteConfirmation
                    .trim()
                    .toUpperCase();

            if (typedCode !== expectedCode) {
                toast.error(
                    `Escribí ${vehicle.code} para confirmar la eliminación.`,
                );

                return;
            }

            try {
                setDeleting(true);

                const supabase =
                    createClient();

                const {
                    data: { user },
                    error: authError,
                } =
                    await supabase.auth.getUser();

                if (
                    authError ||
                    !user
                ) {
                    toast.error(
                        "No se pudo validar el usuario actual",
                    );

                    return;
                }

                /*
                 * 1. Eliminamos primero el historial asociado.
                 *
                 * Esto evita que una FK de vehicle_history
                 * bloquee la eliminación del vehículo.
                 */
                const {
                    error: historyDeleteError,
                } = await supabase
                    .from("vehicle_history")
                    .delete()
                    .eq(
                        "vehicle_id",
                        vehicle.id,
                    );

                if (historyDeleteError) {
                    throw new Error(
                        `No se pudo eliminar el historial: ${historyDeleteError.message}`,
                    );
                }

                /*
                 * 2. Eliminamos definitivamente el vehículo.
                 */
                const {
                    data: deletedVehicle,
                    error: vehicleDeleteError,
                } = await supabase
                    .from("vehicles")
                    .delete()
                    .eq(
                        "id",
                        vehicle.id,
                    )
                    .select("id")
                    .maybeSingle();

                if (vehicleDeleteError) {
                    throw new Error(
                        `No se pudo eliminar el vehículo: ${vehicleDeleteError.message}`,
                    );
                }

                /*
                 * IMPORTANTE:
                 * Con RLS, Supabase puede devolver error = null
                 * aunque el DELETE haya afectado 0 filas.
                 *
                 * Por eso verificamos que realmente haya devuelto
                 * el vehículo eliminado antes de tocar Storage.
                 */
                if (!deletedVehicle) {
                    throw new Error(
                        "Supabase no eliminó el vehículo. Verificá la política DELETE de vehicles.",
                    );
                }

                /*
                 * 3. La BD ya quedó eliminada.
                 * Ahora limpiamos la fotografía en Storage.
                 *
                 * Si esta parte falla, el vehículo igualmente
                 * queda eliminado; sólo quedaría un archivo
                 * huérfano que puede limpiarse después.
                 */
                const storageFiles = [
                    vehicle.image_path,
                    vehicle.image_thumb_path,
                ].filter(
                    (path): path is string =>
                        Boolean(path),
                );

                if (storageFiles.length > 0) {
                    const {
                        error: imageDeleteError,
                    } = await supabase.storage
                        .from(
                            "vehicle-images",
                        )
                        .remove(
                            Array.from(
                                new Set(
                                    storageFiles,
                                ),
                            ),
                        );

                    if (imageDeleteError) {
                        console.warn(
                            "El vehículo fue eliminado, pero no se pudieron borrar todos sus archivos de imagen de Storage:",
                            imageDeleteError,
                        );
                    }
                }

                toast.success(
                    "Vehículo eliminado definitivamente",
                );

                setDeleteOpen(false);

                router.push(
                    "/dashboard/planta-vehicular",
                );

                router.refresh();
            } catch (error) {
                console.error(
                    "Error eliminando definitivamente el vehículo:",
                    error,
                );

                toast.error(
                    error instanceof Error
                        ? error.message
                        : "No se pudo eliminar el vehículo",
                );
            } finally {
                setDeleting(false);
            }
        };

    const exportToPdf = async () => {
        if (isExportingPdf) {
            return;
        }

        setIsExportingPdf(true);

        try {
            const doc = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4",
                compress: true,
            }) as PdfDocument;

            const pageWidth =
                doc.internal.pageSize.getWidth();

            const pageHeight =
                doc.internal.pageSize.getHeight();

            const marginX = 14;

            let logoDataUrl:
                | string
                | null = null;

            let vehiclePhotoDataUrl:
                | string
                | null = null;

            try {
                logoDataUrl =
                    await loadImageAsDataUrl(
                        "/logo-general-pico-horizontal.png",
                        500,
                        0.72,
                    );
            } catch (error) {
                console.warn(
                    "No se pudo cargar el logo para el PDF:",
                    error,
                );
            }

            if (vehicleImageUrl) {
                try {
                    vehiclePhotoDataUrl =
                        await loadImageAsDataUrl(
                            vehicleImageUrl,
                            900,
                            0.7,
                        );
                } catch (error) {
                    console.warn(
                        "No se pudo cargar la foto del vehículo para el PDF:",
                        error,
                    );
                }
            }

            if (logoDataUrl) {
                doc.addImage(
                    logoDataUrl,
                    "JPEG",
                    marginX,
                    9,
                    34,
                    12,
                    undefined,
                    "FAST",
                );
            }

            doc.setFont(
                "helvetica",
                "bold",
            );

            doc.setFontSize(17);
            doc.setTextColor(
                30,
                41,
                59,
            );

            doc.text(
                "Ficha de Planta Vehicular",
                52,
                14,
            );

            doc.setFont(
                "helvetica",
                "normal",
            );

            doc.setFontSize(9.5);
            doc.setTextColor(
                71,
                85,
                105,
            );

            doc.text(
                "Secretaría de Ambiente y Servicios Públicos",
                52,
                20,
            );

            doc.setFontSize(8.5);

            doc.text(
                `Fecha de exportación: ${new Date().toLocaleString(
                    "es-AR",
                )}`,
                marginX,
                31,
            );

            doc.setDrawColor(
                226,
                232,
                240,
            );

            doc.line(
                marginX,
                35,
                pageWidth - marginX,
                35,
            );

            let topY = 42;

            if (vehiclePhotoDataUrl) {
                const photoX = marginX;
                const photoY = topY;
                const photoW = 70;
                const photoH = 48;

                doc.setDrawColor(
                    226,
                    232,
                    240,
                );

                doc.roundedRect(
                    photoX,
                    photoY,
                    photoW,
                    photoH,
                    2,
                    2,
                );

                doc.addImage(
                    vehiclePhotoDataUrl,
                    "JPEG",
                    photoX + 1,
                    photoY + 1,
                    photoW - 2,
                    photoH - 2,
                    undefined,
                    "FAST",
                );

                doc.setFont(
                    "helvetica",
                    "bold",
                );

                doc.setFontSize(18);
                doc.setTextColor(
                    30,
                    41,
                    59,
                );

                doc.text(
                    vehicle.code,
                    90,
                    topY + 6,
                );

                doc.setFontSize(12.5);

                const vehicleNameLines =
                    doc.splitTextToSize(
                        vehicle.vehicle ||
                            "Sin nombre",
                        103,
                    );

                doc.text(
                    vehicleNameLines,
                    90,
                    topY + 13,
                );

                doc.setFont(
                    "helvetica",
                    "normal",
                );

                doc.setFontSize(9);
                doc.setTextColor(
                    71,
                    85,
                    105,
                );

                doc.text(
                    `Dominio: ${
                        vehicle.license_plate ||
                        "-"
                    }`,
                    90,
                    topY + 26,
                );

                doc.text(
                    `Estado: ${getStatusLabel(
                        vehicle.operational_status,
                    )}`,
                    90,
                    topY + 33,
                );

                doc.text(
                    `Dirección: ${
                        vehicle.department ||
                        "-"
                    }`,
                    90,
                    topY + 40,
                );

                topY = photoY + photoH + 8;
            } else {
                doc.setFont(
                    "helvetica",
                    "bold",
                );

                doc.setFontSize(18);

                doc.text(
                    `${vehicle.code} · ${vehicle.vehicle}`,
                    marginX,
                    topY,
                );

                doc.setFont(
                    "helvetica",
                    "normal",
                );

                doc.setFontSize(9);

                doc.text(
                    `Dominio: ${
                        vehicle.license_plate ||
                        "-"
                    } · Estado: ${getStatusLabel(
                        vehicle.operational_status,
                    )}`,
                    marginX,
                    topY + 7,
                );

                topY += 15;
            }

            doc.setFont(
                "helvetica",
                "bold",
            );

            doc.setFontSize(11.5);
            doc.setTextColor(
                30,
                41,
                59,
            );

            doc.text(
                "Información general",
                marginX,
                topY,
            );

            autoTable(doc, {
                startY: topY + 3,
                head: [[
                    "Campo",
                    "Valor",
                ]],
                body: [
                    [
                        "Código",
                        vehicle.code || "-",
                    ],
                    [
                        "Vehículo",
                        vehicle.vehicle || "-",
                    ],
                    [
                        "Dominio",
                        vehicle.license_plate ||
                            "-",
                    ],
                    [
                        "Tipo de vehículo",
                        vehicle.vehicle_type ||
                            "-",
                    ],
                    [
                        "Año",
                        vehicle.year
                            ? String(vehicle.year)
                            : "-",
                    ],
                    [
                        "Dirección",
                        vehicle.department ||
                            "-",
                    ],
                    [
                        "Estado operativo",
                        getStatusLabel(
                            vehicle.operational_status,
                        ),
                    ],
                ],
                theme: "grid",
                margin: {
                    left: marginX,
                    right: marginX,
                },
                styles: {
                    fontSize: 8.5,
                    cellPadding: 2.2,
                    textColor: [
                        51,
                        65,
                        85,
                    ],
                    lineColor: [
                        226,
                        232,
                        240,
                    ],
                    lineWidth: 0.15,
                },
                headStyles: {
                    fillColor: [
                        5,
                        150,
                        105,
                    ],
                    textColor: [
                        255,
                        255,
                        255,
                    ],
                    fontStyle: "bold",
                },
                alternateRowStyles: {
                    fillColor: [
                        248,
                        250,
                        252,
                    ],
                },
                columnStyles: {
                    0: {
                        cellWidth: 55,
                        fontStyle: "bold",
                    },
                    1: {
                        cellWidth: 127,
                    },
                },
            });

            let nextY =
                (doc.lastAutoTable?.finalY ??
                    topY) + 8;

            if (nextY > 240) {
                doc.addPage();
                nextY = 18;
            }

            doc.setFont(
                "helvetica",
                "bold",
            );

            doc.setFontSize(11.5);
            doc.setTextColor(
                30,
                41,
                59,
            );

            doc.text(
                "Utilización y responsables",
                marginX,
                nextY,
            );

            autoTable(doc, {
                startY: nextY + 3,
                head: [[
                    "Campo",
                    "Valor",
                ]],
                body: [
                    [
                        "Utilización",
                        vehicle.utilization ||
                            "-",
                    ],
                    [
                        "Franja horaria",
                        vehicle.schedule || "-",
                    ],
                    [
                        "Chofer titular 1",
                        vehicle.primary_driver_1 ||
                            "-",
                    ],
                    [
                        "Chofer titular 2",
                        vehicle.primary_driver_2 ||
                            "-",
                    ],
                    [
                        "Chofer suplente",
                        vehicle.backup_driver ||
                            "-",
                    ],
                ],
                theme: "grid",
                margin: {
                    left: marginX,
                    right: marginX,
                },
                styles: {
                    fontSize: 8.5,
                    cellPadding: 2.2,
                    textColor: [
                        51,
                        65,
                        85,
                    ],
                    lineColor: [
                        226,
                        232,
                        240,
                    ],
                    lineWidth: 0.15,
                },
                headStyles: {
                    fillColor: [
                        16,
                        185,
                        129,
                    ],
                    textColor: [
                        255,
                        255,
                        255,
                    ],
                    fontStyle: "bold",
                },
                alternateRowStyles: {
                    fillColor: [
                        248,
                        250,
                        252,
                    ],
                },
                columnStyles: {
                    0: {
                        cellWidth: 55,
                        fontStyle: "bold",
                    },
                    1: {
                        cellWidth: 127,
                    },
                },
            });

            nextY =
                (doc.lastAutoTable?.finalY ??
                    nextY) + 8;

            if (nextY > 235) {
                doc.addPage();
                nextY = 18;
            }

            doc.setFont(
                "helvetica",
                "bold",
            );

            doc.setFontSize(11.5);
            doc.setTextColor(
                30,
                41,
                59,
            );

            doc.text(
                "Equipamiento y tecnología",
                marginX,
                nextY,
            );

            autoTable(doc, {
                startY: nextY + 3,
                head: [[
                    "TAG RFID",
                    "ALLTRACK",
                    "Lector iButton",
                    "Cámara",
                ]],
                body: [[
                    vehicle.rfid_tag || "-",
                    formatBoolean(
                        vehicle.has_alltrack,
                    ),
                    formatBoolean(
                        vehicle.has_ibutton_reader,
                    ),
                    formatBoolean(
                        vehicle.has_camera,
                    ),
                ]],
                theme: "grid",
                margin: {
                    left: marginX,
                    right: marginX,
                },
                styles: {
                    fontSize: 8.2,
                    cellPadding: 2.2,
                    textColor: [
                        51,
                        65,
                        85,
                    ],
                    lineColor: [
                        226,
                        232,
                        240,
                    ],
                    lineWidth: 0.15,
                    halign: "center",
                },
                headStyles: {
                    fillColor: [
                        16,
                        185,
                        129,
                    ],
                    textColor: [
                        255,
                        255,
                        255,
                    ],
                    fontStyle: "bold",
                },
            });

            nextY =
                (doc.lastAutoTable?.finalY ??
                    nextY) + 8;

            if (nextY > 225) {
                doc.addPage();
                nextY = 18;
            }

            doc.setFont(
                "helvetica",
                "bold",
            );

            doc.setFontSize(11.5);
            doc.setTextColor(
                30,
                41,
                59,
            );

            doc.text(
                "Estado y observaciones",
                marginX,
                nextY,
            );

            autoTable(doc, {
                startY: nextY + 3,
                head: [[
                    "Campo",
                    "Detalle",
                ]],
                body: [
                    [
                        "Motivo de reparación",
                        vehicle.repair_reason ||
                            "-",
                    ],
                    [
                        "Motivo fuera de servicio",
                        vehicle.out_of_service_reason ||
                            "-",
                    ],
                    [
                        "Observaciones",
                        vehicle.observations ||
                            "-",
                    ],
                ],
                theme: "grid",
                margin: {
                    left: marginX,
                    right: marginX,
                },
                styles: {
                    fontSize: 8.5,
                    cellPadding: 2.2,
                    textColor: [
                        51,
                        65,
                        85,
                    ],
                    lineColor: [
                        226,
                        232,
                        240,
                    ],
                    lineWidth: 0.15,
                    overflow: "linebreak",
                },
                headStyles: {
                    fillColor: [
                        16,
                        185,
                        129,
                    ],
                    textColor: [
                        255,
                        255,
                        255,
                    ],
                    fontStyle: "bold",
                },
                alternateRowStyles: {
                    fillColor: [
                        248,
                        250,
                        252,
                    ],
                },
                columnStyles: {
                    0: {
                        cellWidth: 55,
                        fontStyle: "bold",
                    },
                    1: {
                        cellWidth: 127,
                    },
                },
            });

            nextY =
                (doc.lastAutoTable?.finalY ??
                    nextY) + 8;

            if (
                criticality &&
                vehicle.active
            ) {
                if (nextY > 225) {
                    doc.addPage();
                    nextY = 18;
                }

                doc.setFont(
                    "helvetica",
                    "bold",
                );

                doc.setFontSize(11.5);
                doc.setTextColor(
                    30,
                    41,
                    59,
                );

                doc.text(
                    "Criticidad actual",
                    marginX,
                    nextY,
                );

                autoTable(doc, {
                    startY: nextY + 3,
                    head: [[
                        "OT 6 meses",
                        "Conf. mecánica",
                        "Crit. servicio",
                        "Reemplazo",
                        "Seguridad",
                        "Total",
                        "Estado",
                    ]],
                    body: [[
                        criticality.work_orders_count,
                        criticality.mechanical_reliability_score,
                        criticality.service_criticality,
                        criticality.replacement_score,
                        criticality.has_checklist
                            ? criticality.security_score
                            : "--",
                        criticality.total_criticality !== null
                            ? criticality.total_criticality
                            : "--",
                        criticality.status_display ||
                            criticality.status_label ||
                            "SIN DATOS",
                    ]],
                    theme: "grid",
                    margin: {
                        left: marginX,
                        right: marginX,
                    },
                    styles: {
                        fontSize: 7.8,
                        cellPadding: 2,
                        textColor: [
                            51,
                            65,
                            85,
                        ],
                        lineColor: [
                            226,
                            232,
                            240,
                        ],
                        lineWidth: 0.15,
                        halign: "center",
                    },
                    headStyles: {
                        fillColor: [
                            5,
                            150,
                            105,
                        ],
                        textColor: [
                            255,
                            255,
                            255,
                        ],
                        fontStyle: "bold",
                    },
                });

                nextY =
                    (doc.lastAutoTable?.finalY ??
                        nextY) + 8;
            }

            if (
                latestRegularWorkOrders.length >
                0
            ) {
                if (nextY > 220) {
                    doc.addPage();
                    nextY = 18;
                }

                doc.setFont(
                    "helvetica",
                    "bold",
                );

                doc.setFontSize(11.5);
                doc.setTextColor(
                    30,
                    41,
                    59,
                );

                doc.text(
                    "Órdenes de trabajo · últimos 6 meses",
                    marginX,
                    nextY,
                );

                autoTable(doc, {
                    startY: nextY + 3,
                    head: [[
                        "OT",
                        "Fecha",
                        "Tipo",
                        "Reparación",
                        "Detalle",
                        "Estado",
                    ]],
                    body:
                        latestRegularWorkOrders.map(
                            (order) => [
                                order.order_number ||
                                    "-",
                                formatDate(
                                    order.entry_date,
                                ),
                                order.failure_type ||
                                    "-",
                                order.repair_type ||
                                    "-",
                                getWorkOrderSummary(
                                    order,
                                ),
                                order.status ||
                                    "-",
                            ],
                        ),
                    theme: "grid",
                    showHead: "everyPage",
                    rowPageBreak: "avoid",
                    margin: {
                        left: marginX,
                        right: marginX,
                        top: 18,
                        bottom: 16,
                    },
                    styles: {
                        fontSize: 7.5,
                        cellPadding: 1.8,
                        textColor: [
                            51,
                            65,
                            85,
                        ],
                        lineColor: [
                            226,
                            232,
                            240,
                        ],
                        lineWidth: 0.15,
                        overflow: "linebreak",
                        valign: "middle",
                    },
                    headStyles: {
                        fillColor: [
                            16,
                            185,
                            129,
                        ],
                        textColor: [
                            255,
                            255,
                            255,
                        ],
                        fontStyle: "bold",
                    },
                    alternateRowStyles: {
                        fillColor: [
                            248,
                            250,
                            252,
                        ],
                    },
                    columnStyles: {
                        0: {
                            cellWidth: 15,
                        },
                        1: {
                            cellWidth: 22,
                        },
                        2: {
                            cellWidth: 28,
                        },
                        3: {
                            cellWidth: 28,
                        },
                        4: {
                            cellWidth: 70,
                        },
                        5: {
                            cellWidth: 20,
                        },
                    },
                });
            }

            const pageCount =
                doc.getNumberOfPages();

            for (
                let pageNumber = 1;
                pageNumber <= pageCount;
                pageNumber += 1
            ) {
                doc.setPage(pageNumber);

                doc.setDrawColor(
                    226,
                    232,
                    240,
                );

                doc.line(
                    marginX,
                    pageHeight - 13,
                    pageWidth - marginX,
                    pageHeight - 13,
                );

                doc.setFont(
                    "helvetica",
                    "normal",
                );

                doc.setFontSize(7.5);
                doc.setTextColor(
                    100,
                    116,
                    139,
                );

                doc.text(
                    "Sistema Integral SAySSPP · Planta Vehicular",
                    marginX,
                    pageHeight - 7,
                );

                doc.text(
                    `Página ${pageNumber} de ${pageCount}`,
                    pageWidth - marginX,
                    pageHeight - 7,
                    {
                        align: "right",
                    },
                );
            }

            const safeCode =
                vehicle.code
                    .trim()
                    .replace(
                        /[^a-zA-Z0-9_-]+/g,
                        "_",
                    );

            doc.save(
                `ficha_vehiculo_${safeCode}.pdf`,
            );

            toast.success(
                "Ficha del vehículo exportada correctamente.",
            );
        } catch (error) {
            console.error(
                "Error exportando la ficha del vehículo:",
                error,
            );

            toast.error(
                "No se pudo exportar la ficha del vehículo.",
            );
        } finally {
            setIsExportingPdf(false);
        }
    };

    return (
        <>
            <PageLoader show={navigationLoading} />

            <div className="container mx-auto space-y-6 p-6">
                {/* =====================================================
            CABECERA
        ====================================================== */}

                <div className="flex flex-col gap-4">
                    <Button
                        type="button"
                        variant="ghost"
                        className="-ml-2 w-fit gap-2"
                        onClick={() =>
                            router.push(
                                "/dashboard/planta-vehicular",
                            )
                        }
                    >
                        <ArrowLeft className="h-4 w-4" />

                        Volver a Planta Vehicular
                    </Button>

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-3xl font-bold tracking-tight">
                                    {vehicle.code}
                                </h1>

                                {!vehicle.active && (
                                    <Badge
                                        variant="outline"
                                        className="border-red-200 bg-red-100 text-red-800"
                                    >
                                        <CircleOff className="mr-1 h-3.5 w-3.5" />

                                        Dado de baja
                                    </Badge>
                                )}
                            </div>

                            <p className="mt-2 text-xl font-semibold">
                                {vehicle.vehicle}
                            </p>

                            <p className="mt-1 text-muted-foreground">
                                {vehicle.license_plate ||
                                    "Sin dominio cargado"}
                            </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={exportToPdf}
                                disabled={
                                    isExportingPdf
                                }
                            >
                                {isExportingPdf ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <FilePenLine className="mr-2 h-4 w-4" />
                                )}

                                {isExportingPdf
                                    ? "Generando PDF..."
                                    : "Exportar PDF"}
                            </Button>

                            {vehicle.has_alltrack && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={
                                        handleOpenTracking
                                    }
                                    className="border-emerald-200 bg-emerald-50/60 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100/80 hover:text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                                >
                                    <MapPin className="mr-2 h-4 w-4" />

                                    Rastrear vehículo
                                </Button>
                            )}

                            {canManage && (
                                <>
                                {vehicle.active ? (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={
                                                handleEditVehicle
                                            }
                                            disabled={
                                                navigationLoading
                                            }
                                        >
                                            <Edit className="mr-2 h-4 w-4" />

                                            Editar vehículo
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="destructive"
                                            onClick={
                                                handleOpenDeactivation
                                            }
                                        >
                                            <CircleOff className="mr-2 h-4 w-4" />

                                            Dar de baja
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-950/30"
                                        onClick={() =>
                                            setReactivationOpen(
                                                true,
                                            )
                                        }
                                    >
                                        <RotateCcw className="mr-2 h-4 w-4" />

                                        Reactivar vehículo
                                    </Button>
                                )}

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                                    onClick={
                                        handleOpenDelete
                                    }
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />

                                    Eliminar definitivamente
                                </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* =====================================================
            ALERTA BAJA
        ====================================================== */}

                {!vehicle.active && (
                    <Card className="border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
                        <CardContent className="py-5">
                            <div className="flex items-start gap-4">
                                <div className="rounded-full border border-red-300 bg-red-100 p-3 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                                    <AlertTriangle className="h-6 w-6" />
                                </div>

                                <div className="flex-1 space-y-4">
                                    <div>
                                        <h2 className="text-lg font-bold text-red-800 dark:text-red-300">
                                            VEHÍCULO DADO DE BAJA
                                        </h2>

                                        <p className="mt-1 text-sm text-red-700/80 dark:text-red-300/80">
                                            Esta unidad ya no forma parte de la planta vehicular activa.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                                        <div>
                                            <span className="text-muted-foreground">
                                                Fecha de baja
                                            </span>

                                            <p className="font-semibold">
                                                {formatDate(
                                                    vehicle.deactivation_date,
                                                )}
                                            </p>
                                        </div>

                                        <div>
                                            <span className="text-muted-foreground">
                                                Motivo
                                            </span>

                                            <p className="font-semibold">
                                                {vehicle.deactivation_reason ||
                                                    "-"}
                                            </p>
                                        </div>
                                    </div>

                                    {canManage && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="border-green-300 bg-background text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-950/30"
                                            onClick={() =>
                                                setReactivationOpen(
                                                    true,
                                                )
                                            }
                                        >
                                            <RotateCcw className="mr-2 h-4 w-4" />

                                            Reactivar vehículo
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {isReadonly && (
                    <Card>
                        <CardContent className="py-4">
                            <p className="text-sm text-muted-foreground">
                                Estás viendo esta ficha en modo solo lectura.
                                Podés consultar toda la información del vehículo,
                                pero no realizar modificaciones.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* =====================================================
            FOTO + ESTADOS
        ====================================================== */}

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_1fr]">
                    <Card className="overflow-hidden">
                        <div className="flex min-h-[360px] items-center justify-center overflow-hidden bg-muted/30">
                            {vehicleImageLoading ? (
                                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                    <Loader2 className="h-8 w-8 animate-spin" />

                                    <span className="text-sm">
                                        Cargando fotografía...
                                    </span>
                                </div>
                            ) : vehicleImageUrl ? (
                                <img
                                    src={vehicleImageUrl}
                                    alt={`${vehicle.code} - ${vehicle.vehicle}`}
                                    loading="eager"
                                    decoding="async"
                                    fetchPriority="high"
                                    className="h-full min-h-[360px] w-full object-contain"
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                    <Car className="h-16 w-16" />

                                    <span className="text-sm">
                                        Sin imagen cargada
                                    </span>
                                </div>
                            )}
                        </div>
                    </Card>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-1">
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Estado del vehículo
                                </CardTitle>
                            </CardHeader>

                            <CardContent className="space-y-5">
                                <div>
                                    <p className="mb-2 text-sm text-muted-foreground">
                                        {vehicle.active
                                            ? "Estado operativo"
                                            : "Último estado operativo registrado"}
                                    </p>

                                    <Badge
                                        variant="outline"
                                        className={getStatusBadgeClass(
                                            vehicle.operational_status,
                                        )}
                                    >
                                        {getStatusLabel(
                                            vehicle.operational_status,
                                        )}
                                    </Badge>

                                    {!vehicle.active && (
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            Este estado corresponde al último registro operativo
                                            antes de la baja.
                                        </p>
                                    )}
                                </div>

                                <InfoRow
                                    icon={
                                        <MapPin className="h-4 w-4" />
                                    }
                                    label="Dirección"
                                    value={
                                        vehicle.department
                                    }
                                />

                                <InfoRow
                                    icon={
                                        <CalendarDays className="h-4 w-4" />
                                    }
                                    label="Año"
                                    value={
                                        vehicle.year
                                            ? String(
                                                vehicle.year,
                                            )
                                            : null
                                    }
                                />

                                <InfoRow
                                    icon={
                                        <Truck className="h-4 w-4" />
                                    }
                                    label="Tipo"
                                    value={
                                        vehicle.vehicle_type
                                    }
                                />

                                <InfoRow
                                    icon={
                                        <IdCard className="h-4 w-4" />
                                    }
                                    label="Dominio"
                                    value={
                                        vehicle.license_plate
                                    }
                                />
                            </CardContent>
                        </Card>

                        <Card
                            className={
                                !vehicle.active
                                    ? "border-red-200 dark:border-red-900"
                                    : undefined
                            }
                        >
                            <CardHeader>
                                <CardTitle>
                                    Estado administrativo
                                </CardTitle>
                            </CardHeader>

                            <CardContent className="space-y-5">
                                <InfoRow
                                    label="Situación"
                                    value={
                                        vehicle.active
                                            ? "Activo"
                                            : "Dado de baja"
                                    }
                                />

                                {!vehicle.active && (
                                    <>
                                        <InfoRow
                                            label="Fecha de baja"
                                            value={formatDate(
                                                vehicle.deactivation_date,
                                            )}
                                        />

                                        <InfoRow
                                            label="Motivo de baja"
                                            value={
                                                vehicle.deactivation_reason
                                            }
                                        />
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* =====================================================
            CRITICIDAD DEL VEHÍCULO
        ====================================================== */}

                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Gauge className="h-5 w-5" />
                                    Criticidad actual
                                </CardTitle>

                                <p className="mt-1 text-sm text-muted-foreground">
                                    Cálculo conectado al módulo de Taller según OT,
                                    criticidad del servicio, reemplazo y seguridad.
                                </p>
                            </div>

                            {!criticalityLoading && (
                                <Badge
                                    variant="outline"
                                    className={[
                                        getCriticalityBadgeClass(
                                            !vehicle.active
                                                ? "DADO DE BAJA"
                                                : criticality?.status_display ||
                                                    criticality?.status_label ||
                                                    "SIN DATOS",
                                        ),
                                        "w-fit px-3 py-1 font-bold",
                                    ].join(" ")}
                                >
                                    {!vehicle.active
                                        ? "DADO DE BAJA"
                                        : criticality?.status_display ||
                                            criticality?.status_label ||
                                            "SIN DATOS"}
                                </Badge>
                            )}
                        </div>
                    </CardHeader>

                    <CardContent>
                        {criticalityLoading ? (
                            <div className="flex min-h-[140px] items-center justify-center gap-2 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Cargando criticidad...
                            </div>
                        ) : !vehicle.active ? (
                            <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                                El vehículo está dado de baja y queda excluido del
                                cálculo de criticidad activa.
                            </div>
                        ) : criticalityError ? (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
                                {criticalityError}
                            </div>
                        ) : !criticality ? (
                            <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                                No hay datos de criticidad disponibles para este vehículo.
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                                    <CriticalityMetric
                                        label="OT 6 meses"
                                        value={String(
                                            criticality.work_orders_count,
                                        )}
                                    />

                                    <CriticalityMetric
                                        label="Conf. mecánica"
                                        value={String(
                                            criticality.mechanical_reliability_score,
                                        )}
                                    />

                                    <CriticalityMetric
                                        label="Crit. servicio"
                                        value={String(
                                            criticality.service_criticality,
                                        )}
                                    />

                                    <CriticalityMetric
                                        label="Reemplazo"
                                        value={String(
                                            criticality.replacement_score,
                                        )}
                                    />

                                    <CriticalityMetric
                                        label="Seguridad"
                                        value={
                                            criticality.has_checklist
                                                ? String(
                                                    criticality.security_score,
                                                )
                                                : "--"
                                        }
                                    />

                                    <CriticalityMetric
                                        label="Total"
                                        value={
                                            criticality.total_criticality !== null
                                                ? String(
                                                    criticality.total_criticality,
                                                )
                                                : "--"
                                        }
                                        emphasized
                                    />
                                </div>

                                {!criticality.has_checklist && (
                                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 dark:border-orange-900 dark:bg-orange-950/20 dark:text-orange-300">
                                        Este vehículo no tiene checklist cargada, por eso
                                        no se puede calcular la criticidad total.
                                    </div>
                                )}

                                {criticality.notes?.trim() && (
                                    <div className="rounded-xl border bg-muted/20 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                            Observaciones de criticidad
                                        </p>

                                        <p className="mt-2 text-sm">
                                            {criticality.notes}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* =====================================================
            ÓRDENES DE TRABAJO
        ====================================================== */}

                <Card id="ordenes-trabajo" className="scroll-mt-24">
                    <CardHeader>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Wrench className="h-5 w-5" />
                                    Órdenes de trabajo
                                </CardTitle>

                                <p className="mt-1 text-sm text-muted-foreground">
                                    Resumen de intervenciones del Taller sobre esta unidad.
                                    Los mantenimientos se muestran por separado.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        navigateWithLoader(
                                            workOrdersSixMonthsHref,
                                        )
                                    }
                                >
                                    <CalendarDays className="mr-2 h-4 w-4" />
                                    Últimos 6 meses
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        navigateWithLoader(
                                            workOrdersHistoryHref,
                                        )
                                    }
                                >
                                    <History className="mr-2 h-4 w-4" />
                                    Historial completo
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        {workOrdersLoading ? (
                            <div className="flex min-h-[160px] items-center justify-center gap-2 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Cargando órdenes de trabajo...
                            </div>
                        ) : workOrdersError ? (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
                                {workOrdersError}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_0.8fr]">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold">
                                                Últimas OT en los últimos 6 meses
                                            </p>

                                            <p className="text-xs text-muted-foreground">
                                                Se muestran todas las intervenciones
                                                registradas en los últimos 6 meses,
                                                dejando mantenimiento separado.
                                            </p>
                                        </div>

                                        <Badge variant="outline">
                                            Historial completo:{" "}
                                            {vehicleWorkOrders.length} OT
                                        </Badge>
                                    </div>

                                    {latestRegularWorkOrders.length === 0 ? (
                                        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                                            No hay órdenes de trabajo registradas en
                                            los últimos 6 meses fuera de mantenimiento.
                                        </div>
                                    ) : (
                                        <div className="overflow-hidden rounded-xl border">
                                            {latestRegularWorkOrders.map(
                                                (order) => (
                                                    <WorkOrderPreviewRow
                                                        key={String(
                                                            order.id,
                                                        )}
                                                        order={order}
                                                        returnTo={`${pathname}#ordenes-trabajo`}
                                                    />
                                                ),
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <p className="font-semibold">
                                            Último mantenimiento
                                        </p>

                                        <p className="text-xs text-muted-foreground">
                                            Separado de las demás OT para identificar
                                            rápidamente la última intervención de
                                            mantenimiento.
                                        </p>
                                    </div>

                                    {latestMaintenance ? (
                                        <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <Badge
                                                        variant="outline"
                                                        className="border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                                                    >
                                                        MANTENIMIENTO
                                                    </Badge>

                                                    <p className="mt-3 text-base font-semibold">
                                                        OT{" "}
                                                        {latestMaintenance.order_number ||
                                                            "-"}
                                                    </p>

                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        {formatDate(
                                                            latestMaintenance.entry_date,
                                                        )}
                                                    </p>
                                                </div>

                                                <Badge
                                                    variant="outline"
                                                    className="shrink-0"
                                                >
                                                    {latestMaintenance.status ||
                                                        "Sin estado"}
                                                </Badge>
                                            </div>

                                            <p className="mt-4 text-sm">
                                                {getWorkOrderSummary(
                                                    latestMaintenance,
                                                )}
                                            </p>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="mt-4 w-full"
                                                onClick={() =>
                                                    navigateWithLoader(
                                                        maintenanceHistoryHref,
                                                    )
                                                }
                                            >
                                                <Wrench className="mr-2 h-4 w-4" />
                                                Ver mantenimientos
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border bg-muted/20 p-4">
                                            <p className="text-sm text-muted-foreground">
                                                No hay mantenimiento registrado para
                                                este vehículo.
                                            </p>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="mt-4 w-full"
                                                onClick={() =>
                                                    navigateWithLoader(
                                                        maintenanceHistoryHref,
                                                    )
                                                }
                                            >
                                                Ver mantenimientos
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* =====================================================
            INFORMACIÓN GENERAL
        ====================================================== */}

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                Información general
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="space-y-5">
                            <InfoRow
                                icon={
                                    <Truck className="h-4 w-4" />
                                }
                                label="Código"
                                value={vehicle.code}
                            />

                            <InfoRow
                                icon={
                                    <Car className="h-4 w-4" />
                                }
                                label="Vehículo"
                                value={vehicle.vehicle}
                            />

                            <InfoRow
                                icon={
                                    <IdCard className="h-4 w-4" />
                                }
                                label="Dominio"
                                value={
                                    vehicle.license_plate
                                }
                            />

                            <InfoRow
                                icon={
                                    <Truck className="h-4 w-4" />
                                }
                                label="Tipo de vehículo"
                                value={
                                    vehicle.vehicle_type
                                }
                            />

                            <InfoRow
                                icon={
                                    <CalendarDays className="h-4 w-4" />
                                }
                                label="Año"
                                value={
                                    vehicle.year
                                        ? String(
                                            vehicle.year,
                                        )
                                        : null
                                }
                            />

                            <InfoRow
                                icon={
                                    <MapPin className="h-4 w-4" />
                                }
                                label="Dirección"
                                value={
                                    vehicle.department
                                }
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>
                                Utilización y responsables
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="space-y-5">
                            <InfoRow
                                icon={
                                    <Gauge className="h-4 w-4" />
                                }
                                label="Utilización"
                                value={
                                    vehicle.utilization
                                }
                            />

                            <InfoRow
                                icon={
                                    <Clock3 className="h-4 w-4" />
                                }
                                label="Franja horaria"
                                value={
                                    vehicle.schedule
                                }
                            />

                            <InfoRow
                                icon={
                                    <UserRound className="h-4 w-4" />
                                }
                                label="Chofer titular 1"
                                value={
                                    vehicle.primary_driver_1
                                }
                            />

                            <InfoRow
                                icon={
                                    <UsersRound className="h-4 w-4" />
                                }
                                label="Chofer titular 2"
                                value={
                                    vehicle.primary_driver_2
                                }
                            />

                            <InfoRow
                                icon={
                                    <UserRound className="h-4 w-4" />
                                }
                                label="Chofer suplente"
                                value={
                                    vehicle.backup_driver
                                }
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* =====================================================
            EQUIPAMIENTO
        ====================================================== */}

                <Card>
                    <CardHeader>
                        <CardTitle>
                            Equipamiento y tecnología
                        </CardTitle>
                    </CardHeader>

                    <CardContent>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                            <EquipmentCard
                                icon={
                                    <Radio className="h-5 w-5" />
                                }
                                title="TAG RFID"
                                value={
                                    vehicle.rfid_tag ||
                                    "-"
                                }
                            />

                            <EquipmentCard
                                icon={
                                    <MapPin className="h-5 w-5" />
                                }
                                title="ALLTRACK"
                                value={formatBoolean(
                                    vehicle.has_alltrack,
                                )}
                            />

                            <EquipmentCard
                                icon={
                                    <IdCard className="h-5 w-5" />
                                }
                                title="Lector iButton"
                                value={formatBoolean(
                                    vehicle.has_ibutton_reader,
                                )}
                            />

                            <EquipmentCard
                                icon={
                                    <Camera className="h-5 w-5" />
                                }
                                title="Cámara"
                                value={formatBoolean(
                                    vehicle.has_camera,
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* =====================================================
            ESTADO Y TALLER
        ====================================================== */}

                <Card>
                    <CardHeader>
                        <CardTitle>
                            Estado y taller
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-5">
                        <InfoRow
                            icon={
                                <Wrench className="h-4 w-4" />
                            }
                            label="Motivo de reparación"
                            value={
                                vehicle.repair_reason
                            }
                        />

                        <InfoRow
                            icon={
                                <CircleOff className="h-4 w-4" />
                            }
                            label="Motivo fuera de servicio"
                            value={
                                vehicle.out_of_service_reason
                            }
                        />

                        <div className="space-y-2">
                            <p className="text-sm font-medium">
                                Observaciones
                            </p>

                            <div className="min-h-[100px] rounded-lg border bg-muted/20 p-4 text-sm">
                                {vehicle.observations?.trim() ||
                                    "Sin observaciones."}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* =====================================================
            HISTORIA DEL VEHÍCULO
        ====================================================== */}

                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl border p-2">
                                    <History className="h-5 w-5" />
                                </div>

                                <div>
                                    <CardTitle>
                                        Historia del vehículo
                                    </CardTitle>

                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Registro cronológico de todos los acontecimientos
                                        y cambios realizados sobre esta unidad.
                                    </p>
                                </div>
                            </div>

                            {/* ===============================================
                  FILTROS HISTORIAL
              ================================================ */}

                            <div className="rounded-xl border bg-muted/10 p-4">
                                <div className="mb-4 flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-muted-foreground" />

                                    <p className="text-sm font-semibold">
                                        Filtrar historial
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    {/* TIPO */}
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">
                                            Tipo
                                        </Label>

                                        <Select
                                            value={historyType}
                                            onValueChange={setHistoryType}
                                        >
                                            <SelectTrigger className="h-10 w-full">
                                                <SelectValue placeholder="Tipo de acontecimiento" />
                                            </SelectTrigger>

                                            <SelectContent>
                                                <SelectItem value={HISTORY_ALL}>
                                                    Todos los tipos
                                                </SelectItem>

                                                {HISTORY_TYPE_OPTIONS.map((option) => (
                                                    <SelectItem
                                                        key={option.value}
                                                        value={option.value}
                                                    >
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* DESDE */}
                                    <div className="space-y-1">
                                        <Label
                                            htmlFor="history-date-from"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Desde
                                        </Label>

                                        <Input
                                            id="history-date-from"
                                            type="date"
                                            value={historyDateFrom}
                                            onChange={(event) =>
                                                setHistoryDateFrom(
                                                    event.target.value,
                                                )
                                            }
                                            className="h-10"
                                        />
                                    </div>

                                    {/* HASTA */}
                                    <div className="space-y-1">
                                        <Label
                                            htmlFor="history-date-to"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Hasta
                                        </Label>

                                        <Input
                                            id="history-date-to"
                                            type="date"
                                            value={historyDateTo}
                                            onChange={(event) =>
                                                setHistoryDateTo(
                                                    event.target.value,
                                                )
                                            }
                                            className="h-10"
                                        />
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-xs text-muted-foreground">
                                        {historyTotal} acontecimiento
                                        {historyTotal === 1
                                            ? ""
                                            : "s"}{" "}
                                        encontrado
                                        {historyTotal === 1
                                            ? ""
                                            : "s"}
                                    </div>

                                    {hasHistoryFilters && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={
                                                clearHistoryFilters
                                            }
                                        >
                                            <X className="mr-2 h-4 w-4" />

                                            Limpiar filtros
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        {historyLoading ? (
                            <div className="flex min-h-[180px] items-center justify-center gap-2 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />

                                Cargando historial...
                            </div>
                        ) : history.length ===
                            0 ? (
                            <div className="rounded-xl border border-dashed py-12 text-center">
                                <History className="mx-auto h-8 w-8 text-muted-foreground" />

                                <p className="mt-3 font-medium">
                                    No hay acontecimientos para mostrar
                                </p>

                                <p className="mt-1 text-sm text-muted-foreground">
                                    {hasHistoryFilters
                                        ? "No encontramos movimientos que coincidan con los filtros seleccionados."
                                        : "Todavía no hay acontecimientos registrados para esta unidad."}
                                </p>

                                {hasHistoryFilters && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="mt-4"
                                        onClick={
                                            clearHistoryFilters
                                        }
                                    >
                                        Limpiar filtros
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="relative">
                                    <div className="absolute bottom-4 left-[19px] top-4 w-px bg-border" />

                                    <div className="space-y-6">
                                        {history.map(
                                            (event) => (
                                                <HistoryItem
                                                    key={
                                                        event.id
                                                    }
                                                    event={
                                                        event
                                                    }
                                                />
                                            ),
                                        )}
                                    </div>
                                </div>

                                {/* ===========================================
                    PAGINACIÓN
                ============================================ */}

                                <div className="mt-6 flex flex-col gap-4 border-t pt-5 md:flex-row md:items-center md:justify-between">
                                    <div className="text-sm text-muted-foreground">
                                        Mostrando{" "}
                                        <span className="font-medium text-foreground">
                                            {historyFirstResult}
                                        </span>{" "}
                                        a{" "}
                                        <span className="font-medium text-foreground">
                                            {historyLastResult}
                                        </span>{" "}
                                        de{" "}
                                        <span className="font-medium text-foreground">
                                            {historyTotal}
                                        </span>{" "}
                                        acontecimientos
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={
                                                historyPage <= 1 ||
                                                historyLoading
                                            }
                                            onClick={() =>
                                                setHistoryPage(
                                                    (current) =>
                                                        Math.max(
                                                            1,
                                                            current -
                                                            1,
                                                        ),
                                                )
                                            }
                                        >
                                            <ChevronLeft className="mr-1 h-4 w-4" />

                                            Anterior
                                        </Button>

                                        <div className="min-w-[110px] text-center text-sm">
                                            Página{" "}
                                            <span className="font-semibold">
                                                {historyPage}
                                            </span>{" "}
                                            de{" "}
                                            <span className="font-semibold">
                                                {historyTotalPages}
                                            </span>
                                        </div>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={
                                                historyPage >=
                                                historyTotalPages ||
                                                historyLoading
                                            }
                                            onClick={() =>
                                                setHistoryPage(
                                                    (current) =>
                                                        Math.min(
                                                            historyTotalPages,
                                                            current +
                                                            1,
                                                        ),
                                                )
                                            }
                                        >
                                            Siguiente

                                            <ChevronRight className="ml-1 h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* =====================================================
            INFORMACIÓN DEL REGISTRO
        ====================================================== */}

                <Card>
                    <CardHeader>
                        <CardTitle>
                            Información del registro
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <InfoRow
                            label="Fecha de alta"
                            value={formatDateTime(
                                vehicle.created_at,
                            )}
                        />

                        <InfoRow
                            label="Última actualización"
                            value={formatDateTime(
                                vehicle.updated_at,
                            )}
                        />
                    </CardContent>
                </Card>
            </div>

            {/* =======================================================
          MODAL RASTREO ALLTRACK
      ======================================================== */}

            <Dialog
                open={trackingOpen}
                onOpenChange={
                    setTrackingOpen
                }
            >
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-emerald-600" />

                            Ubicación de{" "}
                            {vehicle.code}
                        </DialogTitle>

                        <DialogDescription>
                            {vehicle.vehicle}
                            {vehicle.license_plate
                                ? ` · ${vehicle.license_plate}`
                                : ""}
                            . Se muestra la última posición válida informada por Alltrack.
                        </DialogDescription>
                    </DialogHeader>

                    {trackingLoading &&
                    !trackingData ? (
                        <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-xl border bg-muted/20">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />

                            <div className="text-center">
                                <p className="font-medium">
                                    Consultando ubicación en Alltrack...
                                </p>

                                <p className="mt-1 text-sm text-muted-foreground">
                                    Esto puede demorar unos segundos.
                                </p>
                            </div>
                        </div>
                    ) : trackingError &&
                      !trackingData ? (
                        <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-xl border border-red-200 bg-red-50/60 p-6 text-center dark:border-red-900 dark:bg-red-950/20">
                            <CircleOff className="h-9 w-9 text-red-600" />

                            <div>
                                <p className="font-semibold text-red-800 dark:text-red-300">
                                    No se pudo obtener la ubicación
                                </p>

                                <p className="mt-1 max-w-lg text-sm text-red-700/80 dark:text-red-300/80">
                                    {
                                        trackingError
                                    }
                                </p>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    void fetchTrackingLocation()
                                }
                            >
                                <RotateCcw className="mr-2 h-4 w-4" />

                                Reintentar
                            </Button>
                        </div>
                    ) : trackingData ? (
                        <div className="space-y-4">
                            {trackingMapUrl ? (
                                <div className="overflow-hidden rounded-xl border bg-muted/20">
                                    <iframe
                                        title={`Ubicación de ${vehicle.code}`}
                                        src={
                                            trackingMapUrl
                                        }
                                        className="h-[360px] w-full border-0"
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                    />
                                </div>
                            ) : (
                                <div className="flex min-h-[220px] items-center justify-center rounded-xl border bg-muted/20 px-6 text-center text-sm text-muted-foreground">
                                    Alltrack no devolvió coordenadas válidas para mostrar el mapa.
                                </div>
                            )}

                            {trackingError && (
                                <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950/20 dark:text-yellow-200">
                                    No se pudo actualizar la posición. Se mantiene visible la última ubicación obtenida.
                                </div>
                            )}

                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <TrackingInfoCard
                                    label="Estado"
                                    value={
                                        trackingPosition
                                            ?.status ||
                                        "-"
                                    }
                                />

                                <TrackingInfoCard
                                    label="Velocidad"
                                    value={
                                        typeof trackingPosition
                                            ?.speed ===
                                        "number"
                                            ? `${trackingPosition.speed} km/h`
                                            : "-"
                                    }
                                />

                                <TrackingInfoCard
                                    label="Último reporte"
                                    value={
                                        [
                                            trackingPosition
                                                ?.date,
                                            trackingPosition
                                                ?.time,
                                        ]
                                            .filter(
                                                Boolean,
                                            )
                                            .join(
                                                " · ",
                                            ) ||
                                        "-"
                                    }
                                />

                                <TrackingInfoCard
                                    label="Odómetro"
                                    value={
                                        trackingPosition
                                            ?.odometer !==
                                            null &&
                                        trackingPosition
                                            ?.odometer !==
                                            undefined
                                            ? `${Number(
                                                trackingPosition.odometer,
                                            ).toLocaleString(
                                                "es-AR",
                                                {
                                                    maximumFractionDigits:
                                                        1,
                                                },
                                            )} km`
                                            : "-"
                                    }
                                />
                            </div>

                            <div className="rounded-xl border p-3">
                                <div className="flex items-start gap-2">
                                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                            Dirección
                                        </p>

                                        <p className="mt-1 text-sm leading-6">
                                            {trackingPosition
                                                ?.address ||
                                                "Sin dirección informada"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                {trackingExternalMapUrl && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        asChild
                                    >
                                        <a
                                            href={
                                                trackingExternalMapUrl
                                            }
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            <MapPin className="mr-2 h-4 w-4" />

                                            Abrir mapa
                                        </a>
                                    </Button>
                                )}

                                <Button
                                    type="button"
                                    onClick={() =>
                                        void fetchTrackingLocation()
                                    }
                                    disabled={
                                        trackingLoading
                                    }
                                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                    {trackingLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                    )}

                                    {trackingLoading
                                        ? "Actualizando..."
                                        : "Actualizar ubicación"}
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* =======================================================
          MODAL BAJA
      ======================================================== */}

            <Dialog
                open={
                    deactivationOpen
                }
                onOpenChange={(open) => {
                    if (deactivating) {
                        return;
                    }

                    setDeactivationOpen(
                        open,
                    );
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Dar de baja vehículo
                        </DialogTitle>

                        <DialogDescription>
                            El vehículo no será eliminado. Quedará registrado como
                            dado de baja y podrá consultarse desde Planta Vehicular.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        <div className="rounded-lg border bg-muted/20 p-4">
                            <p className="font-semibold">
                                {vehicle.code} —{" "}
                                {vehicle.vehicle}
                            </p>

                            <p className="mt-1 text-sm text-muted-foreground">
                                Dominio:{" "}
                                {vehicle.license_plate ||
                                    "-"}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="deactivation-date">
                                Fecha de baja

                                <span className="ml-1 text-destructive">
                                    *
                                </span>
                            </Label>

                            <Input
                                id="deactivation-date"
                                type="date"
                                value={
                                    deactivationDate
                                }
                                onChange={(event) =>
                                    setDeactivationDate(
                                        event.target.value,
                                    )
                                }
                                disabled={
                                    deactivating
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="deactivation-reason">
                                Motivo de baja

                                <span className="ml-1 text-destructive">
                                    *
                                </span>
                            </Label>

                            <textarea
                                id="deactivation-reason"
                                value={
                                    deactivationReason
                                }
                                onChange={(event) =>
                                    setDeactivationReason(
                                        event.target.value,
                                    )
                                }
                                placeholder="Ej: Cumplió su ciclo, baja definitiva, vehículo reemplazado..."
                                rows={4}
                                disabled={
                                    deactivating
                                }
                                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={
                                deactivating
                            }
                            onClick={() =>
                                setDeactivationOpen(
                                    false,
                                )
                            }
                        >
                            Cancelar
                        </Button>

                        <Button
                            type="button"
                            variant="destructive"
                            disabled={
                                deactivating
                            }
                            onClick={() =>
                                void handleDeactivateVehicle()
                            }
                        >
                            {deactivating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                                    Dando de baja...
                                </>
                            ) : (
                                <>
                                    <CircleOff className="mr-2 h-4 w-4" />

                                    Confirmar baja
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* =======================================================
          MODAL REACTIVACIÓN
      ======================================================== */}

            <Dialog
                open={
                    reactivationOpen
                }
                onOpenChange={(open) => {
                    if (reactivating) {
                        return;
                    }

                    setReactivationOpen(
                        open,
                    );
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Reactivar vehículo
                        </DialogTitle>

                        <DialogDescription>
                            La unidad volverá a formar parte de la Planta Vehicular
                            activa.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        <div className="rounded-lg border bg-muted/20 p-4">
                            <p className="font-semibold">
                                {vehicle.code} —{" "}
                                {vehicle.vehicle}
                            </p>

                            <p className="mt-1 text-sm text-muted-foreground">
                                Dominio:{" "}
                                {vehicle.license_plate ||
                                    "-"}
                            </p>
                        </div>

                        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm dark:border-green-900 dark:bg-green-950/20">
                            <p className="font-semibold text-green-800 dark:text-green-300">
                                ¿Confirmás la reactivación?
                            </p>

                            <p className="mt-2 text-muted-foreground">
                                La unidad volverá a estar activa y este acontecimiento
                                quedará registrado en su historia.
                            </p>

                            <div className="mt-3">
                                <span className="text-xs text-muted-foreground">
                                    Estado operativo al reactivar:
                                </span>

                                <div className="mt-1">
                                    <Badge
                                        variant="outline"
                                        className={getStatusBadgeClass(
                                            vehicle.operational_status,
                                        )}
                                    >
                                        {getStatusLabel(
                                            vehicle.operational_status,
                                        )}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={
                                reactivating
                            }
                            onClick={() =>
                                setReactivationOpen(
                                    false,
                                )
                            }
                        >
                            Cancelar
                        </Button>

                        <Button
                            type="button"
                            disabled={
                                reactivating
                            }
                            className="bg-green-600 text-white hover:bg-green-700"
                            onClick={() =>
                                void handleReactivateVehicle()
                            }
                        >
                            {reactivating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                                    Reactivando...
                                </>
                            ) : (
                                <>
                                    <RotateCcw className="mr-2 h-4 w-4" />

                                    Confirmar reactivación
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* =======================================================
          MODAL ELIMINACIÓN DEFINITIVA
      ======================================================== */}

            <Dialog
                open={
                    deleteOpen
                }
                onOpenChange={(open) => {
                    if (deleting) {
                        return;
                    }

                    setDeleteOpen(
                        open,
                    );

                    if (!open) {
                        setDeleteConfirmation("");
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-destructive">
                            Eliminar vehículo definitivamente
                        </DialogTitle>

                        <DialogDescription>
                            Esta acción no es una baja. El vehículo será eliminado
                            de forma permanente junto con todo su historial y su
                            fotografía. Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-400" />

                                <div>
                                    <p className="font-semibold text-red-800 dark:text-red-300">
                                        Eliminación permanente
                                    </p>

                                    <p className="mt-1 text-sm text-red-700/80 dark:text-red-300/80">
                                        Usá esta opción únicamente para vehículos cargados
                                        por error o registros de prueba. Para una unidad real
                                        que deja de formar parte de la flota, utilizá Dar de baja.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border bg-muted/20 p-4">
                            <p className="font-semibold">
                                {vehicle.code} —{" "}
                                {vehicle.vehicle}
                            </p>

                            <p className="mt-1 text-sm text-muted-foreground">
                                Dominio:{" "}
                                {vehicle.license_plate ||
                                    "-"}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="delete-confirmation">
                                Para confirmar, escribí{" "}
                                <span className="font-bold text-foreground">
                                    {vehicle.code}
                                </span>
                            </Label>

                            <Input
                                id="delete-confirmation"
                                value={
                                    deleteConfirmation
                                }
                                onChange={(event) =>
                                    setDeleteConfirmation(
                                        event.target.value,
                                    )
                                }
                                placeholder={vehicle.code}
                                autoComplete="off"
                                disabled={
                                    deleting
                                }
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={
                                deleting
                            }
                            onClick={() =>
                                setDeleteOpen(
                                    false,
                                )
                            }
                        >
                            Cancelar
                        </Button>

                        <Button
                            type="button"
                            variant="destructive"
                            disabled={
                                deleting ||
                                deleteConfirmation
                                    .trim()
                                    .toUpperCase() !==
                                    vehicle.code
                                        .trim()
                                        .toUpperCase()
                            }
                            onClick={() =>
                                void handleDeleteVehicle()
                            }
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                                    Eliminando...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 h-4 w-4" />

                                    Eliminar definitivamente
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function TrackingInfoCard({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-xl border bg-muted/20 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {label}
            </p>

            <p className="mt-1.5 text-sm font-semibold leading-snug">
                {value}
            </p>
        </div>
    );
}

/* =========================================================
   HISTORIAL
========================================================= */

function HistoryItem({
    event,
}: {
    event: VehicleHistory;
}) {
    const config =
        getHistoryConfig(
            event.event_type,
        );

    const changedFields =
        getChangedFields(event);

    return (
        <div className="relative flex gap-4">
            <div
                className={[
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background",
                    config.className,
                ].join(" ")}
            >
                {config.icon}
            </div>

            <div className="min-w-0 flex-1 rounded-xl border p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="font-semibold">
                            {event.title}
                        </p>

                        {event.description && (
                            <p className="mt-1 text-sm text-muted-foreground">
                                {event.description}
                            </p>
                        )}
                    </div>

                    <div className="shrink-0 text-xs text-muted-foreground">
                        {formatDateTime(
                            event.created_at,
                        )}
                    </div>
                </div>

                {event.event_type ===
                    "deactivated" && (
                        <DeactivationDetails
                            event={event}
                        />
                    )}

                {event.event_type ===
                    "reactivated" && (
                        <div className="mt-3">
                            <Badge
                                variant="outline"
                                className="border-green-200 bg-green-100 text-green-800"
                            >
                                Vehículo nuevamente activo
                            </Badge>
                        </div>
                    )}

                {changedFields.length >
                    0 && (
                        <HistoryChanges
                            event={event}
                            fields={
                                changedFields
                            }
                        />
                    )}
            </div>
        </div>
    );
}

function HistoryChanges({
    event,
    fields,
}: {
    event: VehicleHistory;
    fields: ChangedField[];
}) {
    /*
     * En baja mostramos fecha y motivo
     * arriba en DeactivationDetails.
     * Evitamos repetirlos.
     */
    const visibleFields =
        fields.filter((field) => {
            if (
                event.event_type ===
                "deactivated"
            ) {
                return ![
                    "active",
                    "deactivation_date",
                    "deactivation_reason",
                ].includes(
                    String(
                        field.key,
                    ),
                );
            }

            /*
             * En reactivación evitamos repetir
             * active + limpieza de la baja.
             */
            if (
                event.event_type ===
                "reactivated"
            ) {
                return ![
                    "active",
                    "deactivation_date",
                    "deactivation_reason",
                ].includes(
                    String(
                        field.key,
                    ),
                );
            }

            return true;
        });

    if (
        visibleFields.length ===
        0
    ) {
        return null;
    }

    return (
        <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
                <FilePenLine className="h-4 w-4 text-muted-foreground" />

                <p className="text-sm font-semibold">
                    Cambios realizados
                </p>
            </div>

            <div className="overflow-hidden rounded-lg border">
                {visibleFields.map(
                    (field, index) => (
                        <HistoryFieldChange
                            key={
                                String(
                                    field.key,
                                )
                            }
                            field={
                                field
                            }
                            isLast={
                                index ===
                                visibleFields.length -
                                1
                            }
                        />
                    ),
                )}
            </div>
        </div>
    );
}

function HistoryFieldChange({
    field,
    isLast,
}: {
    field: ChangedField;
    isLast: boolean;
}) {
    return (
        <div
            className={[
                "grid grid-cols-1 gap-3 p-3 md:grid-cols-[220px_1fr]",
                !isLast
                    ? "border-b"
                    : "",
            ].join(" ")}
        >
            <div className="text-sm font-medium">
                {field.label}
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                {field.type ===
                    "status" ? (
                    <>
                        <Badge
                            variant="outline"
                            className={getStatusBadgeClass(
                                field.before
                                    ? String(
                                        field.before,
                                    )
                                    : null,
                            )}
                        >
                            {formatHistoryValue(
                                field.before,
                                field.type,
                            )}
                        </Badge>

                        <span className="text-muted-foreground">
                            →
                        </span>

                        <Badge
                            variant="outline"
                            className={getStatusBadgeClass(
                                field.after
                                    ? String(
                                        field.after,
                                    )
                                    : null,
                            )}
                        >
                            {formatHistoryValue(
                                field.after,
                                field.type,
                            )}
                        </Badge>
                    </>
                ) : (
                    <>
                        <span className="max-w-full break-words rounded-md bg-muted px-2 py-1">
                            {formatHistoryValue(
                                field.before,
                                field.type,
                            )}
                        </span>

                        <span className="text-muted-foreground">
                            →
                        </span>

                        <span className="max-w-full break-words rounded-md bg-muted px-2 py-1 font-medium">
                            {formatHistoryValue(
                                field.after,
                                field.type,
                            )}
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}

function DeactivationDetails({
    event,
}: {
    event: VehicleHistory;
}) {
    const after =
        event.metadata?.after;

    if (!after) {
        return null;
    }

    return (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/20">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                    <span className="text-muted-foreground">
                        Fecha
                    </span>

                    <p className="font-medium">
                        {formatDate(
                            after.deactivation_date,
                        )}
                    </p>
                </div>

                <div>
                    <span className="text-muted-foreground">
                        Motivo
                    </span>

                    <p className="font-medium">
                        {after.deactivation_reason ||
                            "-"}
                    </p>
                </div>
            </div>
        </div>
    );
}

function getHistoryConfig(
    eventType:
        VehicleHistoryEventType,
) {
    switch (eventType) {
        case "created":
            return {
                icon: (
                    <PlusCircle className="h-4 w-4" />
                ),
                className:
                    "border-green-300 text-green-700 dark:border-green-900 dark:text-green-400",
            };

        case "updated":
            return {
                icon: (
                    <FilePenLine className="h-4 w-4" />
                ),
                className:
                    "border-blue-300 text-blue-700 dark:border-blue-900 dark:text-blue-400",
            };

        case "status_change":
            return {
                icon: (
                    <Activity className="h-4 w-4" />
                ),
                className:
                    "border-orange-300 text-orange-700 dark:border-orange-900 dark:text-orange-400",
            };

        case "deactivated":
            return {
                icon: (
                    <CircleOff className="h-4 w-4" />
                ),
                className:
                    "border-red-300 text-red-700 dark:border-red-900 dark:text-red-400",
            };

        case "reactivated":
            return {
                icon: (
                    <RotateCcw className="h-4 w-4" />
                ),
                className:
                    "border-green-300 text-green-700 dark:border-green-900 dark:text-green-400",
            };
    }
}

/* =========================================================
   UI AUXILIAR
========================================================= */

function WorkOrderPreviewRow({
    order,
    returnTo,
}: {
    order: WorkOrder;
    returnTo: string;
}) {
    const orderHref =
        `/dashboard/taller/ordenes-trabajo/${order.id}/view?returnTo=${encodeURIComponent(
            returnTo,
        )}`;

    return (
        <Link
            href={orderHref}
            className="group/ot block border-b last:border-b-0 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            title={`Ver detalle de OT ${order.order_number || ""}`}
        >
            <div className="grid gap-2 p-3 sm:grid-cols-[100px_120px_1fr_auto] sm:items-center">
                <div>
                    <p className="text-xs text-muted-foreground">
                        OT
                    </p>

                    <p className="font-semibold text-primary underline-offset-4 transition-colors group-hover/ot:underline">
                        {order.order_number || "-"}
                    </p>
                </div>

                <div>
                    <p className="text-xs text-muted-foreground">
                        Fecha
                    </p>

                    <p className="text-sm">
                        {formatDate(
                            order.entry_date,
                        )}
                    </p>
                </div>

                <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                        {getWorkOrderSummary(
                            order,
                        )}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                        {order.failure_type ||
                            "Sin tipo de falla"}{" "}
                        ·{" "}
                        {order.repair_type ||
                            "Sin tipo de reparación"}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Badge
                        variant="outline"
                        className="w-fit shrink-0"
                    >
                        {order.status ||
                            "Sin estado"}
                    </Badge>

                    <span className="text-xs font-medium text-muted-foreground opacity-0 transition-opacity group-hover/ot:opacity-100">
                        Ver
                    </span>
                </div>
            </div>
        </Link>
    );
}

function CriticalityMetric({
    label,
    value,
    emphasized = false,
}: {
    label: string;
    value: string;
    emphasized?: boolean;
}) {
    return (
        <div
            className={[
                "rounded-xl border p-4",
                emphasized
                    ? "bg-primary/5"
                    : "bg-muted/20",
            ].join(" ")}
        >
            <p className="text-xs text-muted-foreground">
                {label}
            </p>

            <p
                className={[
                    "mt-2 font-bold",
                    emphasized
                        ? "text-2xl"
                        : "text-xl",
                ].join(" ")}
            >
                {value}
            </p>
        </div>
    );
}

function InfoRow({
    icon,
    label,
    value,
}: {
    icon?: React.ReactNode;
    label: string;
    value?: string | null;
}) {
    return (
        <div className="flex items-start justify-between gap-4 border-b pb-4 last:border-b-0 last:pb-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {icon}

                <span>
                    {label}
                </span>
            </div>

            <span className="max-w-[60%] text-right text-sm font-medium">
                {value?.trim() ||
                    "-"}
            </span>
        </div>
    );
}

function EquipmentCard({
    icon,
    title,
    value,
}: {
    icon: React.ReactNode;
    title: string;
    value: string;
}) {
    return (
        <div className="rounded-xl border p-4">
            <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                {icon}

                <span className="text-sm">
                    {title}
                </span>
            </div>

            <p className="font-semibold">
                {value}
            </p>
        </div>
    );
}