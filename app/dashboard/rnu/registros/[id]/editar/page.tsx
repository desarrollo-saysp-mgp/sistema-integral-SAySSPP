"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
    useParams,
    useRouter,
} from "next/navigation";
import {
    ArrowLeft,
    Building2,
    Minus,
    Plus,
    Save,
    Users,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { updateRnuEntry } from "../../../actions";

const TRANSPORT_OPTIONS = [
    { value: "AUTO", label: "Auto" },
    { value: "MOTO", label: "Moto" },
    { value: "BICICLETA", label: "Bicicleta" },
    {
        value: "CAMINANDO_CORRIENDO",
        label: "Caminando / corriendo",
    },
];

const REASON_OPTIONS = [
    { value: "PESCA", label: "Pesca" },
    { value: "RECREACION", label: "Recreación" },
    { value: "PAMPA_WAKE", label: "Pampa Wake" },
    {
        value: "ACTIVIDAD_PROGRAMADA",
        label: "Actividad programada",
    },
    {
        value: "FOTOGRAFIA_AVISTAJE",
        label: "Fotografía / avistaje de aves",
    },
    { value: "KAYAK", label: "Kayak" },
    { value: "ACAMPE", label: "Acampe" },
];

const FACILITY_OPTIONS = [
    { value: "SUM", label: "SUM" },
    {
        value: "CENTRO_INTERPRETATIVO",
        label: "Centro Interpretativo",
    },
];

const ACTIVITY_OPTIONS = [
    { value: "KAYAK", label: "Kayak" },
    { value: "AVISTAJE", label: "Avistaje" },
    {
        value: "CENTRO_ATENCION_VISITANTE",
        label: "Centro de Atención al Visitante",
    },
];

const BEHAVIOR_OPTIONS = [
    { value: "BUENO", label: "Bueno" },
    { value: "REGULAR", label: "Regular" },
    { value: "MALO", label: "Malo" },
];

type EntryType = "GENERAL" | "INSTITUCION";

export default function EditarRnuPage() {
    const params = useParams<{ id: string }>();
    const id = params.id;
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [isPending, startTransition] = useTransition();

    const [entryType, setEntryType] =
        useState<EntryType>("GENERAL");

    const [entryDate, setEntryDate] = useState("");
    const [entryTime, setEntryTime] = useState("");
    const [visitorCount, setVisitorCount] = useState(1);
    const [provinceLocality, setProvinceLocality] =
        useState("");
    const [observations, setObservations] = useState("");

    const [transportType, setTransportType] = useState("");
    const [firstVisit, setFirstVisit] =
        useState<boolean | null>(null);
    const [entryReasons, setEntryReasons] = useState<
        string[]
    >([]);
    const [facilities, setFacilities] = useState<string[]>([]);

    const [institutionName, setInstitutionName] = useState("");
    const [ages, setAges] = useState("");
    const [responsibleName, setResponsibleName] =
        useState("");
    const [responsiblePhone, setResponsiblePhone] =
        useState("");
    const [estimatedExitTime, setEstimatedExitTime] =
        useState("");
    const [hasVisitRequest, setHasVisitRequest] =
        useState<boolean | null>(null);
    const [activities, setActivities] = useState<string[]>([]);
    const [behavior, setBehavior] = useState("");

    useEffect(() => {
        async function loadEntry() {
            const supabase = createClient();

            const { data, error } = await supabase
                .from("rnu_entries")
                .select("*")
                .eq("id", id)
                .single();

            if (error || !data) {
                setErrorMessage(
                    "No se pudo cargar el registro.",
                );
                setLoading(false);
                return;
            }

            setEntryType(data.entry_type);
            setEntryDate(data.entry_date || "");
            setEntryTime(
                data.entry_time
                    ? String(data.entry_time).slice(0, 5)
                    : "",
            );
            setVisitorCount(data.visitor_count || 1);
            setProvinceLocality(
                data.province_locality || "",
            );
            setObservations(data.observations || "");

            setTransportType(data.transport_type || "");
            setFirstVisit(data.first_visit ?? null);
            setEntryReasons(data.entry_reasons || []);
            setFacilities(data.facilities || []);

            setInstitutionName(
                data.institution_name || "",
            );
            setAges(data.ages || "");
            setResponsibleName(
                data.responsible_name || "",
            );
            setResponsiblePhone(
                data.responsible_phone || "",
            );
            setEstimatedExitTime(
                data.estimated_exit_time
                    ? String(data.estimated_exit_time).slice(0, 5)
                    : "",
            );
            setHasVisitRequest(
                data.has_visit_request ?? null,
            );
            setActivities(data.activities || []);
            setBehavior(data.behavior || "");

            setLoading(false);
        }

        loadEntry();
    }, [id]);

    function toggleArray(
        value: string,
        current: string[],
        setter: React.Dispatch<
            React.SetStateAction<string[]>
        >,
    ) {
        setter(
            current.includes(value)
                ? current.filter((item) => item !== value)
                : [...current, value],
        );
    }

    function handleSubmit(
        event: React.FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();
        setErrorMessage("");

        startTransition(async () => {
            try {
                const result = await updateRnuEntry({
                    id,
                    entryType,
                    entryDate,
                    entryTime,
                    visitorCount,
                    provinceLocality,
                    observations,

                    transportType,
                    firstVisit,
                    entryReasons,
                    facilities,

                    institutionName,
                    ages,
                    responsibleName,
                    responsiblePhone,
                    estimatedExitTime,
                    hasVisitRequest,
                    activities,
                    behavior,
                });

                if (result.success) {
                    router.push(
                        `/dashboard/rnu/registros/${result.id}`,
                    );

                    router.refresh();
                }
            } catch (error) {
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "No se pudo actualizar el registro.",
                );
            }
        });
    }

    if (loading) {
        return (
            <main className="mx-auto w-full max-w-5xl px-4 py-8">
                <p className="text-muted-foreground">
                    Cargando registro...
                </p>
            </main>
        );
    }

    return (
        <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
            <div className="mb-5">
                <Link
                    href={`/dashboard/rnu/registros/${id}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Volver
                </Link>
            </div>

            <section className="mb-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                        {entryType === "INSTITUCION" ? (
                            <Building2 className="h-6 w-6" />
                        ) : (
                            <Users className="h-6 w-6" />
                        )}
                    </div>

                    <div>
                        <h1 className="text-2xl font-bold sm:text-3xl">
                            Editar registro
                        </h1>

                        <p className="mt-1 text-sm text-muted-foreground">
                            {entryType === "INSTITUCION"
                                ? "Ingreso institucional"
                                : "Ingreso general"}
                        </p>
                    </div>
                </div>
            </section>

            <form onSubmit={handleSubmit} className="space-y-5">
                <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
                    <h2 className="text-lg font-semibold">
                        Datos generales
                    </h2>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <input
                            type="date"
                            value={entryDate}
                            onChange={(e) => setEntryDate(e.target.value)}
                            className="min-h-12 rounded-xl border px-4"
                        />

                        <input
                            type="time"
                            value={entryTime}
                            onChange={(e) => setEntryTime(e.target.value)}
                            className="min-h-12 rounded-xl border px-4"
                        />

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() =>
                                    setVisitorCount((current) =>
                                        Math.max(1, current - 1),
                                    )
                                }
                                className="flex h-12 w-12 items-center justify-center rounded-xl border"
                            >
                                <Minus className="h-5 w-5" />
                            </button>

                            <div className="flex h-12 min-w-20 items-center justify-center rounded-xl border font-bold">
                                {visitorCount}
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setVisitorCount(
                                        (current) => current + 1,
                                    )
                                }
                                className="flex h-12 w-12 items-center justify-center rounded-xl border"
                            >
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>

                        <input
                            value={provinceLocality}
                            onChange={(e) =>
                                setProvinceLocality(e.target.value)
                            }
                            placeholder="Provincia / localidad"
                            className="min-h-12 rounded-xl border px-4"
                        />
                    </div>
                </section>

                {entryType === "GENERAL" ? (
                    <>
                        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
                            <h2 className="text-lg font-semibold">
                                Medio de ingreso
                            </h2>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {TRANSPORT_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                            setTransportType((current) =>
                                                current === option.value
                                                    ? ""
                                                    : option.value,
                                            )
                                        }
                                        className={`min-h-12 rounded-xl border px-4 ${transportType === option.value
                                            ? "border-emerald-600 bg-emerald-50"
                                            : ""
                                            }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
                            <h2 className="text-lg font-semibold">
                                ¿Primera visita?
                            </h2>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                                {[true, false].map((value) => (
                                    <button
                                        key={String(value)}
                                        type="button"
                                        onClick={() =>
                                            setFirstVisit((current) =>
                                                current === value
                                                    ? null
                                                    : value,
                                            )
                                        }
                                        className={`min-h-12 rounded-xl border ${firstVisit === value
                                            ? "border-emerald-600 bg-emerald-50"
                                            : ""
                                            }`}
                                    >
                                        {value ? "Sí" : "No"}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
                            <h2 className="text-lg font-semibold">
                                Motivos
                            </h2>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {REASON_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                            toggleArray(
                                                option.value,
                                                entryReasons,
                                                setEntryReasons,
                                            )
                                        }
                                        className={`min-h-12 rounded-xl border px-4 ${entryReasons.includes(
                                            option.value,
                                        )
                                            ? "border-emerald-600 bg-emerald-50"
                                            : ""
                                            }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </section>
                    </>
                ) : (
                    <>
                        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
                            <h2 className="text-lg font-semibold">
                                Institución
                            </h2>

                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <input
                                    value={institutionName}
                                    onChange={(e) =>
                                        setInstitutionName(
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Nombre de la institución"
                                    className="min-h-12 rounded-xl border px-4 sm:col-span-2"
                                />

                                <input
                                    value={ages}
                                    onChange={(e) =>
                                        setAges(e.target.value)
                                    }
                                    placeholder="Edades"
                                    className="min-h-12 rounded-xl border px-4"
                                />

                                <input
                                    value={estimatedExitTime}
                                    onChange={(e) =>
                                        setEstimatedExitTime(
                                            e.target.value,
                                        )
                                    }
                                    type="time"
                                    className="min-h-12 rounded-xl border px-4"
                                />

                                <input
                                    value={responsibleName}
                                    onChange={(e) =>
                                        setResponsibleName(
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Responsable"
                                    className="min-h-12 rounded-xl border px-4"
                                />

                                <input
                                    value={responsiblePhone}
                                    onChange={(e) =>
                                        setResponsiblePhone(
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Teléfono"
                                    className="min-h-12 rounded-xl border px-4"
                                />
                            </div>
                        </section>

                        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
                            <h2 className="text-lg font-semibold">
                                Pedido de visita
                            </h2>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                                {[true, false].map((value) => (
                                    <button
                                        key={String(value)}
                                        type="button"
                                        onClick={() =>
                                            setHasVisitRequest(
                                                (current) =>
                                                    current === value
                                                        ? null
                                                        : value,
                                            )
                                        }
                                        className={`min-h-12 rounded-xl border ${hasVisitRequest === value
                                            ? "border-sky-600 bg-sky-50"
                                            : ""
                                            }`}
                                    >
                                        {value ? "Sí" : "No"}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
                            <h2 className="text-lg font-semibold">
                                Actividades
                            </h2>

                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                {ACTIVITY_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                            toggleArray(
                                                option.value,
                                                activities,
                                                setActivities,
                                            )
                                        }
                                        className={`min-h-12 rounded-xl border px-4 ${activities.includes(
                                            option.value,
                                        )
                                            ? "border-sky-600 bg-sky-50"
                                            : ""
                                            }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
                            <h2 className="text-lg font-semibold">
                                Comportamiento
                            </h2>

                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                {BEHAVIOR_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                            setBehavior((current) =>
                                                current === option.value
                                                    ? ""
                                                    : option.value,
                                            )
                                        }
                                        className={`min-h-12 rounded-xl border ${behavior === option.value
                                            ? "border-sky-600 bg-sky-50"
                                            : ""
                                            }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </section>
                    </>
                )}

                <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
                    <h2 className="text-lg font-semibold">
                        Instalaciones
                    </h2>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {FACILITY_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                    toggleArray(
                                        option.value,
                                        facilities,
                                        setFacilities,
                                    )
                                }
                                className={`min-h-12 rounded-xl border ${facilities.includes(option.value)
                                    ? "border-emerald-600 bg-emerald-50"
                                    : ""
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
                    <h2 className="text-lg font-semibold">
                        Observaciones
                    </h2>

                    <textarea
                        value={observations}
                        onChange={(e) =>
                            setObservations(e.target.value)
                        }
                        rows={5}
                        className="mt-4 w-full rounded-xl border p-4"
                    />
                </section>

                {errorMessage && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {errorMessage}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                    <Save className="h-5 w-5" />

                    {isPending
                        ? "Guardando cambios..."
                        : "Guardar cambios"}
                </button>
            </form>
        </main>
    );
}