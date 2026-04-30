"use client";

import { useEffect, useState } from "react";
import type { User, UserFormData, UserRole } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserFormProps {
  user?: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    data: UserFormData,
  ) => Promise<{ success: boolean; error?: string }>;
}

type FormState = {
  full_name: string;
  email: string;
  role: UserRole;
  password: string;
  confirmPassword: string;
};

export function UserForm({
  user,
  open,
  onOpenChange,
  onSubmit,
}: UserFormProps) {
  const isEditing = !!user;

  const [formData, setFormData] = useState<FormState>({
    full_name: "",
    email: "",
    role: "Reclamos",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        email: user.email || "",
        role: (user.role as UserRole) || "Reclamos",
        password: "",
        confirmPassword: "",
      });
    } else {
      setFormData({
        full_name: "",
        email: "",
        role: "Reclamos",
        password: "",
        confirmPassword: "",
      });
    }

    setErrors({});
  }, [user, open]);

  const handleChange = (field: keyof FormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value as never }));

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = "El nombre es requerido";
    }

    if (!formData.email.trim()) {
      newErrors.email = "El email es requerido";
    }

    if (!formData.role) {
      newErrors.role = "El rol es requerido";
    }

    if (!isEditing) {
      if (!formData.password.trim()) {
        newErrors.password = "La contraseña es requerida";
      } else if (formData.password.length < 6) {
        newErrors.password = "La contraseña debe tener al menos 6 caracteres";
      }

      if (!formData.confirmPassword.trim()) {
        newErrors.confirmPassword = "Debe confirmar la contraseña";
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Las contraseñas no coinciden";
      }
    } else {
      if (formData.password && formData.password.length < 6) {
        newErrors.password = "La contraseña debe tener al menos 6 caracteres";
      }

      if (formData.password && formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Las contraseñas no coinciden";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    const payload: UserFormData = {
      full_name: formData.full_name.trim(),
      email: formData.email.trim(),
      role: formData.role,
      ...(formData.password ? { password: formData.password } : {}),
    };

    const result = await onSubmit(payload);

    setIsSubmitting(false);

    if (result.success) {
      onOpenChange(false);
    } else if (result.error) {
      setErrors((prev) => ({
        ...prev,
        email: result.error,
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar usuario" : "Nuevo usuario"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Actualiza los datos del usuario. La contraseña es opcional."
              : "Completa los datos para crear un usuario con contraseña."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nombre completo *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleChange("full_name", e.target.value)}
              placeholder="Ingrese nombre completo"
            />
            {errors.full_name && (
              <p className="text-sm text-red-500">{errors.full_name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="Ingrese email"
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => handleChange("role", value)}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Seleccione un rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Reclamos">Reclamos</SelectItem>
                <SelectItem value="ReclamosArbolado">
                  Reclamos Arbolado
                </SelectItem>
                <SelectItem value="ReclamosZyV">
                  Reclamos ZyV
                </SelectItem>
                <SelectItem value="AdminLectura">Admin Lectura</SelectItem>
                <SelectItem value="FC_RRHH">FC + RRHH</SelectItem>
                <SelectItem value="FC_SECTOR">FC Sector</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-red-500">{errors.role}</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">
                {isEditing ? "Nueva contraseña" : "Contraseña *"}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                placeholder={
                  isEditing
                    ? "Opcional para editar"
                    : "Ingrese una contraseña"
                }
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {isEditing
                  ? "Confirmar nueva contraseña"
                  : "Confirmar contraseña *"}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  handleChange("confirmPassword", e.target.value)
                }
                placeholder="Repita la contraseña"
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          {!isEditing && (
            <p className="text-sm text-muted-foreground">
              El usuario será creado con la contraseña definida por el
              administrador.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
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
                ? isEditing
                  ? "Guardando..."
                  : "Creando..."
                : isEditing
                  ? "Guardar cambios"
                  : "Crear usuario"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}