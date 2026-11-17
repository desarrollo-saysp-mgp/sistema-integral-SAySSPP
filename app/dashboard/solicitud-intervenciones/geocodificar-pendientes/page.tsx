"use client";

import { useState } from "react";
import Link from "next/link";

type Item = { id:string; expediente?:string|null; nombre?:string|null; direccion?:string|null; estado:string; latitud?:number; longitud?:number };
const API="/api/solicitud-intervenciones/geocodificar-pendientes";
export default function GeocodificarPendientes() {
  const [offset,setOffset]=useState(0);
  const [items,setItems]=useState<Item[]>([]);
  const [checked,setChecked]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [saved,setSaved]=useState<string[]>([]);
  const [next,setNext]=useState(0);
  async function request(payload:object) {
    const res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const data=await res.json();
    if(!res.ok) throw new Error(data.error||`Error HTTP ${res.status}`);
    return data;
  }
  async function preview(start:number) {
    setBusy(true);setMessage("");setChecked([]);setItems([]);
    try {const r=await request({mode:"preview",offset:start});setItems(r.resultados);setOffset(start);setNext(r.siguiente);}
    catch(e){setMessage(e instanceof Error?e.message:"Error inesperado");}
    finally{setBusy(false);}
  }
  async function save() {
    setBusy(true);setMessage("");
    const registros=items.filter(x=>checked.includes(x.id)&&x.estado==="Revisar"&&x.latitud!==undefined&&x.longitud!==undefined&&x.direccion).map(x=>({id:x.id,latitud:x.latitud!,longitud:x.longitud!,direccion:x.direccion!}));
    try {
      const r=await request({mode:"save",registros});
      const ok=r.resultados.filter((x:{ok:boolean})=>x.ok).map((x:{id:string})=>x.id);
      setSaved(prev=>[...prev,...ok]);setChecked([]);
      setItems(prev=>prev.map(x=>ok.includes(x.id)?{...x,estado:"Guardada"}:x));
      setMessage(`Se guardaron ${ok.length} de ${registros.length} ubicaciones. ${r.resultados.filter((x:{ok:boolean})=>!x.ok).map((x:{error?:string})=>x.error).join("; ")}`);
    }catch(e){setMessage(e instanceof Error?e.message:"Error inesperado");}
    finally{setBusy(false);}
  }
  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
    <Link href="/dashboard/solicitud-intervenciones/mapa" className="text-sm text-[#008C70]">← Volver al mapa</Link>
    <h1 className="text-2xl font-bold">Revisar coordenadas de 36 direcciones corregidas</h1>
    <p className="text-sm text-muted-foreground">Buscamos las coordenadas con el geocodificador actual. <strong>No se guarda nada hasta que marques las coincidencias verificadas y presiones Guardar.</strong> Si no aparece un resultado confiable, ubicá la solicitud manualmente desde el mapa.</p>
    <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={()=>preview(0)} className="rounded-xl bg-[#00A27F] px-4 py-2 font-semibold text-white disabled:opacity-50">Comenzar revisión</button>
    {items.length>0 && next<36 && <button disabled={busy} onClick={()=>preview(next)} className="rounded-xl border px-4 py-2 disabled:opacity-50">Siguiente tanda de 5 →</button>}
    </div>
    {items.length>0 && <p className="text-sm">Tanda {offset+1}–{Math.min(next,36)} de 36 · Guardadas en esta sesión: {saved.length}</p>}
    {busy && <p role="status" className="text-sm">Procesando…</p>}
    {message && <p role="status" className="rounded-lg border p-3 text-sm">{message}</p>}
    {items.length>0 && <div className="space-y-3">{items.map(x=><article key={x.id} className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap justify-between gap-2"><div><strong>Exp. {x.expediente ?? "—"}</strong> · {x.nombre ?? "—"}</div><span className="text-sm font-medium">{x.estado}</span></div>
      <p className="mt-1 text-sm text-muted-foreground">{x.direccion || "Sin dirección"}</p>
      {x.estado==="Revisar"&&x.latitud!==undefined&&x.longitud!==undefined && <div className="mt-3 space-y-2">
        <p className="text-sm">Coordenadas propuestas: {x.latitud.toFixed(6)}, {x.longitud.toFixed(6)}</p>
        <a className="inline-block text-sm font-medium text-[#008C70] underline" href={`https://www.openstreetmap.org/?mlat=${x.latitud}&mlon=${x.longitud}#map=18/${x.latitud}/${x.longitud}`} target="_blank" rel="noopener noreferrer">Ver ubicación en OpenStreetMap ↗</a>
        <label className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm"><input type="checkbox" className="mt-1" checked={checked.includes(x.id)} disabled={busy} onChange={e=>setChecked(prev=>e.target.checked?[...prev,x.id]:prev.filter(id=>id!==x.id))}/><span>Verifiqué este punto en el mapa y confirmo que corresponde a la dirección.</span></label>
      </div>}
    </article>)}
    <button disabled={busy||checked.length===0} onClick={save} className="rounded-xl bg-[#00A27F] px-5 py-3 font-semibold text-white disabled:opacity-50">Guardar {checked.length} ubicaciones confirmadas</button></div>}
    <p className="text-xs text-muted-foreground">Herramienta de revisión exclusiva para administradores. Solo alcanza los 36 UUID previamente verificados; no modifica direcciones, pines existentes ni solicitudes de otros módulos.</p>
  </main>;
}
