"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Complaint } from "@/types";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STREETS } from "@/lib/constants/streets";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ChevronDown } from "lucide-react";

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const ARBOLADO_DEPARTMENTS = [
  "Arbolado",
  "Mantenimiento de espacios verdes",
] as const;

const ARBOLADO_LEVELS = [
  "Urgente",
  "Importante",
  "Orden de llegada",
] as const;

const ARBOLADO_DESCRIPTION_OPTIONS = [
  "Rama colgada",
  "Ramas sobre viviendas",
  "Bolsas/Basura",
  "Plazoleta, ramas bajas",
  "Árbol caído",
  "Ramas tapan luminarias",
  "Elevación de copa",
  "Plazoleta, ramas sobre cables",
  "Ramas sobre techo",
  "Ramas sobre cables",
  "Ramas secas",
  "Terreno con renuevos y malezas",
  "Levantamiento de vereda",
  "Árbol inclinado por tormenta",
  "Rama caída sobre calle",
  "Ramas se quiebran",
  "Árbol decrépito",
  "Evaluar árbol",
] as const;

const ARBOLADO_SOLUTIONS = ["Interno", "Tercero"] as const;

const ARBOLADO_AGENTS = [
  "N/A",
  "GIROLDI, Pablo",
  "Daniel Dupuy",
  "ROBATTO, Francisco",
  "REINOSO, Florencia",
  "Milton, LOPEZ",
  "ZEBALLOS, Alejandro",
  "VIVALDA, Florencia",
  "GARCIA, Gerardo",
  "MUÑOZ, Hernán",
  "GOMEZ, Juan Carlos",
] as const;

type ArboladoDepartment = (typeof ARBOLADO_DEPARTMENTS)[number];
type ArboladoLevel = (typeof ARBOLADO_LEVELS)[number];
type ArboladoDescription = (typeof ARBOLADO_DESCRIPTION_OPTIONS)[number];
type ArboladoSolution = (typeof ARBOLADO_SOLUTIONS)[number];
type ArboladoAgent = (typeof ARBOLADO_AGENTS)[number];
type ComplaintStatus = "En proceso" | "Resuelto" | "No resuelto";
type ContactMethod = "Presencial" | "Telefono" | "Email" | "WhatsApp" | "";

type ComplaintExtraData = {
  department?: unknown;
  description_type?: unknown;
  level?: unknown;
  observations?: unknown;
  solution?: unknown;
  resolution_date?: unknown;
  agent?: unknown;
  resolution_responsible?: unknown;
};

export interface ArboladoComplaintFormData {
  complaint_date: string;
  complainant_name: string;
  address: string;
  street_number: string;
  phone_number: string;
  department: ArboladoDepartment | "";
  level: ArboladoLevel | "";
  description_type: ArboladoDescription | "";
  observations: string;
  solution: ArboladoSolution | "";
  contact_method: ContactMethod;
  status: ComplaintStatus;
  resolution_date: string;
  agent: ArboladoAgent | "";
  resolution_responsible: string;
}

interface ArboladoComplaintFormProps {
  complaint?: Complaint | null;
  onSubmit: (
    data: ArboladoComplaintFormData,
  ) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
}

const getExtraData = (complaint?: Complaint | null): ComplaintExtraData => {
  if (
    complaint?.extra_data &&
    typeof complaint.extra_data === "object" &&
    !Array.isArray(complaint.extra_data)
  ) {
    return complaint.extra_data as ComplaintExtraData;
  }

  return {};
};

export function ArboladoComplaintForm({
  complaint,
  onSubmit,
  onCancel,
}: ArboladoComplaintFormProps) {
  const { profile } = useUser();
  const today = formatLocalDate(new Date());
  const extra = getExtraData(complaint);

  const [formData, setFormData] = useState<ArboladoComplaintFormData>({
    complaint_date: complaint?.complaint_date || today,
    complainant_name: complaint?.complainant_name || "",
    address: complaint?.address || "",
    street_number: complaint?.street_number || "",
    phone_number: complaint?.phone_number || "",
    department:
      (typeof extra.department === "string"
        ? extra.department
        : "Arbolado") as ArboladoDepartment,
    level: (typeof extra.level === "string" ? extra.level : "") as ArboladoLevel | "",
    description_type:
      (typeof extra.description_type === "string"
        ? extra.description_type
        : complaint?.details || "") as ArboladoDescription | "",
    observations:
      typeof extra.observations === "string" ? extra.observations : "",
    solution:
      (typeof extra.solution === "string"
        ? extra.solution
        : "") as ArboladoSolution | "",
    contact_method: (complaint?.contact_method || "") as ContactMethod,
    status: complaint?.status || "En proceso",
    resolution_date:
      typeof extra.resolution_date === "string" ? extra.resolution_date : "",
    agent: (typeof extra.agent === "string"
      ? extra.agent
      : "N/A") as ArboladoAgent | "",
    resolution_responsible:
      typeof extra.resolution_responsible === "string"
        ? extra.resolution_responsible
        : profile?.full_name || "",
  });

  const [addressQuery, setAddressQuery] = useState(complaint?.address || "");
  const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof ArboladoComplaintFormData, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addressContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      resolution_responsible: profile?.full_name || prev.resolution_responsible,
    }));
  }, [profile?.full_name]);

  const filteredStreets = useMemo(() => {
    const query = addressQuery.trim().toLowerCase();

    if (!query) return STREETS.slice(0, 12);

    return STREETS.filter((street) =>
      street.toLowerCase().includes(query),
    ).slice(0, 12);
  }, [addressQuery]);

  const validatePhone = (phone: string): boolean => {
    if (!phone.trim()) return true;
    return /^\d+$/.test(phone.trim()) && phone.trim().length <= 50;
  };

  const isValidStreet = (value: string) => {
    return (STREETS as readonly string[]).includes(value);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        addressContainerRef.current &&
        !addressContainerRef.current.contains(event.target as Node)
      ) {
        setIsAddressDropdownOpen(false);

        if (!isValidStreet(addressQuery)) {
          setAddressQuery(formData.address || "");
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [addressQuery, formData.address]);

  useEffect(() => {
    if (!formData.address) {
      setAddressQuery("");
    }
  }, [formData.address]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ArboladoComplaintFormData, string>> =
      {};

    if (!formData.complaint_date) {
      newErrors.complaint_date = "La fecha de reclamo es requerida";
    }

    if (formData.complaint_date && formData.complaint_date > today) {
      newErrors.complaint_date = "La fecha no puede ser futura";
    }

    if (!formData.address.trim()) {
      newErrors.address = "La dirección es requerida";
    } else if (!isValidStreet(formData.address)) {
      newErrors.address = "Debe seleccionar una calle válida del listado";
    }

    if (!formData.street_number.trim()) {
      newErrors.street_number = "El número es requerido";
    }

    if (formData.phone_number.trim() && !validatePhone(formData.phone_number)) {
      newErrors.phone_number =
        "Formato inválido. Solo números, máximo 50 caracteres";
    }

    if (!formData.department) {
      newErrors.department = "El departamento es requerido";
    }

    if (!formData.level) {
      newErrors.level = "El nivel es requerido";
    }

    if (!formData.description_type) {
      newErrors.description_type = "La descripción es requerida";
    }

    if (!formData.solution) {
      newErrors.solution = "La solución es requerida";
    }

    if (
      formData.contact_method &&
      !["Presencial", "Telefono", "Email", "WhatsApp"].includes(
        formData.contact_method,
      )
    ) {
      newErrors.contact_method = "El medio de contacto es inválido";
    }

    if (!formData.status) {
      newErrors.status = "El estado es requerido";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    field: keyof ArboladoComplaintFormData,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleAgentChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      agent: value as ArboladoAgent,
      resolution_responsible: profile?.full_name || prev.resolution_responsible,
    }));
  };

  const handleAddressInputChange = (value: string) => {
    setAddressQuery(value);
    setIsAddressDropdownOpen(true);
    handleChange("address", "");
  };

  const handleAddressSelect = (street: string) => {
    setAddressQuery(street);
    handleChange("address", street);
    setIsAddressDropdownOpen(false);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const result = await onSubmit({
        ...formData,
        complainant_name: formData.complainant_name.trim(),
        address: formData.address.trim(),
        street_number: formData.street_number.trim(),
        phone_number: formData.phone_number.trim(),
        observations: formData.observations.trim(),
        resolution_responsible: profile?.full_name || "",
      });

      if (!result.success) {
        setErrors((prev) => ({
          ...prev,
          description_type: result.error || "Error al guardar",
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmitForm} className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Información Básica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          <div className="space-y-2">
            <Label htmlFor="complaint_date">
              Fecha de Reclamo <span className="text-red-500">*</span>
            </Label>
            <Input
              id="complaint_date"
              type="date"
              value={formData.complaint_date}
              onChange={(e) => handleChange("complaint_date", e.target.value)}
              max={today}
            />
            {errors.complaint_date && (
              <p className="text-sm text-red-500">{errors.complaint_date}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Datos del Reclamante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          <div className="space-y-2">
            <Label htmlFor="complainant_name">Nombre y Apellido</Label>
            <Input
              id="complainant_name"
              value={formData.complainant_name}
              onChange={(e) => handleChange("complainant_name", e.target.value)}
              placeholder="Ingrese nombre y apellido"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address-search">
                Calle <span className="text-red-500">*</span>
              </Label>

              <div ref={addressContainerRef} className="relative">
                <div className="relative">
                  <Input
                    id="address-search"
                    value={addressQuery}
                    onChange={(e) => handleAddressInputChange(e.target.value)}
                    onFocus={() => setIsAddressDropdownOpen(true)}
                    placeholder="Busque y seleccione una calle"
                    autoComplete="off"
                    className="pr-10"
                  />
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>

                {isAddressDropdownOpen && (
                  <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                    {filteredStreets.length > 0 ? (
                      filteredStreets.map((street) => {
                        const isSelected = formData.address === street;

                        return (
                          <button
                            key={street}
                            type="button"
                            onClick={() => handleAddressSelect(street)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          >
                            <span>{street}</span>
                            {isSelected && <Check className="h-4 w-4" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No se encontraron calles
                      </div>
                    )}
                  </div>
                )}
              </div>

              {errors.address && (
                <p className="mt-1 text-sm text-red-500">{errors.address}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="street_number">
                Número <span className="text-red-500">*</span>
              </Label>
              <Input
                id="street_number"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.street_number}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  handleChange("street_number", value);
                }}
                placeholder="Nro."
              />
              {errors.street_number && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.street_number}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone_number">Teléfono</Label>
            <Input
              id="phone_number"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={50}
              value={formData.phone_number}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                handleChange("phone_number", value);
              }}
              placeholder="Ingrese teléfono (opcional, solo números)"
            />
            {errors.phone_number && (
              <p className="mt-1 text-sm text-red-500">
                {errors.phone_number}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Datos del Área</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="department">
                Depto <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.department}
                onValueChange={(value) => handleChange("department", value)}
              >
                <SelectTrigger id="department">
                  <SelectValue placeholder="Seleccione un departamento" />
                </SelectTrigger>
                <SelectContent>
                  {ARBOLADO_DEPARTMENTS.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.department && (
                <p className="text-sm text-red-500">{errors.department}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="level">
                Nivel <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.level}
                onValueChange={(value) => handleChange("level", value)}
              >
                <SelectTrigger id="level">
                  <SelectValue placeholder="Seleccione un nivel" />
                </SelectTrigger>
                <SelectContent>
                  {ARBOLADO_LEVELS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.level && (
                <p className="text-sm text-red-500">{errors.level}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description_type">
              Descripción <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.description_type}
              onValueChange={(value) =>
                handleChange("description_type", value)
              }
            >
              <SelectTrigger id="description_type">
                <SelectValue placeholder="Seleccione una descripción" />
              </SelectTrigger>
              <SelectContent>
                {ARBOLADO_DESCRIPTION_OPTIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.description_type && (
              <p className="text-sm text-red-500">
                {errors.description_type}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observations">Observaciones</Label>
            <textarea
              id="observations"
              value={formData.observations}
              onChange={(e) => handleChange("observations", e.target.value)}
              placeholder="Observaciones"
              className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-3 text-sm"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="solution">
                Solución <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.solution}
                onValueChange={(value) => handleChange("solution", value)}
              >
                <SelectTrigger id="solution">
                  <SelectValue placeholder="Seleccione una solución" />
                </SelectTrigger>
                <SelectContent>
                  {ARBOLADO_SOLUTIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.solution && (
                <p className="text-sm text-red-500">{errors.solution}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_method">Medio de contacto</Label>
              <Select
                value={formData.contact_method}
                onValueChange={(value) => handleChange("contact_method", value)}
              >
                <SelectTrigger id="contact_method">
                  <SelectValue placeholder="Seleccione medio de contacto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Presencial">Presencial</SelectItem>
                  <SelectItem value="Telefono">Teléfono</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
              {errors.contact_method && (
                <p className="text-sm text-red-500">{errors.contact_method}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Seguimiento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          <div className="space-y-2">
            <Label htmlFor="status">
              Seguimiento <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleChange("status", value)}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Seleccione estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="En proceso">En proceso</SelectItem>
                <SelectItem value="Resuelto">Resuelto</SelectItem>
                <SelectItem value="No resuelto">No resuelto</SelectItem>
              </SelectContent>
            </Select>
            {errors.status && (
              <p className="text-sm text-red-500">{errors.status}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="resolution_date">Fecha de resolución</Label>
            <Input
              id="resolution_date"
              type="date"
              value={formData.resolution_date}
              onChange={(e) => handleChange("resolution_date", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agent">Agente</Label>
              <Select value={formData.agent} onValueChange={handleAgentChange}>
                <SelectTrigger id="agent">
                  <SelectValue placeholder="Seleccione un agente" />
                </SelectTrigger>
                <SelectContent>
                  {ARBOLADO_AGENTS.map((agent) => (
                    <SelectItem key={agent} value={agent}>
                      {agent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resolution_responsible">
                Responsable de Resolución
              </Label>
              <Input
                id="resolution_responsible"
                value={profile?.full_name || ""}
                disabled
                className="bg-muted"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Responsable de Carga</Label>
            <Input
              value={profile?.full_name || "Usuario no disponible"}
              disabled
              className="bg-muted"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar Reclamo"}
        </Button>
      </div>
    </form>
  );
}