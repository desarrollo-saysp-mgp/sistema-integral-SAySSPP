import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MapClient from "./map-client";

const SERVICIOS_PUBLICOS_EMAILS = [
  "waldaquin84@gmail.com",
  "adm.serviciospublicos.mgp@gmail.com",
  "martincornejo.gp@gmail.com",
];

function normalizeAccessValue(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

export default async function TestGradingMapPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("email, role, is_readonly")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/dashboard/accesos");
  }

  const userRole = normalizeAccessValue(profile.role);
  const userEmail = normalizeAccessValue(
    profile.email || user.email
  );

  const isAdmin =
    userRole === "admin";

  const isAdminLectura =
    userRole === "adminlectura";

  const isServiciosPublicos =
    SERVICIOS_PUBLICOS_EMAILS
      .map(normalizeAccessValue)
      .includes(userEmail);

  if (
    !isAdmin &&
    !isAdminLectura &&
    !isServiciosPublicos
  ) {
    redirect("/dashboard/accesos");
  }

  const readOnly =
    isAdminLectura ||
    profile.is_readonly === true;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Mapa de Motonivelación de General Pico
        </h1>
      </div>

      <MapClient readOnly={readOnly} />
    </div>
  );
}
