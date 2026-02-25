"use client";

import { useState, useEffect } from "react";
import type { Complaint, Service, Cause, SinceWhenPeriod } from "@/types";
import { SINCE_WHEN_OPTIONS } from "@/types";
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
  phone_number: string;
  email: string;
  service_id: string;
  cause_id: string;
  zone: string;
  since_when_period: SinceWhenPeriod | "";
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
    phone_number: "",
    email: "",
    service_id: "",
    cause_id: "",
    zone: "",
    since_when_period: "",
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

  // Helper function to convert period to date
  const calculateDateFromPeriod = (
    period: SinceWhenPeriod,
    referenceDate: string = today,
  ): string => {
    const date = new Date(referenceDate);

    switch (period) {
      case "En el día":
        // Same day as reference
        return date.toISOString().split("T")[0];
      case "1 semana":
        date.setDate(date.getDate() - 7);
        break;
      case "1 mes":
        date.setMonth(date.getMonth() - 1);
        break;
      case "3 meses":
        date.setMonth(date.getMonth() - 3);
        break;
      case "6 meses":
        date.setMonth(date.getMonth() - 6);
        break;
      case "1 año":
        date.setFullYear(date.getFullYear() - 1);
        break;
    }

    return date.toISOString().split("T")[0];
  };

  // Helper function to convert date to closest period (for edit mode)
  const getClosestPeriod = (
    sinceWhenDate: string,
    complaintDate: string,
  ): SinceWhenPeriod => {
    const since = new Date(sinceWhenDate);
    const complaint = new Date(complaintDate);
    const diffMs = complaint.getTime() - since.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Map to closest period
    if (diffDays === 0) return "En el día";
    if (diffDays <= 10) return "1 semana";
    if (diffDays <= 45) return "1 mes";
    if (diffDays <= 135) return "3 meses";
    if (diffDays <= 270) return "6 meses";
    return "1 año";
  };

  // Validation helper functions
  const validatePhone = (phone: string): boolean => {
    if (!phone.trim()) return true; // Optional field
    // Only digits allowed, max 50 chars
    const digitsOnly = /^\d+$/;
    return digitsOnly.test(phone.trim()) && phone.trim().length <= 50;
  };

  const validateEmail = (email: string): boolean => {
    if (!email.trim()) return true; // Optional field
    // Basic email format, max 100 chars
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email.trim()) && email.trim().length <= 100;
  };

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
        phone_number: complaint.phone_number || "",
        email: complaint.email || "",
        service_id: complaint.service_id.toString(),
        cause_id: complaint.cause_id.toString(),
        zone: complaint.zone,
        since_when_period: getClosestPeriod(
          complaint.since_when,
          complaint.complaint_date,
        ),
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

      // Only reset cause_id if causes are loaded and current cause_id is not in filtered list
      // This prevents resetting when causes are still loading
      if (
        causes.length > 0 &&
        formData.cause_id &&
        !filtered.some((c) => c.id === parseInt(formData.cause_id))
      ) {
        setFormData((prev) => ({ ...prev, cause_id: "" }));
      }
    } else {
      setFilteredCauses([]);
      // Only reset cause_id if we're not in edit mode or causes are loaded
      if (!isEditing || causes.length > 0) {
        setFormData((prev) => ({ ...prev, cause_id: "" }));
      }
    }
  }, [formData.service_id, causes, isEditing]);

  // Clear phone/email when contact method changes
  useEffect(() => {
    // Clear phone number if contact method is not Telefono or WhatsApp
    if (
      formData.contact_method !== "Telefono" &&
      formData.contact_method !== "WhatsApp" &&
      formData.phone_number
    ) {
      setFormData((prev) => ({ ...prev, phone_number: "" }));
    }

    // Clear email if contact method is not Email
    if (formData.contact_method !== "Email" && formData.email) {
      setFormData((prev) => ({ ...prev, email: "" }));
    }
  }, [formData.contact_method]);

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

    if (!formData.since_when_period) {
      newErrors.since_when_period =
        "Debe seleccionar desde cuándo existe el problema";
    }

    // Phone validation (optional but must be valid if provided)
    if (formData.phone_number.trim() && !validatePhone(formData.phone_number)) {
      newErrors.phone_number =
        "Formato inválido. Solo números, máximo 50 caracteres";
    }

    // Email validation (optional but must be valid if provided)
    if (formData.email.trim() && !validateEmail(formData.email)) {
      newErrors.email = "Formato de email inválido";
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
      // Convert since_when_period to actual date before submitting
      const since_when = formData.since_when_period
        ? calculateDateFromPeriod(
            formData.since_when_period,
            formData.complaint_date,
          )
        : "";

      // Create submission data with since_when as date
      const submissionData: any = {
        ...formData,
        since_when,
      };
      // Remove since_when_period from submission
      delete submissionData.since_when_period;

      const result = await onSubmit(submissionData);

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

          {/* Conditional Phone Number Field - Show when Telefono or WhatsApp is selected */}
          {(formData.contact_method === "Telefono" ||
            formData.contact_method === "WhatsApp") && (
            <div>
              <Label htmlFor="phone_number">
                {formData.contact_method === "WhatsApp"
                  ? "Número de WhatsApp"
                  : "Número de Teléfono"}
              </Label>
              <Input
                id="phone_number"
                value={formData.phone_number}
                onChange={(e) => handleChange("phone_number", e.target.value)}
                placeholder="Ingrese teléfono (opcional, solo números)"
              />
              {errors.phone_number && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.phone_number}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Solo números, máximo 50 caracteres
              </p>
            </div>
          )}

          {/* Conditional Email Field - Show when Email is selected */}
          {formData.contact_method === "Email" && (
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="Ingrese email (opcional)"
              />
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email}</p>
              )}
            </div>
          )}
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
              <Label htmlFor="since_when_period">
                Desde Cuándo <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.since_when_period}
                onValueChange={(value) => handleChange("since_when_period", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione el período" />
                </SelectTrigger>
                <SelectContent>
                  {SINCE_WHEN_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.since_when_period && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.since_when_period}
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
              value={profile?.full_name || "Usuario no disponible"}
              disabled
              className="bg-muted"
            />
            {!profile && (
              <p className="text-sm text-amber-600 mt-1">
                ⚠️ No se pudo cargar el perfil del usuario
              </p>
            )}
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
