import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Pencil,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type RnuEntry = {
  id: string;
  entry_type: "GENERAL" | "INSTITUCION";
  entry_date: string;
  entry_time: string;
  visitor_count: number;

  province_locality: string | null;
  observations: string | null;

  transport_type: string | null;
  first_visit: boolean | null;
  entry_reasons: string[] | null;
  facilities: string[] | null;

  institution_name: string | null;
  ages: string | null;
  responsible_name: string | null;
  responsible_phone: string | null;
  estimated_exit_time: string | null;
  has_visit_request: boolean | null;
  activities: string[] | null;
  behavior: string | null;

  created_at: string;
};

const TRANSPORT_LABELS: Record<string, string> = {
  AUTO: "Auto",
  MOTO: "Moto",
  BICICLETA: "Bicicleta",
  CAMINANDO_CORRIENDO: "Caminando / corriendo",
};

const REASON_LABELS: Record<string, string> = {
  PESCA: "Pesca",
  RECREACION: "Recreación",
  PAMPA_WAKE: "Pampa Wake",
  ACTIVIDAD_PROGRAMADA: "Actividad programada",
  FOTOGRAFIA_AVISTAJE: "Fotografía / avistaje de aves",
  KAYAK: "Kayak",
  ACAMPE: "Acampe",
};

const FACILITY_LABELS: Record<string, string> = {
  SUM: "SUM",
  CENTRO_INTERPRETATIVO: "Centro Interpretativo",
};

const ACTIVITY_LABELS: Record<string, string> = {
  KAYAK: "Kayak",
  AVISTAJE: "Avistaje",
  CENTRO_ATENCION_VISITANTE:
    "Centro de Atención al Visitante",
};

const BEHAVIOR_LABELS: Record<string, string> = {
  BUENO: "Bueno",
  REGULAR: "Regular",
  MALO: "Malo",
};

function normalizeRole(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatTime(value: string | null) {
  if (!value) return "—";

  return value.slice(0, 5);
}

function formatBoolean(value: boolean | null) {
  if (value === true) return "Sí";
  if (value === false) return "No";

  return "—";
}

function formatArray(
  values: string[] | null,
  labels: Record<string, string>,
) {
  if (!values?.length) {
    return "—";
  }

  return values
    .map((value) => labels[value] || value)
    .join(", ");
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-sm text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 break-words font-medium">
        {value}
      </p>
    </div>
  );
}

export default async function RnuEntryDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  const userRole = normalizeRole(profile.role);

  const allowedRoles = [
    "admin",
    "adminlectura",
    "rnu",
  ];

  if (!allowedRoles.includes(userRole)) {
    redirect("/dashboard/accesos");
  }

  const canEdit =
    userRole === "admin" ||
    userRole === "rnu";

  const { data, error } = await supabase
    .from("rnu_entries")
    .select(`
      id,
      entry_type,
      entry_date,
      entry_time,
      visitor_count,

      province_locality,
      observations,

      transport_type,
      first_visit,
      entry_reasons,
      facilities,

      institution_name,
      ages,
      responsible_name,
      responsible_phone,
      estimated_exit_time,
      has_visit_request,
      activities,
      behavior,

      created_at
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(
      "Error al obtener registro RNU:",
      error,
    );

    throw new Error(
      "No se pudo cargar el registro.",
    );
  }

  if (!data) {
    notFound();
  }

  const entry = data as RnuEntry;

  const isInstitution =
    entry.entry_type === "INSTITUCION";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/dashboard/rnu/registros"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>

        {canEdit && (
          <Link
            href={`/dashboard/rnu/registros/${entry.id}/editar`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <Pencil className="h-4 w-4" />
            Editar registro
          </Link>
        )}
      </div>

      <section className="mb-6">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              isInstitution
                ? "bg-sky-100 text-sky-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {isInstitution ? (
              <Building2 className="h-6 w-6" />
            ) : (
              <Users className="h-6 w-6" />
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {isInstitution
                ? entry.institution_name ||
                  "Ingreso institucional"
                : "Ingreso general"}
            </h1>

            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Detalle completo del registro de ingreso.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">
            Datos generales
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem
              label="Fecha"
              value={formatDate(entry.entry_date)}
            />

            <DetailItem
              label="Hora de ingreso"
              value={formatTime(entry.entry_time)}
            />

            <DetailItem
              label="Tipo"
              value={
                isInstitution
                  ? "Institución"
                  : "General"
              }
            />

            <DetailItem
              label="Cantidad de personas"
              value={entry.visitor_count}
            />

            <DetailItem
              label="Procedencia"
              value={
                entry.province_locality || "—"
              }
            />
          </div>
        </article>

        {!isInstitution ? (
          <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">
              Datos del ingreso general
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem
                label="Medio de ingreso"
                value={
                  entry.transport_type
                    ? TRANSPORT_LABELS[
                        entry.transport_type
                      ] ||
                      entry.transport_type
                    : "—"
                }
              />

              <DetailItem
                label="Primera visita"
                value={formatBoolean(
                  entry.first_visit,
                )}
              />

              <DetailItem
                label="Motivo de ingreso"
                value={formatArray(
                  entry.entry_reasons,
                  REASON_LABELS,
                )}
              />

              <DetailItem
                label="Instalaciones"
                value={formatArray(
                  entry.facilities,
                  FACILITY_LABELS,
                )}
              />
            </div>
          </article>
        ) : (
          <>
            <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold">
                Datos de la institución
              </h2>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailItem
                  label="Institución"
                  value={
                    entry.institution_name ||
                    "—"
                  }
                />

                <DetailItem
                  label="Edades"
                  value={entry.ages || "—"}
                />

                <DetailItem
                  label="Responsable"
                  value={
                    entry.responsible_name ||
                    "—"
                  }
                />

                <DetailItem
                  label="Teléfono"
                  value={
                    entry.responsible_phone ||
                    "—"
                  }
                />

                <DetailItem
                  label="Hora estimada de salida"
                  value={formatTime(
                    entry.estimated_exit_time,
                  )}
                />

                <DetailItem
                  label="¿Tiene pedido de visita?"
                  value={formatBoolean(
                    entry.has_visit_request,
                  )}
                />

                <DetailItem
                  label="Instalaciones"
                  value={formatArray(
                    entry.facilities,
                    FACILITY_LABELS,
                  )}
                />

                <DetailItem
                  label="Actividades"
                  value={formatArray(
                    entry.activities,
                    ACTIVITY_LABELS,
                  )}
                />

                <DetailItem
                  label="Comportamiento"
                  value={
                    entry.behavior
                      ? BEHAVIOR_LABELS[
                          entry.behavior
                        ] ||
                        entry.behavior
                      : "—"
                  }
                />
              </div>
            </article>
          </>
        )}

        <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">
            Observaciones
          </h2>

          <div className="mt-4 rounded-xl border bg-background p-4">
            <p className="whitespace-pre-wrap text-sm leading-6">
              {entry.observations || "—"}
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}