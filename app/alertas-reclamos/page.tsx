import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { getAlerts } from "@/lib/get-alerts";
import { AlertsPageClient } from "@/components/alerts/alerts-page-client";

export default async function AlertasReclamosPage() {
  const data = await getAlerts();

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <Link
            href="/dashboard/complaints/home"
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[#00A27F] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al dashboard
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00A27F]/12 text-[#00A27F]">
              <Bell className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Alertas de reclamos
              </h1>

              <p className="text-sm text-muted-foreground">
                Reclamos que requieren atención según reglas automáticas.
              </p>
            </div>
          </div>
        </div>

        <AlertsPageClient alerts={data.alerts} />
      </div>
    </main>
  );
}