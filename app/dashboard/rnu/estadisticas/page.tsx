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

type RnuEstadisticasPageProps = {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    tipo?: string;
    historico?: string;
  }>;
};

function normalizeRole(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function formatArgentinaDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getArgentinaDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  return formatArgentinaDate(date);
}

const PAGE_SIZE = 1000;

export default async function RnuEstadisticasPage({
  searchParams,
}: RnuEstadisticasPageProps) {
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

  const params = await searchParams;

  const showAllHistory = params.historico === "1";

  const rawFrom =
    typeof params.desde === "string"
      ? params.desde.trim()
      : "";

  const rawTo =
    typeof params.hasta === "string"
      ? params.hasta.trim()
      : "";

  const dateFrom = showAllHistory
    ? rawFrom
    : rawFrom || getArgentinaDate(-14);

  const dateTo = showAllHistory
    ? rawTo
    : rawTo || getArgentinaDate();

  const rawType =
    typeof params.tipo === "string"
      ? params.tipo.trim()
      : "";

  const entryType =
    rawType === "GENERAL" ||
    rawType === "INSTITUCION"
      ? rawType
      : "";

  const entries: RnuStatsEntry[] = [];

  let from = 0;

  while (true) {
    let query = supabase
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
      `);

    if (dateFrom) {
      query = query.gte(
        "entry_date",
        dateFrom,
      );
    }

    if (dateTo) {
      query = query.lte(
        "entry_date",
        dateTo,
      );
    }

    if (entryType) {
      query = query.eq(
        "entry_type",
        entryType,
      );
    }

    const { data, error } = await query
      .order("entry_date", {
        ascending: true,
      })
      .range(
        from,
        from + PAGE_SIZE - 1,
      );

    if (error) {
      console.error(
        "Error al obtener estadísticas RNU:",
        error,
      );

      break;
    }

    const batch =
      (data ?? []) as RnuStatsEntry[];

    entries.push(...batch);

    if (batch.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return (
    <EstadisticasRnuClient
      initialEntries={entries}
      initialFrom={dateFrom}
      initialTo={dateTo}
      initialType={entryType}
      initialShowAllHistory={showAllHistory}
    />
  );
}
