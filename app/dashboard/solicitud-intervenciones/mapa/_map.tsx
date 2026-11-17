"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, RotateCcw, Pencil, ListFilter, TreePine, Layers3, Maximize2, Minimize2, Save, X, LocateFixed, CalendarRange, History } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";

type MapPoint = {
  id: string;
  expediente: string | null;
  nombre_apellido: string | null;
  ubicacion_calle: string | null;
  tipo: string | null;
  especie: string | null;
  estado: string | null;
  retirado: string | null;
  anio_original: string | null;
  fecha: string | null;
  cantidad: number | null;
  latitud: number | null;
  longitud: number | null;
};

type Props = {
  points: MapPoint[];
  pending: MapPoint[];
  pendingCount: number;
  total: number;
  geocoded: number;
  limited: boolean;
  canEdit: boolean;
};

type GroupStatus = "autorizado" | "denegado" | "mixto" | "otro";

type PointGroup = {
  key: string;
  lat: number;
  lng: number;
  items: MapPoint[];
  status: GroupStatus;
};

const BASE = "/dashboard/solicitud-intervenciones";

// La vista inicial se limita al año en curso; el botón Histórico muestra todas las fechas.
// Se utiliza fecha (DATE real) y no anio_original, que puede provenir de registros antiguos.
const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_FROM = `${CURRENT_YEAR}-01-01`;
const DEFAULT_TO = `${CURRENT_YEAR}-12-31`;

function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const normalize = (value: string | null) => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR");
const display = (value: string | number | null) =>
  value === null || String(value).trim() === "" ? "—" : String(value);

function classifyStatus(value: string | null): Exclude<GroupStatus, "mixto"> {
  const normalized = normalize(value).trim();
  if (normalized === "autorizado") return "autorizado";
  if (normalized === "denegado" || normalized === "denegada") return "denegado";
  return "otro";
}

function groupStatus(items: MapPoint[]): GroupStatus {
  const statuses = new Set(items.map(item => classifyStatus(item.estado)));
  return statuses.size === 1 ? [...statuses][0] : "mixto";
}

function groupPoints(points: MapPoint[]): PointGroup[] {
  const grouped = new Map<string, PointGroup>();
  for (const point of points) {
    const lat = Number(point.latitud);
    const lng = Number(point.longitud);
    if (point.latitud == null || point.longitud == null || !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

    // Agrupar coordenadas prácticamente idénticas. No unir direcciones distintas por cercanía.
    const key = `${lat.toFixed(7)}|${lng.toFixed(7)}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.items.push(point);
    } else {
      grouped.set(key, { key, lat, lng, items: [point], status: "otro" });
    }
  }
  for (const group of grouped.values()) group.status = groupStatus(group.items);
  return Array.from(grouped.values());
}

const colors: Record<GroupStatus, { fill: string; border: string; foreground: string }> = {
  autorizado: { fill: "#e0f2fe", border: "#0284c7", foreground: "#075985" },
  denegado: { fill: "#fef3c7", border: "#d97706", foreground: "#92400e" },
  mixto: { fill: "#ede9fe", border: "#7c3aed", foreground: "#5b21b6" },
  otro: { fill: "#f1f5f9", border: "#64748b", foreground: "#334155" },
};

function markerColor(status: string | null) {
  return colors[classifyStatus(status)].border;
}

// Íconos memoizados: no volvemos a generar SVG por cada marcador o clic.
const iconCache = new Map<string, Leaflet.DivIcon>();
function treeIcon(L: typeof Leaflet, group: PointGroup, active: boolean): Leaflet.DivIcon {
  const count = group.items.length;
  const cacheKey = `${group.status}|${Math.min(count, 1000)}|${active ? 1 : 0}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;
  const palette = colors[group.status];
  const size = 36; // Antes 48 px. Siguen siendo árboles individuales, NO clústeres.
  const treeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="${palette.foreground}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 4 5h-2l4 5h-3l3 5H6l3-5H6l4-5H8l4-5Z"/><path d="M12 18v3"/></svg>`;
  const badge = count > 1 ? `<span style="position:absolute;top:-7px;right:-8px;min-width:19px;height:19px;padding:0 3px;box-sizing:border-box;border:2px solid #fff;border-radius:12px;background:${palette.border};color:#fff;display:flex;align-items:center;justify-content:center;font:700 10px/1 system-ui,sans-serif">${count > 999 ? '999+' : count}</span>` : '';
  const icon = L.divIcon({
    className: 'intervention-tree-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="position:relative;box-sizing:border-box;width:${size}px;height:${size}px;border-radius:50%;background:${palette.fill};border:2px solid ${palette.border};display:flex;align-items:center;justify-content:center;box-shadow:${active ? '0 0 0 3px rgba(0,162,127,.35)' : '0 1px 4px rgba(0,0,0,.16)'}">${treeSvg}${badge}</div>`,
  });
  iconCache.set(cacheKey, icon);
  return icon;
}

function MapCanvas({ groups, onPick, selectedKey, placing, picking, candidate, onPlace }: {
  groups: PointGroup[];
  onPick: (key: string) => void;
  selectedKey: string | null;
  placing: boolean;
  picking: boolean;
  candidate: { lat: number; lng: number } | null;
  onPlace: (lat: number, lng: number) => void;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const moduleRef = useRef<typeof Leaflet | null>(null);
  const pickRef = useRef(onPick);
  const placeRef = useRef(onPlace);
  const placingRef = useRef(placing);
  const pickingRef = useRef(picking);
  const candidateLayerRef = useRef<Leaflet.Marker | null>(null);
  const groupsRef = useRef(groups);
  const selectedRef = useRef(selectedKey);
  const displayedMarkersRef = useRef<Map<string, Leaflet.Marker>>(new Map());
  const refreshVisibleRef = useRef<() => void>(() => {});
  const [initialized, setInitialized] = useState(0);
  pickRef.current = onPick;
  placeRef.current = onPlace;
  placingRef.current = placing;
  pickingRef.current = picking;
  groupsRef.current = groups;
  selectedRef.current = selectedKey;

  // Solo dibuja los árboles visibles (y un pequeño margen). No mezcla domicilios.
  // Se actualiza al terminar el desplazamiento, no continuamente mientras se arrastra.
  refreshVisibleRef.current = () => {
    const L = moduleRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    const bounds = map.getBounds().pad(0.20);
    const existing = displayedMarkersRef.current;
    const visibleKeys = new Set<string>();
    for (const group of groupsRef.current) {
      if (!bounds.contains([group.lat, group.lng])) continue;
      visibleKeys.add(group.key);
      if (existing.has(group.key)) continue;
      const marker = L.marker([group.lat, group.lng], {
        icon: treeIcon(L, group, selectedRef.current === group.key),
        keyboard: true,
        riseOnHover: true,
      });
      marker.on('click', () => {
        if (!placingRef.current) pickRef.current(group.key);
      });
      marker.bindTooltip(group.items.length === 1
        ? `Expediente ${display(group.items[0].expediente)}`
        : `${group.items.length} solicitudes en esta ubicación`,
        { direction: 'top', offset: [0, -16] });
      marker.addTo(layer);
      existing.set(group.key, marker);
    }
    for (const [key, marker] of existing) {
      if (!visibleKeys.has(key)) {
        layer.removeLayer(marker);
        existing.delete(key);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function mount() {
      const L = await import("leaflet");
      if (cancelled || !elementRef.current || mapRef.current) return;
      moduleRef.current = L;
      const map = L.map(elementRef.current, { scrollWheelZoom: true }).setView([-35.669, -63.747], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      // El navegador mueve los marcadores existentes durante el drag;
      // recién al terminar se ajustan los del área visible.
      map.on('moveend zoomend', () => refreshVisibleRef.current());
      map.on("click", (event: Leaflet.LeafletMouseEvent) => {
        // Solo colocar un pin si el usuario activó explícitamente el modo de selección.
        if (placingRef.current && pickingRef.current) {
          placeRef.current(event.latlng.lat, event.latlng.lng);
        }
      });
      setInitialized(v => v + 1);
    }
    void mount();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      candidateLayerRef.current = null;
      moduleRef.current = null;
      displayedMarkersRef.current.clear();
    };
  }, []);

  // Leaflet no recalcula automáticamente su superficie al cambiar el tamaño
  // de la ventana o abrir/cerrar la vista ampliada.
  useEffect(() => {
    const container = elementRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        mapRef.current?.invalidateSize({ pan: false, debounceMoveend: true });
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [initialized]);

  // Los filtros cambian el conjunto de marcadores, pero seleccionar un árbol
  // NO destruye ni vuelve a crear los otros mil marcadores.
  useEffect(() => {
    const L = moduleRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    for (const marker of displayedMarkersRef.current.values()) layer.removeLayer(marker);
    displayedMarkersRef.current.clear();
    if (groups.length > 0) {
      map.fitBounds(L.latLngBounds(groups.map(g => [g.lat, g.lng] as [number, number])), {
        padding: [45, 45], maxZoom: 16,
      });
    } else {
      map.setView([-35.669, -63.747], 13);
    }
    refreshVisibleRef.current();
  }, [groups, initialized]);

  // Solo cambia el estilo del seleccionado, sin volver a renderizar todo el mapa.
  const lastSelectionRef = useRef<string | null>(null);
  useEffect(() => {
    const L = moduleRef.current;
    if (!L) return;
    const previous = lastSelectionRef.current;
    lastSelectionRef.current = selectedKey;
    for (const key of [previous, selectedKey]) {
      if (!key) continue;
      const marker = displayedMarkersRef.current.get(key);
      const group = groupsRef.current.find(g => g.key === key);
      if (marker && group) marker.setIcon(treeIcon(L, group, key === selectedKey));
    }
  }, [selectedKey, initialized]);

  // Pin temporal arrastrable: nunca se guarda hasta confirmar.
  useEffect(() => {
    const L = moduleRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    candidateLayerRef.current?.remove();
    candidateLayerRef.current = null;
    if (!placing || !candidate) return;
    const icon = L.divIcon({
      className: "intervention-manual-pin",
      html: '<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#db2777;border:3px solid #fff;box-shadow:0 2px 10px #0007"><span style="display:block;width:9px;height:9px;border-radius:50%;background:white;margin:7px"></span></div>',
      iconSize: [34, 39],
      iconAnchor: [16, 35],
    });
    const marker = L.marker([candidate.lat, candidate.lng], { draggable: true, icon }).addTo(map);
    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      placeRef.current(pos.lat, pos.lng);
    });
    candidateLayerRef.current = marker;
    return () => { marker.remove(); candidateLayerRef.current = null; };
  }, [placing, candidate?.lat, candidate?.lng, initialized]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getContainer().style.cursor = placing && picking ? "crosshair" : "";
  }, [placing, picking, initialized]);

  return <div ref={elementRef} role="region" aria-label={placing && picking ? "Hacé clic para colocar el marcador" : "Mapa de solicitudes georreferenciadas"} className="h-full min-h-0 w-full rounded-xl bg-muted" />;
}

function RequestDetail({ item, canEdit }: { item: MapPoint; canEdit: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="break-words text-lg font-bold">Expediente {display(item.expediente)}</h3>
        <span className="rounded-full border px-2 py-1 text-[10px] font-semibold" style={{ color: markerColor(item.estado), borderColor: markerColor(item.estado) }}>
          {display(item.estado)}
        </span>
      </div>
      <p className="break-words text-sm font-medium">{display(item.nombre_apellido)}</p>
      <p className="flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0"/><span className="break-words">{display(item.ubicacion_calle)}</span></p>
      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">Tipo</dt><dd className="break-words">{display(item.tipo)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Especie</dt><dd className="break-words">{display(item.especie)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Cantidad</dt><dd>{display(item.cantidad)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Año</dt><dd>{display(item.anio_original)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">¿Retirado?</dt><dd className="font-medium">{display(item.retirado)}</dd></div>
      </dl>
      <p className="break-all text-xs text-muted-foreground">Coordenadas: {item.latitud}, {item.longitud}</p>
      {canEdit && <Link href={`${BASE}/${item.id}/editar`} className="inline-flex items-center gap-2 rounded-lg bg-[#00A27F] px-3 py-2 text-sm font-semibold text-white hover:bg-[#008C70]"><Pencil className="h-4 w-4"/> Editar solicitud</Link>}
    </div>
  );
}

export function InterventionsMap({ points, pending, pendingCount, total, geocoded, limited, canEdit }: Props) {
  const [savedPoints, setSavedPoints] = useState<MapPoint[]>(points);
  const [pendingItems, setPendingItems] = useState<MapPoint[]>(pending);
  const [pendingSearch, setPendingSearch] = useState("");
  const [placingId, setPlacingId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [candidate, setCandidate] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [showPending, setShowPending] = useState(true);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("");
  const [retirado, setRetirado] = useState("");
  const [fechaDesde, setFechaDesde] = useState(DEFAULT_FROM);
  const [fechaHasta, setFechaHasta] = useState(DEFAULT_TO);
  const [especie, setEspecie] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const fullscreenRef = useRef<HTMLElement>(null);

  // Pantalla completa REAL del navegador (no solo un fixed dentro de la página).
  // El navegador gestiona Escape y fullscreenchange incluso cuando el usuario sale con F11.
  useEffect(() => {
    const syncFullscreen = () => {
      setFullscreen(document.fullscreenElement === fullscreenRef.current);
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const enterFullscreen = async () => {
    const element = fullscreenRef.current;
    if (!element) return;
    setFullscreenError("");
    if (!element.requestFullscreen) {
      setFullscreenError("Este navegador no admite pantalla completa desde la página. Podés usar F11.");
      return;
    }
    try {
      // Debe ejecutarse directamente desde el clic para que Chrome lo permita.
      await element.requestFullscreen();
    } catch (error) {
      console.error("No se pudo activar pantalla completa:", error);
      setFullscreenError("Chrome no permitió activar pantalla completa. Probá nuevamente o usá F11.");
    }
  };

  const exitFullscreen = async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (error) {
        console.error("No se pudo salir de pantalla completa:", error);
      }
    }
  };

  const options = useMemo(() => {
    const unique = (field: keyof MapPoint) => [...new Set(savedPoints.map(p => p[field]).filter((v): v is string =>
      typeof v === "string" && v.trim() !== ""))].sort((a, b) => a.localeCompare(b, "es-AR", { numeric: true }));
    return { tipos: unique("tipo"), estados: unique("estado"), especies: unique("especie"), retirados: unique("retirado") };
  }, [savedPoints]);

  const rangoInvalido = Boolean(fechaDesde && fechaHasta && fechaDesde > fechaHasta);
  const modoHistorico = !fechaDesde && !fechaHasta;
  const filtered = useMemo(() => savedPoints.filter(p => {
    const term = normalize(q.trim());
    // En histórico se incluyen incluso los registros antiguos con fecha NULL.
    // Si existe algún límite, solo califican las solicitudes con fecha válida.
    const fecha = p.fecha?.slice(0, 10) ?? "";
    const dentroDelRango = modoHistorico || (
      isISODate(fecha) &&
      (!fechaDesde || fecha >= fechaDesde) &&
      (!fechaHasta || fecha <= fechaHasta)
    );
    return !rangoInvalido && dentroDelRango &&
      (!term || [p.expediente, p.nombre_apellido, p.ubicacion_calle, p.especie]
        .some(value => normalize(value).includes(term))) &&
      (!tipo || p.tipo === tipo) && (!estado || p.estado === estado) &&
      (retirado === "" || (retirado === "__sin_informar__"
        ? !p.retirado?.trim()
        : p.retirado === retirado)) &&
      (!especie || p.especie === especie);
  }), [savedPoints, q, tipo, estado, retirado, especie, fechaDesde, fechaHasta, modoHistorico, rangoInvalido]);

  const groups = useMemo(() => groupPoints(filtered), [filtered]);
  const selectedGroup = groups.find(group => group.key === selectedKey) ?? null;
  const selectedItem = selectedGroup?.items.find(item => item.id === selectedItemId) ?? selectedGroup?.items[0] ?? null;

  const pickGroup = (key: string) => {
    setSelectedKey(key);
    setSelectedItemId(null);
  };
  const reset = () => {
    setQ(""); setTipo(""); setEstado(""); setRetirado(""); setEspecie("");
    setFechaDesde(DEFAULT_FROM); setFechaHasta(DEFAULT_TO);
    setSelectedKey(null); setSelectedItemId(null);
  };
  const showHistory = () => {
    setQ(""); setTipo(""); setEstado(""); setRetirado(""); setEspecie("");
    setFechaDesde(""); setFechaHasta("");
    setSelectedKey(null); setSelectedItemId(null);
  };
  const placingItem = pendingItems.find(p => p.id === placingId) ?? null;
  const pendingFiltered = useMemo(() => pendingItems.filter(p => {
    const term = normalize(pendingSearch.trim());
    return !term || [p.expediente, p.nombre_apellido, p.ubicacion_calle].some(v => normalize(v).includes(term));
  }), [pendingItems, pendingSearch]);

  const startPlacing = (item: MapPoint) => {
    if (!canEdit) return;
    setPlacingId(item.id);
    setPicking(false); // Primero se puede recorrer libremente el mapa.
    setCandidate(null);
    setSelectedKey(null);
    setSelectedItemId(null);
    setSaveError("");
    setSaveMessage("");
    document.getElementById("interventions-map-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const savePosition = async () => {
    if (!canEdit || !placingItem || !candidate || saving) return;
    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    try {
      const response = await fetch("/api/solicitud-intervenciones/ubicacion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: placingItem.id, latitud: candidate.lat, longitud: candidate.lng }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "No se pudo guardar la ubicación.");
      const saved: MapPoint = { ...placingItem, latitud: payload.latitud, longitud: payload.longitud };
      setSavedPoints(old => [...old, saved]);
      setPendingItems(old => old.filter(p => p.id !== placingItem.id));
      setPlacingId(null);
      setPicking(false);
      setCandidate(null);
      setSaveMessage(`Expediente ${display(placingItem.expediente)}: ubicación guardada.`);
      setShowPending(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Error al guardar la ubicación.");
    } finally {
      setSaving(false);
    }
  };

  const selectClass = "h-10 min-w-0 w-full rounded-lg border border-border bg-background px-3 text-sm";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Solicitudes totales</p><p className="text-2xl font-bold tabular-nums">{total.toLocaleString("es-AR")}</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Con coordenadas</p><p className="text-2xl font-bold tabular-nums text-[#008C70]">{(geocoded + savedPoints.length - points.length).toLocaleString("es-AR")}</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Sin coordenadas</p><p className="text-2xl font-bold tabular-nums">{Math.max(0, total - geocoded - (savedPoints.length - points.length)).toLocaleString("es-AR")}</p></div>
      </div>
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <button type="button" onClick={() => setShowPending(v => !v)} className="flex w-full items-center justify-between gap-3 text-left">
          <span className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-[#00A27F]"/> Solicitudes pendientes de ubicación ({pendingItems.length})</span>
          <span className="text-xs text-muted-foreground">{showPending ? "Ocultar" : "Mostrar"}</span>
        </button>
        {showPending && <>
          <label className="relative block"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"/>
            <input value={pendingSearch} onChange={e => setPendingSearch(e.target.value)} placeholder="Buscar expediente, vecino o dirección" aria-label="Buscar pendientes" className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm"/>
          </label>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {pendingFiltered.map(item => <div key={item.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${placingId === item.id ? "border-[#00A27F] bg-[#00A27F]/10" : ""}`}>
              <div className="min-w-0"><p className="break-words text-sm font-semibold">Exp. {display(item.expediente)} · {display(item.nombre_apellido)}</p>
                <p className="break-words text-xs text-muted-foreground">{display(item.ubicacion_calle)}</p></div>
              {canEdit ? <button type="button" onClick={() => startPlacing(item)} disabled={saving} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#00A27F] px-3 py-2 text-xs font-semibold text-white hover:bg-[#008C70]"><MapPin className="h-4 w-4"/> Ubicar en mapa</button>
                : <span className="text-xs text-muted-foreground">Sin coordenadas</span>}
            </div>)}
            {pendingFiltered.length === 0 && <p className="py-5 text-center text-sm text-muted-foreground">No hay solicitudes que coincidan con la búsqueda.</p>}
          </div>
          <p className="text-xs text-muted-foreground">Solo se muestra un marcador cuando se elige manualmente la ubicación. No se infieren coordenadas desde la dirección.</p>
        </>}
      </div>
      {saveMessage && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{saveMessage}</p>}
      {saveError && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{saveError}</p>}
      {limited && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">La base supera los 10.000 puntos. Este mapa muestra únicamente los primeros 10.000; no representa todas las solicitudes georreferenciadas.</p>}
      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><ListFilter className="h-4 w-4 text-[#00A27F]"/> Filtrar puntos del mapa</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-12 xl:items-end">
          <label className="relative sm:col-span-2 lg:col-span-2 xl:col-span-3">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Buscar solicitud</span>
            <Search className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-muted-foreground"/>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Expediente, vecino, calle" aria-label="Buscar en el mapa" className={`${selectClass} pl-9`}/>
          </label>
          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</span>
            <select aria-label="Tipo" value={tipo} onChange={e => setTipo(e.target.value)} className={selectClass}><option value="">Todos los tipos</option>{options.tipos.map(v => <option key={v}>{v}</option>)}</select>
          </label>
          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Estado</span>
            <select aria-label="Estado" value={estado} onChange={e => setEstado(e.target.value)} className={selectClass}><option value="">Todos los estados</option>{options.estados.map(v => <option key={v}>{v}</option>)}</select>
          </label>
          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">¿Retirado?</span>
            <select aria-label="¿Retirado?" value={retirado} onChange={e => setRetirado(e.target.value)} className={selectClass}>
              <option value="">Todos</option>
              {options.retirados.map(v => <option key={v} value={v}>{v}</option>)}
              <option value="__sin_informar__">Sin informar</option>
            </select>
          </label>
          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Especie</span>
            <select aria-label="Especie" value={especie} onChange={e => setEspecie(e.target.value)} className={selectClass}><option value="">Todas las especies</option>{options.especies.map(v => <option key={v}>{v}</option>)}</select>
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-2 xl:col-span-3">
            <button type="button" onClick={reset} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 text-sm hover:bg-muted"><RotateCcw className="h-4 w-4"/> Restablecer</button>
            <button type="button" onClick={showHistory} aria-pressed={modoHistorico}
              className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 text-sm font-semibold transition-colors ${modoHistorico ? "border-[#00A27F] bg-[#00A27F] text-white" : "border-[#00A27F]/40 text-[#008C70] hover:bg-[#00A27F]/10"}`}>
              <History className="h-4 w-4"/> Histórico
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border bg-muted/25 p-3">
          <span className="flex items-center gap-2 pb-2 text-sm font-semibold"><CalendarRange className="h-4 w-4 text-[#00A27F]"/> Rango de fechas</span>
          <label className="min-w-[150px] flex-1 sm:flex-none">
            <span className="mb-1 block text-xs text-muted-foreground">Desde</span>
            <input type="date" aria-label="Fecha desde" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className={`${selectClass} sm:w-[175px]`}/>
          </label>
          <label className="min-w-[150px] flex-1 sm:flex-none">
            <span className="mb-1 block text-xs text-muted-foreground">Hasta</span>
            <input type="date" aria-label="Fecha hasta" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className={`${selectClass} sm:w-[175px]`}/>
          </label>
          <span className="pb-2 text-xs text-muted-foreground">
            {modoHistorico ? "Histórico completo, incluidas solicitudes sin fecha registrada" : "Se filtra por fecha de la solicitud; ambos extremos están incluidos"}
          </span>
        </div>
        {rangoInvalido && <p role="alert" className="mt-2 text-sm font-medium text-amber-700">La fecha «Desde» no puede ser posterior a «Hasta».</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Mostrando <strong className="text-foreground">{filtered.length}</strong> solicitudes en <strong className="text-foreground">{groups.length}</strong> ubicaciones {modoHistorico ? "(histórico completo)" : "(rango seleccionado)"}</span>
          <span className="flex flex-wrap items-center gap-2 font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500 bg-sky-100 px-2.5 py-1.5 text-sky-900 dark:bg-sky-950 dark:text-sky-100"><TreePine className="h-4 w-4"/> Autorizado</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500 bg-amber-100 px-2.5 py-1.5 text-amber-900 dark:bg-amber-950 dark:text-amber-100"><TreePine className="h-4 w-4"/> Denegado</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500 bg-violet-100 px-2.5 py-1.5 text-violet-900 dark:bg-violet-950 dark:text-violet-100"><TreePine className="h-4 w-4"/> Mixto</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-foreground"><Layers3 className="h-4 w-4"/> Número = misma coordenada</span>
          </span>
        </div>
      </div>
      {fullscreenError && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{fullscreenError}</p>}
      <section
        id="interventions-map-section"
        ref={fullscreenRef}
        aria-label="Mapa y detalle de intervenciones"
        className={fullscreen
          ? "flex h-[100dvh] w-full min-h-0 flex-col gap-2 overflow-y-auto bg-background p-2 sm:p-3 xl:overflow-hidden"
          : "min-w-0 space-y-3"}
      >
        {fullscreen && (
          <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <TreePine className="h-5 w-5 shrink-0 text-[#00A27F]" />
              <span className="truncate">Mapa de Intervenciones</span>
              <span className="hidden text-xs font-normal text-muted-foreground sm:inline">{groups.length} ubicaciones</span>
            </div>
            <button type="button" onClick={exitFullscreen}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
              aria-label="Salir de pantalla completa">
              <Minimize2 className="h-4 w-4" /> <span className="hidden sm:inline">Salir de pantalla completa</span><span className="sm:hidden">Salir</span>
            </button>
          </div>
        )}
        <div className={fullscreen
          ? "grid min-h-0 flex-1 content-start gap-2 xl:grid-cols-[minmax(0,1fr)_320px] xl:content-stretch"
          : "grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_310px]"}>
          <div className={fullscreen
            ? "relative min-h-0 min-w-0 overflow-hidden rounded-xl border bg-card p-1.5 max-xl:h-[min(68dvh,760px)] xl:h-full"
            : "relative h-[60dvh] min-h-[420px] min-w-0 overflow-hidden rounded-xl border bg-card p-2 sm:h-[70dvh] sm:min-h-[550px] lg:h-[75dvh] lg:max-h-[930px]"}>
            <MapCanvas groups={groups} selectedKey={selectedKey} onPick={pickGroup}
              placing={!!placingItem && canEdit} picking={picking} candidate={candidate}
              onPlace={(lat, lng) => { setCandidate({ lat, lng }); setPicking(false); }}/>
            {placingItem && canEdit && (
              <div className="absolute left-4 top-4 z-[500] flex max-w-[calc(100%-9rem)] flex-col gap-2">
                <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-800 shadow-md">
                  {picking ? "Modo selección: tocá el lugar exacto" : "Modo navegación: movete y acercá el mapa libremente"}
                </div>
                <button type="button" disabled={saving} onClick={() => setPicking(v => !v)}
                  className={`inline-flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold shadow-md disabled:opacity-50 ${picking ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-[#00A27F] text-white hover:bg-[#008C70]"}`}>
                  <MapPin className="h-4 w-4"/>
                  {picking ? "Cancelar selección" : candidate ? "Cambiar punto" : "Colocar pin"}
                </button>
              </div>
            )}
            {!fullscreen && (
              <button type="button" onClick={enterFullscreen}
                className="absolute right-4 top-4 z-[500] inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-md transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A27F]"
                aria-label="Ver mapa en pantalla completa" title="Pantalla completa">
                <Maximize2 className="h-4 w-4" /><span className="hidden sm:inline">Pantalla completa</span>
              </button>
            )}
          </div>
          <aside className={fullscreen
            ? "min-h-0 min-w-0 overflow-y-auto rounded-xl border bg-card p-4 max-xl:max-h-[30dvh]"
            : "min-w-0 rounded-xl border bg-card p-4 xl:max-h-[930px] xl:overflow-y-auto"}>
          {placingItem && canEdit ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2"><h2 className="text-lg font-bold">Ubicar expediente {display(placingItem.expediente)}</h2>
                <button type="button" onClick={() => { setPlacingId(null); setPicking(false); setCandidate(null); setSaveError(""); }} disabled={saving} aria-label="Cancelar ubicación" className="rounded-lg border p-2 hover:bg-muted"><X className="h-4 w-4"/></button>
              </div>
              <p className="break-words text-sm font-semibold">{display(placingItem.nombre_apellido)}</p>
              <p className="break-words text-sm text-muted-foreground">{display(placingItem.ubicacion_calle)}</p>
              <div className="rounded-lg border border-[#00A27F]/40 bg-[#00A27F]/5 p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold"><LocateFixed className="h-4 w-4"/> Ubicación manual</p>
                <p className="mt-1">Primero movete y acercá el mapa libremente. Cuando encuentres el lugar, presioná <strong>Colocar pin</strong> y hacé un clic. Después podés arrastrar el marcador para ajustarlo.</p>
              </div>
              <button type="button" disabled={saving} onClick={() => setPicking(v => !v)}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${picking ? "border-slate-700 bg-slate-800 text-white" : "border-[#00A27F] text-[#008C70] hover:bg-[#00A27F]/10"} disabled:opacity-50`}>
                <MapPin className="h-4 w-4"/>
                {picking ? "Cancelar selección (seguir navegando)" : candidate ? "Cambiar punto en el mapa" : "Elegir ubicación en el mapa"}
              </button>
              {picking && <p className="text-xs font-semibold text-[#008C70]">Ahora sí: hacé un clic donde querés colocar el pin. La selección se desactiva automáticamente.</p>}
              {candidate ? <div className="rounded-lg bg-muted p-3 text-xs tabular-nums">Latitud: {candidate.lat.toFixed(7)}<br/>Longitud: {candidate.lng.toFixed(7)}</div>
                : <p className="text-sm text-muted-foreground">Todavía no seleccionaste un punto.</p>}
              <button type="button" onClick={savePosition} disabled={!candidate || saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#00A27F] px-3 py-3 text-sm font-semibold text-white hover:bg-[#008C70] disabled:cursor-not-allowed disabled:opacity-50">
                <Save className="h-4 w-4"/>{saving ? "Guardando..." : "Guardar ubicación"}
              </button>
              {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
            </div>
          ) : selectedGroup && selectedItem ? (
            <div className="space-y-4">
              {selectedGroup.items.length > 1 && (
                <div className="space-y-2">
                  <h2 className="flex items-center gap-2 text-sm font-bold"><Layers3 className="h-4 w-4 text-[#00A27F]"/>{selectedGroup.items.length} solicitudes en esta ubicación</h2>
                  <p className="text-xs text-muted-foreground">Elegí el expediente que querés consultar.</p>
                  <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                    {selectedGroup.items.map(item => (
                      <button key={item.id} type="button" onClick={() => setSelectedItemId(item.id)}
                        aria-pressed={selectedItem.id === item.id}
                        className={`w-full rounded-lg border p-2.5 text-left transition-colors ${selectedItem.id === item.id ? "border-[#00A27F] bg-[#00A27F]/10" : "hover:bg-muted/50"}`}>
                        <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">Exp. {display(item.expediente)}</span><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{background: markerColor(item.estado)}}/></div>
                        <span className="block break-words text-xs text-muted-foreground">{display(item.nombre_apellido)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <RequestDetail item={selectedItem} canEdit={canEdit}/>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center"><TreePine className="h-9 w-9 text-[#00A27F]"/><h2 className="font-semibold">Seleccioná un árbol</h2><p className="text-sm text-muted-foreground">Hacé clic en un marcador para consultar el expediente, la dirección y los datos de la intervención. Un número indica varias solicitudes en un mismo punto.</p></div>
          )}
          </aside>
        </div>
      </section>
      
    </div>
  );
}
