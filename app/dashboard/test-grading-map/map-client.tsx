"use client";

import dynamic from "next/dynamic";

const TestGradingMap = dynamic(
  () =>
    import(
      "@/components/grading-test/TestGradingMap"
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border bg-background p-6 text-sm text-muted-foreground shadow-sm">
        Cargando mapa de motonivelación...
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
    <TestGradingMap readOnly={readOnly} />
  );
}
