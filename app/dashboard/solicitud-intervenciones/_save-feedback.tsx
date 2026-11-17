"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/** Muestra el aviso solo tras una redirección confirmada por la acción de servidor. */
export function InterventionSaveFeedback({ status }: { status: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "creado" && status !== "editado") return;
    const current = searchParams.toString();
    if (shown.current === current) return;
    shown.current = current;

    toast.success(status === "creado" ? "Solicitud cargada correctamente" : "Solicitud actualizada correctamente", {
      duration: 3500,
    });

    // Limpiamos el parámetro para que no vuelva a mostrar el aviso al recargar.
    const params = new URLSearchParams(current);
    params.delete("guardado");
    const query = params.toString();
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }, [status, pathname, searchParams]);

  // El layout principal ya tiene un Toaster global. No montar un segundo.
  return null;
}
