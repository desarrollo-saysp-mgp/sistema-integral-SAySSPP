"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

import type { LatLngTuple } from "leaflet";

import StreetAutocomplete from "./StreetAutocomplete";

import "leaflet/dist/leaflet.css";

type StreetSegmentResponse = {
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  to_street: string;
  from_street: string;
  main_street: string;
};

function FitRoute({
  positions,
}: {
  positions: LatLngTuple[];
}) {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 0) return;

    map.fitBounds(positions, {
      padding: [40, 40],
    });
  }, [map, positions]);

  return null;
}

export default function TestSweepingMap() {
  const [street, setStreet] = useState("33");
  const [fromStreet, setFromStreet] = useState("40");
  const [toStreet, setToStreet] = useState("500");

  const [route, setRoute] = useState<LatLngTuple[]>([]);

  const [currentSegment, setCurrentSegment] =
    useState<StreetSegmentResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStreetSegment(
    mainStreet: string,
    from: string,
    to: string
  ) {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        street: mainStreet,
        from,
        to,
      });

      const response = await fetch(
        `/api/test-sweeping/segment?${params.toString()}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "No se pudo obtener el tramo."
        );
      }

      const segment = data as StreetSegmentResponse;

      const leafletPositions: LatLngTuple[] =
        segment.geometry.coordinates.map(([lng, lat]) => [
          lat,
          lng,
        ]);

      if (leafletPositions.length < 2) {
        throw new Error(
          "El tramo encontrado no tiene suficientes puntos."
        );
      }

      setRoute(leafletPositions);
      setCurrentSegment(segment);
    } catch (err) {
      console.error(err);

      setRoute([]);
      setCurrentSegment(null);

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al cargar el tramo."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanStreet = street.trim();
    const cleanFrom = fromStreet.trim();
    const cleanTo = toStreet.trim();

    if (!cleanStreet || !cleanFrom || !cleanTo) {
      setError(
        "Completá la calle principal, la calle desde y la calle hasta."
      );
      return;
    }

    await loadStreetSegment(
      cleanStreet,
      cleanFrom,
      cleanTo
    );
  }

  useEffect(() => {
    loadStreetSegment("33", "40", "500");
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-background p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            Probar tramo de barrido
          </h2>

          <p className="text-sm text-muted-foreground">
            Ingresá una calle principal y las dos calles que delimitan
            el tramo.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-4 md:grid-cols-4 md:items-end"
        >
          <StreetAutocomplete
            label="Calle principal"
            value={street}
            onChange={setStreet}
            placeholder="Escribí una calle..."
          />

          <StreetAutocomplete
            label="Desde calle"
            value={fromStreet}
            onChange={setFromStreet}
            placeholder="Escribí una calle..."
          />

          <StreetAutocomplete
            label="Hasta calle"
            value={toStreet}
            onChange={setToStreet}
            placeholder="Escribí una calle..."
          />

          <button
            type="submit"
            disabled={loading}
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Buscando..." : "Mostrar tramo"}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {currentSegment && !error && (
          <div className="mt-4 rounded-md border bg-muted/40 p-3">
            <div className="text-sm font-medium">
              Tramo encontrado
            </div>

            <div className="text-sm text-muted-foreground">
              {currentSegment.main_street} desde{" "}
              {currentSegment.from_street} hasta{" "}
              {currentSegment.to_street}
            </div>
          </div>
        )}
      </div>

      <div className="h-[650px] w-full overflow-hidden rounded-xl border">
        <MapContainer
          center={[-35.6585, -63.733]}
          zoom={15}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {route.length > 0 && (
            <>
              <Polyline
                positions={route}
                pathOptions={{
                  color: "#16a34a",
                  weight: 8,
                  opacity: 0.9,
                }}
              >
                <Tooltip sticky>
                  {currentSegment
                    ? `${currentSegment.main_street} — desde ${currentSegment.from_street} hasta ${currentSegment.to_street}`
                    : "Tramo de barrido"}
                </Tooltip>
              </Polyline>

              <FitRoute positions={route} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}