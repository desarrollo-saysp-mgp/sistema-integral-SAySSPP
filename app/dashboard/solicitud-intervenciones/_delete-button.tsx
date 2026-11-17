"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { eliminarSolicitud } from "./_actions";

type Props = {
  id: string;
  expediente: string;
  nombre: string;
};

export function DeleteInterventionButton({ id, expediente, nombre }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    // Mantiene el dialogo usable y evita desplazar la pagina por detras.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, pending]);

  const closeDialog = () => {
    if (pending) return;
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const confirmDelete = () => {
    if (pending) return;

    startTransition(async () => {
      try {
        const result = await eliminarSolicitud(id);
        if (!result.ok) {
          toast.error(result.error ?? "No se pudo eliminar la solicitud.");
          return;
        }

        setOpen(false);
        toast.success("Solicitud eliminada correctamente.");
        router.refresh();
      } catch {
        toast.error("No se pudo eliminar la solicitud.");
      }
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-rose-600 transition-colors hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:text-rose-400"
        aria-label={`Eliminar solicitud ${expediente}`}
      >
        <Trash2 className="h-3.5 w-3.5 shrink-0" />
        Eliminar
      </button>

      {mounted && open &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/55 p-3 backdrop-blur-[2px] sm:p-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeDialog();
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              className="my-auto w-full max-w-[440px] min-w-0 overflow-hidden rounded-2xl border border-border bg-background p-5 text-foreground shadow-2xl sm:p-6"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <Trash2 className="h-4 w-4" />
                  </div>
                  <h2 id={titleId} className="min-w-0 text-base font-semibold leading-snug sm:text-lg">
                    Eliminar solicitud
                  </h2>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={closeDialog}
                  aria-label="Cerrar"
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div id={descriptionId} className="mt-4 min-w-0 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p>¿Confirmás que querés eliminar definitivamente esta solicitud?</p>
                <div className="min-w-0 rounded-xl border bg-muted/40 px-3 py-2.5">
                  <p className="break-words [overflow-wrap:anywhere]">
                    <span className="font-medium text-muted-foreground">Expediente: </span>
                    <strong className="font-semibold text-foreground">{expediente || "Sin número"}</strong>
                  </p>
                  <p className="mt-1 break-words [overflow-wrap:anywhere]">
                    <span className="font-medium text-muted-foreground">Solicitante: </span>
                    <span className="text-foreground">{nombre || "Sin nombre"}</span>
                  </p>
                </div>
                <p className="text-xs">Esta acción no se puede deshacer.</p>
              </div>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  ref={cancelRef}
                  type="button"
                  disabled={pending}
                  onClick={closeDialog}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={confirmDelete}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {pending ? "Eliminando..." : "Sí, eliminar"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
