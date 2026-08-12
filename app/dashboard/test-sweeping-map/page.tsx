import MapClient from "./map-client";

export default function TestSweepingMapPage() {
  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">
          Prueba – Mapa de Barrido
        </h1>

        <p className="text-muted-foreground">
          Primera prueba visual del mapa de General Pico.
        </p>
      </div>

      <MapClient />
    </main>
  );
}