"use client";

import { useId, useState } from "react";

type DatoMes = {
  clave: string;
  nombre: string;
  cantidad: number;
};

type Props = { datos: DatoMes[] };

/** La geometría y el detalle usan el MISMO viewBox para evitar desalineaciones. */
export default function GraficoEvolucionInteractivo({ datos }: Props) {
  const [activo, setActivo] = useState<number | null>(null);
  const gradiente = useId().replace(/:/g, "");

  if (datos.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No hay fechas válidas para mostrar la evolución.
      </p>
    );
  }

  const ancho = 760;
  const alto = 260;
  const margen = { izquierda: 34, derecha: 20, arriba: 23, abajo: 34 };
  const interiorAncho = ancho - margen.izquierda - margen.derecha;
  const interiorAlto = alto - margen.arriba - margen.abajo;
  const topeReal = Math.max(1, ...datos.map((d) => d.cantidad));
  const tope = Math.ceil(topeReal / 10) * 10 || 10;
  const baseY = margen.arriba + interiorAlto;

  const puntos = datos.map((dato, indice) => ({
    x:
      margen.izquierda +
      (datos.length === 1 ? interiorAncho / 2 : (indice * interiorAncho) / (datos.length - 1)),
    y: baseY - (dato.cantidad / tope) * interiorAlto,
  }));

  const linea = puntos.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${puntos[0].x},${baseY} ${linea} ${puntos[puntos.length - 1].x},${baseY}`;
  const punto = activo === null ? null : puntos[activo] ?? null;
  const seleccionado = activo === null ? null : datos[activo] ?? null;

  const cajaAncho = 154;
  const cajaAlto = 53;
  const cajaX = punto ? Math.max(4, Math.min(ancho - cajaAncho - 4, punto.x - cajaAncho / 2)) : 0;
  const cajaY = punto
    ? punto.y < cajaAlto + 22
      ? Math.min(alto - cajaAlto - 4, punto.y + 15)
      : Math.max(4, punto.y - cajaAlto - 16)
    : 0;

  return (
    <div className="w-full min-w-0">
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        className="block h-auto w-full select-none"
        role="img"
        aria-label="Evolución de encuestas por mes. Pasá el cursor o tocá los puntos para consultar las cantidades."
        onPointerLeave={(evento) => {
          if (evento.pointerType !== "touch") setActivo(null);
        }}
        onPointerDown={(evento) => {
          if (evento.target === evento.currentTarget) setActivo(null);
        }}
      >
        <defs>
          <linearGradient id={gradiente} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.015" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((fraccion) => {
          const yy = baseY - fraccion * interiorAlto;
          return (
            <g key={fraccion}>
              <line
                x1={margen.izquierda}
                x2={ancho - margen.derecha}
                y1={yy}
                y2={yy}
                stroke="currentColor"
                strokeOpacity="0.10"
              />
              <text x={margen.izquierda - 9} y={yy + 4} fontSize="11" textAnchor="end" fill="currentColor" opacity="0.6">
                {Math.round(tope * fraccion)}
              </text>
            </g>
          );
        })}

        <polygon points={area} fill={`url(#${gradiente})`} />
        <polyline
          points={linea}
          fill="none"
          stroke="#10b981"
          strokeWidth="3.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          pointerEvents="none"
        />

        {punto && (
          <line
            x1={punto.x}
            x2={punto.x}
            y1={margen.arriba}
            y2={baseY}
            stroke="#059669"
            strokeWidth="1.5"
            strokeDasharray="4 5"
            opacity="0.45"
            pointerEvents="none"
          />
        )}

        {puntos.map((p, indice) => (
          <g key={datos[indice].clave}>
            {activo === indice && (
              <circle cx={p.x} cy={p.y} r="11" fill="#10b981" fillOpacity="0.17" pointerEvents="none" />
            )}
            <circle cx={p.x} cy={p.y} r={activo === indice ? 6.5 : 5} fill="#10b981" stroke="white" strokeWidth="2.2" pointerEvents="none" />
            <circle
              cx={p.x}
              cy={p.y}
              r="15"
              fill="transparent"
              className="cursor-pointer outline-none focus-visible:stroke-emerald-600"
              role="button"
              tabIndex={0}
              aria-label={`${datos[indice].nombre}: ${datos[indice].cantidad} encuestas`}
              onPointerEnter={(evento) => {
                if (evento.pointerType !== "touch") setActivo(indice);
              }}
              onPointerLeave={(evento) => {
                if (evento.pointerType !== "touch") setActivo(null);
              }}
              onPointerDown={(evento) => {
                if (evento.pointerType === "touch") {
                  setActivo((actual) => actual === indice ? null : indice);
                }
              }}
              onFocus={() => setActivo(indice)}
              onBlur={() => setActivo(null)}
              onKeyDown={(evento) => {
                if (evento.key === "Enter" || evento.key === " ") {
                  evento.preventDefault();
                  setActivo((actual) => actual === indice ? null : indice);
                }
              }}
            />
          </g>
        ))}

        {datos.map((dato, indice) => {
          // Se muestran menos meses en pantallas angostas mediante CSS sin perder puntos.
          const visibleMovil = indice % 2 === 0 || indice === datos.length - 1;
          return (
            <text
              key={dato.clave}
              x={puntos[indice].x}
              y={alto - 8}
              textAnchor="middle"
              fontSize="10.5"
              fill="currentColor"
              opacity="0.65"
              className={visibleMovil ? "" : "max-sm:hidden"}
            >
              {dato.nombre}
            </text>
          );
        })}

        {punto && seleccionado && (
          <g pointerEvents="none" role="status">
            <rect x={cajaX} y={cajaY} width={cajaAncho} height={cajaAlto} rx="9" fill="var(--popover, #ffffff)" stroke="var(--border, #d1d5db)" strokeWidth="1" />
            <rect x={cajaX + 10} y={cajaY + 11} width="4" height="30" rx="2" fill="#10b981" />
            <text x={cajaX + 23} y={cajaY + 22} fontSize="12" fill="var(--popover-foreground, #111827)" fontWeight="600">
              {seleccionado.nombre}
            </text>
            <text x={cajaX + 23} y={cajaY + 39} fontSize="12.5" fill="var(--popover-foreground, #111827)" fontWeight="700">
              {seleccionado.cantidad.toLocaleString("es-AR")} encuestas
            </text>
          </g>
        )}
      </svg>
      <p className="mt-2 text-xs text-muted-foreground sm:hidden">
        Tocá un punto para consultar la cantidad de ese mes.
      </p>
    </div>
  );
}
