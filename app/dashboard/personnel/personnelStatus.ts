import type { Personnel } from "@/types";

/** Estado complementario: nunca se reutiliza `activo = false` para licencias. */
export type ServiceStatus = "ACTIVO" | "SIN_PRESTACION" | "BAJA";
export type ServiceReason =
  | "LICENCIA_MEDICA"
  | "SIN_GOCE"
  | "MOTIVOS_PARTICULARES"
  | "COMISION_SERVICIOS"
  | "SUSPENSION"
  | "OTRO";

export type PersonnelServiceFields = {
  situacion_servicio?: "ACTIVO" | "SIN_PRESTACION" | null;
  motivo_sin_servicio?: ServiceReason | null;
  fecha_inicio_sin_servicio?: string | null;
  observaciones_sin_servicio?: string | null;
};

export const SERVICE_REASON_LABELS: Record<ServiceReason, string> = {
  LICENCIA_MEDICA: "Licencia médica prolongada",
  SIN_GOCE: "Licencia sin goce de haberes",
  MOTIVOS_PARTICULARES: "Licencia por motivos particulares",
  COMISION_SERVICIOS: "Comisión de servicios",
  SUSPENSION: "Suspensión temporal",
  OTRO: "Otro motivo",
};

export const getServiceStatus = (person: Personnel): ServiceStatus => {
  if (!person.activo) return "BAJA";
  return (person as Personnel & PersonnelServiceFields).situacion_servicio === "SIN_PRESTACION"
    ? "SIN_PRESTACION"
    : "ACTIVO";
};

export const getServiceStatusLabel = (person: Personnel): string => {
  const status = getServiceStatus(person);
  if (status === "BAJA") return "Baja";
  if (status === "SIN_PRESTACION") return "Sin prestación de servicios";
  return "Activo";
};

export const getServiceDetail = (person: Personnel): string | null => {
  if (getServiceStatus(person) !== "SIN_PRESTACION") return null;
  const data = person as Personnel & PersonnelServiceFields;
  const details: string[] = [];
  if (data.motivo_sin_servicio) details.push(SERVICE_REASON_LABELS[data.motivo_sin_servicio] ?? data.motivo_sin_servicio);
  if (data.fecha_inicio_sin_servicio) {
    const [year, month, day] = data.fecha_inicio_sin_servicio.slice(0, 10).split("-");
    if (year && month && day) details.push(`Desde ${day}/${month}/${year}`);
  }
  // Las observaciones se conservan en la ficha de edición, no en listados/PDF.
  return details.length ? details.join(" · ") : null;
};
