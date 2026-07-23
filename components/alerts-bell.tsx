"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

type AlertSeverity = "high" | "medium" | "low";

type AlertItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  count?: number;
  complaintId?: number;
  complaintNumber?: number | string | null;
  serviceId?: number;
  serviceName?: string;
  zone?: string | null;
  createdAt?: string | null;
};

export default function AlertsBell() {
  const router = useRouter();
  const loadingRef = useRef(false);

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadAlerts = useCallback(async () => {
    if (loadingRef.current) return;

    try {
      loadingRef.current = true;
      setLoading(true);

      const response = await fetch("/api/alerts", {
        cache: "no-store",
      });

      if (!response.ok) {
        console.warn("No se pudieron cargar alertas:", response.status);
        setAlerts([]);
        return;
      }

      const data = await response.json();

      setAlerts(
        Array.isArray(data.alerts)
          ? data.alerts
          : Array.isArray(data.data)
            ? data.data
            : [],
      );
    } catch (error) {
      console.warn("Error cargando alertas:", error);
      setAlerts([]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  const handleViewAllAlerts = () => {
    setNavigating(true);
    setOpen(false);
    router.push("/alertas-reclamos");
  };

  useEffect(() => {
    void loadAlerts();

    const interval = window.setInterval(() => {
      void loadAlerts();
    }, 60000);

    return () => window.clearInterval(interval);
  }, [loadAlerts]);

  const total = alerts.length;

  const getSeverityClass = (severity: AlertSeverity) => {
    if (severity === "high") {
      return "border-red-500 bg-red-50 text-red-700 hover:bg-red-100";
    }

    if (severity === "medium") {
      return "border-yellow-500 bg-yellow-50 text-yellow-700 hover:bg-yellow-100";
    }

    return "border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100";
  };

  const loader =
    mounted && navigating
      ? createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-white/40 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-6 shadow-xl">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#00A27F]/20 border-t-[#00A27F]" />
              <p className="text-sm font-medium text-[#4B5563]">
                Cargando...
              </p>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {loader}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E3DE] bg-white text-[#373737] shadow-sm transition hover:bg-[#00A27F]/10 hover:text-[#00A27F]"
          title="Alertas"
        >
          <Bell className="h-5 w-5" />

          {total > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
              {total}
            </span>
          )}
        </button>

        {open && (
          <div
            className="
              fixed left-4 right-4 top-24 z-[60]
              max-h-[72vh] overflow-hidden
              rounded-xl border border-[#D8E3DE] bg-white shadow-xl

              sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3
              sm:w-96 sm:max-w-none sm:max-h-none
            "
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#D8E3DE] px-4 py-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-[#1F2937]">Alertas</h3>
                <p className="text-xs text-[#6B7280]">
                  Reclamos que requieren atención
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadAlerts()}
                className="shrink-0 rounded-md px-2 py-1 text-xs text-[#6B7280] hover:bg-gray-100"
              >
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-3 sm:max-h-96">
              {alerts.length === 0 ? (
                <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-[#6B7280]">
                  No hay alertas activas.
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.slice(0, 5).map((alert) => {
                    const content = (
                      <div
                        className={`rounded-lg border-l-4 p-3 transition ${getSeverityClass(
                          alert.severity,
                        )}`}
                      >
                        <p className="text-sm font-semibold">{alert.title}</p>
                        <p className="mt-1 text-xs">{alert.description}</p>

                        {alert.complaintId && (
                          <p className="mt-2 text-xs font-semibold underline">
                            Ver detalle del reclamo
                          </p>
                        )}
                      </div>
                    );

                    if (alert.complaintId) {
                      return (
                        <Link
                          key={alert.id}
                          href={`/dashboard/complaints/${alert.complaintId}/view`}
                          onClick={() => setOpen(false)}
                          className="block"
                        >
                          {content}
                        </Link>
                      );
                    }

                    return <div key={alert.id}>{content}</div>;
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-[#D8E3DE] p-3">
              <button
                type="button"
                onClick={handleViewAllAlerts}
                disabled={navigating}
                className="block w-full rounded-lg bg-gray-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Ver todas las alertas
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}