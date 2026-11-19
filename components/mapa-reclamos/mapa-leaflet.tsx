
"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { MapGroup } from "./mapa-reclamos-client";
import { styleFor } from "./mapa-reclamos-client";
import "leaflet/dist/leaflet.css";
import "./mapa-reclamos.css";

// ==========================================
// ICONOS DE RECLAMOS
// ==========================================

const iconCache = new Map<string, L.DivIcon>();

function groupIcon(group: MapGroup): L.DivIcon {
  const services = [
    ...new Set(
      group.complaints.map((c) => c.effectiveService)
    ),
  ];

  const multiple = group.complaints.length > 1;

  const style =
    services.length > 1
      ? {
          label: "Varios servicios",
          color: "#334155",
          icon: "📍",
        }
      : styleFor(services[0]);

  const key = `${style.color}:${style.icon}:${
    multiple ? group.complaints.length : 0
  }`;

  const existing = iconCache.get(key);

  if (existing) return existing;

  const icon = L.divIcon({
    className: "complaints-marker-wrapper",
    iconSize: multiple ? [42, 48] : [38, 44],
    iconAnchor: multiple ? [21, 45] : [19, 41],
    popupAnchor: [0, -38],

    html: `
      <div
        class="complaints-pin"
        style="--pin-color:${style.color}"
      >
        <span>${style.icon}</span>

        ${
          multiple
            ? `<b class="complaints-pin-badge">
                ${group.complaints.length}
              </b>`
            : ""
        }
      </div>
    `,
  });

  iconCache.set(key, icon);

  return icon;
}

// ==========================================
// SEGURIDAD Y FORMATO
// ==========================================

function escapeHtml(v: unknown): string {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char
  );
}

function cleanText(value: unknown): string {
  const text = String(value ?? "").trim();

  return text ? escapeHtml(text) : "—";
}

function formatComplaintDate(value: string | null | undefined): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return cleanText(value);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function getExtra(
  extra: unknown,
  ...keys: string[]
): string {
  if (
    !extra ||
    typeof extra !== "object" ||
    Array.isArray(extra)
  ) {
    return "";
  }

  const bag = extra as Record<string, unknown>;

  for (const key of keys) {
    const value = bag[key];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "";
}

// ==========================================
// NUMERO DEL RECLAMO
// ==========================================

function complaintNumber(
  complaint: MapGroup["complaints"][number]
) {
  return complaint.form_variant === "arbolado"
    ? complaint.arbolado_number ??
        complaint.complaint_number ??
        complaint.id
    : complaint.complaint_number ??
        complaint.id;
}

// ==========================================
// INFORMACION DEL POPUP
// ==========================================

function popup(group: MapGroup): string {
  const first = group.complaints[0];

  const address = `${
    first.address ?? "Dirección no especificada"
  } ${first.street_number ?? ""}`.trim();

  return `
    <div class="complaints-popup">

      <strong>${escapeHtml(address)}</strong>

      <div class="complaints-popup-summary">
        ${
          group.complaints.length === 1
            ? "1 reclamo"
            : `${group.complaints.length} reclamos en esta dirección exacta`
        }
      </div>

      <div class="complaints-popup-list">

        ${group.complaints
          .map((c) => {
            const style = styleFor(
              c.effectiveService
            );

            const observations = getExtra(
              c.extra_data,
              "observaciones",
              "observation",
              "observations",
              "sp_observations"
            );

            const solution =
              typeof c.resolution_detail ===
                "string" &&
              c.resolution_detail.trim()
                ? c.resolution_detail.trim()
                : getExtra(
                    c.extra_data,
                    "solucion",
                    "solution",
                    "sp_solution"
                  );

            const responsible = getExtra(
              c.extra_data,
              "agente",
              "responsable",
              "responsable_resolucion",
              "resolution_responsible"
            );

            return `
              <div class="complaints-popup-item">

                <div class="complaints-popup-title">
                  <b>
                    ${escapeHtml(style.icon)}
                    ${escapeHtml(style.label)}
                  </b>

                  <span>
                    #${escapeHtml(
                      complaintNumber(c)
                    )}
                  </span>
                </div>

                <div>
                  <b>Fecha:</b>
                  ${formatComplaintDate(c.complaint_date)}
                </div>

                <div>
                  <b>Estado:</b>
                  ${cleanText(c.status)}
                </div>

                <div>
                  <b>Nombre:</b>
                  ${cleanText(c.complainant_name)}
                </div>

                <div>
                  <b>Causa:</b>
                  ${cleanText(c.cause_name)}
                </div>

                <div>
                  <b>Zona:</b>
                  ${cleanText(c.zone)}
                </div>

                <div>
                  <b>Detalle:</b>
                  ${cleanText(c.details)}
                </div>

                <div>
                  <b>Observaciones:</b>
                  ${cleanText(observations)}
                </div>

                <div>
                  <b>Resolución:</b>
                  ${cleanText(solution)}
                </div>

                <div>
                  <b>Responsable:</b>
                  ${cleanText(responsible)}
                </div>

              </div>
            `;
          })
          .join("")}

      </div>
    </div>
  `;
}

// ==========================================
// CAPA DE RECLAMOS
// ==========================================

function ComplaintLayers({
  groups,
}: {
  groups: MapGroup[];
}) {
  const map = useMap();

  const layerRef = useRef<L.LayerGroup | null>(
    null
  );

  const renderer = useMemo(
    () => L.canvas({ padding: 0.1 }),
    []
  );

  useEffect(() => {
    const layer = L.layerGroup().addTo(map);

    layerRef.current = layer;

    let scheduled = 0;

    const draw = () => {
      layer.clearLayers();

      const bounds = map.getBounds().pad(0.04);

      const zoom = map.getZoom();

      const visibleGroups = groups.filter(
        (group) =>
          bounds.contains(
            L.latLng(group.lat, group.lng)
          )
      );

      // ======================================
      // MEJORA VISUAL
      // Mostrar iconos desde zoom 14.
      // Limitar iconos grandes para mantener
      // un buen rendimiento.
      // ======================================

      const showDetailedIcons =
        zoom >= 14 &&
        visibleGroups.length <= 700;

      for (const group of visibleGroups) {
        const point = L.latLng(
          group.lat,
          group.lng
        );

        const repeat =
          group.complaints.length > 1;

        const style = styleFor(
          group.complaints[0].effectiveService
        );

        let marker: L.Marker | L.CircleMarker;

        if (repeat || showDetailedIcons) {
          // Marcador completo con icono.
          // Las direcciones reincidentes
          // mantienen su numero.

          marker = L.marker(point, {
            icon: groupIcon(group),
            keyboard: false,
            interactive: true,
          });
        } else {
          // Marcador compacto pero visible.
          // Canvas permite dibujar muchos
          // puntos sin crear miles de HTML.

          marker = L.circleMarker(point, {
            renderer,

            radius: 7.5,

            color: "#ffffff",

            weight: 2,

            fillColor: style.color,

            fillOpacity: 1,

            opacity: 1,

            bubblingMouseEvents: false,
          });
        }

        marker.bindPopup(
          () => popup(group),
          {
            maxWidth: 400,
            minWidth: 260,
            autoPanPaddingTopLeft: [
              40,
              120,
            ],
          }
        );

        layer.addLayer(marker);
      }
    };

    const scheduleDraw = () => {
      window.cancelAnimationFrame(scheduled);

      scheduled =
        window.requestAnimationFrame(draw);
    };

    draw();

    map.on(
      "moveend zoomend",
      scheduleDraw
    );

    return () => {
      window.cancelAnimationFrame(
        scheduled
      );

      map.off(
        "moveend zoomend",
        scheduleDraw
      );

      map.removeLayer(layer);

      if (layerRef.current === layer) {
        layerRef.current = null;
      }
    };
  }, [groups, map, renderer]);

  return null;
}

// ==========================================
// AJUSTAR TAMAÑO DEL MAPA
// ==========================================

function AutoResize() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();

    const observer = new ResizeObserver(
      () => {
        map.invalidateSize({
          pan: false,
        });
      }
    );

    observer.observe(container);

    const frame =
      requestAnimationFrame(() => {
        map.invalidateSize({
          pan: false,
        });
      });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map]);

  return null;
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function MapaLeaflet({
  groups,
}: {
  groups: MapGroup[];
}) {
  return (
    <MapContainer
      center={[-35.659, -63.758]}
      zoom={13}
      minZoom={4}
      className="h-full w-full"
      scrollWheelZoom
      preferCanvas
      zoomAnimation={false}
      markerZoomAnimation={false}
      fadeAnimation={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        updateWhenIdle
        keepBuffer={2}
      />
      <AutoResize />

      <ComplaintLayers groups={groups} />
    </MapContainer>
  );
}
