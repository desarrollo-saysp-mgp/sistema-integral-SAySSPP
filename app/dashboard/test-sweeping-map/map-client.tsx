"use client";

import dynamic from "next/dynamic";

const TestSweepingMap = dynamic(
  () => import("@/components/sweeping-test/TestSweepingMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[650px] items-center justify-center rounded-xl border">
        Cargando mapa...
      </div>
    ),
  }
);

export default function MapClient() {
  return <TestSweepingMap />;
}