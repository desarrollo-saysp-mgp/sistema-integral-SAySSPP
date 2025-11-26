"use client";

import { useState, useEffect } from "react";
import type { Cause, Service } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CauseFormProps {
  cause?: Cause | null;
  service: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    service_id: number;
  }) => Promise<{ success: boolean; error?: string }>;
}

export function CauseForm({
  cause,
  service,
  open,
  onOpenChange,
  onSubmit,
}: CauseFormProps) {
  const isEditing = !!cause;

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens/closes or cause changes
  useEffect(() => {
    if (open && cause) {
      setName(cause.name);
      setError("");
    } else if (open && !cause) {
      setName("");
      setError("");
    }
  }, [open, cause]);

  const validateForm = (): boolean => {
    if (!name.trim()) {
      setError("El nombre de la causa es requerido");
      return false;
    }
    if (!service) {
      setError("Debe seleccionar un servicio");
      return false;
    }
    setError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await onSubmit({
        name: name.trim(),
        service_id: service!.id,
      });

      if (result.success) {
        onOpenChange(false);
      } else {
        setError(result.error || "Error al guardar causa");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar causa" : "Crear nueva causa"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica el nombre de la causa."
              : service
                ? `Ingresa el nombre para la nueva causa de "${service.name}".`
                : "Ingresa el nombre para la nueva causa."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {service && (
              <div className="space-y-2">
                <Label>Servicio</Label>
                <div className="rounded-md border px-3 py-2 text-sm bg-muted">
                  {service.name}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">
                Nombre de la causa <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ej: Lámpara fundida"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError("");
                }}
                className={error ? "border-destructive" : ""}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Guardando..."
                : isEditing
                  ? "Actualizar"
                  : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
