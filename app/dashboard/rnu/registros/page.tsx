import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type RnuEntry = {
  id: string;
  entry_type: "GENERAL" | "INSTITUCION";
  entry_date: string;
  entry_time: string;
  visitor_count: number;
  province_locality: string | null;
  transport_type: string | null;
  institution_name: string | null;
  entry_reasons: string[] | null;
  observations: string | null;
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

function normalizeRole(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function formatDate(value: string) {
  if (!value) return "--";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

function formatTime(value: string) {
  if (!value) return "--";

  return value.slice(0, 5);
}

export default async function RnuRegistrosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  const userRole = normalizeRole(profile.role);
  const allowedRoles = ["admin", "adminlectura", "rnu"];

  if (!allowedRoles.includes(userRole)) {
    redirect("/dashboard/accesos");
  }

  const { data, error } = await supabase
    .from("rnu_entries")
    .select(
      `
        id,
        entry_type,
        entry_date,
        entry_time,
        visitor_count,
        province_locality,
        transport_type,
        institution_name,
        entry_reasons,
        observations,
        created_at
      `,
    )
    .order("entry_date", { ascending: false })
    .order("entry_time", { ascending: false });

  if (error) {
    console.error("Error al consultar registros RNU:", error);
  }

  const entries = (data ?? []) as RnuEntry[];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
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
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Registros de ingresos
        </h1>

        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Consultá los ingresos generales e institucionales cargados en la
          Reserva Natural Urbana.
        </p>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          No se pudieron cargar los registros.
        </div>
      ) : entries.length === 0 ? (
        <section className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <p className="text-muted-foreground">
            Todavía no hay ingresos registrados.
          </p>
        </section>
      ) : (
        <>
          <div className="space-y-4 md:hidden">
            {entries.map((entry) => {
              const isInstitution = entry.entry_type === "INSTITUCION";

              return (
                <article
                  key={entry.id}
                  className="rounded-2xl border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                        {isInstitution ? (
                          <Building2 className="h-5 w-5" />
                        ) : (
                          <Users className="h-5 w-5" />
                        )}
                      </div>

                      <div>
                        <h2 className="font-semibold">
                          {isInstitution
                            ? entry.institution_name || "Institución"
                            : "Ingreso general"}
                        </h2>

                        <p className="text-sm text-muted-foreground">
                          {formatDate(entry.entry_date)} ·{" "}
                          {formatTime(entry.entry_time)}
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      {entry.visitor_count} personas
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <p>
                      <span className="font-medium">Procedencia:</span>{" "}
                      {entry.province_locality || "--"}
                    </p>

                    {!isInstitution && (
                      <>
                        <p>
                          <span className="font-medium">
                            Medio de ingreso:
                          </span>{" "}
                          {entry.transport_type
                            ? TRANSPORT_LABELS[entry.transport_type] ||
                              entry.transport_type
                            : "--"}
                        </p>

                        <p>
                          <span className="font-medium">Motivos:</span>{" "}
                          {entry.entry_reasons?.length
                            ? entry.entry_reasons
                                .map(
                                  (reason) =>
                                    REASON_LABELS[reason] || reason,
                                )
                                .join(", ")
                            : "--"}
                        </p>
                      </>
                    )}

                    {entry.observations ? (
                      <p>
                        <span className="font-medium">Observaciones:</span>{" "}
                        {entry.observations}
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b text-left">
                    <th className="px-4 py-3 font-semibold">Fecha</th>
                    <th className="px-4 py-3 font-semibold">Hora</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Cantidad</th>
                    <th className="px-4 py-3 font-semibold">Procedencia</th>
                    <th className="px-4 py-3 font-semibold">Detalle</th>
                  </tr>
                </thead>

                <tbody>
                  {entries.map((entry) => {
                    const isInstitution =
                      entry.entry_type === "INSTITUCION";

                    return (
                      <tr
                        key={entry.id}
                        className="border-b last:border-b-0"
                      >
                        <td className="px-4 py-4">
                          {formatDate(entry.entry_date)}
                        </td>

                        <td className="px-4 py-4">
                          {formatTime(entry.entry_time)}
                        </td>

                        <td className="px-4 py-4">
                          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                            {isInstitution ? "Institución" : "General"}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          {entry.visitor_count}
                        </td>

                        <td className="px-4 py-4">
                          {entry.province_locality || "--"}
                        </td>

                        <td className="px-4 py-4">
                          {isInstitution
                            ? entry.institution_name || "Institución"
                            : entry.entry_reasons?.length
                              ? entry.entry_reasons
                                  .map(
                                    (reason) =>
                                      REASON_LABELS[reason] || reason,
                                  )
                                  .join(", ")
                              : "--"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}