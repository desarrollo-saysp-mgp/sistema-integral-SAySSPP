import Link from "next/link";
import { notFound } from "next/navigation";
import { getInterventionAccess, INTERVENTIONS_BASE } from "../../_access";
import { editarSolicitud } from "../../_actions";
import { InterventionForm } from "../../_form";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> };
export default async function EditarSolicitud({ params, searchParams }: Props) {
  const { supabase } = await getInterventionAccess(true);
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id)) notFound();
  const [{ data: row, error: rowError }, { data: options, error: optionsError }] = await Promise.all([
    supabase.from("solicitudes_intervencion").select("id, expediente, fecha, fecha_original, nombre_apellido, tipo, cantidad, especie, ubicacion_calle, estado, derivacion, retirado").eq("id", id).single(),
    supabase.rpc("opciones_formulario_intervenciones"),
  ]);
  if (rowError || !row) notFound();
  const query = await searchParams;
  return <main className="w-full space-y-5 px-3 py-5 sm:px-6 lg:px-8">
    <Link className="text-sm text-[#008C70]" href={INTERVENTIONS_BASE}>← Volver al listado</Link>
    <h1 className="text-2xl font-bold">Editar solicitud · Expediente {row.expediente}</h1>
    {optionsError ? <p role="alert" className="rounded-lg border p-3 text-sm">Error al consultar opciones: {optionsError.message}</p> : <InterventionForm row={row} options={options ?? []} action={editarSolicitud.bind(null, id)} error={query.error}/>}
  </main>;
}
