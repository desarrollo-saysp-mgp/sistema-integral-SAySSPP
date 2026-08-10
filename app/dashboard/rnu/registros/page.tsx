import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import RegistrosRnuClient from "./registros-client";

export type RnuEntry = {
  id: string;
  entry_type: "GENERAL" | "INSTITUCION";
  entry_date: string;
  entry_time: string;
  visitor_count: number;

  province_locality: string | null;
  observations: string | null;

  transport_type: string | null;
  first_visit: boolean | null;
  entry_reasons: string[] | null;
  facilities: string[] | null;

  institution_name: string | null;
  ages: string | null;
  responsible_name: string | null;
  responsible_phone: string | null;
  estimated_exit_time: string | null;
  has_visit_request: boolean | null;
  activities: string[] | null;
  behavior: string | null;

  created_at: string;
};

function normalizeRole(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

const PAGE_SIZE = 1000;

export default async function RnuRegistrosPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } =
    await supabase
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

  const entries: RnuEntry[] = [];

  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("rnu_entries")
      .select(`
        id,
        entry_type,
        entry_date,
        entry_time,
        visitor_count,

        province_locality,
        observations,

        transport_type,
        first_visit,
        entry_reasons,
        facilities,

        institution_name,
        ages,
        responsible_name,
        responsible_phone,
        estimated_exit_time,
        has_visit_request,
        activities,
        behavior,

        created_at
      `)
      .order("entry_date", {
        ascending: false,
      })
      .order("entry_time", {
        ascending: false,
      })
      .range(
        from,
        from + PAGE_SIZE - 1,
      );

    if (error) {
      console.error(
        "Error al consultar registros RNU:",
        error,
      );

      break;
    }

    const batch =
      (data ?? []) as RnuEntry[];

    entries.push(...batch);

    if (batch.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return (
    <RegistrosRnuClient
      initialEntries={entries}
      userRole={userRole}
    />
  );
}