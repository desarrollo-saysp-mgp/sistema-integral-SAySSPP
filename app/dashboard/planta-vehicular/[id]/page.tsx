import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { FichaVehiculoClient } from "./ficha-vehiculo-client";

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

type Vehicle = {
  id: string;

  code: string;
  vehicle: string;
  license_plate: string | null;

  vehicle_type: string | null;
  year: number | null;
  department: string | null;

  operational_status: string | null;

  repair_reason: string | null;
  out_of_service_reason: string | null;
  observations: string | null;

  rfid_tag: string | null;

  has_alltrack: boolean;
  has_ibutton_reader: boolean;
  has_camera: boolean;

  utilization: string | null;
  schedule: string | null;

  primary_driver_1: string | null;
  primary_driver_2: string | null;

  image_path: string | null;

  active: boolean;

  deactivation_date: string | null;
  deactivation_reason: string | null;

  created_at: string;
  updated_at: string;

  created_by: string | null;
  updated_by: string | null;
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function FichaVehiculoPage({
  params,
}: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, is_readonly")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  const userRole = normalizeText(profile.role);

  const canAccess =
    userRole === "admin" ||
    userRole === "adminlectura" ||
    userRole === "taller";

  if (!canAccess) {
    redirect("/dashboard/accesos");
  }

  const isReadonly =
    profile.role === "AdminLectura" ||
    profile.is_readonly === true;

  const canManage =
    !isReadonly &&
    (userRole === "admin" || userRole === "taller");

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .single();

  if (vehicleError || !vehicle) {
    redirect("/dashboard/planta-vehicular");
  }

  return (
    <FichaVehiculoClient
      vehicle={vehicle as Vehicle}
      canManage={canManage}
      isReadonly={isReadonly}
    />
  );
}