"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

type Trabajo = {
  trabajo_id: number;
  calle: string;
  altura: string;
};

type Punto = {
  lat: number;
  lng: number;
};

const API = "/api/intervenciones-geocodificacion/manual";

export default function GeocodificacionManual() {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<Leaflet.Map | null>(null);
  const marcadorRef = useRef<Leaflet.CircleMarker | null>(null);

  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [seleccionado, setSeleccionado] = useState<Trabajo | null>(null);
  const [punto, setPunto] = useState<Punto | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const cargarTrabajos = useCallback(async () => {
    const respuesta = await fetch(API, {
      cache: "no-store",
      credentials: "same-origin",
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(
        datos.error ?? "No se pudieron cargar las direcciones.",
      );
    }

    return (datos.trabajos ?? []) as Trabajo[];
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const lista = await cargarTrabajos();
        if (cancelado) return;

        setTrabajos(lista);
        setSeleccionado(lista[0] ?? null);
      } catch (e) {
        if (!cancelado) {
          setError(
            e instanceof Error ? e.message : "Error de carga.",
          );
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    void cargar();

    return () => {
      cancelado = true;
    };
  }, [cargarTrabajos]);

  useEffect(() => {
    let cancelado = false;

    async function crearMapa() {
      const L = await import("leaflet");

      if (
        cancelado ||
        !contenedorRef.current ||
        mapaRef.current
      ) {
        return;
      }

      const mapa = L.map(contenedorRef.current, {
        center: [-35.659, -63.757],
        zoom: 15,
        zoomControl: true,
      });

      mapaRef.current = mapa;

      L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        },
      ).addTo(mapa);

      mapa.on("click", (evento: Leaflet.LeafletMouseEvent) => {
        setPunto({
          lat: evento.latlng.lat,
          lng: evento.latlng.lng,
        });
      });

      setTimeout(() => {
        if (!cancelado) mapa.invalidateSize();
      }, 100);
    }

    void crearMapa();

    return () => {
      cancelado = true;

      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }

      marcadorRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function actualizarMarcador() {
      const L = await import("leaflet");

      if (cancelado || !mapaRef.current) return;

      if (marcadorRef.current) {
        marcadorRef.current.remove();
        marcadorRef.current = null;
      }

      if (!punto) return;

      marcadorRef.current = L.circleMarker(
        [punto.lat, punto.lng],
        {
          radius: 9,
          color: "#ffffff",
          weight: 3,
          fillColor: "#00AE82",
          fillOpacity: 1,
        },
      ).addTo(mapaRef.current);
    }

    void actualizarMarcador();

    return () => {
      cancelado = true;
    };
  }, [punto]);

  function seleccionar(trabajo: Trabajo) {
    setSeleccionado(trabajo);
    setPunto(null);
    setMensaje("");
    setError("");
  }

  async function guardar() {
    if (!seleccionado || !punto || guardando) return;

    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      const respuesta = await fetch(API, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: seleccionado.trabajo_id,
          latitud: punto.lat,
          longitud: punto.lng,
        }),
      });

      const datos = await respuesta.json();

      if (!respuesta.ok || datos.ok !== true) {
        throw new Error(
          datos.error ?? "No se pudo guardar.",
        );
      }

      const lista = await cargarTrabajos();

      setTrabajos(lista);

      const siguiente =
        lista.find(
          (t) => t.trabajo_id > seleccionado.trabajo_id,
        ) ??
        lista[0] ??
        null;

      setSeleccionado(siguiente);
      setPunto(null);

      setMensaje(
        `Ubicación estimada guardada. ` +
        `${datos.solicitudesActualizadas} solicitud(es) actualizada(s).`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Error al guardar.",
      );
    } finally {
      setGuardando(false);
    }
  }

  const filtrados = trabajos.filter((t) =>
    `${t.calle} ${t.altura}`
      .toLowerCase()
      .includes(busqueda.toLowerCase().trim()),
  );

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <Link
        href="/dashboard/solicitud-intervenciones/geocodificar"
        className="text-sm font-medium text-[#008C70] hover:underline"
      >
        ← Volver a georreferenciación
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          Ubicación aproximada de intervenciones
        </h1>

        <p className="text-sm text-muted-foreground">
          Elegí una dirección y marcá su cuadra sobre el
          mapa. Se guardará como ubicación estimada.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-3 rounded-2xl border bg-card p-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Direcciones pendientes de revisión
            </p>
            <p className="text-3xl font-bold text-[#008C70]">
              {trabajos.length}
            </p>
          </div>

          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar calle o altura..."
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-[#00AE82]"
          />

          <div className="max-h-[400px] space-y-2 overflow-y-auto">
            {cargando && (
              <p className="text-sm">Cargando direcciones...</p>
            )}

            {!cargando &&
              filtrados.map((trabajo) => {
                const activo =
                  seleccionado?.trabajo_id === trabajo.trabajo_id;

                return (
                  <button
                    type="button"
                    key={trabajo.trabajo_id}
                    onClick={() => seleccionar(trabajo)}
                    className={
                      "w-full rounded-xl border p-3 text-left text-sm transition " +
                      (activo
                        ? "border-[#00AE82] bg-[#00AE82]/10"
                        : "hover:bg-muted")
                    }
                  >
                    <span className="block font-semibold">
                      {trabajo.calle} {trabajo.altura}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      General Pico
                    </span>
                  </button>
                );
              })}

            {!cargando && filtrados.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay direcciones para mostrar.
              </p>
            )}
          </div>
        </aside>

        <section className="min-w-0 space-y-3 rounded-2xl border bg-card p-4">
          <div className="space-y-1">
            <h2 className="font-semibold">
              {seleccionado
                ? `${seleccionado.calle} ${seleccionado.altura}`
                : "Seleccioná una dirección"}
            </h2>

            <p className="text-sm text-muted-foreground">
              Acercate con la rueda del mouse y hacé clic
              aproximadamente en el centro de la cuadra correcta.
            </p>
          </div>

          <div
            ref={contenedorRef}
            className="h-[470px] w-full overflow-hidden rounded-xl border bg-muted"
            style={{ zIndex: 0 }}
          />

          {punto ? (
            <div className="rounded-xl border p-3 text-sm">
              <p className="font-medium">
                Punto seleccionado
              </p>
              <p className="text-muted-foreground">
                {punto.lat.toFixed(7)},{" "}
                {punto.lng.toFixed(7)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Si no es la cuadra correcta, hacé clic
                nuevamente sobre el mapa.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Todavía no seleccionaste ningún punto.
            </p>
          )}

          <button
            type="button"
            disabled={
              !seleccionado || !punto || guardando
            }
            onClick={() => void guardar()}
            className="w-full rounded-xl bg-[#00AE82] px-5 py-3 font-semibold text-white transition hover:bg-[#008C70] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {guardando
              ? "Guardando ubicación..."
              : "Guardar ubicación estimada"}
          </button>

          {mensaje && (
            <p
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
            >
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
        </section>
      </div>
    </main>
  );
}