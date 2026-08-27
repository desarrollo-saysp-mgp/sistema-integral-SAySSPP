import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { EditarVehiculoClient } from "./editar-vehiculo-client";

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditarVehiculoPage({
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

  const canManage =
    !profile.is_readonly &&
    (userRole === "admin" || userRole === "taller");

  if (!canManage) {
    redirect(`/dashboard/planta-vehicular/${id}`);
  }

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .single();

  if (vehicleError || !vehicle) {
    redirect("/dashboard/planta-vehicular");
  }

  return (
    <EditarVehiculoClient
      vehicle={vehicle}
      userId={user.id}
    />
  );
}