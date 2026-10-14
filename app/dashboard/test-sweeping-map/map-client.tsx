"use client";

import dynamic from "next/dynamic";

const TestSweepingMap = dynamic(
  () =>
    import(
      "@/components/sweeping-test/TestSweepingMap"
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border bg-background p-6 text-sm text-muted-foreground shadow-sm">
        Cargando mapa de barrido...
      </div>
    ),
  }
);

type MapClientProps = {
  readOnly?: boolean;
};

export default function MapClient({
  readOnly = false,
}: MapClientProps) {
  return (
    <TestSweepingMap readOnly={readOnly} />
  );
}
