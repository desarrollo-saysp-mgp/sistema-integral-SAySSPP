"use client";

import { useState, useEffect } from "react";
import type { Service } from "@/types";
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

interface ServiceFormProps {
  service?: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string }) => Promise<{
    success: boolean;
    error?: string;
  }>;
}

export function ServiceForm({
  service,
  open,
  onOpenChange,
  onSubmit,
}: ServiceFormProps) {
  const isEditing = !!service;

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens/closes or service changes
  useEffect(() => {
    if (open && service) {
      setName(service.name);
      setError("");
    } else if (open && !service) {
      setName("");
      setError("");
    }
  }, [open, service]);

  const validateForm = (): boolean => {
    if (!name.trim()) {
      setError("El nombre del servicio es requerido");
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
      const result = await onSubmit({ name: name.trim() });

      if (result.success) {
        onOpenChange(false);
      } else {
        setError(result.error || "Error al guardar servicio");
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
            {isEditing ? "Editar servicio" : "Crear nuevo servicio"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica el nombre del servicio."
              : "Ingresa el nombre para el nuevo servicio."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nombre del servicio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ej: Alumbrado Público"
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
