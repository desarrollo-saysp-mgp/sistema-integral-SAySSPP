"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Bike,
  Car,
  Footprints,
  Minus,
  Plus,
  Save,
  Users,
} from "lucide-react";

import { createGeneralRnuEntry } from "../actions";
import LocalidadSelector from "@/components/rnu/LocalidadSelector";

const TRANSPORT_OPTIONS = [
  {
    value: "AUTO",
    label: "Auto",
    icon: Car,
  },
  {
    value: "MOTO",
    label: "Moto",
    icon: Bike,
  },
  {
    value: "BICICLETA",
    label: "Bicicleta",
    icon: Bike,
  },
  {
    value: "CAMINANDO_CORRIENDO",
    label: "Caminando / corriendo",
    icon: Footprints,
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
  {
    value: "SUM",
    label: "SUM",
  },
  {
    value: "CENTRO_INTERPRETATIVO",
    label: "Centro Interpretativo",
  },
];

function getCurrentDate() {
  return new Date().toLocaleDateString("en-CA");
}

function getCurrentTime() {
  return new Date().toTimeString().slice(0, 5);
}

export default function NuevoIngresoRnuPage() {
  const [entryDate, setEntryDate] = useState(getCurrentDate());
  const [entryTime, setEntryTime] = useState(getCurrentTime());
  const [visitorCount, setVisitorCount] = useState(1);

  const [provinceLocality, setProvinceLocality] = useState("");

  const [transportType, setTransportType] = useState("");

  const [firstVisit, setFirstVisit] = useState<boolean | null>(
    null,
  );

  const [entryReasons, setEntryReasons] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<string[]>([]);
  const [observations, setObservations] = useState("");

  const [errorMessage, setErrorMessage] = useState("");

  const [isPending, startTransition] = useTransition();

  function toggleTransport(value: string) {
    setTransportType((current) =>
      current === value ? "" : value,
    );
  }

  function toggleFirstVisit(value: boolean) {
    setFirstVisit((current) =>
      current === value ? null : value,
    );
  }

  function toggleReason(value: string) {
    setEntryReasons((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function toggleFacility(value: string) {
    setFacilities((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

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

  function handleSave() {
    if (isPending) {
      return;
    }

    setErrorMessage("");

    startTransition(async () => {
      try {
        await createGeneralRnuEntry({
          entryDate,
          entryTime,
          visitorCount,
          provinceLocality,
          transportType,
          firstVisit,
          entryReasons,
          facilities,
          observations,
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo guardar el ingreso.",
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
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Users className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Registrar ingreso general
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
            Fecha y hora de ingreso
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="entry-date"
                className="mb-2 block text-sm font-medium"
              >
                Fecha
              </label>

              <input
                id="entry-date"
                type="date"
                value={entryDate}
                onChange={(event) =>
                  setEntryDate(event.target.value)
                }
                className="min-h-12 w-full rounded-xl border bg-background px-4 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div>
              <label
                htmlFor="entry-time"
                className="mb-2 block text-sm font-medium"
              >
                Hora
              </label>

              <input
                id="entry-time"
                type="time"
                value={entryTime}
                onChange={(event) =>
                  setEntryTime(event.target.value)
                }
                className="min-h-12 w-full rounded-xl border bg-background px-4 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">
            Cantidad de visitantes
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
            Medio de ingreso
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Tocá nuevamente una opción seleccionada para quitarla.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TRANSPORT_OPTIONS.map((option) => {
              const Icon = option.icon;

              const isSelected =
                transportType === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    toggleTransport(option.value)
                  }
                  className={`flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3 text-left text-base font-medium transition ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/20"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  <Icon className="h-6 w-6 shrink-0" />

                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">
            Procedencia
          </h2>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium">
              Provincia / localidad
            </label>

            <LocalidadSelector
              value={provinceLocality}
              onChange={setProvinceLocality}
              placeholder="Escribí una localidad..."
              accent="emerald"
            />
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">
            ¿Es la primera vez que visita la reserva?
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                toggleFirstVisit(true)
              }
              className={`min-h-14 rounded-xl border px-4 text-base font-semibold transition ${
                firstVisit === true
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/20"
                  : "bg-background hover:bg-muted"
              }`}
            >
              Sí
            </button>

            <button
              type="button"
              onClick={() =>
                toggleFirstVisit(false)
              }
              className={`min-h-14 rounded-xl border px-4 text-base font-semibold transition ${
                firstVisit === false
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/20"
                  : "bg-background hover:bg-muted"
              }`}
            >
              No
            </button>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">
            Motivo de ingreso
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Podés seleccionar ninguna, una o varias opciones.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {REASON_OPTIONS.map((option) => {
              const isSelected =
                entryReasons.includes(
                  option.value,
                );

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    toggleReason(option.value)
                  }
                  className={`min-h-14 rounded-xl border px-4 py-3 text-left text-base font-medium transition ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/20"
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
            Instalaciones que utilizará
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Podés seleccionar ninguna, una o varias opciones.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FACILITY_OPTIONS.map((option) => {
              const isSelected =
                facilities.includes(
                  option.value,
                );

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    toggleFacility(option.value)
                  }
                  className={`min-h-14 rounded-xl border px-4 py-3 text-left text-base font-medium transition ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/20"
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
                setObservations(
                  event.target.value,
                )
              }
              placeholder="Escribí una observación si es necesario..."
              rows={5}
              className="w-full resize-y rounded-xl border bg-background px-4 py-3 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
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
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-base font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-5 w-5" />

            {isPending
              ? "Guardando ingreso..."
              : "Guardar ingreso"}
          </button>
        </div>
      </form>
    </main>
  );
}