"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPinned,
  Play,
  Square,
  TreePine,
} from "lucide-react";

type Modo = "normal" | "revision";

type Resumen = {
  consultadas: number;
  direccionesValidadas: number;
  solicitudesGeorreferenciadas: number;
  pendientesRevision: number;
  sinResultado: number;
  errores: number;
};

type Detalle = {
  direccion: string;
  estado: string;
  solicitudes: number;
  precision?: string | null;
};

type Resultado = {
  ok?: boolean;
  error?: string;
  modo?: Modo;
  trabajos?: number;
  resumen?: Resumen;
  detalles?: Detalle[];
};

const BASE = "/dashboard/solicitud-intervenciones";
const API = "/api/intervenciones-geocodificacion/lote";

const INICIAL: Resumen = {
  consultadas: 0,
  direccionesValidadas: 0,
  solicitudesGeorreferenciadas: 0,
  pendientesRevision: 0,
  sinResultado: 0,
  errores: 0,
};

const esperar = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function GeocodificarIntervenciones() {
  const [procesando, setProcesando] = useState(false);
  const [modoActivo, setModoActivo] = useState<Modo | null>(null);
  const [automatico, setAutomatico] = useState(false);
  const [deteniendo, setDeteniendo] = useState(false);

  const [lotes, setLotes] = useState(0);
  const [resumen, setResumen] = useState<Resumen>({ ...INICIAL });
  const [detalles, setDetalles] = useState<Detalle[]>([]);

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const ejecutandoRef = useRef(false);
  const detenerRef = useRef(false);

  async function ejecutarLote(modo: Modo): Promise<Resultado> {
    const response = await fetch(API, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ modo }),
    });

    const resultado = (await response.json()) as Resultado;

    if (!response.ok || resultado.ok !== true) {
      throw new Error(
        resultado.error ?? "No se pudo completar el lote.",
      );
    }

    return resultado;
  }

  function acumular(resultado: Resultado) {
    const r = resultado.resumen ?? INICIAL;

    setLotes((actual) => actual + 1);

    setResumen((actual) => ({
      consultadas: actual.consultadas + r.consultadas,
      direccionesValidadas:
        actual.direccionesValidadas + r.direccionesValidadas,
      solicitudesGeorreferenciadas:
        actual.solicitudesGeorreferenciadas +
        r.solicitudesGeorreferenciadas,
      pendientesRevision:
        actual.pendientesRevision + r.pendientesRevision,
      sinResultado: actual.sinResultado + r.sinResultado,
      errores: actual.errores + r.errores,
    }));

    setDetalles(resultado.detalles ?? []);
  }

  async function iniciar(modo: Modo, enAutomatico: boolean) {
    if (ejecutandoRef.current) return;

    ejecutandoRef.current = true;
    detenerRef.current = false;

    setProcesando(true);
    setModoActivo(modo);
    setAutomatico(enAutomatico);
    setDeteniendo(false);

    setLotes(0);
    setResumen({ ...INICIAL });
    setDetalles([]);
    setError("");

    let terminada = false;
    let completados = 0;

    const limite = enAutomatico ? 110 : 1;

    try {
      for (let i = 0; i < limite; i++) {
        if (detenerRef.current) {
          setMensaje("Procesamiento detenido.");
          break;
        }

        setMensaje(
          `${modo === "revision" ? "Revisando" : "Procesando"} lote ${i + 1}...`,
        );

        const resultado = await ejecutarLote(modo);

        if ((resultado.trabajos ?? 0) === 0) {
          terminada = true;
          setMensaje(
            modo === "revision"
              ? "No quedan direcciones para la segunda pasada."
              : "No quedan direcciones pendientes.",
          );
          break;
        }

        acumular(resultado);
        completados++;

        if ((resultado.resumen?.errores ?? 0) > 0) {
          throw new Error(
            "El lote tuvo errores. Se detuvo la carga.",
          );
        }

        if (!enAutomatico) {
          setMensaje("Lote completado.");
          break;
        }

        if (detenerRef.current) {
          setMensaje(
            "Detenido al finalizar el lote actual.",
          );
          break;
        }

        setMensaje(
          `Lote ${i + 1} completado. Preparando el siguiente...`,
        );

        await esperar(2000);
      }

      if (
        enAutomatico &&
        !terminada &&
        !detenerRef.current &&
        completados >= limite
      ) {
        setMensaje(
          "Se alcanzó el límite de lotes de esta ejecución.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Error inesperado.",
      );
      setMensaje(
        "Procesamiento interrumpido. Los resultados guardados se conservan.",
      );
    } finally {
      ejecutandoRef.current = false;
      detenerRef.current = false;

      setProcesando(false);
      setModoActivo(null);
      setAutomatico(false);
      setDeteniendo(false);
    }
  }

  function detener() {
    detenerRef.current = true;
    setDeteniendo(true);
    setMensaje("Se detendrá al finalizar el lote actual.");
  }

  const datos = [
    ["Consultas realizadas", resumen.consultadas],
    ["Direcciones validadas", resumen.direccionesValidadas],
    [
      "Solicitudes georreferenciadas",
      resumen.solicitudesGeorreferenciadas,
    ],
    ["Para revisar", resumen.pendientesRevision],
    ["Sin resultado", resumen.sinResultado],
    ["Errores", resumen.errores],
  ] as const;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <Link
        href={BASE}
        className="inline-flex items-center gap-2 text-sm text-[#008C70] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Solicitud de Intervenciones
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <TreePine className="h-7 w-7 text-[#00A27F]" />
          <h1 className="text-2xl font-bold">
            Georreferenciación de intervenciones
          </h1>
        </div>

        <p className="text-sm text-muted-foreground">
          Procesamiento automático de direcciones históricas.
          Las ubicaciones exactas se incorporan al mapa y
          las aproximadas quedan pendientes de revisión.
        </p>
      </header>

      <section className="space-y-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">
            Primera pasada
          </h2>

          <p className="text-sm text-muted-foreground">
            Procesa direcciones nuevas que todavía tengan
            estado pendiente.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={procesando}
              onClick={() => void iniciar("normal", false)}
              className="rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              Georreferenciar 10 direcciones
            </button>

            <button
              type="button"
              disabled={procesando}
              onClick={() => void iniciar("normal", true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#00A27F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#008C70] disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Procesar todas las pendientes
            </button>
          </div>
        </div>

        <div className="space-y-2 border-t pt-5">
          <h2 className="text-lg font-semibold">
            Segunda pasada — direcciones en revisión
          </h2>

          <p className="text-sm text-muted-foreground">
            Busca variantes de las 120 direcciones que no
            alcanzaron la precisión requerida en la primera
            pasada. Solo acepta nuevas coincidencias exactas.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={procesando}
              onClick={() => void iniciar("revision", false)}
              className="rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              Revisar 3 direcciones
            </button>

            <button
              type="button"
              disabled={procesando}
              onClick={() => void iniciar("revision", true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#00A27F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#008C70] disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Procesar todas las de revisión
            </button>
          </div>
        </div>

        {procesando && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-xl border border-[#00A27F]/30 bg-[#00A27F]/5 p-4"
          >
            <Loader2 className="h-5 w-5 animate-spin text-[#00A27F]" />
            <div>
              <p className="text-sm font-semibold">
                {modoActivo === "revision"
                  ? "Revisando direcciones..."
                  : "Georreferenciando direcciones..."}
              </p>
              <p className="text-xs text-muted-foreground">
                Mantené esta página abierta. Los lotes
                se ejecutan sin consultas paralelas.
              </p>
            </div>
          </div>
        )}

        {procesando && automatico && (
          <button
            type="button"
            disabled={deteniendo}
            onClick={detener}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Square className="h-4 w-4" />
            {deteniendo
              ? "Deteniendo..."
              : "Detener procesamiento"}
          </button>
        )}

        {mensaje && (
          <p className="text-sm font-medium">{mensaje}</p>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </p>
        )}

        {(lotes > 0 || procesando) && (
          <div className="space-y-5 border-t pt-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold">
                Progreso de esta ejecución
              </p>
              <span className="text-xs text-muted-foreground">
                {lotes} lotes completados
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {datos.map(([nombre, cantidad]) => (
                <div
                  key={nombre}
                  className="rounded-xl border p-4"
                >
                  <p className="text-xs text-muted-foreground">
                    {nombre}
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {cantidad.toLocaleString("es-AR")}
                  </p>
                </div>
              ))}
            </div>

            {detalles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#00A27F]" />
                  <h3 className="font-semibold">
                    Último lote procesado
                  </h3>
                </div>

                {detalles.map((item, index) => (
                  <div
                    key={`${index}-${item.direccion}`}
                    className="rounded-xl border p-3 text-sm"
                  >
                    <p className="font-medium">
                      {item.direccion}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.estado}
                      {" · "}
                      Solicitudes actualizadas:{" "}
                      {item.solicitudes}
                      {item.precision
                        ? ` · Precisión: ${item.precision}`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="border-t pt-5">
          <Link
            href={`${BASE}/mapa`}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-muted"
          >
            <MapPinned className="h-4 w-4" />
            Ver árboles en el mapa
          </Link>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        No ejecutes el procesamiento desde varias pestañas.
        Los contadores muestran solamente la ejecución actual.
        Las solicitudes ya georreferenciadas conservan sus
        coordenadas.
      </p>
    </main>
  );
}