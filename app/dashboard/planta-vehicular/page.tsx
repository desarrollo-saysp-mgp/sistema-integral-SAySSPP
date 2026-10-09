import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PlantaVehicularClient } from "./planta-vehicular-client";

const LUCAS_BELLIARDO_EMAIL = "arqbelliardolucas@gmail.com";

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

export default async function PlantaVehicularPage() {
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
    .select("role, email, is_readonly")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  const userRole = normalizeText(profile.role);
  const userEmail = normalizeText(profile.email || user.email);

  const isLucasBelliardo =
    userEmail === normalizeText(LUCAS_BELLIARDO_EMAIL);

  const canAccess =
    userRole === "admin" ||
    userRole === "adminlectura" ||
    userRole === "taller" ||
    isLucasBelliardo;

  if (!canAccess) {
    redirect("/dashboard/accesos");
  }

  const isReadonly =
    userRole === "adminlectura" ||
    profile.is_readonly === true ||
    isLucasBelliardo;

  return (
    <PlantaVehicularClient
      isReadonly={isReadonly}
      userRole={profile.role}
    />
  );
}
