import Link from "next/link";
import {
  BarChart3,
  Building2,
  ClipboardList,
  Users,
} from "lucide-react";

export default function RnuPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Registro de Ingresos RNU
        </h1>

        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Registrá los ingresos de visitantes e instituciones a la Reserva
          Natural Urbana Benicio Delfín Pérez.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="flex min-h-[260px] flex-col rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Users className="h-6 w-6" />
          </div>

          <div className="mt-5 flex-1">
            <h2 className="text-xl font-semibold">
              Registrar ingreso general
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Para personas, familias o grupos que ingresan a la reserva.
            </p>
          </div>

          <Link
            href="/dashboard/rnu/nuevo"
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            Registrar ingreso
          </Link>
        </article>

        <article className="flex min-h-[260px] flex-col rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <Building2 className="h-6 w-6" />
          </div>

          <div className="mt-5 flex-1">
            <h2 className="text-xl font-semibold">
              Registrar institución
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Para escuelas, organizaciones, grupos institucionales y visitas
              programadas.
            </p>
          </div>

          <Link
            href="/dashboard/rnu/instituciones/nueva"
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
          >
            Registrar institución
          </Link>
        </article>
      </section>

      <section className="mt-4">
        <article className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                <ClipboardList className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-semibold">
                  Registros de ingresos
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Consultá los ingresos generales e institucionales cargados.
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/rnu/registros"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border bg-background px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted sm:w-auto"
            >
              Ver registros
            </Link>
          </div>
        </article>
      </section>

      <section className="mt-4">
        <article className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <BarChart3 className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-semibold">
                  Estadísticas
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Analizá visitantes, motivos, procedencias e ingresos
                  institucionales.
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/rnu/estadisticas"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border bg-background px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted sm:w-auto"
            >
              Ver estadísticas
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}