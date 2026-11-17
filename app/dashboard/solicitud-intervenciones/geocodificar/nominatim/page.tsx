"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type Trabajo = {
  trabajo_id: number;
  calle: string;
  altura: string;
};

type Detalle = {
  id: number;
  direccion: string;
  estado: string;
  solicitudes: number;
  lat: number | null;
  lon: number | null;
  calleDetectada?: string | null;
  observacion?: string;
};

type Respuesta = {
  ok?: boolean;
  error?: string;
  candidatas?: number;
  incorporadas?: number;
  solicitudesActualizadas?: number;
  callesSinAltura?: number;
  ambiguas?: number;
  sinCoincidencia?: number;
  detalles?: Detalle[];
};

function nombreEstado(estado: string): string {
  switch (estado) {
    case "candidata": return "Dirección y altura encontradas";
    case "incorporada": return "Guardada como estimada";
    case "calle_encontrada_altura_no_verificada": return "Calle encontrada · altura no verificada";
    case "calle_ambigua": return "Ubicación ambigua · requiere revisión";
    case "sin_coincidencia": return "Calle no confirmada en la búsqueda";
    case "sin_solicitudes_pendientes": return "Sin solicitudes pendientes para guardar";
    default: return estado;
  }
}

export default function GeocodificarNominatim() {
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [total, setTotal] = useState(0);
  const [candidatas, setCandidatas] = useState(0);
  const [guardadas, setGuardadas] = useState(0);
  const [solicitudes, setSolicitudes] = useState(0);
  const [callesSinAltura, setCallesSinAltura] = useState(0);
  const [ambiguas, setAmbiguas] = useState(0);
  const [noConfirmadas, setNoConfirmadas] = useState(0);
  const [resultados, setResultados] = useState<Detalle[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const ejecutando = useRef(false);
  const detener = useRef(false);

  async function iniciar(aplicar: boolean, soloTres: boolean) {
    if (ejecutando.current) return;
    ejecutando.current = true;
    detener.current = false;
    setProcesando(true);
    setProgreso(0);
    setTotal(0);
    setCandidatas(0);
    setGuardadas(0);
    setSolicitudes(0);
    setCallesSinAltura(0);
    setAmbiguas(0);
    setNoConfirmadas(0);
    setResultados([]);
    setMensaje("");
    setError("");

    try {
      const listaResponse = await fetch(
        "/api/intervenciones-geocodificacion/manual",
        { cache: "no-store", credentials: "same-origin" },
      );
      const listaJson = await listaResponse.json();
      if (!listaResponse.ok) {
        throw new Error(listaJson.error ?? "Error cargando direcciones.");
      }
      const lista = (listaJson.trabajos ?? []) as Trabajo[];
      const trabajos = soloTres ? lista.slice(0, 3) : lista;
      setTotal(trabajos.length);
      if (trabajos.length === 0) {
        setMensaje("No quedan direcciones en revisión.");
        return;
      }

      let examinadas = 0;
      let encontradas = 0;
      let incorporadas = 0;
      let actualizadas = 0;
      let calles = 0;
      let dudas = 0;
      let ninguna = 0;
      const acumuladas: Detalle[] = [];

      for (let i = 0; i < trabajos.length; i += 3) {
        if (detener.current) break;
        const lote = trabajos.slice(i, i + 3);
        setMensaje(`Consultando ${i + 1} a ${i + lote.length} de ${trabajos.length}...`);

        const response = await fetch(
          "/api/intervenciones-geocodificacion/nominatim",
          {
            method: "POST",
            cache: "no-store",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ids: lote.map((t) => t.trabajo_id),
              aplicar,
            }),
          },
        );

        const data = (await response.json()) as Respuesta;
        const recibidos = data.detalles ?? [];
        acumuladas.push(...recibidos);
        examinadas += recibidos.length;
        encontradas += data.candidatas ?? 0;
        incorporadas += data.incorporadas ?? 0;
        actualizadas += data.solicitudesActualizadas ?? 0;
        calles += data.callesSinAltura ?? 0;
        dudas += data.ambiguas ?? 0;
        ninguna += data.sinCoincidencia ?? 0;

        setProgreso(examinadas);
        setCandidatas(encontradas);
        setGuardadas(incorporadas);
        setSolicitudes(actualizadas);
        setCallesSinAltura(calles);
        setAmbiguas(dudas);
        setNoConfirmadas(ninguna);
        setResultados([...acumuladas]);

        if (!response.ok || data.ok !== true) {
          throw new Error(data.error ?? "El procesamiento se interrumpió.");
        }
        if (i + 3 < trabajos.length) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      setMensaje(
        detener.current
          ? "Proceso detenido al finalizar un lote."
          : aplicar
            ? incorporadas > 0
              ? `Finalizado: ${incorporadas} direcciones guardadas, ${actualizadas} solicitudes actualizadas.`
              : "Finalizado: no hubo nuevas direcciones verificadas para guardar."
            : "Prueba finalizada. No se modificó ninguna solicitud.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setProcesando(false);
      ejecutando.current = false;
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8">
      <Link
        href="/dashboard/solicitud-intervenciones/geocodificar"
        className="text-sm text-[#008C70] hover:underline"
      >
        ← Volver a georreferenciación
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Georreferenciación — OpenStreetMap / Nominatim</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Diferencia las direcciones completas de las calles cuya altura todavía no pudo verificarse.
          Solo guarda ubicaciones con calle y número coincidentes.
        </p>
      </div>

      <section className="space-y-5 rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap gap-3">
          <button
            disabled={procesando}
            onClick={() => void iniciar(false, true)}
            className="rounded-xl border px-5 py-3 text-sm font-semibold disabled:opacity-50"
          >
            Probar 3 sin guardar
          </button>
          <button
            disabled={procesando}
            onClick={() => void iniciar(false, false)}
            className="rounded-xl border px-5 py-3 text-sm font-semibold disabled:opacity-50"
          >
            Probar todas sin guardar
          </button>
          <button
            disabled={procesando}
            onClick={() => void iniciar(true, false)}
            className="rounded-xl bg-[#00AE82] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Guardar coincidencias verificadas
          </button>
          {procesando && (
            <button
              onClick={() => { detener.current = true; }}
              className="rounded-xl border border-red-300 px-5 py-3 text-sm text-red-600"
            >
              Detener al finalizar el lote
            </button>
          )}
        </div>

        {total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{procesando ? "Procesando..." : "Proceso finalizado"}</span>
              <span>{progreso} / {total}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-[#00AE82] transition-all" style={{ width: `${(progreso / total) * 100}%` }} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            ["Examinadas", progreso],
            ["Dirección y altura encontradas", candidatas],
            ["Calle sin altura verificada", callesSinAltura],
            ["Ambiguas", ambiguas],
            ["Calle no confirmada", noConfirmadas],
            ["Direcciones guardadas", guardadas],
            ["Solicitudes actualizadas", solicitudes],
          ].map(([titulo, valor]) => (
            <div key={titulo} className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">{titulo}</p>
              <p className="mt-1 text-2xl font-bold">{valor}</p>
            </div>
          ))}
        </div>

        {mensaje && <p role="status" className="text-sm">{mensaje}</p>}
        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {resultados.length > 0 && (
          <div className="max-h-[500px] space-y-2 overflow-y-auto">
            {resultados.map((r) => (
              <div key={r.id} className="rounded-xl border p-3 text-sm">
                <p className="font-semibold">{r.direccion}</p>
                <p className="text-xs text-muted-foreground">
                  {nombreEstado(r.estado)} · Solicitudes actualizadas: {r.solicitudes}
                </p>
                {r.calleDetectada && (
                  <p className="mt-1 text-xs text-muted-foreground">Nombre encontrado: {r.calleDetectada}</p>
                )}
                {r.observacion && <p className="mt-1 text-xs text-muted-foreground">{r.observacion}</p>}
                {r.lat !== null && r.lon !== null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.lat.toFixed(7)}, {r.lon.toFixed(7)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
