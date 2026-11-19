"use client";



import dynamic from "next/dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RefreshCw, Maximize2, Minimize2, SlidersHorizontal, ChevronDown, ChevronUp, ListFilter } from "lucide-react";



const LeafletMap = dynamic(() => import("./mapa-leaflet"), {

  ssr: false,

  loading: () => <div className="grid h-full place-items-center text-slate-500">Preparando mapa…</div>,

});



type Complaint = {

  id: number;

  complaint_number: number | null;

  arbolado_number: number | null;

  complaint_date: string;

  complainant_name?: string | null;

  address: string | null;

  street_number: string | null;

  service_id: number | null;

  service_name: string | null;

  cause_name?: string | null;

  status: string;

  zone: string | null;

  details?: string | null;

  resolution_detail?: string | null;

  latlon: string | null;

  form_variant: string | null;

  extra_data?: Record<string, unknown> | null;

};



export type MapComplaint = Complaint & {

  lat: number;

  lng: number;

  effectiveService: number;

  addressKey: string | null;

};

export type MapGroup = { key: string; lat: number; lng: number; complaints: MapComplaint[] };



export const SERVICES: Record<number, { label: string; icon: string; color: string }> = {

  1: { label: "Rec. Domiciliaria", icon: "🗑️", color: "#059669" },

  2: { label: "Rec. Especial", icon: "🚛", color: "#2563eb" },

  3: { label: "Rec. Contenedores", icon: "♻️", color: "#0891b2" },

  4: { label: "Rec. Escuelas y jardines", icon: "🏫", color: "#0d9488" },

  5: { label: "Barrido", icon: "🧹", color: "#ea580c" },

  6: { label: "Riego", icon: "💧", color: "#0284c7" },

  7: { label: "Canales y desagües", icon: "🌊", color: "#7c3aed" },

  8: { label: "Motonivelación", icon: "🚜", color: "#ca8a04" },

  9: { label: "Vectores", icon: "🦟", color: "#be185d" },

  10: { label: "Arbolado", icon: "🌳", color: "#16a34a" },

  11: { label: "Zoonosis", icon: "🐾", color: "#9333ea" },

  12: { label: "Jornadas Integrales", icon: "🧰", color: "#b45309" },

  13: { label: "Inspección", icon: "🔎", color: "#475569" },

  21: { label: "Sin servicio", icon: "📍", color: "#64748b" },

};



// Las Direcciones son AREAS MUNICIPALES, no nombres de calles.

// Cada filtro trabaja solo sobre los reclamos que la API autorizó al usuario.

type DirectionKey = "SP" | "GIRSU" | "AYPU" | "ZYV";

const DIRECTIONS: Record<DirectionKey, { label: string; services: readonly number[] }> = {

  SP: { label: "Servicios Públicos", services: [5, 6, 7, 8, 12] },

  GIRSU: { label: "GIRSU", services: [1, 2, 3, 4, 13] },

  AYPU: { label: "Arbolado y Parques Urbanos", services: [10] },

  ZYV: { label: "Zoonosis y Vectores", services: [9, 11] },

};

const DIRECTION_ORDER: DirectionKey[] = ["SP", "GIRSU", "AYPU", "ZYV"];



const DEFAULT_STYLE = { label: "Sin clasificar", icon: "📍", color: "#64748b" };

export const styleFor = (service: number) => SERVICES[service] ?? DEFAULT_STYLE;



function effectiveService(c: Complaint): number {

  if (c.service_id == null && c.form_variant === "arbolado") return 10;

  return c.service_id ?? 21;

}

function normalizeSearch(s: string): string {

  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

}

function addressKey(c: Complaint): string | null {

  const street = (c.address ?? "").trim();

  const number = (c.street_number ?? "").trim();

  if (!street || !number) return null;

  return JSON.stringify([street, number]);

}

function parseComplaint(c: Complaint): MapComplaint | null {

  if (!c.latlon) return null;

  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(c.latlon);

  if (!match) return null;

  const lat = Number(match[1]);

  const lng = Number(match[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;

  return {

    ...c,

    lat,

    lng,

    effectiveService: effectiveService(c),

    addressKey: addressKey(c),

  };

}

function groupComplaints(items: MapComplaint[]): MapGroup[] {

  const groups = new Map<string, MapGroup>();

  for (const item of items) {

    const key = item.addressKey ? `address:${item.addressKey}` : `id:${item.id}`;

    const previous = groups.get(key);

    if (previous) previous.complaints.push(item);

    else groups.set(key, { key, lat: item.lat, lng: item.lng, complaints: [item] });

  }

  return [...groups.values()];

}

function formatNumber(n: number) {

  return n.toLocaleString("es-AR");

}



type Stats = { total: number; en_proceso: number; resueltos: number; no_resueltos: number };



const STAT_DESCRIPTIONS = [

  { label: "Total de Reclamos", sub: "Reclamos registrados", key: "total", color: "#0d9488" },

  { label: "En Proceso", sub: "Pendientes de resolución", key: "en_proceso", color: "#d97706" },

  { label: "Resueltos", sub: "Casos completados", key: "resueltos", color: "#059669" },

  { label: "No Resueltos", sub: "Casos sin resolución", key: "no_resueltos", color: "#e11d48" },

] as const;



const formatter = new Intl.NumberFormat("es-AR");

function Counts({ stats, repeated, compact }: { stats: Stats | null; repeated: number; compact: boolean }) {

  const values: Array<{ label: string; sub: string; key: string; color: string; value: number | null }> = [

    ...STAT_DESCRIPTIONS.map((s) => ({

      ...s,

      value: stats ? stats[s.key] : null,

    })),

    {

      label: "Reincidentes",

      sub: "Reclamos en direcciones repetidas",

      key: "repeated",

      color: "#7c3aed",

      value: repeated,

    },

  ];

  if (compact) {

    return <div className="mapa-stats-compact">

      {values.map((item) => <div key={item.key} className="mapa-stat-pill">

        <span className="mapa-stat-dot" style={{ background: item.color }} />

        <span className="mapa-stat-label">{item.label}</span>

        <strong style={{ color: item.color }}>{item.value === null ? "—" : formatter.format(item.value)}</strong>

      </div>)}

    </div>;

  }

  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">

    {values.map((item) => <div key={item.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">

      <div className="mb-5 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-200">

        <span>{item.label}</span>

        <span className="mapa-stat-icon" style={{ color: item.color, background: `${item.color}14` }}>●</span>

      </div>

      <div className="text-4xl font-bold tracking-tight" style={{ color: item.color }}>{item.value === null ? "—" : formatter.format(item.value)}</div>

      <p className="mt-2 text-xs text-slate-500">{item.sub}</p>

    </div>)}

  </div>;

}



export default function MapaReclamosClient({ area }: { area: string }) {

  const [items, setItems] = useState<Complaint[]>([]);

  const [stats, setStats] = useState<Stats | null>(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [statsError, setStatsError] = useState("");

  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [direction, setDirection] = useState("all");

  const [service, setService] = useState("all");

  const [status, setStatus] = useState("all");

  const [search, setSearch] = useState("");

  const [onlyRepeated, setOnlyRepeated] = useState(false);

  const [dateFrom, setDateFrom] = useState("");

  const [dateTo, setDateTo] = useState("");

  const [showFilters, setShowFilters] = useState(false);

  const [showLegend, setShowLegend] = useState(false);

  const wrapper = useRef<HTMLDivElement>(null);

  const [fullscreen, setFullscreen] = useState(false);

  const busy = useRef(false);



  const load = useCallback(async () => {

    if (busy.current) return;

    busy.current = true;

    setRefreshing(true);

    try {

      const [mapResult, statsResult] = await Promise.allSettled([

        fetch("/api/complaints/map", { credentials: "same-origin", cache: "no-store" }),

        fetch("/api/complaints/map/stats", { credentials: "same-origin", cache: "no-store" }),

      ]);



      if (mapResult.status !== "fulfilled") throw new Error("No se pudo conectar con el mapa");

      const mapResponse = mapResult.value;

      const mapBody: { data?: Complaint[]; error?: string; updatedAt?: string } = await mapResponse.json();

      if (!mapResponse.ok || !Array.isArray(mapBody.data)) throw new Error(mapBody.error ?? "No se pudieron obtener los reclamos");

      setItems(mapBody.data);

      setUpdatedAt(mapBody.updatedAt ? new Date(mapBody.updatedAt).toLocaleString("es-AR") : new Date().toLocaleString("es-AR"));

      setError("");



      if (statsResult.status === "fulfilled") {

        const statsResponse = statsResult.value;

        const statsBody: { data?: Stats; error?: string } = await statsResponse.json();

        if (statsResponse.ok && statsBody.data) {

          setStats(statsBody.data);

          setStatsError("");

        } else setStatsError(statsBody.error ?? "No se pudieron actualizar las estadísticas");

      } else setStatsError("No se pudieron actualizar las estadísticas");

    } catch (err) {

      setError(err instanceof Error ? err.message : "Error cargando reclamos");

    } finally {

      busy.current = false;

      setLoading(false);

      setRefreshing(false);

    }

  }, []);



  useEffect(() => {

    void load();

    const timer = window.setInterval(() => void load(), 600_000);

    return () => window.clearInterval(timer);

  }, [load]);



  useEffect(() => {

    const handler = () => setFullscreen(document.fullscreenElement === wrapper.current);

    document.addEventListener("fullscreenchange", handler);

    return () => document.removeEventListener("fullscreenchange", handler);

  }, []);



  const parsed = useMemo(() => items.map(parseComplaint).filter((c): c is MapComplaint => Boolean(c)), [items]);

  const availableServices = useMemo(() => [...new Set(parsed.map((c) => c.effectiveService))].sort((a, b) => a - b), [parsed]);

  // Solo mostramos Direcciones que tengan servicios entre los datos permitidos.

  const availableDirections = useMemo(() => {

    const permittedServices = new Set(parsed.map((c) => c.effectiveService));

    return DIRECTION_ORDER.filter((key) =>

      DIRECTIONS[key].services.some((id) => permittedServices.has(id))

    );

  }, [parsed]);



  // Cuando se elige una Dirección, el combo Servicio solo presenta sus servicios.

  const servicesForDirection = useMemo(() => {

    if (direction === "all") return availableServices;

    const directionIds = DIRECTIONS[direction as DirectionKey]?.services ?? [];

    return availableServices.filter((id) => directionIds.includes(id));

  }, [direction, availableServices]);



  const onDirectionChange = (nextDirection: string) => {

    setDirection(nextDirection);

    // No dejar seleccionado un servicio de otra Dirección.

    setService("all");

  };



  const filtered = useMemo(() => parsed.filter((c) => {

    if (direction !== "all" && !DIRECTIONS[direction as DirectionKey]?.services.includes(c.effectiveService)) return false;

    if (service !== "all" && String(c.effectiveService) !== service) return false;

    if (status !== "all" && c.status !== status) return false;

    if (dateFrom && c.complaint_date < dateFrom) return false;

    if (dateTo && c.complaint_date > dateTo) return false;

    if (search.trim()) {

      const needle = normalizeSearch(search);

      const haystack = normalizeSearch(`${c.address ?? ""} ${c.street_number ?? ""} ${c.complaint_number ?? ""} ${c.arbolado_number ?? ""} ${c.complainant_name ?? ""} ${c.details ?? ""} ${c.cause_name ?? ""}`);

      if (!haystack.includes(needle)) return false;

    }

    return true;

  }), [parsed, direction, service, status, search, dateFrom, dateTo]);



  const grouped = useMemo(() => groupComplaints(filtered), [filtered]);

  const displayed = useMemo(() => (onlyRepeated ? grouped.filter((g) => g.complaints.length > 1) : grouped), [grouped, onlyRepeated]);

  const repeatedComplaints = useMemo(() => grouped.reduce((count, group) => count + (group.complaints.length > 1 ? group.complaints.length : 0), 0), [grouped]);



  const toggleFullscreen = async () => {

    if (!wrapper.current) return;

    if (document.fullscreenElement) await document.exitFullscreen();

    else await wrapper.current.requestFullscreen();

  };



  const filters = <div className="mapa-filters-inner">

    <label className="mapa-filter-address">Dirección

      <select value={direction} onChange={(e) => onDirectionChange(e.target.value)}>

        <option value="all">Todas las direcciones</option>

        {availableDirections.map((key) => (

          <option key={key} value={key}>{DIRECTIONS[key].label}</option>

        ))}

      </select>

    </label>

    <label>Servicio<select value={service} onChange={(e) => setService(e.target.value)}><option value="all">Todos</option>{servicesForDirection.map((id) => <option key={id} value={id}>{styleFor(id).label}</option>)}</select></label>

    <label>Estado<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Todos</option>{["En proceso", "Resuelto", "No resuelto"].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>

    <label>Desde<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>

    <label>Hasta<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>

    <label className="mapa-filter-search">Buscar calle o número<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ej.: Calle 12 674" /></label>

    <label className="mapa-filter-check"><input type="checkbox" checked={onlyRepeated} onChange={(e) => setOnlyRepeated(e.target.checked)} /> Reincidentes</label>

  </div>;



  const legend = <div className="mapa-legend-items">

    {availableServices.map((id) => <span key={id}><span style={{ color: styleFor(id).color }}>●</span> {styleFor(id).icon} {styleFor(id).label}</span>)}

  </div>;



  return <div ref={wrapper} className={`mapa-root ${fullscreen ? "mapa-fullscreen" : "mapa-standard"}`}>

    {!fullscreen && <>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">

        <div><h1 className="text-2xl font-bold">Mapa de Reclamos</h1><p className="text-sm text-slate-500">Área: {area} · Actualización cada 10 minutos · {updatedAt ? `Actualizado: ${updatedAt}` : "Cargando…"}</p></div>

        <div className="flex items-center gap-2">

          <button className="mapa-button mapa-primary" disabled={refreshing} onClick={() => void load()}><RefreshCw size={14} /> {refreshing ? "Actualizando…" : "Actualizar"}</button>

        </div>

      </div>

      <Counts stats={stats} repeated={repeatedComplaints} compact={false}/>

      <div className="mapa-filters-standard">{filters}</div>

    </>}



    {error && <div className="mapa-error">{error}. {items.length ? "Se conservan los últimos datos cargados." : ""}</div>}

    {statsError && !fullscreen && <p className="mt-2 text-xs text-amber-700">{statsError}. Comprobá que ejecutaste el SQL de estadísticas.</p>}



    <div className="mapa-map-area">

      {loading ? <div className="grid h-full place-items-center">Cargando reclamos…</div> : <LeafletMap groups={displayed} />}

      {!fullscreen && (
        <button
          type="button"
          className="mapa-fullscreen-map-button"
          onClick={() => void toggleFullscreen()}
          title="Ver mapa en pantalla completa"
          aria-label="Ver mapa en pantalla completa"
        >
          <Maximize2 size={20} />
        </button>
      )}



      {fullscreen && <>

        <div className="mapa-mini-header">

          <div className="mapa-mini-title"><strong>Mapa de Reclamos</strong><span>{area}</span></div>

          <Counts stats={stats} repeated={repeatedComplaints} compact />

          <div className="mapa-mini-actions">

            <button className="mapa-icon-button" title="Actualizar" aria-label="Actualizar" disabled={refreshing} onClick={() => void load()}><RefreshCw size={15} /></button>

            <button className="mapa-icon-button" title="Filtros" aria-label="Filtros" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}><SlidersHorizontal size={16} /></button>

            <button className="mapa-icon-button" title="Salir de pantalla completa" aria-label="Salir de pantalla completa" onClick={() => void toggleFullscreen()}><Minimize2 size={16} /></button>

          </div>

        </div>

        {showFilters && <div className="mapa-mini-filters">{filters}</div>}

        <div className="mapa-floating-legend">

          <button className="mapa-legend-trigger" onClick={() => setShowLegend((v) => !v)} aria-expanded={showLegend}>

            <ListFilter size={14} /> Leyenda {showLegend ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}

          </button>

          {showLegend && legend}

        </div>

        <span className="mapa-last-update">{updatedAt ? `Actualizado: ${updatedAt}` : "Cargando datos…"}</span>

      </>}

    </div>

    {!fullscreen && <div className="mapa-legend-normal">{legend}</div>}

  </div>;

}
