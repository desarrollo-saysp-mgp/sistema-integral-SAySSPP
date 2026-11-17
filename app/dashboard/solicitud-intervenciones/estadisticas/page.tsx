import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { InterventionStatistics } from "./_statistics";

export const dynamic = "force-dynamic";

const BASE = "/dashboard/solicitud-intervenciones";
const LUCAS_EMAIL = "arqbelliardolucas@gmail.com";
const BATCH = 1000;
const MAX_ROWS = 10000;

const normalize = (input: unknown) => String(input ?? "").trim().toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");

type StatisticsRow = {
  id: string;
  fecha: string | null;
  anio_original: string | null;
  tipo: string | null;
  estado: string | null;
  derivacion: string | null;
  retirado: string | null;
  especie: string | null;
  cantidad: number | null;
};

export default async function IntervencionesEstadisticasPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("users").select("role,email,is_readonly").eq("id", user.id).single();
  if (profileError || !profile) redirect("/dashboard/accesos");

  const role = normalize(profile.role);
  const email = normalize(profile.email || user.email);
  if (!["admin", "adminlectura", "reclamosarbolado"].includes(role) && email !== normalize(LUCAS_EMAIL)) {
    redirect("/dashboard/accesos");
  }

  // Solo lectura, sin service_role, sin SQL adicional ni endpoints de escritura.
  // Paginamos para no omitir filas por el límite predeterminado de Supabase.
  const records: StatisticsRow[] = [];
  let totalRows = 0;
  let loadError: string | null = null;
  for (let offset = 0; offset < MAX_ROWS; offset += BATCH) {
    const { data, error, count } = await supabase.from("solicitudes_intervencion")
      .select("id,fecha,anio_original,tipo,estado,derivacion,retirado,especie,cantidad", offset === 0 ? { count: "exact" } : {})
      .order("id", { ascending: true }).range(offset, offset + BATCH - 1);
    if (error) { loadError = error.message; break; }
    if (offset === 0) totalRows = count ?? 0;
    records.push(...((data ?? []) as StatisticsRow[]));
    if (!data || data.length < BATCH) break;
  }

  return (
    <main className="w-full min-w-0 space-y-5 px-3 py-5 sm:px-5 lg:px-7 2xl:px-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href={BASE} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#00A27F]">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a solicitudes
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <BarChart3 className="h-7 w-7 text-[#00A27F]" /> Estadísticas de intervenciones
          </h1>
          <p className="text-sm text-muted-foreground">Indicadores y comparativas dinámicas de las solicitudes de arbolado.</p>
        </div>
        <Link href={`${BASE}/mapa`} className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted">Ver mapa</Link>
      </header>
      {loadError ? (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          No se pudieron cargar las estadísticas: {loadError}
        </div>
      ) : (
        <InterventionStatistics records={records} totalRows={totalRows} limited={totalRows > MAX_ROWS} />
      )}
    </main>
  );
}
