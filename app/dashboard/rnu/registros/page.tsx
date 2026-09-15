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

type RnuRegistrosPageProps = {
  searchParams: Promise<{
    pagina?: string;
    buscar?: string;
    tipo?: string;
    desde?: string;
    hasta?: string;
  }>;
};

type TodayEntry = {
  entry_type: "GENERAL" | "INSTITUCION";
  visitor_count: number;
};

const ITEMS_PER_PAGE = 20;
const SEARCH_CHUNK_SIZE = 1000;

const REASON_LABELS: Record<string, string> = {
  PESCA: "Pesca",
  RECREACION: "Recreación",
  PAMPA_WAKE: "Pampa Wake",
  ACTIVIDAD_PROGRAMADA: "Actividad programada",
  FOTOGRAFIA_AVISTAJE:
    "Fotografía / avistaje de aves",
  KAYAK: "Kayak",
  ACAMPE: "Acampe",
};

const TRANSPORT_LABELS: Record<string, string> = {
  AUTO: "Auto",
  MOTO: "Moto",
  BICICLETA: "Bicicleta",
  CAMINANDO_CORRIENDO: "Caminando / corriendo",
};

function normalizeRole(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getTransportLabel(value: string | null) {
  if (!value) return "—";
  return TRANSPORT_LABELS[value] || value;
}

function getReasonLabel(reasons: string[] | null) {
  if (!reasons?.length) return "—";

  return reasons
    .map((reason) => REASON_LABELS[reason] || reason)
    .join(", ");
}

function matchesSearch(entry: RnuEntry, search: string) {
  const normalizedSearch = normalizeSearch(search);

  if (!normalizedSearch) return true;

  const searchableText = normalizeSearch(
    [
      entry.province_locality,
      entry.institution_name,
      entry.responsible_name,
      getTransportLabel(entry.transport_type),
      getReasonLabel(entry.entry_reasons),
    ]
      .filter(Boolean)
      .join(" "),
  );

  return searchableText.includes(normalizedSearch);
}

function getTodayArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const ENTRY_SELECT = `
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
`;

export default async function RnuRegistrosPage({
  searchParams,
}: RnuRegistrosPageProps) {
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

  const allowedRoles = ["admin", "adminlectura", "rnu"];

  if (!allowedRoles.includes(userRole)) {
    redirect("/dashboard/accesos");
  }

  const params = await searchParams;

  const parsedPage = Number.parseInt(params.pagina || "1", 10);
  const requestedPage =
    Number.isFinite(parsedPage) && parsedPage > 0
      ? parsedPage
      : 1;

  const search =
    typeof params.buscar === "string"
      ? params.buscar.trim().slice(0, 200)
      : "";

  const rawType =
    typeof params.tipo === "string" ? params.tipo.trim() : "";

  const type =
    rawType === "GENERAL" || rawType === "INSTITUCION"
      ? rawType
      : "";

  const rawFrom =
    typeof params.desde === "string" ? params.desde.trim() : "";
  const rawTo =
    typeof params.hasta === "string" ? params.hasta.trim() : "";

  const dateFrom = isValidDate(rawFrom) ? rawFrom : "";
  const dateTo = isValidDate(rawTo) ? rawTo : "";

  // Tarjetas de hoy: consulta chica, solo dos columnas.
  const today = getTodayArgentina();
  const { data: todayData, error: todayError } = await supabase
    .from("rnu_entries")
    .select("entry_type, visitor_count")
    .eq("entry_date", today);

  if (todayError) {
    console.error("Error al consultar resumen diario RNU:", todayError);
  }

  const todayEntries = (todayData ?? []) as TodayEntry[];

  const todayVisitorCount = todayEntries.reduce(
    (total, entry) => total + Number(entry.visitor_count || 0),
    0,
  );

  const todayGeneralCount = todayEntries.filter(
    (entry) => entry.entry_type === "GENERAL",
  ).length;

  const todayInstitutionCount = todayEntries.filter(
    (entry) => entry.entry_type === "INSTITUCION",
  ).length;

  let entries: RnuEntry[] = [];
  let totalEntries = 0;
  let currentPage = requestedPage;

  // Sin texto de búsqueda: paginación real en Supabase, 20 filas.
  if (!search) {
    let query = supabase
      .from("rnu_entries")
      .select(ENTRY_SELECT, { count: "exact" });

    if (type) query = query.eq("entry_type", type);
    if (dateFrom) query = query.gte("entry_date", dateFrom);
    if (dateTo) query = query.lte("entry_date", dateTo);

    const from = (requestedPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const { data, error, count } = await query
      .order("entry_date", { ascending: false })
      .order("entry_time", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error al consultar registros RNU:", error);
    } else {
      totalEntries = count ?? 0;

      const totalPages = Math.max(
        1,
        Math.ceil(totalEntries / ITEMS_PER_PAGE),
      );

      currentPage = Math.min(requestedPage, totalPages);
      entries = (data ?? []) as RnuEntry[];

      if (currentPage !== requestedPage) {
        let safeQuery = supabase
          .from("rnu_entries")
          .select(ENTRY_SELECT);

        if (type) safeQuery = safeQuery.eq("entry_type", type);
        if (dateFrom) safeQuery = safeQuery.gte("entry_date", dateFrom);
        if (dateTo) safeQuery = safeQuery.lte("entry_date", dateTo);

        const safeFrom = (currentPage - 1) * ITEMS_PER_PAGE;
        const safeTo = safeFrom + ITEMS_PER_PAGE - 1;

        const { data: safeData, error: safeError } = await safeQuery
          .order("entry_date", { ascending: false })
          .order("entry_time", { ascending: false })
          .range(safeFrom, safeTo);

        if (safeError) {
          console.error("Error al consultar página válida RNU:", safeError);
        } else {
          entries = (safeData ?? []) as RnuEntry[];
        }
      }
    }
  } else {
    // Con búsqueda conservamos exactamente el comportamiento previo.
    // Solo en este caso recorremos los registros que cumplen tipo/fechas.
    const matchingEntries: RnuEntry[] = [];
    let offset = 0;

    while (true) {
      let query = supabase.from("rnu_entries").select(ENTRY_SELECT);

      if (type) query = query.eq("entry_type", type);
      if (dateFrom) query = query.gte("entry_date", dateFrom);
      if (dateTo) query = query.lte("entry_date", dateTo);

      const { data, error } = await query
        .order("entry_date", { ascending: false })
        .order("entry_time", { ascending: false })
        .range(offset, offset + SEARCH_CHUNK_SIZE - 1);

      if (error) {
        console.error("Error al buscar registros RNU:", error);
        break;
      }

      const batch = (data ?? []) as RnuEntry[];

      matchingEntries.push(
        ...batch.filter((entry) => matchesSearch(entry, search)),
      );

      if (batch.length < SEARCH_CHUNK_SIZE) break;
      offset += SEARCH_CHUNK_SIZE;
    }

    totalEntries = matchingEntries.length;

    const totalPages = Math.max(
      1,
      Math.ceil(totalEntries / ITEMS_PER_PAGE),
    );

    currentPage = Math.min(requestedPage, totalPages);

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    entries = matchingEntries.slice(start, start + ITEMS_PER_PAGE);
  }

  const totalPages = Math.max(
    1,
    Math.ceil(totalEntries / ITEMS_PER_PAGE),
  );

  return (
    <RegistrosRnuClient
      initialEntries={entries}
      userRole={userRole}
      initialSearch={search}
      initialType={type}
      initialFrom={dateFrom}
      initialTo={dateTo}
      currentPage={currentPage}
      totalPages={totalPages}
      totalEntries={totalEntries}
      todayVisitorCount={todayVisitorCount}
      todayGeneralCount={todayGeneralCount}
      todayInstitutionCount={todayInstitutionCount}
      todayRecordsCount={todayEntries.length}
    />
  );
}
