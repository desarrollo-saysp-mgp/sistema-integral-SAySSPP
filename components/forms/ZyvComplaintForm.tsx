"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Complaint,
  ComplaintWithDetails,
  Cause,
  Service,
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

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const TIPO_DOMICILIO_OPTIONS = [
  "Establecimiento Educativo",
  "Edificio Público",
  "Establecimiento de salud",
  "Casa particular",
  "Espacio Público",
  "Otro",
];

export interface ZyvComplaintFormData {
  complaint_date: string;
  complainant_name: string;
  address: string;
  street_number: string;
  dni: string;
  phone_number: string;
  service_id: string;
  cause_id: string;
  since_when: SinceWhenPeriod | "";
  contact_method: "Presencial" | "Telefono" | "Email" | "WhatsApp" | "";
  details: string;
  status: "En proceso" | "Resuelto" | "No resuelto";
  zone: string;
}

interface ZyvComplaintFormProps {
  complaint?: Complaint | ComplaintWithDetails | null;
  onSubmit: (
    data: ZyvComplaintFormData,
  ) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
}

export function ZyvComplaintForm({
  complaint,
  onSubmit,
  onCancel,
}: ZyvComplaintFormProps) {
  const { profile } = useUser();
  const today = formatLocalDate(new Date());
  const isEditing = !!complaint;

  const [causes, setCauses] = useState<Cause[]>([]);
  const [zyvServices, setZyvServices] = useState<Service[]>([]);

  const [formData, setFormData] = useState<ZyvComplaintFormData>({
    complaint_date: complaint?.complaint_date || today,
    complainant_name: complaint?.complainant_name || "",
    address: complaint?.address || "",
    street_number: complaint?.street_number || "",
    dni: complaint?.dni || "",
    phone_number: complaint?.phone_number || "",
    service_id: complaint?.service_id ? String(complaint.service_id) : "",
    cause_id: complaint?.cause_id ? String(complaint.cause_id) : "",
    since_when: (complaint?.since_when as SinceWhenPeriod) || "En el día",
    contact_method: complaint?.contact_method || "Telefono",
    details: complaint?.details || "",
    status: complaint?.status || "En proceso",
    zone: complaint?.zone || "",
  });

  const [addressQuery, setAddressQuery] = useState(complaint?.address || "");
  const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof ZyvComplaintFormData, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const addressContainerRef = useRef<HTMLDivElement | null>(null);

  const filteredStreets = useMemo(() => {
    const query = addressQuery.trim().toLowerCase();
    if (!query) return STREETS.slice(0, 12);

    return STREETS.filter((street) =>
      street.toLowerCase().includes(query),
    ).slice(0, 12);
  }, [addressQuery]);

  const filteredCauses = useMemo(() => {
    if (!formData.service_id) return [];

    return causes.filter(
      (cause) =>
        cause.service_id === Number(formData.service_id) && cause.active,
    );
  }, [causes, formData.service_id]);

  const isValidStreet = (value: string) => {
    return (STREETS as readonly string[]).includes(value);
  };

  const validatePhone = (phone: string): boolean => {
    if (!phone.trim()) return true;
    return /^\d+$/.test(phone.trim()) && phone.trim().length <= 50;
  };

  useEffect(() => {
    fetchZyvData();
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [addressQuery, formData.address]);

  const fetchZyvData = async () => {
    setIsLoadingData(true);

    try {
      const servicesRes = await fetch("/api/services");
      const servicesData = await servicesRes.json();

      const filteredServices =
        servicesData.data?.filter((service: Service) => {
          const name = normalizeName(service.name);

          return (
            service.active &&
            (name.includes("zoonosis") || name.includes("vectores"))
          );
        }) ?? [];

      setZyvServices(filteredServices);

      if (!isEditing && filteredServices.length > 0) {
        setFormData((prev) => ({
          ...prev,
          service_id: prev.service_id || String(filteredServices[0].id),
          cause_id: "",
        }));
      }

      const causesRes = await fetch("/api/causes");
      const causesData = await causesRes.json();

      if (causesData.data) {
        setCauses(causesData.data.filter((cause: Cause) => cause.active));
      }
    } catch (error) {
      console.error("Error loading ZyV data:", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleChange = (field: keyof ZyvComplaintFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
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

  const validateForm = () => {
    const newErrors: Partial<Record<keyof ZyvComplaintFormData, string>> = {};

    if (!formData.complaint_date) {
      newErrors.complaint_date = "La fecha es requerida";
    }

    if (formData.complaint_date && formData.complaint_date > today) {
      newErrors.complaint_date = "La fecha no puede ser futura";
    }

    if (!formData.complainant_name.trim()) {
      newErrors.complainant_name = "El nombre y apellido es requerido";
    }

    if (!formData.address.trim()) {
      newErrors.address = "La calle es requerida";
    } else if (!isValidStreet(formData.address)) {
      newErrors.address = "Debe seleccionar una calle válida del listado";
    }

    if (!formData.street_number.trim()) {
      newErrors.street_number = "El número de casa es requerido";
    }

    if (formData.phone_number.trim() && !validatePhone(formData.phone_number)) {
      newErrors.phone_number = "Formato inválido. Solo números.";
    }

    if (!formData.service_id) {
      newErrors.service_id = "El servicio es requerido";
    }

    if (!formData.cause_id) {
      newErrors.cause_id = "La causa es requerida";
    }

    if (!formData.since_when) {
      newErrors.since_when = "Debe seleccionar desde cuándo";
    }

    if (!formData.contact_method) {
      newErrors.contact_method = "El medio de contacto es requerido";
    }

    if (!formData.status) {
      newErrors.status = "El seguimiento es requerido";
    }

    if (!formData.zone) {
      newErrors.zone = "El tipo de domicilio es requerido";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const result = await onSubmit({
        ...formData,
        service_id: formData.service_id,
        complainant_name: formData.complainant_name.trim(),
        address: formData.address.trim(),
        street_number: formData.street_number.trim(),
        dni: formData.dni.trim(),
        phone_number: formData.phone_number.trim(),
        details: formData.details.trim(),
      });

      if (!result.success) {
        setErrors((prev) => ({
          ...prev,
          complainant_name: result.error || "Error al guardar",
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
          <CardTitle>Datos del Reclamo ZyV</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-0">
          <div className="space-y-2">
            <Label htmlFor="complaint_date">
              Fecha <span className="text-red-500">*</span>
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

          <div className="space-y-2">
            <Label htmlFor="complainant_name">
              Nombre y apellido <span className="text-red-500">*</span>
            </Label>
            <Input
              id="complainant_name"
              value={formData.complainant_name}
              onChange={(e) => handleChange("complainant_name", e.target.value)}
              placeholder="Ingrese nombre y apellido"
            />
            {errors.complainant_name && (
              <p className="text-sm text-red-500">{errors.complainant_name}</p>
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
                <p className="text-sm text-red-500">{errors.address}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="street_number">
                Número de casa <span className="text-red-500">*</span>
              </Label>
              <Input
                id="street_number"
                type="text"
                inputMode="numeric"
                value={formData.street_number}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  handleChange("street_number", value);
                }}
                placeholder="Nro."
              />
              {errors.street_number && (
                <p className="text-sm text-red-500">{errors.street_number}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dni">DNI</Label>
              <Input
                id="dni"
                value={formData.dni}
                onChange={(e) => handleChange("dni", e.target.value)}
                placeholder="Ingrese DNI"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number">Teléfono</Label>
              <Input
                id="phone_number"
                type="text"
                inputMode="numeric"
                value={formData.phone_number}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  handleChange("phone_number", value);
                }}
                placeholder="Ingrese teléfono"
              />
              {errors.phone_number && (
                <p className="text-sm text-red-500">{errors.phone_number}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Detalle ZyV</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-0">
          <div className="space-y-2">
            <Label htmlFor="service_id">
              Servicio <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.service_id}
              onValueChange={(value) => {
                handleChange("service_id", value);
                handleChange("cause_id", "");
              }}
              disabled={isLoadingData}
            >
              <SelectTrigger id="service_id">
                <SelectValue placeholder="Seleccione servicio" />
              </SelectTrigger>
              <SelectContent>
                {zyvServices.map((service) => (
                  <SelectItem key={service.id} value={service.id.toString()}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.service_id && (
              <p className="text-sm text-red-500">{errors.service_id}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cause_id">
              Causa <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.cause_id}
              onValueChange={(value) => handleChange("cause_id", value)}
              disabled={isLoadingData || !formData.service_id}
            >
              <SelectTrigger id="cause_id">
                <SelectValue placeholder="Seleccione una causa" />
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
              <p className="text-sm text-red-500">{errors.cause_id}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="since_when">
                Desde cuando <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.since_when}
                onValueChange={(value) => handleChange("since_when", value)}
              >
                <SelectTrigger id="since_when">
                  <SelectValue />
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
                <p className="text-sm text-red-500">{errors.since_when}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_method">
                Medio de contacto <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.contact_method}
                onValueChange={(value) => handleChange("contact_method", value)}
              >
                <SelectTrigger id="contact_method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Telefono">Teléfono</SelectItem>
                  <SelectItem value="Presencial">Presencial</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
              {errors.contact_method && (
                <p className="text-sm text-red-500">{errors.contact_method}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Detalles</Label>
            <textarea
              id="details"
              value={formData.details}
              onChange={(e) => handleChange("details", e.target.value)}
              placeholder="Detalle del reclamo"
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-3 text-sm"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">
                Seguimiento <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange("status", value)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
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
              <Label htmlFor="zone">
                Tipo de domicilio <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.zone}
                onValueChange={(value) => handleChange("zone", value)}
              >
                <SelectTrigger id="zone">
                  <SelectValue placeholder="Seleccione tipo de domicilio" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_DOMICILIO_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.zone && (
                <p className="text-sm text-red-500">{errors.zone}</p>
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
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>

        <Button type="submit" disabled={isSubmitting || isLoadingData}>
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