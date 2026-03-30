import { Suspense } from "react";
import ComplaintsClient from "./complaints-client";

export default function ComplaintsPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando reclamos...</div>}>
      <ComplaintsClient />
    </Suspense>
  );
}