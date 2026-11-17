import Link from "next/link";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {

  ArrowLeft,

  BarChart3,

  CalendarDays,

  ChevronLeft,

  ChevronRight,

  ClipboardList,

  FilePlus2,

  FileSearch,

  LockKeyhole,

  MapPin,

  MapPinned,

  RotateCcw,

  Search,

  ShieldCheck,

} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { InterventionSaveFeedback } from "./_save-feedback";

import { DeleteInterventionButton } from "./_delete-button";

import { EditInterventionLink } from "./_edit-link";
import { InterventionNavigationButton } from "./_intervention-navigation-button";

const LUCAS_EMAIL = "arqbelliardolucas\@gmail.com";

const PAGE_SIZE = 20;

const BASE_URL = "/dashboard/solicitud-intervenciones";

const COLUMNS =

  "id, expediente, fecha, fecha_original, nombre_apellido, tipo, cantidad, especie, ubicacion_calle, estado, derivacion, anio_original, retirado";

type SearchParams = {

  q?: string | string[];

  tipo?: string | string[];

  estado?: string | string[];

  anio?: string | string[];

  page?: string | string[];

  guardado?: string | string[];

  orden?: string | string[];

};

type PageProps = { searchParams?: Promise<SearchParams> };

type Filters = { q: string; tipo: string; estado: string; anio: string; orden: string };

type FilterOption = { categoria: string; valor: string };

type Intervention = {

  id: string;

  expediente: string | null;

  fecha: string | null;

  fecha_original: string | null;

  nombre_apellido: string | null;

  tipo: string | null;

  cantidad: number | null;

  especie: string | null;

  ubicacion_calle: string | null;

  estado: string | null;

  derivacion: string | null;

  anio_original: string | null;

  retirado: string | null;

};

const normalize = (value: unknown) =>

  String(value ?? "")

    .trim()

    .toLowerCase()

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")

    .replace(/\s+/g, "");

function firstParam(value: string | string[] | undefined) {

  return typeof value === "string"

    ? value

    : Array.isArray(value)

      ? value[0] ?? ""

      : "";

}

function show(value: unknown) {

  return value === null || value === undefined || String(value).trim() === ""

    ? "—"

    : String(value);

}

function formatDate(value: string | null, original: string | null) {

  if (!value) return show(original);

  const parts = value.split("-");

  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;

}

function buildUrl(filters: Filters, page: number) {

  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);

  if (filters.tipo) params.set("tipo", filters.tipo);

  if (filters.estado) params.set("estado", filters.estado);

  if (filters.anio) params.set("anio", filters.anio);

  if (filters.orden !== "recientes") params.set("orden", filters.orden);

  if (page > 1) params.set("page", String(page));

  const suffix = params.toString();

  return `${BASE_URL}${suffix ? `?${suffix}` : ""}`;

}

function StatusBadge({ status }: { status: string | null }) {

  const normalized = normalize(status);

  const color = normalized === "autorizado"

    ? "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200"

    : normalized === "denegado" || normalized === "denegada"

      ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"

      : "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";

  return (

    <span className={`inline-flex max-w-full rounded-full border px-2.5 py-1 text-[11px] font-semibold ${color}`}>

      {show(status)}

    </span>

  );

}

function MobileField({

  label,

  value,

}: {

  label: string;

  value: string | number | null;

}) {

  return (

    <div className="min-w-0 space-y-0.5">

      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>

      <dd className="break-words text-sm text-foreground">{show(value)}</dd>

    </div>

  );

}

export default async function SolicitudIntervencionesPage({

  searchParams,

}: PageProps) {

  const supabase = await createClient();

  const {

    data: { user },

    error: authError,

  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data: profile, error: profileError } = await supabase

    .from("users")

    .select("role, email, is_readonly")

    .eq("id", user.id)

    .single();

  if (profileError || !profile) redirect("/dashboard/accesos");

  const role = normalize(profile.role);

  const email = normalize(profile.email || user.email);

  const canAccess =

    role === "admin" ||

    role === "adminlectura" ||

    role === "reclamosarbolado" ||

    email === normalize(LUCAS_EMAIL);

  if (!canAccess) redirect("/dashboard/accesos");

  const isReadOnly = role === "adminlectura" || profile.is_readonly === true;

  const raw = (await searchParams) ?? {};

  // El RPC devuelve DISTINCT directamente en la base: no trae miles de filas al navegador.

  // Ejecutar primero el archivo SQL que acompaña esta página.

  const { data: optionsData, error: optionsError } = await supabase.rpc(

    "opciones_filtros_intervenciones",

  );

  const options = (optionsData ?? []) as FilterOption[];

  const valuesFor = (category: string) =>

    Array.from(

      new Set(

        options

          .filter((option) => option.categoria === category)

          .map((option) => option.valor)

          .filter((value) => typeof value === "string" && value.trim() !== ""),

      ),

    ).sort((a, b) =>

      category === "anio"

        ? b.localeCompare(a, "es-AR", { numeric: true })

        : a.localeCompare(b, "es-AR"),

    );

  const types = valuesFor("tipo");

  const statuses = valuesFor("estado");

  const years = valuesFor("anio");

  // Restringimos los filtros a valores devueltos por la base real.

  const requestedType = firstParam(raw.tipo);

  const requestedStatus = firstParam(raw.estado);

  const requestedYear = firstParam(raw.anio);

  const tipo = types.includes(requestedType) ? requestedType : "";

  const estado = statuses.includes(requestedStatus) ? requestedStatus : "";

  const anio = years.includes(requestedYear) ? requestedYear : "";

  // Los caracteres de control de PostgREST se excluyen del buscador.

  const q = firstParam(raw.q)

    .replace(/[^\p{L}\p{N}\s-]/gu, "")

    .trim()

    .slice(0, 80);

  // El orden se valida del lado del servidor: nunca usamos columnas arbitrarias de la URL.

  const allowedOrders = ["recientes", "antiguos", "nombre_asc", "nombre_desc", "expediente_asc", "expediente_desc"];

  const requestedOrder = firstParam(raw.orden);

  const orden = allowedOrders.includes(requestedOrder) ? requestedOrder : "recientes";

  const numericPage = Number(firstParam(raw.page));

  const requestedPage =

    Number.isSafeInteger(numericPage) && numericPage > 0

      ? Math.min(numericPage, 100000)

      : 1;

  const makeQuery = (withCount: boolean) => {

    let query = supabase

      .from("solicitudes_intervencion")

      .select(COLUMNS, withCount ? { count: "exact" } : {});

    if (q) {

      const term = `%${q}%`;

      query = query.or(

        `expediente.ilike.${term},nombre_apellido.ilike.${term},ubicacion_calle.ilike.${term},especie.ilike.${term}`,

      );

    }

    if (tipo) query = query.eq("tipo", tipo);

    if (estado) query = query.eq("estado", estado);

    if (anio) query = query.eq("anio_original", anio);

    return query;

  };

  const withSorting = (query: ReturnType<typeof makeQuery>) => {

    switch (orden) {

      case "antiguos":

        return query.order("fecha", { ascending: true, nullsFirst: false })

          .order("source_row", { ascending: true, nullsFirst: false })

          .order("id", { ascending: true });

      case "nombre_asc":

        return query.order("nombre_apellido", { ascending: true, nullsFirst: false })

          .order("fecha", { ascending: false, nullsFirst: false })

          .order("id", { ascending: true });

      case "nombre_desc":

        return query.order("nombre_apellido", { ascending: false, nullsFirst: false })

          .order("fecha", { ascending: false, nullsFirst: false })

          .order("id", { ascending: true });

      case "expediente_asc":

        return query.order("expediente", { ascending: true, nullsFirst: false })

          .order("id", { ascending: true });

      case "expediente_desc":

        return query.order("expediente", { ascending: false, nullsFirst: false })

          .order("id", { ascending: true });

      default:

        return query.order("fecha", { ascending: false, nullsFirst: false })

          .order("source_row", { ascending: false, nullsFirst: false })

          .order("id", { ascending: true });

    }

  };

  const result = await withSorting(makeQuery(true))

    .range((requestedPage - 1) * PAGE_SIZE, requestedPage * PAGE_SIZE - 1);

  const total = result.count ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const page = Math.min(requestedPage, totalPages);

  let rows = (result.data ?? []) as unknown as Intervention[];

  let errorMessage = result.error?.message ?? null;

  if (!errorMessage && page !== requestedPage) {

    const fallback = await withSorting(makeQuery(false))

      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    rows = (fallback.data ?? []) as unknown as Intervention[];

    errorMessage = fallback.error?.message ?? null;

  }

  const filters = { q, tipo, estado, anio, orden };

  const hasFilters = Boolean(q || tipo || estado || anio);

  return (

    <main className="w-full min-w-0 space-y-5 px-3 py-5 sm:px-5 lg:px-7 2xl:px-10">

      <header className="flex flex-wrap items-center justify-between gap-3">

        <div className="min-w-0 space-y-1">

          <Link

            href="/dashboard/accesos"

            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#00A27F]"

          >

            <ArrowLeft className="h-3.5 w-3.5" /> Volver a Accesos

          </Link>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">

            Solicitud de Intervenciones

          </h1>

          <p className="text-sm text-muted-foreground">

            Gestión y seguimiento de solicitudes de intervención de arbolado.

          </p>

        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-[#00A27F]/25 bg-[#00A27F]/10 px-3 py-2 text-xs font-semibold text-[#008C70] dark:text-[#00D6AA]">

          {isReadOnly ? (

            <LockKeyhole className="h-4 w-4" />

          ) : (

            <ShieldCheck className="h-4 w-4" />

          )}

          {isReadOnly ? "Modo solo lectura" : "Acceso de edición"}

        </span>

      </header>

      <InterventionSaveFeedback status={firstParam(raw.guardado)} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <Card className="flex min-h-[188px] flex-col gap-0 rounded-xl py-5 shadow-sm">

          <CardHeader className="flex flex-row items-center gap-2.5 px-5 pb-3">

            <ClipboardList className="h-5 w-5 shrink-0 text-[#00A27F]" />

            <CardTitle className="text-base font-semibold">Solicitudes</CardTitle>

          </CardHeader>

          <CardContent className="flex flex-1 flex-col justify-center gap-1 px-5">

            <p className="text-3xl font-bold tracking-tight tabular-nums sm:text-[32px]">

              {errorMessage ? "—" : total.toLocaleString("es-AR")}

            </p>

            <p className="text-sm text-muted-foreground">

              {hasFilters ? "Coinciden con los filtros" : "Registros históricos"}

            </p>

          </CardContent>

        </Card>

        <Card className="flex min-h-[188px] flex-col gap-0 rounded-xl py-5 shadow-sm">

          <CardHeader className="flex flex-row items-center gap-2.5 px-5 pb-3">

            <FilePlus2 className="h-5 w-5 shrink-0 text-[#00A27F]" />

            <CardTitle className="text-base font-semibold">Nueva solicitud</CardTitle>

          </CardHeader>

          <CardContent className="flex flex-1 flex-col justify-between gap-4 px-5">

            <p className="text-sm leading-relaxed text-muted-foreground">

              Carga de nuevas intervenciones.

            </p>

            {isReadOnly ? (

              <Button disabled className="h-11 w-full rounded-lg text-sm font-semibold sm:text-base">

                Solo lectura

              </Button>

            ) : (

              <InterventionNavigationButton href={`${BASE_URL}/nueva`} label="Nueva solicitud" icon="nueva" />

            )}

          </CardContent>

        </Card>

        <Card className="flex min-h-[188px] flex-col gap-0 rounded-xl py-5 shadow-sm">

          <CardHeader className="flex flex-row items-center gap-2.5 px-5 pb-3">

            <MapPinned className="h-5 w-5 shrink-0 text-[#00A27F]" />

            <CardTitle className="text-base font-semibold">Mapa de intervenciones</CardTitle>

          </CardHeader>

          <CardContent className="flex flex-1 flex-col justify-between gap-4 px-5">

            <p className="text-sm leading-relaxed text-muted-foreground">

              Visualizá solicitudes en el mapa y consultá su historial.

            </p>

            <InterventionNavigationButton href={`${BASE_URL}/mapa`} label="Ver mapa" icon="mapa" />

          </CardContent>

        </Card>

        <Card className="flex min-h-[188px] flex-col gap-0 rounded-xl py-5 shadow-sm">

          <CardHeader className="flex flex-row items-center gap-2.5 px-5 pb-3">

            <BarChart3 className="h-5 w-5 shrink-0 text-[#00A27F]" />

            <CardTitle className="text-base font-semibold">Estadísticas</CardTitle>

          </CardHeader>

          <CardContent className="flex flex-1 flex-col justify-between gap-4 px-5">

            <p className="text-sm leading-relaxed text-muted-foreground">

              Consultá indicadores y comparativas con datos actualizados.

            </p>

            <InterventionNavigationButton href={`${BASE_URL}/estadisticas`} label="Ver estadísticas" icon="estadisticas" />

          </CardContent>

        </Card>

      </div>

      <Card className="min-w-0 gap-0 overflow-hidden rounded-xl py-0">

        <CardHeader className="gap-1 border-b px-4 py-4 sm:px-5">

          <div className="flex flex-wrap items-center justify-between gap-2">

            <div className="flex items-center gap-2">

              <FileSearch className="h-5 w-5 text-[#00A27F]" />

              <CardTitle className="text-base sm:text-lg">

                Listado de intervenciones

              </CardTitle>

            </div>

            <span className="text-xs text-muted-foreground">

              {errorMessage

                ? "Datos no disponibles"

                : `${total.toLocaleString("es-AR")} resultados`}

            </span>

          </div>

          <p className="text-xs text-muted-foreground">

            Todas las solicitudes registradas. Los expedientes repetidos se

            conservan como registros independientes.

          </p>

        </CardHeader>

        <CardContent className="min-w-0 space-y-4 px-3 py-4 sm:px-5">

          <form

            method="GET"

            action={BASE_URL}

            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(230px,2fr)_repeat(4,minmax(125px,1fr))_auto] xl:items-end"

          >

            <label className="space-y-1">

              <span className="text-xs font-medium">Buscar</span>

              <span className="relative block">

                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <input

                  name="q"

                  type="search"

                  defaultValue={q}

                  maxLength={80}

                  placeholder="Expediente, vecino, calle o especie"

                  className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#00A27F]/30"

                />

              </span>

            </label>

            <label className="space-y-1">

              <span className="text-xs font-medium">Tipo</span>

              <select

                name="tipo"

                defaultValue={tipo}

                disabled={Boolean(optionsError)}

                className="h-10 w-full rounded-lg border bg-background px-2 text-sm disabled:opacity-60"

              >

                <option value="">Todos</option>

                {types.map((value) => (

                  <option key={value} value={value}>

                    {value}

                  </option>

                ))}

              </select>

            </label>

            <label className="space-y-1">

              <span className="text-xs font-medium">Estado</span>

              <select

                name="estado"

                defaultValue={estado}

                disabled={Boolean(optionsError)}

                className="h-10 w-full rounded-lg border bg-background px-2 text-sm disabled:opacity-60"

              >

                <option value="">Todos</option>

                {statuses.map((value) => (

                  <option key={value} value={value}>

                    {value}

                  </option>

                ))}

              </select>

            </label>

            <label className="space-y-1">

              <span className="text-xs font-medium">Año</span>

              <select

                name="anio"

                defaultValue={anio}

                disabled={Boolean(optionsError)}

                className="h-10 w-full rounded-lg border bg-background px-2 text-sm disabled:opacity-60"

              >

                <option value="">Todos</option>

                {years.map((value) => (

                  <option key={value} value={value}>

                    {value}

                  </option>

                ))}

              </select>

            </label>

            <label className="space-y-1">

              <span className="text-xs font-medium">Ordenar por</span>

              <select name="orden" defaultValue={orden} className="h-10 w-full rounded-lg border bg-background px-2 text-sm">

                <option value="recientes">Fecha: más reciente</option>

                <option value="antiguos">Fecha: más antigua</option>

                <option value="nombre_asc">Nombre: A a Z</option>

                <option value="nombre_desc">Nombre: Z a A</option>

                <option value="expediente_asc">Expediente: A a Z</option>

                <option value="expediente_desc">Expediente: Z a A</option>

              </select>

            </label>

            <div className="flex gap-2 sm:col-span-2 xl:col-span-1">

              <Button

                type="submit"

                className="h-10 flex-1 bg-[#00A27F] hover:bg-[#008C70] xl:flex-none"

              >

                Filtrar

              </Button>

              <Button

                asChild

                type="button"

                variant="outline"

                size="icon"

                className="h-10 w-10 shrink-0"

                title="Limpiar filtros"

              >

                <Link href={BASE_URL}>

                  <RotateCcw className="h-4 w-4" />

                  <span className="sr-only">Limpiar filtros</span>

                </Link>

              </Button>

            </div>

          </form>

          {optionsError && (

            <div role="alert" className="rounded-lg border border-amber-300/50 bg-amber-50/60 p-3 text-xs text-amber-900 dark:bg-amber-950/25 dark:text-amber-200">

              No se pudieron cargar los desplegables desde Supabase. Verificá

              que ejecutaste <code>01_filtros_dinamicos.sql</code> y que el rol

              autenticado tiene permiso para ejecutar la función.

              <span className="mt-1 block break-words opacity-80">

                {optionsError.message}

              </span>

            </div>

          )}

          {errorMessage ? (

            <div

              role="alert"

              className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm"

            >

              No se pudieron consultar las solicitudes. Revisá la conexión y las

              políticas RLS.

              <p className="mt-2 break-words text-xs text-muted-foreground">

                Detalle: {errorMessage}

              </p>

            </div>

          ) : rows.length === 0 ? (

            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">

              No se encontraron solicitudes con esos filtros.

            </div>

          ) : (

            <>

              {/* Escritorio: todas las columnas, scroll horizontal en pantallas angostas. */}

              <div className="hidden w-full min-w-0 overflow-x-auto rounded-xl border lg:block">

                <table className="w-full min-w-[1330px] table-auto text-left text-[12px] xl:text-[13px]">

                  <thead className="bg-muted/65 text-[11px] text-muted-foreground">

                    <tr>

                      <th className="whitespace-nowrap px-3 py-3 font-semibold">Expediente</th>

                      <th className="whitespace-nowrap px-3 py-3 font-semibold">Fecha</th>

                      <th className="min-w-[155px] px-3 py-3 font-semibold">Nombre y apellido</th>

                      <th className="whitespace-nowrap px-3 py-3 font-semibold">Tipo</th>

                      <th className="px-3 py-3 text-center font-semibold">Cant.</th>

                      <th className="min-w-[110px] px-3 py-3 font-semibold">Especie</th>

                      <th className="min-w-[170px] px-3 py-3 font-semibold">Ubicación / calle</th>

                      <th className="px-3 py-3 font-semibold">Estado</th>

                      <th className="min-w-[115px] px-3 py-3 font-semibold">¿Se derivó?</th>

                      <th className="whitespace-nowrap px-3 py-3 font-semibold">¿Retirado?</th>

                      <th className="px-3 py-3 font-semibold">Año</th>

                      {!isReadOnly && <th className="px-3 py-3 font-semibold">Acciones</th>}

                    </tr>

                  </thead>

                  <tbody className="divide-y">

                    {rows.map((item) => (

                      <tr

                        key={item.id}

                        className="

    align-middle

    transition-colors

    odd:bg-white

    even:bg-slate-100/70

    hover:!bg-[#00A27F]/10

    dark:odd:bg-background

    dark:even:bg-slate-800/40

    dark:hover:!bg-[#00A27F]/15

  "

                      >

                        <td className="px-3 py-3 font-semibold tabular-nums">{show(item.expediente)}</td>

                        <td className="whitespace-nowrap px-3 py-3 tabular-nums">{formatDate(item.fecha, item.fecha_original)}</td>

                        <td className="px-3 py-3 font-medium">{show(item.nombre_apellido)}</td>

                        <td className="whitespace-nowrap px-3 py-3">{show(item.tipo)}</td>

                        <td className="px-3 py-3 text-center tabular-nums">{show(item.cantidad)}</td>

                        <td className="px-3 py-3">{show(item.especie)}</td>

                        <td className="px-3 py-3">{show(item.ubicacion_calle)}</td>

                        <td className="px-3 py-3"><StatusBadge status={item.estado} /></td>

                        <td className="px-3 py-3">{show(item.derivacion)}</td>

                        <td className="px-3 py-3">{show(item.retirado)}</td>

                        <td className="px-3 py-3 tabular-nums">{show(item.anio_original)}</td>

                        {!isReadOnly && (

                          <td className="px-3 py-3">

                            <div className="flex items-center gap-3 whitespace-nowrap">

                              <EditInterventionLink href={`${BASE_URL}/${item.id}/editar`} />

                              <DeleteInterventionButton id={item.id} expediente={show(item.expediente)} nombre={show(item.nombre_apellido)} />

                            </div>

                          </td>

                        )}

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

              {/* Celular y tablet: tarjetas con la misma información, sin scroll lateral. */}

              <div className="grid gap-3 sm:grid-cols-2 lg:hidden">

                {rows.map((item) => (

                  <article key={item.id} className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">

                    <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3">

                      <div>

                        <p className="text-[11px] text-muted-foreground">Expediente</p>

                        <p className="text-base font-bold">{show(item.expediente)}</p>

                      </div>

                      <StatusBadge status={item.estado} />

                    </div>

                    <p className="mt-3 break-words text-sm font-semibold">{show(item.nombre_apellido)}</p>

                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">

                      <CalendarDays className="h-3.5 w-3.5" />

                      {formatDate(item.fecha, item.fecha_original)}

                    </div>

                    <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">

                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                      <span className="break-words">{show(item.ubicacion_calle)}</span>

                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 rounded-lg bg-muted/35 p-3">

                      <MobileField label="Tipo" value={item.tipo} />

                      <MobileField label="Cantidad" value={item.cantidad} />

                      <MobileField label="Especie" value={item.especie} />

                      <MobileField label="Año" value={item.anio_original} />

                      <MobileField label="¿Se derivó?" value={item.derivacion} />

                      <MobileField label="¿Retirado?" value={item.retirado} />

                    </dl>

                    {!isReadOnly && (

                      <div className="mt-3 flex flex-wrap items-center gap-4">

                        <EditInterventionLink href={`${BASE_URL}/${item.id}/editar`} mobile />

                        <DeleteInterventionButton id={item.id} expediente={show(item.expediente)} nombre={show(item.nombre_apellido)} />

                      </div>

                    )}

                  </article>

                ))}

              </div>

              <div className="flex flex-col gap-3 border-t pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">

                <span>

                  Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString("es-AR")} solicitudes

                </span>

                <nav aria-label="Paginación" className="flex flex-wrap items-center gap-2">

                  {page > 1 ? (

                    <Button asChild variant="outline" size="sm">

                      <Link href={buildUrl(filters, page - 1)}>

                        <ChevronLeft className="mr-1 h-4 w-4" /> Anterior

                      </Link>

                    </Button>

                  ) : (

                    <Button variant="outline" size="sm" disabled>

                      <ChevronLeft className="mr-1 h-4 w-4" /> Anterior

                    </Button>

                  )}

                  <span className="whitespace-nowrap px-1">Página {page} de {totalPages}</span>

                  {page < totalPages ? (

                    <Button asChild variant="outline" size="sm">

                      <Link href={buildUrl(filters, page + 1)}>

                        Siguiente <ChevronRight className="ml-1 h-4 w-4" />

                      </Link>

                    </Button>

                  ) : (

                    <Button variant="outline" size="sm" disabled>

                      Siguiente <ChevronRight className="ml-1 h-4 w-4" />

                    </Button>

                  )}

                </nav>

              </div>

            </>

          )}

        </CardContent>

      </Card>

    </main>

  );

}
