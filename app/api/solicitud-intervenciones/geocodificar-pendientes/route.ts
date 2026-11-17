import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerLatLon } from "@/lib/geocoding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lista CERRADA: solo los 36 UUID verificados en noviembre de 2026.
const IDS = [
  "2ff16426-c783-46d5-8738-e0078cd0fe82",
  "d279fb7a-94c6-4687-bc80-2e233d79bfc6",
  "3ffee7c1-ee40-4ad2-825a-47c34889343a",
  "cd8bcb10-01fe-443b-b932-fe59c4b492be",
  "8c54d21e-a010-4065-9389-2bc2d8ca5a7a",
  "e063f532-483a-4f5e-ad71-731a907f1f4c",
  "a42daad6-3285-437d-919e-001be8dc50cf",
  "5c2eab37-1339-48a6-8185-9ed70d0c007d",
  "f57b83e7-4094-4865-a99a-3a7b8babda43",
  "3d298a02-533e-4de6-a4f2-2a373d2f446d",
  "957ddef9-fb72-414c-8c29-edc54478ea0e",
  "8852a589-6296-4217-8d4b-88d619101c4f",
  "eaee4b15-1f94-40ec-bb06-eef25ddaa9ed",
  "b800e8cf-5f84-4a68-a0cb-7bdc909f89c2",
  "218fd6a8-f136-4a02-9073-c596c25559c0",
  "d99b2bdd-d5f6-4ee3-b1a3-28784998b4a1",
  "9dd4bfc1-1268-4fa2-b9f4-900fbd67f97a",
  "6a0d2cb2-0ed4-431f-8819-7ac632feb2db",
  "23e6a7d5-d4be-4616-a37c-ceadb66bb74f",
  "5ace4b91-f09f-456e-adc6-3c1b5e0fc3a7",
  "8c904b46-0797-45c3-8eb3-d2e1a09808ab",
  "acbe1180-7c75-4e65-b804-ac961823b4bf",
  "7c2ed543-58fc-4147-8022-27c9cf4b1f2b",
  "80186de6-ddca-4bd9-ba3a-18aca17b56bf",
  "a970cac3-b86a-4130-aea8-f60e58118367",
  "1a750cb5-dbc3-4735-888c-d670c504f1b7",
  "326812fa-10b7-4bb2-8e90-1b64fe9f87eb",
  "24076683-b6be-4629-9ddc-18722a115c62",
  "76fdceaf-2ed3-4299-bfba-9937625b59c8",
  "582ca30a-0647-4099-b1e1-af8aac1ab52d",
  "89462160-9d81-42a8-8a4c-5bdfaa2b8925",
  "54436509-e21d-4414-98f1-163c91b9441c",
  "004a6898-a0e4-4908-84d2-431a7c6bce0b",
  "4dccdb79-147b-4084-b750-14793e26bc84",
  "17bd1f58-98cc-4ee1-9f5a-e7539cabb8f3",
  "f1de24eb-8371-40fd-b7d8-0fd0bbfcdcc6"
] as const;
const allowedIds = new Set<string>(IDS);
const BATCH = 5;

type Registro = { id: string; expediente: string | null; nombre_apellido: string | null; ubicacion_calle: string | null; calle: string | null; altura: string | null; latitud: number | null; longitud: number | null };

async function admin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, autorizado: false };
  const { data: profile, error: profileError } = await supabase.from("users").select("role,is_readonly").eq("id", user.id).single();
  return { supabase, autorizado: !profileError && String(profile?.role ?? "").trim().toLowerCase() === "admin" && profile?.is_readonly !== true };
}
function parseGeo(raw: string) {
  const parts = raw.split(",").map(x => x.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const latitud = Number(parts[0]); const longitud = Number(parts[1]);
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;
  // Filtro geográfico aproximado de seguridad, NO validación del domicilio.
  const rad = Math.PI / 180;
  const dLat = (latitud + 35.669) * rad;
  const dLng = (longitud + 63.747) * rad;
  const a = Math.sin(dLat/2)**2 + Math.cos(-35.669*rad)*Math.cos(latitud*rad)*Math.sin(dLng/2)**2;
  const km = 6371 * 2 * Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
  return km <= 12 ? {latitud,longitud} : null;
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return NextResponse.json({error:"Origen no permitido"},{status:403});
  const {supabase, autorizado} = await admin();
  if (!autorizado) return NextResponse.json({error:"Solo administradores pueden ejecutar esta revisión"},{status:403});
  let body: {mode?: string; offset?: number; registros?: {id:string; latitud:number; longitud:number; direccion:string}[]};
  try { body = await req.json(); } catch {return NextResponse.json({error:"JSON inválido"},{status:400});}
  if (body.mode === "preview") {
    const offset = body.offset;
    if (!Number.isInteger(offset) || (offset as number) < 0 || (offset as number) >= IDS.length) return NextResponse.json({error:"Tanda inválida"},{status:400});
    const subset = IDS.slice(offset as number, (offset as number)+BATCH);
    const {data, error} = await supabase.from("solicitudes_intervencion").select("id,expediente,nombre_apellido,ubicacion_calle,calle,altura,latitud,longitud").in("id", subset);
    if (error) return NextResponse.json({error:error.message},{status:500});
    const dict = new Map(((data??[]) as Registro[]).map(row=>[row.id,row]));
    const resultados = [];
    for (const id of subset) {
      const row = dict.get(id);
      if (!row) {resultados.push({id,estado:"No se encontró o no hay permiso"}); continue;}
      const base = {id, expediente:row.expediente, nombre:row.nombre_apellido, direccion:row.ubicacion_calle};
      if (row.latitud != null || row.longitud != null) {resultados.push({...base,estado:"Ya tiene coordenadas"});continue;}
      if (!row.calle || !row.altura) {resultados.push({...base,estado:"Falta calle o altura"});continue;}
      try {
        const raw = await obtenerLatLon(row.calle,row.altura,{timeoutMs:2500});
        const geo = parseGeo(raw);
        resultados.push({...base, estado:geo ? "Revisar" : "Sin coincidencia local verificable", ...(geo??{})});
      } catch {resultados.push({...base,estado:"Error en servicio de geocodificación"});}
    }
    return NextResponse.json({ok:true, total:IDS.length, offset, siguiente:Math.min(IDS.length,(offset as number)+BATCH), resultados});
  }
  if (body.mode === "save") {
    const registros = body.registros;
    if (!Array.isArray(registros) || !registros.length || registros.length > BATCH) return NextResponse.json({error:"Elegí entre 1 y 5 registros"},{status:400});
    const resultados=[];
    for (const item of registros) {
      if (!item || !allowedIds.has(item.id) || typeof item.direccion !== "string") {resultados.push({id:item?.id??"?",ok:false,error:"Registro no autorizado"});continue;}
      const latitud = Number(item.latitud), longitud=Number(item.longitud);
      const geo = parseGeo(`${latitud},${longitud}`);
      if (!geo) {resultados.push({id:item.id,ok:false,error:"Coordenadas fuera de General Pico"});continue;}
      // Solo guarda si la dirección que revisó el usuario sigue igual y no hay coordenadas.
      const {data,error} = await supabase.from("solicitudes_intervencion")
        .update({latitud:geo.latitud,longitud:geo.longitud,precision_geocodificacion:"estimada"})
        .eq("id",item.id).eq("ubicacion_calle",item.direccion)
        .is("latitud",null).is("longitud",null)
        .select("id").maybeSingle();
      resultados.push({id:item.id,ok:!error && !!data,error:error?.message ?? (data ? undefined : "No se actualizó: cambió la dirección, ya tiene coordenadas o faltan permisos")});
    }
    return NextResponse.json({ok:true,resultados});
  }
  return NextResponse.json({error:"Modo no admitido"},{status:400});
}
