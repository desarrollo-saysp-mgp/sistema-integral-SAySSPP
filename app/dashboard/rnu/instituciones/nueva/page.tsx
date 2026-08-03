"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Building2,
  Minus,
  Plus,
  Save,
} from "lucide-react";

import { createInstitutionRnuEntry } from "../../actions";
import LocalidadSelector from "@/components/rnu/LocalidadSelector";

const FACILITY_OPTIONS = [
  {
    value: "SUM",
    label: "SUM",
  },
  {
    value: "CENTRO_INTERPRETATIVO",
    label: "Centro Interpretativo",
  },
];

const ACTIVITY_OPTIONS = [
  {
    value: "KAYAK",
    label: "Kayak",
  },
  {
    value: "AVISTAJE",
    label: "Avistaje",
  },
  {
    value: "CENTRO_ATENCION_VISITANTE",
    label: "Centro de Atención al Visitante",
  },
];

const BEHAVIOR_OPTIONS = [
  {
    value: "BUENO",
    label: "Bueno",
  },
  {
    value: "REGULAR",
    label: "Regular",
  },
  {
    value: "MALO",
    label: "Malo",
  },
];

function getCurrentDate() {
  return new Date().toLocaleDateString("en-CA");
}

function getCurrentTime() {
  return new Date().toTimeString().slice(0, 5);
}

export default function NuevaInstitucionRnuPage() {
  const [institutionName, setInstitutionName] = useState("");
  const [provinceLocality, setProvinceLocality] = useState("");
  const [visitorCount, setVisitorCount] = useState(1);
  const [ages, setAges] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [responsiblePhone, setResponsiblePhone] = useState("");
  const [entryDate, setEntryDate] = useState(getCurrentDate());
  const [entryTime, setEntryTime] = useState(getCurrentTime());
  const [estimatedExitTime, setEstimatedExitTime] =
    useState("");

  const [hasVisitRequest, setHasVisitRequest] = useState<
    boolean | null
  >(null);

  const [facilities, setFacilities] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [behavior, setBehavior] = useState("");
  const [observations, setObservations] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [isPending, startTransition] = useTransition();

  function decreaseVisitors() {
    setVisitorCount((current) =>
      Math.max(1, current - 1),
    );
  }

  function increaseVisitors() {
    setVisitorCount((current) =>
      current + 1,
    );
  }

  function toggleVisitRequest(value: boolean) {
    setHasVisitRequest((current) =>
      current === value ? null : value,
    );
  }

  function toggleBehavior(value: string) {
    setBehavior((current) =>
      current === value ? "" : value,
    );
  }

  function toggleFacility(value: string) {
    setFacilities((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function toggleActivity(value: string) {
    setActivities((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function handleSave() {
    if (isPending) {
      return;
    }

    setErrorMessage("");

    startTransition(async () => {
      try {
        await createInstitutionRnuEntry({
          institutionName,
          provinceLocality,
          visitorCount,
          ages,
          responsibleName,
          responsiblePhone,
          entryDate,
          entryTime,
          estimatedExitTime,
          hasVisitRequest,
          facilities,
          activities,
          behavior,
          observations,
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo guardar la institución.",
        );
      }
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5">
        <Link
          href="/dashboard/rnu"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </div>

      <section className="mb-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <Building2 className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Registrar institución
            </h1>

            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Todos los campos son opcionales. La fecha, hora y cantidad
              se completan automáticamente.
            </p>
          </div>
        </div>
      </section>

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
          }
        }}
      >
        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">
            Datos de la institución
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="institution-name"
                className="mb-2 block text-sm font-medium"
              >
                Nombre de la institución
              </label>

              <input
                id="institution-name"
                type="text"
                value={institutionName}
                onChange={(event) =>
                  setInstitutionName(event.target.value)
                }
                placeholder="Ejemplo: Escuela N.º 66"
                autoComplete="organization"
                className="min-h-12 w-full rounded-xl border bg-background px-4 text-base outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                Provincia / localidad
              </label>

              <LocalidadSelector
                value={provinceLocality}
                onChange={setProvinceLocality}
                placeholder="Escribí una localidad..."
                accent="sky"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="ages"
                className="mb-2 block text-sm font-medium"
              >
                Edades o rango etario
              </label>

              <input
                id="ages"
                type="text"
                value={ages}
                onChange={(event) =>
                  setAges(event.target.value)
                }
                placeholder="Ejemplo: entre 10 y 12 años"
                className="min-h-12 w-full rounded-xl border bg-background px-4 text-base outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">
            Cantidad de personas
          </h2>

          <div className="mt-4 flex items-center justify-center gap-4 sm:justify-start">
            <button
              type="button"
              onClick={decreaseVisitors}
              className="flex h-14 w-14 items-center justify-center rounded-xl border bg-background transition-colors hover:bg-muted active:scale-95"
              aria-label="Disminuir cantidad"
            >
              <Minus className="h-6 w-6" />
            </button>

            <div className="flex min-w-28 items-center justify-center rounded-xl border bg-muted/40 px-6 py-3">
              <span className="text-3xl font-bold">
                {visitorCount}
              </span>
            </div>

            <button
              type="button"
              onClick={increaseVisitors}
              className="flex h-14 w-14 items-center justify-center rounded-xl border bg-background transition-colors hover:bg-muted active:scale-95"
              aria-label="Aumentar cantidad"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">
            Responsable del grupo
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="responsible-name"
                className="mb-2 block text-sm font-medium"
              >
                Nombre y apellido
              </label>

              <input
                id="responsible-name"
                type="text"
                value={responsibleName}
                onChange={(event) =>
                  setResponsibleName(event.target.value)
                }
                placeholder="Nombre completo"
                autoComplete="name"
                className="min-h-12 w-full rounded-xl border bg-background px-4 text-base outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <div>
              <label
                htmlFor="responsible-phone"
                className="mb-2 block text-sm font-medium"
              >
                Teléfono de contacto
              </label>

              <input
                id="responsible-phone"
                type="tel"
                inputMode="tel"
                value={responsiblePhone}
                onChange={(event) =>
                  setResponsiblePhone(event.target.value)
                }
                placeholder="Ejemplo: 2302 123456"
                autoComplete="tel"
                className="min-h-12 w-full rounded-xl border bg-background px-4 text-base outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">
            Fecha y horarios
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="entry-date"
                className="mb-2 block text-sm font-medium"
              >
                Fecha de entrada
              </label>

              <input
                id="entry-date"
                type="date"
                value={entryDate}
                onChange={(event) =>
                  setEntryDate(event.target.value)
                }
                className="min-h-12 w-full rounded-xl border bg-background px-4 text-base outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <div>
              <label
                htmlFor="entry-time"
                className="mb-2 block text-sm font-medium"
              >
                Hora de entrada
              </label>

              <input
                id="entry-time"
                type="time"
                value={entryTime}
                onChange={(event) =>
                  setEntryTime(event.target.value)
                }
                className="min-h-12 w-full rounded-xl border bg-background px-4 text-base outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <div>
              <label
                htmlFor="estimated-exit-time"
                className="mb-2 block text-sm font-medium"
              >
                Hora estimada de salida
              </label>

              <input
                id="estimated-exit-time"
                type="time"
                value={estimatedExitTime}
                onChange={(event) =>
                  setEstimatedExitTime(event.target.value)
                }
                className="min-h-12 w-full rounded-xl border bg-background px-4 text-base outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">
            ¿Tiene pedido de visita?
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                toggleVisitRequest(true)
              }
              className={`min-h-14 rounded-xl border px-4 text-base font-semibold transition ${
                hasVisitRequest === true
                  ? "border-sky-600 bg-sky-50 text-sky-800 ring-2 ring-sky-600/20"
                  : "bg-background hover:bg-muted"
              }`}
            >
              Sí
            </button>

            <button
              type="button"
              onClick={() =>
                toggleVisitRequest(false)
              }
              className={`min-h-14 rounded-xl border px-4 text-base font-semibold transition ${
                hasVisitRequest === false
                  ? "border-sky-600 bg-sky-50 text-sky-800 ring-2 ring-sky-600/20"
                  : "bg-background hover:bg-muted"
              }`}
            >
              No
            </button>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">
            Instalaciones que utilizará
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Podés seleccionar ninguna, una o varias opciones.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FACILITY_OPTIONS.map((option) => {
              const isSelected =
                facilities.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    toggleFacility(option.value)
                  }
                  className={`min-h-14 rounded-xl border px-4 py-3 text-left text-base font-medium transition ${
                    isSelected
                      ? "border-sky-600 bg-sky-50 text-sky-800 ring-2 ring-sky-600/20"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">
            Actividades a realizar
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Podés seleccionar ninguna, una o varias opciones.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {ACTIVITY_OPTIONS.map((option) => {
              const isSelected =
                activities.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    toggleActivity(option.value)
                  }
                  className={`min-h-14 rounded-xl border px-4 py-3 text-left text-base font-medium transition ${
                    isSelected
                      ? "border-sky-600 bg-sky-50 text-sky-800 ring-2 ring-sky-600/20"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">
            Comportamiento
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Tocá nuevamente una opción seleccionada para quitarla.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {BEHAVIOR_OPTIONS.map((option) => {
              const isSelected =
                behavior === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    toggleBehavior(option.value)
                  }
                  className={`min-h-14 rounded-xl border px-4 py-3 text-base font-semibold transition ${
                    isSelected
                      ? "border-sky-600 bg-sky-50 text-sky-800 ring-2 ring-sky-600/20"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">
            Observaciones
          </h2>

          <div className="mt-4">
            <textarea
              id="observations"
              value={observations}
              onChange={(event) =>
                setObservations(event.target.value)
              }
              placeholder="Escribí una observación si es necesario..."
              rows={5}
              className="w-full resize-y rounded-xl border bg-background px-4 py-3 text-base outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20"
            />
          </div>
        </section>

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-5 w-5" />

            {isPending
              ? "Guardando institución..."
              : "Guardar institución"}
          </button>
        </div>
      </form>
    </main>
  );
}