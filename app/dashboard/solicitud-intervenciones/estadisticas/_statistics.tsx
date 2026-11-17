"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, CalendarRange, CheckCircle2, ClipboardList, GitCompareArrows, Layers3, RotateCcw, Trees } from "lucide-react";

type Row = {
  id: string;
  fecha: string | null;
  anio_original: string | null;
  tipo: string | null;
  estado: string | null;
  derivacion: string | null;
  retirado: string | null;
  especie: string | null;
  cantidad: number | null;
};
type Props = { records: Row[]; totalRows: number; limited: boolean };
type Segment = { name: string; value: number };

const fmt = (value: number) => value.toLocaleString("es-AR");
const percent = (num: number, den: number) => den ? `${(100 * num / den).toFixed(1).replace(".", ",")}%` : "—";
const norm = (v: string | null | undefined) => (v ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ");
const label = (v: string | null | undefined) => (v ?? "").trim() || "Sin informar";
const yearOf = (r: Row) => {
  const date = r.fecha?.slice(0, 10) ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date.slice(0, 4);
  return /^\d{4}$/.test(r.anio_original ?? "") ? r.anio_original! : "Sin año";
};
const monthOf = (r: Row) => /^\d{4}-\d{2}-\d{2}$/.test(r.fecha ?? "") ? (r.fecha ?? "").slice(0, 7) : "";
const sum = (arr: Row[], f: (r: Row) => boolean) => arr.reduce((total, row) => total + Number(f(row)), 0);
const tally = (arr: Row[], getter: (r: Row) => string) => {
  const m = new Map<string, number>();
  for (const r of arr) { const k = getter(r); m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "es-AR"));
};
const COLORS = ["#008f78", "#0284c7", "#7c3aed", "#d97706", "#64748b", "#db2777", "#0d9488"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A27F] focus-visible:ring-offset-2";

function StatCard({ title, value, detail, icon: Icon }: { title: string; value: string; detail: string; icon: typeof ClipboardList }) {
  return <div className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
    <div className="flex items-start justify-between gap-2"><span className="text-sm font-medium text-muted-foreground">{title}</span><Icon className="h-5 w-5 shrink-0 text-[#00A27F]" /></div>
    <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">{value}</p>
    <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
  </div>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <section className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
    <div className="mb-3"><h2 className="text-base font-bold sm:text-lg">{title}</h2>{subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}</div>
    {children}
  </section>;
}

// Gráfico verdadero: un área de trazado con ejes, grilla sutil y un resumen
// editorial a un costado. Los datos no se alteran: solo cambia el diseño.
function VerticalBars({ data, onSelect, selected, colors }: { data: Segment[]; onSelect?: (name: string) => void; selected?: string; colors?: string[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  if (!data.length) return <p className="py-7 text-center text-sm text-muted-foreground">No hay datos en este período.</p>;
  const total = data.reduce((n, item) => n + item.value, 0);
  const max = Math.max(1, ...data.map(item => item.value));
  const ticks = [1, 0.5, 0];
  const compact = data.length > 5;
  const active = data.find(item => item.name === hovered);
  return <div className={`grid min-w-0 items-start gap-4 ${compact ? '' : 'lg:grid-cols-[minmax(0,1.3fr)_minmax(155px,0.7fr)]'}`}>
    <div className="min-w-0 rounded-xl border border-border/70 bg-muted/15 px-3 pb-3 pt-4">
      {/* Un único plano de coordenadas: eje y barras usan exactamente 154 px. */}
      <div className="relative pl-9">
        {/* 26 px libres para los números superiores; 40 px inferiores para etiquetas. */}
        <div className="pointer-events-none absolute inset-x-0 top-[26px] bottom-[40px] flex flex-col justify-between">
          {ticks.map(t => (
            <div key={t} className="relative h-px w-full bg-border/70">
              <span className="absolute -left-9 -top-2.5 w-8 text-right text-[10px] tabular-nums text-muted-foreground">
                {fmt(Math.round(max * t))}
              </span>
            </div>
          ))}
        </div>
        <div className="relative z-10 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((item, i) => {
            const color = colors?.[i % colors.length] ?? COLORS[i % COLORS.length];
            const selectedBar = selected === item.name;
            const barHeight = item.value > 0 ? Math.max(3, 154 * item.value / max) : 0;
            return <button type="button" key={item.name} disabled={!onSelect}
              onClick={() => onSelect?.(item.name)} onMouseEnter={() => setHovered(item.name)} onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(item.name)} onBlur={() => setHovered(null)}
              title={`${item.name}: ${fmt(item.value)} solicitudes (${percent(item.value, total)})`}
              aria-label={`${item.name}: ${fmt(item.value)} solicitudes`} aria-pressed={onSelect ? selectedBar : undefined}
              className={`group flex min-w-0 flex-col items-center rounded-md ${focusClass} ${onSelect ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default'} ${selectedBar ? 'bg-[#00A27F]/10' : ''}`}>
              {/* Base en y=180; máximo en y=26, exactamente igual a las líneas del eje. */}
              <div className="relative h-[180px] w-full">
                <div className="absolute bottom-0 left-1/2 w-[min(68%,54px)] -translate-x-1/2 rounded-t-md transition-[filter,opacity] duration-150 group-hover:brightness-110"
                  style={{ height: `${barHeight}px`, backgroundColor: color, opacity: selected && !selectedBar ? .4 : 1 }} />
                <strong className="absolute left-0 right-0 text-center text-[10px] font-bold tabular-nums sm:text-[11px]"
                  style={{ bottom: `${barHeight + 4}px` }}>{fmt(item.value)}</strong>
              </div>
              <span className="mt-2 flex min-h-8 w-full items-start justify-center break-words text-center text-[10px] font-semibold leading-tight text-foreground/85">{item.name}</span>
            </button>;
          })}
        </div>
      </div>
    </div>
    {compact ? <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 border-t pt-3 sm:grid-cols-4">
      {data.map((d,i) => <div key={d.name} className="flex min-w-0 items-start gap-2 text-xs"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{backgroundColor:colors?.[i % colors.length] ?? COLORS[i % COLORS.length]}}/><div className="min-w-0"><p className="break-words text-muted-foreground">{d.name}</p><strong className="tabular-nums">{percent(d.value,total)}</strong></div></div>)}
    </div> : <div className="min-w-0 rounded-xl bg-muted/35 p-3">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Distribución del período</p>
      <div className="space-y-3">{data.map((d,i) => <div key={d.name} className="min-w-0">
        <div className="mb-1 flex items-start justify-between gap-2 text-xs"><span className="break-words font-medium">{d.name}</span><strong className="shrink-0 tabular-nums">{percent(d.value,total)}</strong></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border/70"><div className="h-full rounded-full" style={{ width: `${total ? 100*d.value/total : 0}%`, backgroundColor:colors?.[i % colors.length] ?? COLORS[i % COLORS.length] }}/></div>
      </div>)}</div>
      <p className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">{active ? `${active.name}: ${fmt(active.value)} solicitudes` : onSelect ? 'Tocá una columna para filtrar el tablero.' : `Total: ${fmt(total)} solicitudes`}</p>
    </div>}
  </div>;
}

function ComparisonVerticalBars({ rows, yearA, yearB, onSelect }: { rows: { name: string; a: number; b: number }[]; yearA: string; yearB: string; onSelect?: (name: string) => void }) {
  if (!rows.length) return <p className="py-7 text-center text-sm text-muted-foreground">No hay datos comparables.</p>;
  const max = Math.max(1, ...rows.flatMap(r => [r.a, r.b]));
  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-medium"><span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-[#0284c7]" />{yearA}</span><span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-[#00A27F]" />{yearB}</span></div>
    <div className="min-w-0 rounded-xl border bg-muted/15 p-3">
      <div className="mx-auto grid max-w-[680px] items-end gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${rows.length},minmax(0,1fr))` }}>
        {rows.map(r => <button key={r.name} type="button" disabled={!onSelect} onClick={() => onSelect?.(r.name)}
          title={`${r.name}: ${yearA}: ${fmt(r.a)}; ${yearB}: ${fmt(r.b)}`}
          className={`group flex min-w-0 flex-col items-center rounded-lg py-1 ${focusClass} ${onSelect ? 'hover:bg-muted/50' : 'cursor-default'}`}>
          <div className="flex h-[158px] w-full items-end justify-center gap-1 border-b border-border/80">
            {([{value:r.a,color:'#0284c7',year:yearA},{value:r.b,color:'#00A27F',year:yearB}]).map(bar => <div key={bar.year} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <strong className="mb-1 text-[10px] font-bold tabular-nums">{fmt(bar.value)}</strong>
              <div className="w-[min(80%,30px)] rounded-t-md transition-[filter] group-hover:brightness-110" style={{height:`${bar.value ? Math.max(3, 125*bar.value/max) : 0}px`,backgroundColor:bar.color}} />
            </div>)}
          </div>
          <span className="mt-2 min-h-8 break-words text-center text-[10px] font-medium leading-tight">{r.name}</span>
        </button>)}
      </div>
    </div>
    <p className="text-[11px] text-muted-foreground">Comparación de solicitudes registradas en ambos años.</p>
  </div>;
}

// Un gráfico por año, alineado dentro de una tarjeta de tamaño apropiado.
// Cada mes muestra un valor fijo y un detalle al pasar el mouse o tocarlo.
function Timeline({ counts, title }: { counts: { key: string; label: string; value: number }[]; title?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  if (!counts.length) return <p className="py-7 text-center text-sm text-muted-foreground">No hay fechas válidas para graficar.</p>;
  const max = Math.max(1, ...counts.map(v => v.value));
  const years = [...new Set(counts.map(m => m.key.slice(0,4)))];
  const chosen = counts.find(m => m.key === (hovered ?? active));
  return <div className="min-w-0 space-y-3" aria-label={title ?? 'Evolución mensual'}>
    <div className={`grid min-w-0 gap-3 ${years.length > 1 ? 'xl:grid-cols-2' : ''}`}>
      {years.map(year => {
        const yearly = counts.filter(m => m.key.startsWith(year));
        const yearTotal = yearly.reduce((n,m) => n+m.value,0);
        const peak = yearly.reduce((best,m) => !best || m.value > best.value ? m : best, undefined as (typeof yearly)[number] | undefined);
        return <section key={year} className="min-w-0 rounded-xl border bg-muted/15 p-3 sm:p-4">
          <div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{year}</h3><p className="text-[11px] text-muted-foreground">Pico: {peak ? `${peak.label} (${fmt(peak.value)})` : '—'}</p></div><div className="text-right"><strong className="text-xl tabular-nums text-[#008C70]">{fmt(yearTotal)}</strong><p className="text-[11px] text-muted-foreground">solicitudes</p></div></div>
          <div className="relative min-w-0 border-b border-border/80">
            <div className="pointer-events-none absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between"><div className="border-t border-dashed border-border/80"/><div className="border-t border-dashed border-border/60"/><div/></div>
            <div className="relative grid h-[170px] min-w-0 items-end gap-0.5 sm:gap-1" style={{gridTemplateColumns:`repeat(${yearly.length},minmax(0,1fr))`}}>
              {yearly.map(m => {
                const selected = active === m.key;
                return <button key={m.key} type="button" onClick={() => setActive(selected ? null : m.key)} onMouseEnter={() => setHovered(m.key)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(m.key)} onBlur={() => setHovered(null)}
                  title={`${m.label}: ${fmt(m.value)} solicitudes`} aria-label={`${m.label}: ${fmt(m.value)} solicitudes`} aria-pressed={selected}
                  className={`group flex min-w-0 flex-col items-center rounded-t-md py-1 ${focusClass} ${selected ? 'bg-[#00A27F]/10' : 'hover:bg-muted/40'}`}>
                  <div className="flex h-[139px] w-full flex-col items-center justify-end">
                    <strong className="mb-1 text-[9px] font-bold tabular-nums sm:text-[10px]">{fmt(m.value)}</strong>
                    <div className={`w-[min(78%,35px)] rounded-t-[4px] transition-colors ${selected ? 'bg-[#006d5c]' : 'bg-[#00A27F] group-hover:bg-[#007966]'}`} style={{height:`${m.value ? Math.max(3,108*m.value/max) : 0}px`}} />
                  </div>
                  <span className="mt-1 w-full text-center text-[9px] font-semibold text-muted-foreground sm:text-[10px]">{MONTHS[Number(m.key.slice(5))-1]}</span>
                </button>;
              })}
            </div>
          </div>
        </section>;
      })}
    </div>
    <div className="flex min-h-9 items-center rounded-lg border border-[#00A27F]/20 bg-[#00A27F]/5 px-3 py-2 text-xs" role="status" aria-live="polite">
      {chosen ? <><strong className="mr-1">{chosen.label}:</strong> {fmt(chosen.value)} solicitudes</> : 'Pasá el mouse o tocá un mes para ver su cantidad exacta.'}
    </div>
  </div>;
}

export function InterventionStatistics({ records, totalRows, limited }: Props) {
  const years = useMemo(() => [...new Set(records.map(yearOf).filter(v => v !== "Sin año"))].sort(), [records]);
  const [yearA, setYearA] = useState(() => years.includes("2025") ? "2025" : years.at(-2) ?? years.at(-1) ?? "");
  const [yearB, setYearB] = useState(() => years.includes("2026") ? "2026" : years.at(-1) ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("");
  const [scope, setScope] = useState<"comparacion" | "historico">("comparacion");
  const kinds = useMemo(() => tally(records, r => label(r.tipo)).map(x => x.name), [records]);
  const states = useMemo(() => tally(records, r => label(r.estado)).map(x => x.name), [records]);
  const invalidRange = !!(from && to && from > to);

  const inFilters = (r: Row) => {
    if (tipo && label(r.tipo) !== tipo) return false;
    if (estado && label(r.estado) !== estado) return false;
    if (invalidRange) return false;
    if (from || to) {
      const date = r.fecha?.slice(0, 10) ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
      if (from && date < from) return false;
      if (to && date > to) return false;
    }
    return true;
  };
  const base = useMemo(() => records.filter(inFilters), [records, tipo, estado, from, to, invalidRange]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = useMemo(() => base.filter(r => scope === "historico" || yearOf(r) === yearA || yearOf(r) === yearB), [base, scope, yearA, yearB]);
  const a = useMemo(() => base.filter(r => yearOf(r) === yearA), [base, yearA]);
  const b = useMemo(() => base.filter(r => yearOf(r) === yearB), [base, yearB]);
  const authorized = sum(visible, r => norm(r.estado) === "AUTORIZADO");
  const denied = sum(visible, r => ["DENEGADO", "DENEGADA"].includes(norm(r.estado)));
  const taken = sum(visible, r => ["SI", "SÍ"].includes(norm(r.retirado)));
  const notTaken = sum(visible, r => norm(r.retirado) === "NO");
  const typeStats = useMemo(() => tally(visible, r => label(r.tipo)), [visible]);
  const stateStats = useMemo(() => tally(visible, r => label(r.estado)), [visible]);
  const derivStats = useMemo(() => tally(visible, r => label(r.derivacion)), [visible]);
  const speciesStats = useMemo(() => tally(visible, r => label(r.especie)).slice(0, 8), [visible]);
  const comparedTypes = useMemo(() => {
    const names = [...new Set([...a, ...b].map(r => label(r.tipo)))];
    return names.map(name => ({ name, a: sum(a, r => label(r.tipo) === name), b: sum(b, r => label(r.tipo) === name) }))
      .sort((x, y) => y.a + y.b - x.a - x.b);
  }, [a, b]);
  const comparedStates = useMemo(() => {
    const names = [...new Set([...a, ...b].map(r => label(r.estado)))];
    return names.map(name => ({ name, a: sum(a, r => label(r.estado) === name), b: sum(b, r => label(r.estado) === name) }))
      .sort((x, y) => y.a + y.b - x.a - x.b);
  }, [a, b]);
  const comparedDeriv = useMemo(() => {
    const names = [...new Set([...a, ...b].map(r => label(r.derivacion)))];
    return names.map(name => ({ name, a: sum(a, r => label(r.derivacion) === name), b: sum(b, r => label(r.derivacion) === name) }))
      .sort((x, y) => y.a + y.b - x.a - x.b);
  }, [a, b]);
  const months = useMemo(() => {
    const keys = [...new Set(visible.map(monthOf).filter(Boolean))].sort();
    if (!keys.length) return [];
    const last = keys[keys.length - 1];
    // Mostrar los 36 meses más recientes en histórico extenso.
    const [lastYear, lastMonth] = last.split("-").map(Number);
    const firstDate = new Date(Date.UTC(lastYear, lastMonth - 1 - 35, 1));
    const horizon = `${firstDate.getUTCFullYear()}-${String(firstDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const first = keys[0] > horizon ? keys[0] : horizon;
    const all: string[] = [];
    const [fy, fm] = first.split("-").map(Number);
    const [ly, lm] = last.split("-").map(Number);
    // Máximo 36 meses para mantener legible la visualización.
    for (let y = fy, m = fm; (y < ly || (y === ly && m <= lm)) && all.length < 36; m++) {
      if (m > 12) { y++; m = 1; }
      all.push(`${y}-${String(m).padStart(2, "0")}`);
    }
    const counts = new Map<string, number>();
    for (const row of visible) { const month = monthOf(row); if (month) counts.set(month, (counts.get(month) ?? 0) + 1); }
    return all.map(key => ({ key, label: `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(2,4)}`, value: counts.get(key) ?? 0 }));
  }, [visible]);
  const matrix = useMemo(() => {
    const types = tally(visible, r => label(r.tipo)).slice(0, 8).map(x => x.name);
    return types.map(name => {
      const all = visible.filter(r => label(r.tipo) === name);
      const yes = sum(all, r => norm(r.estado) === "AUTORIZADO");
      const no = sum(all, r => ["DENEGADO", "DENEGADA"].includes(norm(r.estado)));
      return { name, total: all.length, yes, no, other: all.length - yes - no };
    });
  }, [visible]);
  const derivMatrix = useMemo(() => {
    const types = [...new Set(visible.map(r => label(r.tipo)))].sort();
    const derivs = tally(visible, r => label(r.derivacion)).slice(0, 6).map(x => x.name);
    return { derivs, types: types.map(type => ({ name: type, counts: derivs.map(d => sum(visible, r => label(r.tipo) === type && label(r.derivacion) === d)) })) };
  }, [visible]);
  const reset = () => { setYearA(years.includes("2025") ? "2025" : years.at(-2) ?? ""); setYearB(years.includes("2026") ? "2026" : years.at(-1) ?? ""); setFrom(""); setTo(""); setTipo(""); setEstado(""); setScope("comparacion"); };
  const inputClass = "h-10 min-w-0 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#00A27F]/30";
  const aRate = percent(sum(a, r => norm(r.estado) === "AUTORIZADO"), sum(a, r => ["AUTORIZADO", "DENEGADO", "DENEGADA"].includes(norm(r.estado))));
  const bRate = percent(sum(b, r => norm(r.estado) === "AUTORIZADO"), sum(b, r => ["AUTORIZADO", "DENEGADO", "DENEGADA"].includes(norm(r.estado))));

  return <div className="space-y-5">
    {limited && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">Hay {fmt(totalRows)} registros; se cargaron los primeros 10.000. Las estadísticas no representan el total.</div>}
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-bold"><CalendarRange className="h-4 w-4 text-[#00A27F]" /> Período de análisis</h2><p className="mt-1 text-xs text-muted-foreground">Compará años o consultá todo el histórico. Los filtros se aplican a todos los gráficos.</p></div>
        <button type="button" onClick={reset} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted ${focusClass}`}><RotateCcw className="h-4 w-4" /> Restablecer</button></div>
      <div className="mb-4 inline-flex flex-wrap rounded-xl bg-muted p-1 text-sm font-semibold">
        <button type="button" aria-pressed={scope === "comparacion"} onClick={() => setScope("comparacion")} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${focusClass} ${scope === "comparacion" ? "bg-card text-[#008C70] shadow-sm" : "text-muted-foreground"}`}><GitCompareArrows className="h-4 w-4" /> Comparativa</button>
        <button type="button" aria-pressed={scope === "historico"} onClick={() => setScope("historico")} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${focusClass} ${scope === "historico" ? "bg-card text-[#008C70] shadow-sm" : "text-muted-foreground"}`}><Layers3 className="h-4 w-4" /> Histórico completo</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="space-y-1"><span className="text-xs font-medium">Año inicial</span><select className={inputClass} value={yearA} onChange={e => setYearA(e.target.value)} disabled={scope === "historico"}>{years.map(y => <option key={y}>{y}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs font-medium">Año final</span><select className={inputClass} value={yearB} onChange={e => setYearB(e.target.value)} disabled={scope === "historico"}>{years.map(y => <option key={y}>{y}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs font-medium">Desde (opcional)</span><input type="date" className={inputClass} value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-medium">Hasta (opcional)</span><input type="date" className={inputClass} value={to} onChange={e => setTo(e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-medium">Tipo de intervención</span><select className={inputClass} value={tipo} onChange={e => setTipo(e.target.value)}><option value="">Todos</option>{kinds.map(k => <option key={k} value={k}>{k}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs font-medium">Estado</span><select className={inputClass} value={estado} onChange={e => setEstado(e.target.value)}><option value="">Todos</option>{states.map(k => <option key={k} value={k}>{k}</option>)}</select></label>
      </div>
      {invalidRange && <p role="alert" className="mt-3 text-sm font-semibold text-amber-700">La fecha desde no puede ser posterior a la fecha hasta.</p>}
      <p className="mt-3 text-xs text-muted-foreground">{fmt(visible.length)} solicitudes en el período y filtros seleccionados. Año histórico: usa `anio_original` solo cuando no hay una fecha válida.</p>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard title="Solicitudes analizadas" value={fmt(visible.length)} detail="Cada expediente registrado cuenta como una solicitud" icon={ClipboardList}/>
      <StatCard title="Autorizadas" value={fmt(authorized)} detail={`${percent(authorized, authorized + denied)} de las resueltas como autorizadas o denegadas`} icon={CheckCircle2}/>
      <StatCard title="Denegadas" value={fmt(denied)} detail={`${fmt(visible.length - authorized - denied)} con otro estado o sin informar`} icon={Activity}/>
      <StatCard title="Retiradas" value={fmt(taken)} detail={`${fmt(notTaken)} marcadas NO · ${fmt(visible.length - taken - notTaken)} sin SÍ/NO definido`} icon={Trees}/>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Intervenciones por tipo" subtitle="Seleccioná una categoría para filtrar todo el tablero.">
        <VerticalBars data={typeStats} selected={tipo} onSelect={name => setTipo(tipo === name ? "" : name)}/>
      </Panel>
      <Panel title="Estado de las solicitudes" subtitle="Autorizadas, denegadas y otros estados registrados.">
        <VerticalBars data={stateStats} selected={estado} onSelect={name => setEstado(estado === name ? "" : name)}/>
      </Panel>
      <Panel title="Derivación final" subtitle="Distribución de la derivación efectivamente registrada."><VerticalBars data={derivStats}/></Panel>
      <Panel title="Especies más frecuentes" subtitle="Cantidad de solicitudes por especie, no cantidad de árboles."><VerticalBars data={speciesStats}/></Panel>
    </div>

    <Panel title="Evolución mensual de solicitudes" subtitle="Se contabilizan solo fechas reales registradas. Seleccioná una barra para ver su valor exacto.">
      <Timeline key={`${yearA}-${yearB}-${scope}-${tipo}-${estado}-${from}-${to}`} counts={months} />
    </Panel>

    {scope === "comparacion" && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5"><p className="text-sm text-muted-foreground">Solicitudes {yearA}</p><p className="mt-2 text-3xl font-bold tabular-nums">{fmt(a.length)}</p><p className="mt-2 text-xs text-muted-foreground">Tasa de autorización sobre autorizadas + denegadas: {aRate}</p></div>
        <div className="rounded-2xl border bg-card p-5"><p className="text-sm text-muted-foreground">Solicitudes {yearB}</p><p className="mt-2 text-3xl font-bold tabular-nums">{fmt(b.length)}</p><p className="mt-2 flex items-center gap-2 text-sm font-semibold">{b.length >= a.length ? <ArrowUpRight className="h-4 w-4 text-[#00A27F]" /> : <ArrowDownRight className="h-4 w-4 text-amber-600" />}{a.length ? `${((b.length - a.length) / a.length * 100).toFixed(1).replace(".", ",")}% frente a ${yearA}` : "Sin base para calcular variación"}</p><p className="mt-1 text-xs text-muted-foreground">Tasa de autorización: {bRate}</p></div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Tipo solicitado: comparación entre años" subtitle="Recuento de solicitudes de cada tipo, año por año."><ComparisonVerticalBars rows={comparedTypes} yearA={yearA} yearB={yearB} onSelect={name => setTipo(tipo === name ? "" : name)} /></Panel>
        <Panel title="Estado: comparación entre años" subtitle="Cantidad de solicitudes según su estado."><ComparisonVerticalBars rows={comparedStates} yearA={yearA} yearB={yearB} onSelect={name => setEstado(estado === name ? "" : name)}/></Panel>
        <Panel title="Derivación: comparación entre años" subtitle="Destino real de la intervención en cada año."><ComparisonVerticalBars rows={comparedDeriv} yearA={yearA} yearB={yearB}/></Panel>
        <Panel title="Porcentaje de autorizaciones por tipo" subtitle="Base: solicitudes autorizadas o denegadas de cada tipo (otros estados no incluidos).">
          <div className="max-h-[450px] space-y-4 overflow-y-auto pr-1">{comparedTypes.map(({ name }) => {
            const aa = a.filter(r => label(r.tipo) === name), bb = b.filter(r => label(r.tipo) === name);
            const eligibleA = aa.filter(r => ["AUTORIZADO", "DENEGADO", "DENEGADA"].includes(norm(r.estado)));
            const eligibleB = bb.filter(r => ["AUTORIZADO", "DENEGADO", "DENEGADA"].includes(norm(r.estado)));
            return <div key={name}><p className="mb-2 text-sm font-semibold">{name}</p><div className="grid grid-cols-2 gap-3">{[[yearA, eligibleA, "#0284c7"],[yearB, eligibleB, "#00A27F"]].map(([year, rows, color]) => {
              const list = rows as Row[], value = sum(list, r => norm(r.estado) === "AUTORIZADO"), pct = list.length ? value / list.length * 100 : 0;
              return <div key={year as string} title={`${year}: ${value} autorizadas de ${list.length} resueltas`}><div className="mb-1 flex justify-between gap-2 text-xs"><span>{year as string}</span><strong>{percent(value, list.length)}</strong></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{backgroundColor: color as string, width: `${pct}%`}} /></div></div>;
            })}</div></div>;
          })}</div>
        </Panel>
      </div>
    </>}

    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Cruce: tipo solicitado y estado" subtitle="Tabla dinámica calculada directamente de los registros del período.">
        <div className="overflow-x-auto"><table className="w-full min-w-[440px] text-left text-xs sm:text-sm"><thead><tr className="border-b text-muted-foreground"><th className="py-3 pr-3">Tipo</th><th className="px-2 text-right">Autorizado</th><th className="px-2 text-right">Denegado</th><th className="px-2 text-right">Otro</th><th className="pl-2 text-right">Total</th></tr></thead><tbody>{matrix.map(r => <tr key={r.name} className="border-b last:border-0"><th className="py-3 pr-3 font-medium">{r.name}</th><td className="px-2 text-right tabular-nums">{fmt(r.yes)}</td><td className="px-2 text-right tabular-nums">{fmt(r.no)}</td><td className="px-2 text-right tabular-nums">{fmt(r.other)}</td><td className="pl-2 text-right font-semibold tabular-nums">{fmt(r.total)}</td></tr>)}</tbody></table></div>
      </Panel>
      <Panel title="Cruce: tipo solicitado y derivación" subtitle="Permite identificar cuántas solicitudes terminaron derivadas a un servicio diferente.">
        <div className="overflow-x-auto"><table className="w-full min-w-[460px] text-left text-xs sm:text-sm"><thead><tr className="border-b text-muted-foreground"><th className="py-3 pr-3">Tipo solicitado</th>{derivMatrix.derivs.map(d => <th key={d} className="px-2 text-right">{d}</th>)}</tr></thead><tbody>{derivMatrix.types.map(r => <tr key={r.name} className="border-b last:border-0"><th className="py-3 pr-3 font-medium">{r.name}</th>{r.counts.map((n, i) => <td key={i} className="px-2 text-right tabular-nums">{fmt(n)}</td>)}</tr>)}</tbody></table></div>
      </Panel>
    </div>
    <div className="flex items-start gap-2 rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground"><BarChart3 className="h-4 w-4 shrink-0 text-[#00A27F]" />Los datos provienen de Supabase y se calculan al abrir la página. «Cantidad de solicitudes» no equivale a «cantidad de árboles». Los porcentajes de autorización excluyen estados distintos de autorizado/denegado. Las fechas históricas no normalizadas no se ubican en el gráfico mensual.</div>
  </div>;
}
