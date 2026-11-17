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
};

type Respuesta = {
  ok?: boolean;
  error?: string;
  examinadas?: number;
  candidatas?: number;
  incorporadas?: number;
  solicitudesActualizadas?: number;
  detalles?: Detalle[];
};

export default function GeocodificarGeoref() {
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [total, setTotal] = useState(0);
  const [incorporadas, setIncorporadas] = useState(0);
  const [solicitudes, setSolicitudes] = useState(0);
  const [candidatas, setCandidatas] = useState(0);
  const [sinCoincidencia, setSinCoincidencia] = useState(0);
  const [detalles, setDetalles] = useState<Detalle[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const detenerRef = useRef(false);
  const ejecutandoRef = useRef(false);

  async function ejecutar(aplicar: boolean) {
    if (ejecutandoRef.current) return;

    ejecutandoRef.current = true;
    detenerRef.current = false;

    setProcesando(true);
    setProgreso(0);
    setTotal(0);
    setIncorporadas(0);
    setSolicitudes(0);
    setCandidatas(0);
    setSinCoincidencia(0);
    setDetalles([]);
    setMensaje("");
    setError("");

    try {
      // Reutilizamos la API manual, que ya lista
      // las direcciones pendientes con permisos Admin.
      const respuestaLista = await fetch(
        "/api/intervenciones-geocodificacion/manual",
        {
          cache: "no-store",
          credentials: "same-origin",
        },
      );

      const lista = await respuestaLista.json();

      if (!respuestaLista.ok) {
        throw new Error(
          lista.error ?? "No se pudieron cargar las direcciones.",
        );
      }

      const trabajos = (lista.trabajos ?? []) as Trabajo[];

      setTotal(trabajos.length);

      if (trabajos.length === 0) {
        setMensaje("No quedan direcciones en revisión.");
        return;
      }

      let examinadas = 0;
      let encontradas = 0;
      let guardadas = 0;
      let actualizadas = 0;
      let noEncontradas = 0;

      const acumuladas: Detalle[] = [];

      for (let i = 0; i < trabajos.length; i += 30) {
        if (detenerRef.current) {
          setMensaje("Procesamiento detenido.");
          break;
        }

        const lote = trabajos.slice(i, i + 30);

        setMensaje(
          `Consultando direcciones ${i + 1} a ${
            i + lote.length
          } de ${trabajos.length}...`,
        );

        const respuesta = await fetch(
          "/api/intervenciones-geocodificacion/georef",
          {
            method: "POST",
            cache: "no-store",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ids: lote.map((t) => t.trabajo_id),
              aplicar,
            }),
          },
        );

        const datos = (await respuesta.json()) as Respuesta;

        // Conservamos los resultados parciales, incluso
        // si el proveedor falló después de algunas consultas.
        acumuladas.push(...(datos.detalles ?? []));

        examinadas += datos.detalles?.length ?? 0;
        encontradas += datos.candidatas ?? 0;
        guardadas += datos.incorporadas ?? 0;
        actualizadas += datos.solicitudesActualizadas ?? 0;

        noEncontradas += (datos.detalles ?? []).filter(
          (d) => d.estado === "sin_coincidencia",
        ).length;

        setProgreso(examinadas);
        setCandidatas(encontradas);
        setIncorporadas(guardadas);
        setSolicitudes(actualizadas);
        setSinCoincidencia(noEncontradas);
        setDetalles([...acumuladas]);

        if (!respuesta.ok || datos.ok !== true) {
          throw new Error(
            datos.error ??
              "El procesamiento se interrumpió.",
          );
        }
      }

      if (!detenerRef.current) {
        setMensaje(
          aplicar
            ? "Procesamiento terminado. Las coordenadas recuperadas fueron guardadas."
            : "Vista previa terminada. No se modificó ninguna solicitud.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Error inesperado.",
      );
    } finally {
      setProcesando(false);
      ejecutandoRef.current = false;
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <Link
        href="/dashboard/solicitud-intervenciones/geocodificar"
        className="text-sm text-[#008C70] hover:underline"
      >
        ← Volver a georreferenciación
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">
          Georreferenciación automática — Georef Argentina
        </h1>

        <p className="text-sm text-muted-foreground">
          Busca direcciones en la base oficial argentina.
          Las coincidencias verificadas se pueden incorporar
          como ubicaciones estimadas.
        </p>
      </div>

      <section className="space-y-5 rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap gap-3">
          <button
            disabled={procesando}
            onClick={() => void ejecutar(false)}
            className="rounded-xl border px-5 py-3 text-sm font-semibold disabled:opacity-50"
          >
            Probar todas sin guardar
          </button>

          <button
            disabled={procesando}
            onClick={() => void ejecutar(true)}
            className="rounded-xl bg-[#00AE82] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Georreferenciar todas automáticamente
          </button>

          {procesando && (
            <button
              onClick={() => {
                detenerRef.current = true;
                setMensaje(
                  "Se detendrá al finalizar el lote actual.",
                );
              }}
              className="rounded-xl border border-red-300 px-5 py-3 text-sm text-red-600"
            >
              Detener
            </button>
          )}
        </div>

        {(procesando || total > 0) && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>
                {procesando
                  ? "Procesando direcciones..."
                  : "Proceso finalizado"}
              </span>
              <span>
                {progreso} / {total}
              </span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[#00AE82] transition-all"
                style={{
                  width: `${
                    total > 0
                      ? Math.min(
                          100,
                          (progreso / total) * 100,
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Examinadas", progreso],
            ["Candidatas encontradas", candidatas],
            ["Direcciones guardadas", incorporadas],
            ["Solicitudes actualizadas", solicitudes],
            ["Sin coincidencia", sinCoincidencia],
          ].map(([titulo, valor]) => (
            <div
              key={titulo}
              className="rounded-xl border p-3"
            >
              <p className="text-xs text-muted-foreground">
                {titulo}
              </p>
              <p className="mt-1 text-2xl font-bold">
                {valor}
              </p>
            </div>
          ))}
        </div>

        {mensaje && (
          <p role="status" className="text-sm">
            {mensaje}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {detalles.length > 0 && (
          <div className="max-h-[450px] space-y-2 overflow-y-auto">
            <h2 className="font-semibold">
              Resultados por dirección
            </h2>

            {detalles.map((detalle) => (
              <div
                key={detalle.id}
                className="rounded-xl border p-3 text-sm"
              >
                <p className="font-semibold">
                  {detalle.direccion}
                </p>
                <p className="text-xs text-muted-foreground">
                  {detalle.estado}
                  {" · "}
                  Solicitudes actualizadas:{" "}
                  {detalle.solicitudes}
                </p>

                {detalle.lat !== null &&
                  detalle.lon !== null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {detalle.lat.toFixed(7)},{" "}
                      {detalle.lon.toFixed(7)}
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