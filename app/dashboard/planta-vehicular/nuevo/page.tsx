import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { NuevoVehiculoClient } from "./nuevo-vehiculo-client";

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

export default async function NuevoVehiculoPage() {
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
    userRole === "taller";

  const isReadonly =
    profile.role === "AdminLectura" ||
    profile.is_readonly === true;

  /*
   * AdminLectura puede consultar Planta Vehicular,
   * pero no puede crear vehículos.
   *
   * Cualquier otro rol no autorizado tampoco puede
   * ingresar manualmente a esta URL.
   */
  if (!canAccess || isReadonly) {
    redirect("/dashboard/planta-vehicular");
  }

  return (
    <NuevoVehiculoClient userId={user.id} />
  );
}