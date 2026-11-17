"use client";

import { useState } from "react";
import Link from "next/link";

type Resultado = {
  ok?: boolean;
  error?: string;
  direccionesExaminadas?: number;
  tramosOsmConsultados?: number;
  direccionesAplicadas?: number;
  solicitudesActualizadas?: number;
  ambiguas?: number;
  sinTramoVerificable?: number;
  errores?: string[];
};

export default function GeocodificarOSM() {
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function ejecutar() {
    if (cargando) return;

    setCargando(true);
    setResultado(null);

    try {
      const response = await fetch(
        "/api/intervenciones-geocodificacion/osm",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        },
      );

      const data: Resultado = await response.json();

      setResultado(
        response.ok
          ? data
          : { error: data.error ?? "No se pudo ejecutar." },
      );
    } catch {
      setResultado({ error: "Error de conexión." });
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <Link
        href="/dashboard/solicitud-intervenciones/geocodificar"
        className="text-sm text-[#008C70] hover:underline"
      >
        Volver a georreferenciación
      </Link>

      <h1 className="text-2xl font-bold">
        Georreferenciación aproximada con OpenStreetMap
      </h1>

      <p className="text-sm text-muted-foreground">
        Busca tramos reales de numeración y ubica las
        solicitudes como estimadas cuando puede identificar
        un único tramo compatible.
      </p>

      <button
        type="button"
        onClick={ejecutar}
        disabled={cargando}
        className="rounded-xl bg-[#00A27F] px-5 py-3 font-semibold text-white disabled:opacity-50"
      >
        {cargando
          ? "Consultando OpenStreetMap..."
          : "Georreferenciar por numeración OSM"}
      </button>

      {resultado?.error && (
        <p role="alert" className="text-red-600">
          {resultado.error}
        </p>
      )}

      {resultado && !resultado.error && (
        <div className="space-y-2 rounded-xl border p-4">
          <p>Direcciones examinadas: {resultado.direccionesExaminadas ?? 0}</p>
          <p>Tramos OSM consultados: {resultado.tramosOsmConsultados ?? 0}</p>
          <p>Direcciones incorporadas: {resultado.direccionesAplicadas ?? 0}</p>
          <p>Solicitudes georreferenciadas: {resultado.solicitudesActualizadas ?? 0}</p>
          <p>Direcciones ambiguas: {resultado.ambiguas ?? 0}</p>
          <p>Sin tramo verificable: {resultado.sinTramoVerificable ?? 0}</p>

          <Link
            href="/dashboard/solicitud-intervenciones/mapa"
            className="inline-block text-[#008C70] underline"
          >
            Ver árboles en el mapa
          </Link>
        </div>
      )}
    </main>
  );
}