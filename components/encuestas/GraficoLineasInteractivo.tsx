"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type Serie = {
  id: string;
  nombre: string;
  color: string;
  valores: Array<number | null>;
  fuente?: "Kobo" | "Excel";
};

type Props = {
  etiquetas: string[];
  series: Serie[];
  maximo?: number;
  unidad?: string;
};

type PuntoActivo = { id: string; indice: number } | null;

export default function GraficoLineasInteractivo({
  etiquetas,
  series,
  maximo = 10,
  unidad = "/ 10",
}: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  const [ocultas, setOcultas] = useState<string[]>([]);
  const [destacada, setDestacada] = useState<string | null>(null);
  const [puntoActivo, setPuntoActivo] = useState<PuntoActivo>(null);
  const idGradiente = useId().replace(/:/g, "");

  useEffect(() => {
    const elemento = contenedorRef.current;
    if (!elemento) return;
    const actualizar = () => setAncho(Math.max(0, Math.round(elemento.getBoundingClientRect().width)));
    actualizar();
    const observador = new ResizeObserver(actualizar);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  const visibles = useMemo(() => series.filter((s) => !ocultas.includes(s.id)), [series, ocultas]);
  const movil = ancho > 0 && ancho < 540;
  const muyAngosto = ancho > 0 && ancho < 370;
  const w = Math.max(240, ancho || 900);
  const h = movil ? 275 : 350;
  const margen = { izquierda: movil ? 37 : 48, derecha: movil ? 12 : 24, arriba: 24, abajo: movil ? 48 : 47 };
  const anchoUtil = w - margen.izquierda - margen.derecha;
  const altoUtil = h - margen.arriba - margen.abajo;

  const valores = visibles.flatMap((s) => s.valores.filter((v): v is number => v !== null && Number.isFinite(v)));
  const minDato = valores.length ? Math.min(...valores) : 0;
  const maxDato = valores.length ? Math.max(...valores) : maximo;
  // Mantener un rango legible y con contexto. Nunca cortar datos reales.
  const separacion = Math.max(0.35, (maxDato - minDato) * 0.18);
  const minimoEje = Math.max(0, Math.floor((minDato - separacion) * 2) / 2);
  const maximoEje = Math.min(maximo, Math.max(minimoEje + 1, Math.ceil((maxDato + separacion) * 2) / 2));
  const rango = Math.max(0.5, maximoEje - minimoEje);
  const x = (i: number) => margen.izquierda + (etiquetas.length <= 1 ? anchoUtil / 2 : (anchoUtil * i) / (etiquetas.length - 1));
  const y = (v: number) => margen.arriba + ((maximoEje - v) / rango) * altoUtil;
  const formato = (v: number) => v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const graduaciones = Array.from({ length: 5 }, (_, i) => minimoEje + (rango * i) / 4);
  const saltoEtiquetas = movil ? (etiquetas.length > 9 ? 3 : etiquetas.length > 5 ? 2 : 1) : etiquetas.length > 16 ? 2 : 1;

  const activa = puntoActivo ? visibles.find((s) => s.id === puntoActivo.id) : undefined;
  const valorActivo = activa && puntoActivo ? activa.valores[puntoActivo.indice] : null;
  const tooltipX = puntoActivo ? x(puntoActivo.indice) : 0;
  const tooltipY = valorActivo !== null && valorActivo !== undefined ? y(valorActivo) : 0;
  const tooltipAncho = movil ? Math.min(205, w - 20) : 245;
  const tooltipLeft = Math.min(w - tooltipAncho / 2 - 6, Math.max(tooltipAncho / 2 + 6, tooltipX));

  if (!etiquetas.length || !series.length) {
    return <p className="py-6 text-sm text-muted-foreground">No hay datos para graficar.</p>;
  }

  return (
    <div className="min-w-0 w-full space-y-3" ref={contenedorRef}>
      <div className="relative w-full overflow-hidden" style={{ height: h }}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width="100%"
          height={h}
          className="block w-full"
          role="img"
          aria-label="Evolución histórica interactiva de satisfacción"
          onPointerLeave={() => setPuntoActivo(null)}
        >
          <defs>
            <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
          {graduaciones.map((valor, i) => (
            <g key={i}>
              <line x1={margen.izquierda} x2={w - margen.derecha} y1={y(valor)} y2={y(valor)} stroke="currentColor" opacity="0.10" />
              <text x={margen.izquierda - 8} y={y(valor) + 4} textAnchor="end" fontSize={movil ? 10 : 11} fill="currentColor" opacity="0.6">
                {Number(valor.toFixed(1)).toLocaleString("es-AR", { maximumFractionDigits: 1 })}
              </text>
            </g>
          ))}
          {visibles.map((serie) => {
            const segmentos: string[][] = [];
            serie.valores.forEach((valor, i) => {
              if (valor === null || !Number.isFinite(valor)) return;
              if (!segmentos.length || i === 0 || serie.valores[i - 1] === null || !Number.isFinite(serie.valores[i - 1] as number)) segmentos.push([]);
              segmentos[segmentos.length - 1].push(`${x(i)},${y(valor)}`);
            });
            const atenuada = destacada !== null && destacada !== serie.id;
            return (
              <g key={serie.id} opacity={atenuada ? 0.18 : 1}>
                {segmentos.map((puntos, i) => (
                  <polyline key={i} points={puntos.join(" ")} fill="none" stroke={serie.color} strokeWidth={destacada === serie.id ? 3.3 : movil ? 2 : 2.5} strokeLinecap="round" strokeLinejoin="round" />
                ))}
                {serie.valores.map((valor, i) => {
                  if (valor === null || !Number.isFinite(valor)) return null;
                  const seleccionado = puntoActivo?.id === serie.id && puntoActivo.indice === i;
                  return (
                    <g key={i}>
                      <circle cx={x(i)} cy={y(valor)} r={seleccionado ? 5.5 : movil ? 3.4 : 4} fill={serie.color} stroke="var(--background, white)" strokeWidth="1.2" pointerEvents="none" />
                      <circle
                        cx={x(i)} cy={y(valor)} r={movil ? 12 : 10} fill="transparent"
                        className="cursor-pointer outline-none"
                        tabIndex={0} role="button"
                        aria-label={`${serie.nombre}, ${etiquetas[i]}: ${formato(valor)} ${unidad}`}
                        onPointerEnter={(e) => { if (e.pointerType !== "touch") setPuntoActivo({ id: serie.id, indice: i }); }}
                        onPointerLeave={(e) => { if (e.pointerType !== "touch") setPuntoActivo(null); }}
                        onClick={() => setPuntoActivo((prev) => prev?.id === serie.id && prev.indice === i ? null : { id: serie.id, indice: i })}
                        onFocus={() => setPuntoActivo({ id: serie.id, indice: i })}
                        onBlur={() => setPuntoActivo(null)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPuntoActivo({ id: serie.id, indice: i }); } }}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
          {etiquetas.map((label, i) => {
            if (i % saltoEtiquetas !== 0 && i !== etiquetas.length - 1) return null;
            if (i === etiquetas.length - 1 && i > 0 && i - (etiquetas.length - 1 - ((etiquetas.length - 1) % saltoEtiquetas)) < 2 && etiquetas.length > 6 && (etiquetas.length - 1) % saltoEtiquetas !== 0) return null;
            const corto = movil ? label.replace(/^([a-záéíóú]{3})\w*\s+(20)?(\d\d)$/i, "$1 $3") : label;
            return <text key={`${label}-${i}`} x={x(i)} y={h - 15} fontSize={muyAngosto ? 9 : 10.5} textAnchor="middle" fill="currentColor" opacity="0.65">{corto}</text>;
          })}
        </svg>
        {puntoActivo && activa && valorActivo !== null && valorActivo !== undefined && (
          <div
            className="pointer-events-none absolute z-20 rounded-lg border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-lg"
            style={{ width: tooltipAncho, left: tooltipLeft, top: Math.max(5, tooltipY - 9), transform: tooltipY < 85 ? "translate(-50%, 10px)" : "translate(-50%, -100%)" }}
          >
            <div className="font-semibold leading-snug">{activa.nombre}</div>
            <div className="mt-1 text-muted-foreground">{etiquetas[puntoActivo.indice]} · <strong className="text-foreground">{formato(valorActivo)} {unidad}</strong></div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Indicadores del gráfico">
        {series.map((serie) => {
          const oculta = ocultas.includes(serie.id);
          return (
            <button
              key={serie.id} type="button" aria-pressed={!oculta}
              onClick={() => { setOcultas((prev) => prev.includes(serie.id) ? prev.filter((id) => id !== serie.id) : [...prev, serie.id]); setPuntoActivo(null); }}
              onMouseEnter={() => setDestacada(serie.id)}
              onMouseLeave={() => setDestacada(null)}
              onFocus={() => setDestacada(serie.id)}
              onBlur={() => setDestacada(null)}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[11px] transition-colors hover:bg-muted ${oculta ? "opacity-40 line-through" : ""}`}
            >
              <span className="w-3.5 shrink-0 border-t-[3px]" style={{ borderColor: serie.color }} />
              <span className="break-words text-left">{serie.nombre}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {movil ? "Tocá un punto para ver su valor y volvé a tocarlo para cerrar el detalle." : "Pasá el cursor por un punto para ver su valor exacto."} Tocá un indicador para mostrar u ocultar su línea.
      </p>
    </div>
  );
}
