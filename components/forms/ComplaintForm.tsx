"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type {
  Complaint,
  ComplaintWithDetails,
  Service,
  Cause,
  SinceWhenPeriod,
} from "@/types";
import { SINCE_WHEN_OPTIONS } from "@/types";
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
import { useUser } from "@/hooks/useUser";
import { Check, ChevronDown } from "lucide-react";

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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
  since_when: SinceWhenPeriod | "";
  contact_method: "Presencial" | "Telefono" | "Email" | "WhatsApp" | "";
  details: string;
  status: "En proceso" | "Resuelto" | "No resuelto";
  referred: boolean;
}

interface ComplaintFormProps {
  complaint?: Complaint | ComplaintWithDetails | null;
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
  const today = formatLocalDate(new Date());

  const getInitialFormData = (
    complaintData?: Complaint | ComplaintWithDetails | null,
  ): ComplaintFormData => {
    if (complaintData) {
      return {
        complaint_date: complaintData.complaint_date || today,
        complainant_name: complaintData.complainant_name || "",
        address: complaintData.address || "",
        street_number: complaintData.street_number || "",
        dni: complaintData.dni || "",
        phone_number: complaintData.phone_number || "",
        email: complaintData.email || "",
        service_id: complaintData.service_id
          ? complaintData.service_id.toString()
          : "",
        cause_id: complaintData.cause_id ? complaintData.cause_id.toString() : "",
        zone: complaintData.zone || "",
        since_when: ((complaintData.since_when as SinceWhenPeriod) || ""),
        contact_method: complaintData.contact_method || "",
        details: complaintData.details || "",
        status: complaintData.status,
        referred: complaintData.referred ?? false,
      };
    }

    return {
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
      since_when: "",
      contact_method: "",
      details: "",
      status: "En proceso",
      referred: false,
    };
  };

  const [formData, setFormData] = useState<ComplaintFormData>(() =>
    getInitialFormData(complaint),
  );
  const [addressQuery, setAddressQuery] = useState(() => complaint?.address || "");
  const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false);

  const [services, setServices] = useState<Service[]>([]);
  const [causes, setCauses] = useState<Cause[]>([]);
  const [filteredCauses, setFilteredCauses] = useState<Cause[]>([]);
  const [errors, setErrors] = useState<
    Partial<Record<keyof ComplaintFormData, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(true);

  const addressContainerRef = useRef<HTMLDivElement | null>(null);

  const filteredStreets = useMemo(() => {
    const query = addressQuery.trim().toLowerCase();

    if (!query) return STREETS.slice(0, 12);

    return STREETS.filter((street) =>
      street.toLowerCase().includes(query),
    ).slice(0, 12);
  }, [addressQuery]);

  const validatePhone = (phone: string): boolean => {
    if (!phone.trim()) return true;
    const digitsOnly = /^\d+$/;
    return digitsOnly.test(phone.trim()) && phone.trim().length <= 50;
  };

  const validateEmail = (email: string): boolean => {
    if (!email.trim()) return true;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email.trim()) && email.trim().length <= 100;
  };

  const isValidStreet = (value: string) => {
    return (STREETS as readonly string[]).includes(value);
  };

  useEffect(() => {
    fetchServicesAndCauses();
  }, []);

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
    if (!complaint && !formData.address) {
      setAddressQuery("");
    }
  }, [complaint, formData.address]);

  useEffect(() => {
    if (!formData.service_id) {
      setFilteredCauses([]);
      if (formData.cause_id) {
        setFormData((prev) => ({ ...prev, cause_id: "" }));
      }
      return;
    }

    let filtered = causes.filter(
      (cause) =>
        cause.service_id === parseInt(formData.service_id) && cause.active,
    );

    if (isEditing && complaint) {
      const complaintWithDetails = complaint as ComplaintWithDetails;
      if (
        complaintWithDetails.cause &&
        complaintWithDetails.cause.service_id === parseInt(formData.service_id) &&
        !filtered.some((c) => c.id === complaintWithDetails.cause?.id)
      ) {
        filtered = [...filtered, complaintWithDetails.cause];
      }
    }

    setFilteredCauses(filtered);

    if (
      causes.length > 0 &&
      formData.cause_id &&
      !filtered.some((c) => c.id === parseInt(formData.cause_id))
    ) {
      setFormData((prev) => ({ ...prev, cause_id: "" }));
    }
  }, [formData.service_id, formData.cause_id, causes, isEditing, complaint]);

  const fetchServicesAndCauses = async () => {
    setIsLoadingServices(true);
    try {
      const servicesRes = await fetch("/api/services");
      const servicesData = await servicesRes.json();

      if (servicesData.data) {
        setServices(servicesData.data.filter((s: Service) => s.active));
      }

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

    if (!formData.complainant_name.trim()) {
      newErrors.complainant_name = "El nombre y apellido es requerido";
    }

    if (!formData.address.trim()) {
      newErrors.address = "La dirección es requerida";
    } else if (!isValidStreet(formData.address)) {
      newErrors.address = "Debe seleccionar una calle válida del listado";
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
      newErrors.since_when =
        "Debe seleccionar desde cuándo existe el problema";
    }

    if (formData.phone_number.trim() && !validatePhone(formData.phone_number)) {
      newErrors.phone_number =
        "Formato inválido. Solo números, máximo 50 caracteres";
    }

    if (formData.email.trim() && !validateEmail(formData.email)) {
      newErrors.email = "Formato de email inválido";
    }

    if (!formData.contact_method) {
      newErrors.contact_method = "El medio de contacto es requerido";
    }

    if (!formData.complaint_date) {
      newErrors.complaint_date = "La fecha de reclamo es requerida";
    }

    if (formData.complaint_date && formData.complaint_date > today) {
      newErrors.complaint_date = "La fecha no puede ser futura";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await onSubmit(formData);

      if (!result.success) {
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
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
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
              <p className="mt-1 text-sm text-red-500">
                {errors.complaint_date}
              </p>
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
              <p className="mt-1 text-sm text-red-500">
                {errors.complainant_name}
              </p>
            )}
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

          <div className="space-y-3">
            <Label>
              Medio de Contacto <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
                  className="flex cursor-pointer items-center gap-2"
                >
                  <input
                    type="radio"
                    name="contact_method"
                    value={method}
                    checked={formData.contact_method === method}
                    onChange={(e) =>
                      handleChange("contact_method", e.target.value)
                    }
                    className="h-4 w-4"
                  />
                  <span>{method}</span>
                </label>
              ))}
            </div>
            {errors.contact_method && (
              <p className="mt-1 text-sm text-red-500">
                {errors.contact_method}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Detalles del Reclamo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
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
                <p className="mt-1 text-sm text-red-500">
                  {errors.service_id}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cause_id">
                Causa <span className="text-red-500">*</span>
              </Label>
              <Select
                key={`cause-select-${filteredCauses.length}-${formData.service_id}`}
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
                <p className="mt-1 text-sm text-red-500">{errors.cause_id}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="zone">
                Zona <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.zone}
                onValueChange={(value) => handleChange("zone", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione una zona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sin zona">Sin zona</SelectItem>

                  {Array.from({ length: 16 }, (_, i) => {
                    const zone = String(i + 1);
                    return (
                      <SelectItem key={zone} value={zone}>
                        {zone}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {errors.zone && (
                <p className="mt-1 text-sm text-red-500">{errors.zone}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="since_when">
                Desde Cuándo <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.since_when}
                onValueChange={(value) => handleChange("since_when", value)}
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
              {errors.since_when && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.since_when}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Detalle</Label>
            <textarea
              id="details"
              value={formData.details}
              onChange={(e) => handleChange("details", e.target.value)}
              placeholder="Detalle del reclamo"
              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              rows={4}
            />
            {errors.details && (
              <p className="mt-1 text-sm text-red-500">{errors.details}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Estado y Seguimiento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          <div className="space-y-3">
            <Label>Estado</Label>
            <div className="flex flex-wrap gap-4">
              {(["En proceso", "Resuelto", "No resuelto"] as const).map(
                (statusOption) => (
                  <label
                    key={statusOption}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <input
                      type="radio"
                      name="status"
                      value={statusOption}
                      checked={formData.status === statusOption}
                      onChange={(e) => handleChange("status", e.target.value)}
                      className="h-4 w-4"
                    />
                    <span>{statusOption}</span>
                  </label>
                ),
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Responsable de Carga</Label>
            <Input
              value={profile?.full_name || "Usuario no disponible"}
              disabled
              className="bg-muted"
            />
            {!profile && (
              <p className="mt-1 text-sm text-amber-600">
                ⚠️ No se pudo cargar el perfil del usuario
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
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