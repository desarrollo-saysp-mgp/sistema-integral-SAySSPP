import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MapPinned } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { InterventionsMap } from "./_map";

const BASE = "/dashboard/solicitud-intervenciones";
const LUCAS_EMAIL = "arqbelliardolucas@gmail.com";
const MAX_POINTS = 10000;
const BATCH = 1000;

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type MapRow = {
  id: string; expediente: string | null; nombre_apellido: string | null;
  ubicacion_calle: string | null; tipo: string | null; especie: string | null;
  estado: string | null; retirado: string | null; anio_original: string | null; fecha: string | null; cantidad: number | null;
  latitud: number | null; longitud: number | null;
};

const FIELDS = "id,expediente,nombre_apellido,ubicacion_calle,tipo,especie,estado,retirado,anio_original,fecha,cantidad,latitud,longitud";

export default async function InterventionsMapPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("users").select("role, email, is_readonly").eq("id", user.id).single();
  if (profileError || !profile) redirect("/dashboard/accesos");

  const role = normalize(profile.role);
  const email = normalize(profile.email || user.email);
  if (!["admin", "adminlectura", "reclamosarbolado"].includes(role) && email !== normalize(LUCAS_EMAIL)) {
    redirect("/dashboard/accesos");
  }
  const canEdit = role !== "adminlectura" && profile.is_readonly !== true;

  const points: MapRow[] = [];
  const pending: MapRow[] = [];
  let totalGeocoded = 0;
  let totalPending = 0;
  let queryError: string | null = null;

  for (let offset = 0; offset < MAX_POINTS; offset += BATCH) {
    const { data, error, count } = await supabase.from("solicitudes_intervencion")
      .select(FIELDS, offset === 0 ? { count: "exact" } : {})
      .not("latitud", "is", null).not("longitud", "is", null)
      .order("id", { ascending: true }).range(offset, offset + BATCH - 1);
    if (error) { queryError = error.message; break; }
    if (offset === 0) totalGeocoded = count ?? 0;
    points.push(...((data ?? []) as MapRow[]));
    if (!data || data.length < BATCH) break;
  }

  if (!queryError) {
    for (let offset = 0; offset < MAX_POINTS; offset += BATCH) {
      const { data, error, count } = await supabase.from("solicitudes_intervencion")
        .select(FIELDS, offset === 0 ? { count: "exact" } : {})
        .or("latitud.is.null,longitud.is.null")
        .order("id", { ascending: true }).range(offset, offset + BATCH - 1);
      if (error) { queryError = error.message; break; }
      if (offset === 0) totalPending = count ?? 0;
      pending.push(...((data ?? []) as MapRow[]));
      if (!data || data.length < BATCH) break;
    }
  }

  const { count: total, error: totalError } = await supabase.from("solicitudes_intervencion")
    .select("id", { head: true, count: "exact" });

  const valid = points.filter(p => Number.isFinite(p.latitud) && Number.isFinite(p.longitud) &&
    (p.latitud as number) >= -90 && (p.latitud as number) <= 90 &&
    (p.longitud as number) >= -180 && (p.longitud as number) <= 180);

  return (
    <main className="w-full min-w-0 space-y-5 px-3 py-5 sm:px-5 lg:px-7 2xl:px-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href={BASE} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#00A27F]">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al listado
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <MapPinned className="h-6 w-6 text-[#00A27F]" /> Mapa de Intervenciones
          </h1>
          <p className="text-sm text-muted-foreground">Ubicaciones georreferenciadas y pendientes de solicitudes de arbolado en General Pico.</p>
        </div>
        <Link href={BASE} className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted">Ver listado</Link>
      </header>
      {queryError || totalError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          No se pudo cargar el mapa: {queryError || totalError?.message}
        </div>
      ) : (
        <InterventionsMap points={valid} pending={pending} total={total ?? 0} geocoded={totalGeocoded}
          pendingCount={totalPending} limited={totalGeocoded > MAX_POINTS || totalPending > MAX_POINTS} canEdit={canEdit} />
      )}
    </main>
  );
}
