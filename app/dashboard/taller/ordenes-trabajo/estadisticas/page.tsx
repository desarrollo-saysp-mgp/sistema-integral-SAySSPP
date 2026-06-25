import { WorkOrdersStatsClient } from "@/components/taller/WorkOrdersStatsClient";

export default function WorkOrdersStatsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Estadísticas de Órdenes de Trabajo
        </h1>
        <p className="text-muted-foreground">
          Análisis general de órdenes, vehículos, fallas, estados, proveedores y montos.
        </p>
      </div>

      <WorkOrdersStatsClient />
    </div>
  );
}