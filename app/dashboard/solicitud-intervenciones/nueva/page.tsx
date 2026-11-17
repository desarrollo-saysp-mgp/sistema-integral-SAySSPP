import Link from "next/link";
import { getInterventionAccess, INTERVENTIONS_BASE } from "../_access";
import { crearSolicitud } from "../_actions";
import { InterventionForm } from "../_form";

type Props = { searchParams: Promise<{ error?: string }> };
export default async function NuevaSolicitud({ searchParams }: Props) {
  const { supabase } = await getInterventionAccess(true);
  const { data: options, error } = await supabase.rpc("opciones_formulario_intervenciones");
  const params = await searchParams;
  return <main className="w-full space-y-5 px-3 py-5 sm:px-6 lg:px-8">
    <Link className="text-sm text-[#008C70]" href={INTERVENTIONS_BASE}>← Volver al listado</Link>
    <h1 className="text-2xl font-bold">Nueva solicitud de intervención</h1>
    {error ? <p role="alert" className="rounded-lg border p-3 text-sm">No se pudieron consultar las opciones: {error.message}. Ejecutá primero el SQL del formulario.</p> : <InterventionForm action={crearSolicitud} options={options ?? []} error={params.error}/>}
  </main>;
}
