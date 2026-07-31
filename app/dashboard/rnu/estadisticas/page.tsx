import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EstadisticasRnuClient from "./estadisticas-client";

export type RnuStatsEntry = {
  id: string;
  entry_type: "GENERAL" | "INSTITUCION";
  entry_date: string;
  visitor_count: number;

  province_locality: string | null;

  transport_type: string | null;
  first_visit: boolean | null;
  entry_reasons: string[] | null;
  facilities: string[] | null;

  institution_name: string | null;
  activities: string[] | null;
  behavior: string | null;
};

function normalizeRole(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

export default async function RnuEstadisticasPage() {
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
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  const userRole = normalizeRole(profile.role);

  const allowedRoles = [
    "admin",
    "adminlectura",
    "rnu",
  ];

  if (!allowedRoles.includes(userRole)) {
    redirect("/dashboard/accesos");
  }

  const { data, error } = await supabase
    .from("rnu_entries")
    .select(`
      id,
      entry_type,
      entry_date,
      visitor_count,
      province_locality,
      transport_type,
      first_visit,
      entry_reasons,
      facilities,
      institution_name,
      activities,
      behavior
    `)
    .order("entry_date", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Error al obtener estadísticas RNU:",
      error,
    );
  }

  const entries = (data ?? []) as RnuStatsEntry[];

  return (
    <EstadisticasRnuClient
      initialEntries={entries}
    />
  );
}