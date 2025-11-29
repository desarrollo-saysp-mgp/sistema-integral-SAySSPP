"use client";

import { useState, useEffect } from "react";
import type { Complaint, Service, Cause } from "@/types";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/hooks/useUser";

export interface ComplaintFormData {
  complaint_date: string;
  complainant_name: string;
  address: string;
  street_number: string;
  dni: string;
  service_id: string;
  cause_id: string;
  zone: string;
  since_when: string;
  contact_method: "Presencial" | "Telefono" | "Email" | "WhatsApp" | "";
  details: string;
  status: "En proceso" | "Resuelto" | "No resuelto";
  referred: boolean;
}

interface ComplaintFormProps {
  complaint?: Complaint | null;
  onSubmit: (
    data: ComplaintFormData,
  ) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
}

export function ComplaintForm({
  complaint,
  onSubmit,
  onCancel,
}: ComplaintFormProps) {
  const { profile } = useUser();
  const isEditing = !!complaint;

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState<ComplaintFormData>({
    complaint_date: today,
    complainant_name: "",
    address: "",
    street_number: "",
    dni: "",
    service_id: "",
    cause_id: "",
    zone: "",
    since_when: "",
    contact_method: "",
    details: "",
    status: "En proceso",
    referred: false,
  });

  const [services, setServices] = useState<Service[]>([]);
  const [causes, setCauses] = useState<Cause[]>([]);
  const [filteredCauses, setFilteredCauses] = useState<Cause[]>([]);
  const [errors, setErrors] = useState<
    Partial<Record<keyof ComplaintFormData, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(true);

  // Load services and causes on mount
  useEffect(() => {
    fetchServicesAndCauses();
  }, []);

  // Update form when complaint changes (for editing)
  useEffect(() => {
    if (complaint) {
      setFormData({
        complaint_date: complaint.complaint_date,
        complainant_name: complaint.complainant_name,
        address: complaint.address,
        street_number: complaint.street_number,
        dni: complaint.dni || "",
        service_id: complaint.service_id.toString(),
        cause_id: complaint.cause_id.toString(),
        zone: complaint.zone,
        since_when: complaint.since_when,
        contact_method: complaint.contact_method,
        details: complaint.details,
        status: complaint.status,
        referred: complaint.referred,
      });
    }
  }, [complaint]);

  // Filter causes when service changes
  useEffect(() => {
    if (formData.service_id) {
      const filtered = causes.filter(
        (cause) =>
          cause.service_id === parseInt(formData.service_id) && cause.active,
      );
      setFilteredCauses(filtered);

      // Reset cause_id if it's not in the filtered list
      if (
        formData.cause_id &&
        !filtered.some((c) => c.id === parseInt(formData.cause_id))
      ) {
        setFormData((prev) => ({ ...prev, cause_id: "" }));
      }
    } else {
      setFilteredCauses([]);
      setFormData((prev) => ({ ...prev, cause_id: "" }));
    }
  }, [formData.service_id, causes]);

  const fetchServicesAndCauses = async () => {
    setIsLoadingServices(true);
    try {
      // Fetch services
      const servicesRes = await fetch("/api/services");
      const servicesData = await servicesRes.json();

      if (servicesData.data) {
        setServices(servicesData.data.filter((s: Service) => s.active));
      }

      // Fetch causes
      const causesRes = await fetch("/api/causes");
      const causesData = await causesRes.json();

      if (causesData.data) {
        setCauses(causesData.data.filter((c: Cause) => c.active));
      }
    } catch (error) {
      console.error("Error loading services and causes:", error);
    } finally {
      setIsLoadingServices(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ComplaintFormData, string>> = {};

    // Required fields validation
    if (!formData.complainant_name.trim()) {
      newErrors.complainant_name = "El nombre y apellido es requerido";
    }

    if (!formData.address.trim()) {
      newErrors.address = "La dirección es requerida";
    }

    if (!formData.street_number.trim()) {
      newErrors.street_number = "El número es requerido";
    }

    if (!formData.service_id) {
      newErrors.service_id = "El servicio es requerido";
    }

    if (!formData.cause_id) {
      newErrors.cause_id = "La causa es requerida";
    }

    if (!formData.zone.trim()) {
      newErrors.zone = "La zona es requerida";
    }

    if (!formData.since_when) {
      newErrors.since_when = "La fecha 'Desde cuándo' es requerida";
    }

    if (!formData.contact_method) {
      newErrors.contact_method = "El medio de contacto es requerido";
    }

    if (!formData.details.trim()) {
      newErrors.details = "El detalle es requerido";
    } else if (formData.details.trim().length < 10) {
      newErrors.details = "El detalle debe tener al menos 10 caracteres";
    }

    if (!formData.complaint_date) {
      newErrors.complaint_date = "La fecha de reclamo es requerida";
    }

    // Date validations
    if (formData.complaint_date && formData.complaint_date > today) {
      newErrors.complaint_date = "La fecha no puede ser futura";
    }

    if (
      formData.since_when &&
      formData.complaint_date &&
      formData.since_when > formData.complaint_date
    ) {
      newErrors.since_when =
        "La fecha 'Desde cuándo' no puede ser posterior a la fecha del reclamo";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await onSubmit(formData);

      if (!result.success) {
        // Show error from parent component
        setErrors({ complainant_name: result.error || "Error al guardar" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    field: keyof ComplaintFormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información Básica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
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
              <p className="text-sm text-red-500 mt-1">
                {errors.complaint_date}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Complainant Information */}
      <Card>
        <CardHeader>
          <CardTitle>Datos del Reclamante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="complainant_name">
              Nombre y Apellido <span className="text-red-500">*</span>
            </Label>
            <Input
              id="complainant_name"
              value={formData.complainant_name}
              onChange={(e) =>
                handleChange("complainant_name", e.target.value)
              }
              placeholder="Ingrese nombre y apellido"
            />
            {errors.complainant_name && (
              <p className="text-sm text-red-500 mt-1">
                {errors.complainant_name}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="address">
                Dirección <span className="text-red-500">*</span>
              </Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Ingrese dirección"
              />
              {errors.address && (
                <p className="text-sm text-red-500 mt-1">{errors.address}</p>
              )}
            </div>

            <div>
              <Label htmlFor="street_number">
                Número <span className="text-red-500">*</span>
              </Label>
              <Input
                id="street_number"
                value={formData.street_number}
                onChange={(e) => handleChange("street_number", e.target.value)}
                placeholder="Nro."
              />
              {errors.street_number && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.street_number}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="dni">DNI</Label>
            <Input
              id="dni"
              value={formData.dni}
              onChange={(e) => handleChange("dni", e.target.value)}
              placeholder="Ingrese DNI (opcional)"
            />
          </div>

          <div>
            <Label>
              Medio de Contacto <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
              {(
                [
                  "Presencial",
                  "Telefono",
                  "Email",
                  "WhatsApp",
                ] as const
              ).map((method) => (
                <label
                  key={method}
                  className="flex items-center space-x-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="contact_method"
                    value={method}
                    checked={formData.contact_method === method}
                    onChange={(e) =>
                      handleChange("contact_method", e.target.value)
                    }
                    className="w-4 h-4"
                  />
                  <span>{method}</span>
                </label>
              ))}
            </div>
            {errors.contact_method && (
              <p className="text-sm text-red-500 mt-1">
                {errors.contact_method}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Complaint Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles del Reclamo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="service_id">
                Servicio <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.service_id}
                onValueChange={(value) => handleChange("service_id", value)}
                disabled={isLoadingServices}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un servicio" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id.toString()}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.service_id && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.service_id}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="cause_id">
                Causa <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.cause_id}
                onValueChange={(value) => handleChange("cause_id", value)}
                disabled={!formData.service_id || filteredCauses.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      formData.service_id
                        ? "Seleccione una causa"
                        : "Primero seleccione un servicio"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredCauses.map((cause) => (
                    <SelectItem key={cause.id} value={cause.id.toString()}>
                      {cause.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.cause_id && (
                <p className="text-sm text-red-500 mt-1">{errors.cause_id}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="zone">
                Zona <span className="text-red-500">*</span>
              </Label>
              <Input
                id="zone"
                value={formData.zone}
                onChange={(e) => handleChange("zone", e.target.value)}
                placeholder="Ingrese zona"
              />
              {errors.zone && (
                <p className="text-sm text-red-500 mt-1">{errors.zone}</p>
              )}
            </div>

            <div>
              <Label htmlFor="since_when">
                Desde Cuándo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="since_when"
                type="date"
                value={formData.since_when}
                onChange={(e) => handleChange("since_when", e.target.value)}
                max={formData.complaint_date || today}
              />
              {errors.since_when && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.since_when}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="details">
              Detalle <span className="text-red-500">*</span>
            </Label>
            <textarea
              id="details"
              value={formData.details}
              onChange={(e) => handleChange("details", e.target.value)}
              placeholder="Describa el reclamo en detalle (mínimo 10 caracteres)"
              className="w-full min-h-[100px] px-3 py-2 border border-input rounded-md bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              rows={4}
            />
            {errors.details && (
              <p className="text-sm text-red-500 mt-1">{errors.details}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status and Follow-up */}
      <Card>
        <CardHeader>
          <CardTitle>Estado y Seguimiento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Estado</Label>
            <div className="flex gap-4 mt-2">
              {(["En proceso", "Resuelto", "No resuelto"] as const).map(
                (statusOption) => (
                  <label
                    key={statusOption}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="status"
                      value={statusOption}
                      checked={formData.status === statusOption}
                      onChange={(e) => handleChange("status", e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>{statusOption}</span>
                  </label>
                ),
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="referred"
              checked={formData.referred}
              onChange={(e) => handleChange("referred", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <Label htmlFor="referred" className="cursor-pointer">
              Derivado
            </Label>
          </div>

          <div>
            <Label>Responsable de Carga</Label>
            <Input
              value={profile?.full_name || "Cargando..."}
              disabled
              className="bg-muted"
            />
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex gap-4 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || isLoadingServices}>
          {isSubmitting
            ? "Guardando..."
            : isEditing
              ? "Guardar Cambios"
              : "Guardar Reclamo"}
        </Button>
      </div>
    </form>
  );
}
