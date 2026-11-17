"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { LoaderCircle, Pencil } from "lucide-react";

/** Indicador inmediato durante la navegación al formulario de edición. */
export function EditInterventionLink({
  href,
  mobile = false,
}: {
  href: string;
  mobile?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    // Respetar abrir en pestaña nueva, descargas y clics con modificadores.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;

    if (loading) {
      event.preventDefault();
      return;
    }
    setLoading(true);
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      aria-busy={loading}
      className={
        mobile
          ? "inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-[#008C70] hover:underline dark:text-[#00D6AA]"
          : "inline-flex min-h-8 items-center gap-1.5 font-medium text-[#008C70] hover:underline dark:text-[#00D6AA]"
      }
    >
      {loading ? (
        <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span aria-live="polite">
        {loading ? "Cargando..." : mobile ? "Editar solicitud" : "Editar"}
      </span>
    </Link>
  );
}
