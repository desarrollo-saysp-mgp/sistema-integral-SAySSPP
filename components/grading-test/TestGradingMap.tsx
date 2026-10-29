"use client";

import {

  MapContainer,

  Marker,

  Polygon,

  Polyline,

  Popup,

  TileLayer,

  useMap,

  useMapEvents,

} from "react-leaflet";

import type {

  LatLngBoundsExpression,

  LatLngExpression,

} from "leaflet";

import L from "leaflet";

import {

  useEffect,

  useMemo,

  useRef,

  useState,

} from "react";

import "leaflet/dist/leaflet.css";

import StreetAutocomplete from "./StreetAutocomplete";

import GradingRouteDraw from "./GradingRouteDraw";

/*

 * ============================================================

 * TIPOS

 * ============================================================

 */

type GeoJsonLineString = {

  type: "LineString";

  coordinates: number[][];

};

type SegmentResponse = {

  geometry: GeoJsonLineString;

  main_street?: string;

  from_street?: string;

  to_street?: string;

  main_corridor?: string;

  from_corridor?: string;

  to_corridor?: string;

  original_parts?: number;

  parts_used?: number;

  bridge_max_meters?: number;

  limit_tolerance_meters?: number;

};

type SweepingRecordApi = {

  id: string;

  work_date: string;

  planned_from?: string | null;

  planned_to?: string | null;

  main_street: string;

  from_street: string;

  to_street: string;

  zone: string | null;

  status: string | null;

  observations: string | null;

  geometry: GeoJsonLineString;

  created_by?: string | null;

  created_at?: string | null;

  updated_at?: string | null;

  planned_record_id?: string | null;

  realized_record_id?: string | null;

  batch_id?: string | null;

  sweeping_type?: "MANUAL" | "MECANICO" | null;
  result_status?: "REALIZADO" | "NO_REALIZADO" | null;
  result_observation?: string | null;
  result_date?: string | null;

};

type MapRoute = SweepingRecordApi & {

  positions: LatLngExpression[];

  weekIndex: number;

  color: string;

};

type LoadMode =

  | "automatic"

  | "manual"

  | "area"

  | "mechanical";

type GeoJsonMultiLineString = {
  type: "MultiLineString";
  coordinates: number[][][];
};

type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

type AreaStreetGeometry =
  | GeoJsonLineString
  | GeoJsonMultiLineString;

type AreaStreet = {
  corridor_key: string;
  street_name: string;
  highway_types: string[];
  priority: "ALTA" | "MEDIA" | "BAJA";
  length_meters: number;
  geometry: AreaStreetGeometry;
};

type AreaStreetsResponse = {
  success: boolean;
  summary: {
    total: number;
    high_priority: number;
    medium_priority: number;
    low_priority: number;
    total_length_meters: number;
    total_length_km: number;
  };
  streets: AreaStreet[];
};

type SweepingAreaBatch = {
  batch_id: string;
  work_date: string;
  planned_from?: string | null;
  planned_to?: string | null;
  observations: string | null;
  color?: string | null;
  geometry: GeoJsonPolygon;
  pending_count?: number;
  realized_count?: number;
  created_at?: string | null;
};

type MechanicalMapPoint = {
  lat: number;
  lng: number;
};

type WorkOrderMapView = {
  center: [number, number];
  zoom: number;
  width: number;
  height: number;
};

type MechanicalCorridorPreview = {
  corridor_key: string;
  street_name: string;
  from_street: string;
  to_street: string;
  start_distance_meters: number;
  end_distance_meters: number;
  length_meters: number;
  streets_used?: string[];
  geometry: GeoJsonLineString;
};

type SweepingStatus =

  | "PLANIFICADO"

  | "COMPLETADO";

type ConfirmDialogConfig = {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  variant?: "danger" | "success";
};

type NotCompletedDialogState = {
  record: MapRoute;
  observation: string;
  error: string | null;
};

type SweepingComplaint = {
  id: number;
  complaint_date: string;
  address: string | null;
  street_number: string | null;
  status: string | null;
  details: string | null;
  lat: number;
  lng: number;
  created_at?: string | null;
};

type SweepingComplaintsResponse = {
  data: SweepingComplaint[];
  total: number;
  georeferenced: number;
  without_georeference: number;
};

type SweepingAlltrackVehicle = {
  code: string;
  found_in_database: boolean;
  has_alltrack: boolean;
  available_position: boolean;
  reason: string | null;
  vehicle: {
    id: string;
    name: string | null;
    license_plate: string | null;
    department: string | null;
    operational_status: string | null;
    utilization: string | null;
    primary_driver_1: string | null;
    primary_driver_2: string | null;
    backup_driver: string | null;
    alltrack_vehicle_id: string | null;
  } | null;
  position: {
    lat: number;
    lng: number;
    status: string | null;
    speed: number | null;
    driver: string | null;
    date: string | null;
    time: string | null;
    address: string | null;
    odometer: string | number | null;
    hourmeter: string | number | null;
    heading: number | null;
    timeout: number | null;
    alltrack_vehicle_id: string | null;
    alltrack_plate: string | null;
  } | null;
};

type SweepingAlltrackResponse = {
  updated_at: string;
  requested_codes: string[];
  total: number;
  located: number;
  without_position: number;
  data: SweepingAlltrackVehicle[];
};

type AlltrackHistoryPoint = {
  lat: number;
  lon: number;
  date: string | null;
  time: string | null;
  timestamp?: string | null;
  speed: number | null;
  odometer: string | number | null;
  driver: string | null;
};

type AlltrackHistoryStop = {
  type: string;
  lat: number;
  lng: number;
  from_date: string | null;
  from_time: string | null;
  to_date: string | null;
  to_time: string | null;
  minutes: number | null;
  points_count: number;
  validation?: "alltrack" | "spatial_b6";
  max_displacement_meters?: number | null;
  odometer_delta_km?: number | null;
};

type SweepingAlltrackHistoryResponse = {
  meta?: {
    route_points_count?: number;
    route_paths_count?: number;
    stops_count?: number;
    stops_strategy?: string;
  };
  data: {
    vehicle: {
      id: string;
      code: string;
      name: string | null;
      license_plate: string | null;
      department: string | null;
      primary_driver_1: string | null;
      primary_driver_2: string | null;
      backup_driver: string | null;
      alltrack_vehicle_id: string | null;
    };
    period: {
      from: string;
      to: string;
    };
    summary: {
      session_seconds: number;
      session_time: string;
      idle_seconds: number;
      idle_time: string;
      movement_seconds: number;
      movement_time: string;
      distance_km: number;
      distance_meters: number;
      movement_percent?: number;
      idle_percent?: number;
    };
    stops: AlltrackHistoryStop[];
    route: {
      segments: number;
      points: AlltrackHistoryPoint[];
      paths: AlltrackHistoryPoint[][];
    } | null;
  };
};

/*

 * ============================================================

 * CONSTANTES

 * ============================================================

 */

const GENERAL_PICO_CENTER: LatLngExpression = [

  -35.6566,

  -63.7568,

];

const WEEK_COLORS = [

  "#14b8a6",

  "#f97316",

  "#8b5cf6",

  "#db2777",

  "#22c55e",

];

function getRouteWeight(
  totalRoutes: number
) {
  if (totalRoutes < 200) {
    return 6;
  }

  if (totalRoutes < 500) {
    return 5;
  }

  if (totalRoutes < 1000) {
    return 4;
  }

  return 3;
}

function createComplaintPinIcon(
  color: string
) {
  return L.divIcon({
    className: "",
    iconSize: [30, 38],
    iconAnchor: [15, 36],
    popupAnchor: [0, -34],
    html: `
      <div style="
        position:relative;
        width:30px;
        height:38px;
      ">
        <div style="
          position:absolute;
          left:4px;
          top:2px;
          width:22px;
          height:22px;
          background:${color};
          border:3px solid #ffffff;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 3px 10px rgba(0,0,0,.38);
        ">
          <div style="
            position:absolute;
            left:50%;
            top:50%;
            width:7px;
            height:7px;
            border-radius:9999px;
            background:#ffffff;
            transform:translate(-50%,-50%);
          "></div>
        </div>
      </div>
    `,
  });
}

function parseAlltrackPositionDateTime(
  dateValue?: string | null,
  timeValue?: string | null
) {
  const dateText =
    String(dateValue ?? "").trim();

  const timeText =
    String(timeValue ?? "00:00:00").trim() ||
    "00:00:00";

  let year = "";
  let month = "";
  let day = "";

  if (
    /^\d{2}-\d{2}-\d{4}$/.test(
      dateText
    )
  ) {
    const parts =
      dateText.split("-");

    day = parts[0];
    month = parts[1];
    year = parts[2];
  } else if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      dateText
    )
  ) {
    const parts =
      dateText.split("-");

    year = parts[0];
    month = parts[1];
    day = parts[2];
  } else {
    return null;
  }

  const value = new Date(
    `${year}-${month}-${day}T${timeText}`
  );

  return Number.isNaN(
    value.getTime()
  )
    ? null
    : value;
}

function getAlltrackFreshness(
  dateValue?: string | null,
  timeValue?: string | null
) {
  const positionDate =
    parseAlltrackPositionDateTime(
      dateValue,
      timeValue
    );

  if (!positionDate) {
    return {
      label: "Sin fecha",
      color: "#64748b",
      className:
        "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
    };
  }

  const ageMinutes =
    Math.max(
      0,
      (
        Date.now() -
        positionDate.getTime()
      ) /
        60000
    );

  if (ageMinutes <= 120) {
    return {
      label: "Posición reciente",
      color: "#16a34a",
      className:
        "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
    };
  }

  if (ageMinutes <= 1440) {
    return {
      label: "Última posición de hoy",
      color: "#f59e0b",
      className:
        "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }

  return {
    label: "Posición antigua",
    color: "#64748b",
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
  };
}

function createAlltrackVehicleIcon(
  code: string,
  color: string
) {
  const safeCode =
    String(code || "?")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  return L.divIcon({
    className: "",
    iconSize: [58, 42],
    iconAnchor: [29, 36],
    popupAnchor: [0, -34],
    html: `
      <div style="
        position:relative;
        width:58px;
        height:42px;
        display:flex;
        align-items:flex-start;
        justify-content:center;
      ">
        <div style="
          min-width:42px;
          height:30px;
          padding:0 8px;
          display:flex;
          align-items:center;
          justify-content:center;
          border-radius:10px;
          background:${color};
          color:#ffffff;
          border:3px solid #ffffff;
          box-shadow:0 4px 12px rgba(0,0,0,.35);
          font-size:11px;
          font-weight:800;
          line-height:1;
          white-space:nowrap;
        ">${safeCode}</div>
        <div style="
          position:absolute;
          left:50%;
          top:27px;
          width:10px;
          height:10px;
          background:${color};
          border-right:2px solid #ffffff;
          border-bottom:2px solid #ffffff;
          transform:translateX(-50%) rotate(45deg);
        "></div>
      </div>
    `,
  });
}

function createAlltrackStopIcon(
  minutes: number | null
) {
  const label =
    minutes !== null
      ? `${minutes}m`
      : "P";

  return L.divIcon({
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -15],
    html: `
      <div style="
        width:34px;
        height:34px;
        border-radius:9999px;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#f97316;
        color:#ffffff;
        border:3px solid #ffffff;
        box-shadow:0 3px 10px rgba(0,0,0,.35);
        font-size:10px;
        font-weight:800;
      " title="Detención">${label}</div>
    `,
  });
}

function createAlltrackEndpointIcon(
  label: string,
  color: string
) {
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
    html: `
      <div style="
        width:30px;
        height:30px;
        border-radius:9999px;
        display:flex;
        align-items:center;
        justify-content:center;
        background:${color};
        color:#ffffff;
        border:3px solid #ffffff;
        box-shadow:0 3px 10px rgba(0,0,0,.35);
        font-size:11px;
        font-weight:800;
      " title="${label}">${label}</div>
    `,
  });
}

function escapeAreaLabelText(
  value: string
) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const AREA_COLOR_OPTIONS = [
  { value: "#f97316", label: "Naranja" },
  { value: "#dc2626", label: "Rojo" },
  { value: "#db2777", label: "Rosa" },
  { value: "#7c3aed", label: "Violeta" },
  { value: "#0891b2", label: "Celeste" },
  { value: "#16a34a", label: "Verde" },
  { value: "#2563eb", label: "Azul" },
];

function hexToRgb(
  hex: string
) {
  const normalized =
    hex.replace("#", "").trim();

  if (
    !/^[0-9a-fA-F]{6}$/.test(
      normalized
    )
  ) {
    return null;
  }

  return {
    r: Number.parseInt(
      normalized.slice(0, 2),
      16
    ),
    g: Number.parseInt(
      normalized.slice(2, 4),
      16
    ),
    b: Number.parseInt(
      normalized.slice(4, 6),
      16
    ),
  };
}

function normalizeAreaColor(
  value?: string | null
) {
  const clean =
    value?.trim().toLowerCase() ||
    "";

  return AREA_COLOR_OPTIONS.some(
    (option) =>
      option.value === clean
  )
    ? clean
    : "#f97316";
}

function createAreaPlanningLabelIcon(
  value: string,
  color = "#f97316"
) {
  const clean =
    value.trim() ||
    "Zona planificada";

  const short =
    clean.length > 42
      ? `${clean.slice(0, 39)}...`
      : clean;

  const safe =
    escapeAreaLabelText(short);

  const background =
    normalizeAreaColor(
      color
    );

  return L.divIcon({
    className: "",
    iconSize: [150, 34],
    iconAnchor: [75, 17],
    html: `
      <div style="
        min-width:110px;
        max-width:150px;
        padding:7px 10px;
        border-radius:9999px;
        background:${background};
        color:#ffffff;
        border:2px solid #ffffff;
        box-shadow:0 3px 10px rgba(15,23,42,.28);
        font-size:11px;
        line-height:1.15;
        font-weight:800;
        text-align:center;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      ">${safe}</div>
    `,
  });
}

function areaPolygonToLeaflet(
  geometry?: GeoJsonPolygon | null
): [number, number][] {
  if (
    !geometry ||
    geometry.type !== "Polygon" ||
    !Array.isArray(
      geometry.coordinates
    ) ||
    !Array.isArray(
      geometry.coordinates[0]
    )
  ) {
    return [];
  }

  return geometry.coordinates[0]
    .filter(
      (point) =>
        Array.isArray(point) &&
        point.length >= 2 &&
        Number.isFinite(
          Number(point[0])
        ) &&
        Number.isFinite(
          Number(point[1])
        )
    )
    .map(
      ([lng, lat]) =>
        [
          Number(lat),
          Number(lng),
        ] as [number, number]
    );
}

function areaPolygonCenter(
  geometry?: GeoJsonPolygon | null
): [number, number] | null {
  const positions =
    areaPolygonToLeaflet(
      geometry
    );

  if (positions.length < 3) {
    return null;
  }

  const bounds =
    L.latLngBounds(
      positions
    );

  const center =
    bounds.getCenter();

  return [
    center.lat,
    center.lng,
  ];
}

function areaPolygonLabelPoint(
  geometry?: GeoJsonPolygon | null
): [number, number] | null {
  const positions =
    areaPolygonToLeaflet(
      geometry
    );

  if (positions.length < 3) {
    return null;
  }

  const bounds =
    L.latLngBounds(
      positions
    );

  const north =
    bounds.getNorth();
  const south =
    bounds.getSouth();
  const center =
    bounds.getCenter();

  /*
   * La etiqueta se ubica cerca del borde superior de la zona
   * para no tapar las calles que se deben barrer.
   */
  const lat =
    north -
    (north - south) *
      0.08;

  return [
    lat,
    center.lng,
  ];
}

type RequiredStreetAutocompleteProps = {
  label: string;
  value: string;
  onSelectedChange: (value: string) => void;
  placeholder?: string;
};

function RequiredStreetAutocomplete({
  label,
  value,
  onSelectedChange,
  placeholder,
}: RequiredStreetAutocompleteProps) {
  /*
   * El valor que se escribe vive dentro de este componente.
   * De esta forma cada tecla NO vuelve a renderizar los dos mapas.
   *
   * El valor del componente padre se actualiza únicamente cuando
   * detectamos una selección del desplegable.
   */
  const [draftValue, setDraftValue] =
    useState(value);

  const [
    selectionLocked,
    setSelectionLocked,
  ] = useState(
    value.trim() !== ""
  );

  const rootRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const selectionIntentRef =
    useRef(false);

  const selectedValueRef =
    useRef(value);

  const ignoreNextEmptySyncRef =
    useRef(false);

  useEffect(() => {
    /*
     * Cuando nosotros invalidamos una selección porque el usuario
     * volvió a escribir, el padre pasa temporalmente a "".
     * No queremos que eso borre lo que está escribiendo.
     */
    if (
      ignoreNextEmptySyncRef.current &&
      value === ""
    ) {
      ignoreNextEmptySyncRef.current =
        false;
      selectedValueRef.current = "";
      return;
    }

    selectedValueRef.current = value;
    setDraftValue(value);
    setSelectionLocked(
      value.trim() !== ""
    );
  }, [value]);

  function handleAutocompleteChange(
    nextValue: string
  ) {
    setDraftValue(nextValue);

    if (selectionIntentRef.current) {
      selectionIntentRef.current =
        false;

      selectedValueRef.current =
        nextValue;

      onSelectedChange(
        nextValue
      );

      /*
       * Al confirmar una opción dejamos el campo "bloqueado" en
       * modo texto simple. Así el autocomplete se desmonta por
       * completo y NO puede volver a abrir su lista solo.
       *
       * Si el usuario quiere cambiar la calle, alcanza con volver
       * a hacer click/foco en el campo y se reactiva el autocomplete.
       */
      setSelectionLocked(true);

      return;
    }

    /*
     * Si había una calle válida seleccionada y el usuario vuelve
     * a escribir, deja de considerarse válida hasta que elija
     * nuevamente una opción del desplegable.
     *
     * Esto produce como máximo UN render del padre al comenzar
     * a modificar el campo, no uno por cada tecla.
     */
    if (
      selectedValueRef.current !== ""
    ) {
      selectedValueRef.current = "";
      ignoreNextEmptySyncRef.current =
        true;
      setSelectionLocked(false);
      onSelectedChange("");
    }
  }

  function handleMouseDownCapture(
    event: React.MouseEvent<HTMLDivElement>
  ) {
    const target =
      event.target as HTMLElement | null;

    if (!target) {
      return;
    }

    /*
     * Click dentro del input = escribir/posicionar cursor.
     * Click fuera del input dentro del autocomplete = opción
     * del desplegable.
     */
    if (
      target.closest(
        "input, textarea"
      )
    ) {
      return;
    }

    selectionIntentRef.current = true;

    /*
     * Evita que el input pierda foco antes de que la opción
     * procese el click. Esto elimina el problema de tener que
     * apretar dos veces una calle del desplegable.
     */
    event.preventDefault();
  }

  function handleKeyDownCapture(
    event: React.KeyboardEvent<HTMLDivElement>
  ) {
    if (event.key !== "Enter") {
      return;
    }

    /*
     * Permite seleccionar también con Enter.
     */
    selectionIntentRef.current = true;

    window.setTimeout(() => {
      selectionIntentRef.current = false;
    }, 0);
  }

  return (
    <div
      ref={rootRef}
      onMouseDownCapture={
        handleMouseDownCapture
      }
      onKeyDownCapture={
        handleKeyDownCapture
      }
    >
      {selectionLocked ? (
        <div>
          <label className="mb-1 block text-sm font-medium">
            {label}
          </label>

          <input
            type="text"
            value={draftValue}
            readOnly
            placeholder={placeholder}
            onFocus={() => {
              /*
               * Recién cuando el usuario vuelve a entrar al campo
               * habilitamos otra vez el autocomplete para cambiar
               * la selección.
               */
              setSelectionLocked(false);
            }}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      ) : (
        <StreetAutocomplete
          label={label}
          value={draftValue}
          onChange={
            handleAutocompleteChange
          }
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

type LocalObservationInputProps = {
  value: string;
  onCommit: (value: string) => void;
};

function LocalObservationInput({
  value,
  onCommit,
}: LocalObservationInputProps) {
  /*
   * La observación se escribe en estado LOCAL para que cada tecla
   * no vuelva a renderizar los mapas con miles de Polyline.
   *
   * Recién sincronizamos con TestGradingMap cuando el textarea
   * pierde el foco (por ejemplo al hacer click en "Agregar tramo").
   */
  const [
    draftObservation,
    setDraftObservation,
  ] = useState(value);

  useEffect(() => {
    setDraftObservation(value);
  }, [value]);

  function commitObservation() {
    if (
      draftObservation !==
      value
    ) {
      onCommit(
        draftObservation
      );
    }
  }

  return (
    <div className="mt-3">
      <label
        htmlFor="grading-observations"
        className="mb-1 block text-sm font-medium"
      >
        Observación
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          (opcional)
        </span>
      </label>

      <textarea
        id="grading-observations"
        value={draftObservation}
        onChange={(event) =>
          setDraftObservation(
            event.target.value
          )
        }
        onBlur={
          commitObservation
        }
        rows={3}
        maxLength={500}
        placeholder="Ej: Evitar horario escolar, sector con autos estacionados..."
        className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
      />

      <p className="mt-1 text-right text-xs text-muted-foreground">
        {draftObservation.length}/500
      </p>
    </div>
  );
}

type ShownRoutesPanelProps = {
  kind: "planned" | "completed";
  routes: MapRoute[];
  fromDate: string;
  toDate: string;
  editingRecordId: string | null;
  selectedRouteId: string | null;
  selectedBatchId: string | null;
  readOnly: boolean;
  editingSaving: boolean;
  deletingId: string | null;
  markingRealizedId: string | null;
  deletingBatchId: string | null;
  markingBatchId: string | null;
  deletingAllPending: boolean;
  onEdit: (record: MapRoute) => void;
  onDelete: (record: MapRoute) => void;
  onSelectRoute: (
    kind: "planned" | "completed",
    record: MapRoute
  ) => void;
  onSelectBatch?: (
    kind: "planned" | "completed",
    batchId: string,
    records: MapRoute[]
  ) => void;
  onMarkCompleted?: (record: MapRoute) => void;
  onMarkNotCompleted?: (record: MapRoute) => void;
  onUndoNotCompleted?: (record: MapRoute) => void;
  onMarkBatchCompleted?: (
    batchId: string,
    records: MapRoute[]
  ) => void;
  onDeleteBatch?: (
    batchId: string,
    records: MapRoute[]
  ) => void;
  onDeleteCompletedBatch?: (
    batchId: string,
    records: MapRoute[]
  ) => void;
  onDeleteAllPending?: () => void;
};

function ShownRoutesPanel({
  kind,
  routes,
  fromDate,
  toDate,
  editingRecordId,
  selectedRouteId,
  selectedBatchId,
  readOnly,
  editingSaving,
  deletingId,
  markingRealizedId,
  deletingBatchId,
  markingBatchId,
  deletingAllPending,
  onEdit,
  onDelete,
  onSelectRoute,
  onSelectBatch,
  onMarkCompleted,
  onMarkNotCompleted,
  onUndoNotCompleted,
  onMarkBatchCompleted,
  onDeleteBatch,
  onDeleteCompletedBatch,
  onDeleteAllPending,
}: ShownRoutesPanelProps) {
  const [searchText, setSearchText] =
    useState("");

  const [currentPage, setCurrentPage] =
    useState(1);

  const [
    expandedBatchIds,
    setExpandedBatchIds,
  ] = useState<Set<string>>(
    () => new Set()
  );

  const PAGE_SIZE = 8;

  const normalizedSearch =
    searchText
      .trim()
      .toLocaleLowerCase("es");



  const filteredRoutes = useMemo(() => {
    /*
     * En "Trabajos de motonivelación mostrados" ordenamos por orden de carga:
     * el registro más recientemente cargado aparece primero.
     *
     * Usamos created_at, que representa el momento real en que
     * se creó el registro en la base. No modificamos el orden
     * de los mapas ni los datos originales.
     */
    const orderedRoutes = [
      ...routes,
    ].sort((a, b) => {
      const aTime =
        a.created_at
          ? new Date(
              a.created_at
            ).getTime()
          : 0;

      const bTime =
        b.created_at
          ? new Date(
              b.created_at
            ).getTime()
          : 0;

      return bTime - aTime;
    });

    return orderedRoutes.filter(
      (record) => {


        if (!normalizedSearch) {
          return true;
        }

        const searchableText = [
          record.main_street,
          record.from_street,
          record.to_street,
          record.observations ?? "",
          record.sweeping_type === "MECANICO"
            ? "puntos corredor motoniveladora"
            : record.sweeping_type === "MANUAL"
              ? "trazado libre"
              : "",
        ]
          .join(" ")
          .toLocaleLowerCase("es");

        return searchableText.includes(
          normalizedSearch
        );
      }
    );
  }, [
    routes,
    normalizedSearch,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredRoutes.length / PAGE_SIZE
    )
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    normalizedSearch,
  ]);

  useEffect(() => {
    setCurrentPage((previous) =>
      Math.min(previous, totalPages)
    );
  }, [totalPages]);

  const pageStart =
    (currentPage - 1) * PAGE_SIZE;

  const paginatedRoutes =
    filteredRoutes.slice(
      pageStart,
      pageStart + PAGE_SIZE
    );

  const visibleFrom =
    filteredRoutes.length === 0
      ? 0
      : pageStart + 1;

  const visibleTo = Math.min(
    pageStart + PAGE_SIZE,
    filteredRoutes.length
  );

  const isPlanned =
    kind === "planned";

  /*
   * Las cargas hechas con "Seleccionar zona" comparten batch_id.
   * Las agrupamos solo para mostrar acciones masivas; el listado
   * individual se conserva debajo sin ningún cambio.
   */
  const batchGroups = useMemo(() => {
    const grouped =
      new Map<string, MapRoute[]>();

    for (const record of filteredRoutes) {
      const batchId =
        record.batch_id?.trim();

      if (!batchId) {
        continue;
      }

      const current =
        grouped.get(batchId) ?? [];

      current.push(record);
      grouped.set(
        batchId,
        current
      );
    }

    return Array.from(
      grouped.entries()
    )
      .map(
        ([batchId, records]) => ({
          batchId,
          records,
        })
      )
      .sort((a, b) => {
        const aTime =
          Math.max(
            ...a.records.map(
              (record) =>
                record.created_at
                  ? new Date(
                      record.created_at
                    ).getTime()
                  : 0
            )
          );

        const bTime =
          Math.max(
            ...b.records.map(
              (record) =>
                record.created_at
                  ? new Date(
                      record.created_at
                    ).getTime()
                  : 0
            )
          );

        return bTime - aTime;
      });
  }, [
    filteredRoutes,
  ]);

  const title =
    isPlanned
      ? "Planificados"
      : "Realizados";

  const panelClasses =
    isPlanned
      ? "border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20"
      : "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20";

  const titleClasses =
    isPlanned
      ? "text-blue-700 dark:text-blue-300"
      : "text-emerald-700 dark:text-emerald-300";

  const badgeClasses =
    isPlanned
      ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";

  const pendingPlannedCount =
    isPlanned
      ? routes.filter(
          (record) =>
            !record.realized_record_id && record.result_status !== "NO_REALIZADO"
        ).length
      : 0;

  const actionsDisabled =
    readOnly ||
    editingSaving ||
    deletingId !== null ||
    markingRealizedId !== null ||
    deletingBatchId !== null ||
    markingBatchId !== null ||
    deletingAllPending;

  function goToPage(page: number) {
    setCurrentPage(
      Math.min(
        Math.max(page, 1),
        totalPages
      )
    );
  }

  return (
    <div
      className={`rounded-lg border p-3 ${panelClasses}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p
            className={`text-sm font-semibold ${titleClasses}`}
          >
            {title}
          </p>

          <p className="text-xs text-muted-foreground">
            Del {formatDateAr(fromDate)} al{" "}
            {formatDateAr(toDate)}.
          </p>


        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {isPlanned &&
            !readOnly &&
            pendingPlannedCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  onDeleteAllPending?.()
                }
                disabled={
                  actionsDisabled
                }
                className="rounded-md border border-red-200 bg-background px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                {deletingAllPending
                  ? "Eliminando planificación..."
                  : `Eliminar ${pendingPlannedCount} pendientes del período`}
              </button>
            )}

          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClasses}`}
          >
            {normalizedSearch
              ? `${filteredRoutes.length} de ${routes.length}`
              : routes.length}
          </span>
        </div>
      </div>

      {routes.length > 0 && (
        <div className="mb-3">
          <input
            type="text"
            value={searchText}
            onChange={(event) =>
              setSearchText(
                event.target.value
              )
            }
            placeholder="Buscar calle u observación..."
            className="h-9 w-full rounded-md border bg-background px-3 text-xs outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
          />

          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>
              {filteredRoutes.length > 0
                ? `Mostrando ${visibleFrom}-${visibleTo} de ${filteredRoutes.length}`
                : "No hay tramos para mostrar"}
            </span>

            {filteredRoutes.length >
              PAGE_SIZE && (
              <span>
                Página {currentPage} de{" "}
                {totalPages}
              </span>
            )}
          </div>
        </div>
      )}

      {batchGroups.length > 0 && (
          <div
            className={`mb-3 space-y-2 rounded-lg border p-3 ${
              isPlanned
                ? "border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20"
                : "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p
                  className={`text-xs font-semibold ${
                    isPlanned
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {isPlanned
                    ? "Planificaciones por zona"
                    : "Trabajos de motonivelación realizados por zona"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {isPlanned
                    ? "Podés operar el grupo completo o seguir usando cada tramo individual del listado."
                    : "Podés revisar la zona completa, eliminar un realizado individual o corregir toda la zona si fue marcada por error."}
                </p>
              </div>

              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  isPlanned
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                }`}
              >
                {batchGroups.length}{" "}
                {batchGroups.length === 1
                  ? "grupo"
                  : "grupos"}
              </span>
            </div>

            <div className="space-y-2">
              {batchGroups.map(
                ({
                  batchId,
                  records: groupRecords,
                }) => {
                  const realizedCount =
                    isPlanned
                      ? groupRecords.filter(
                          (record) =>
                            Boolean(
                              record.realized_record_id
                            )
                        ).length
                      : groupRecords.length;

                  const notCompletedCount = isPlanned
                    ? groupRecords.filter((record) => record.result_status === "NO_REALIZADO").length
                    : 0;
                  const pendingCount =
                    isPlanned ? groupRecords.length - realizedCount - notCompletedCount : 0;

                  const firstRecord =
                    groupRecords[0];

                  const markingThisBatch =
                    markingBatchId ===
                    batchId;

                  const deletingThisBatch =
                    deletingBatchId ===
                    batchId;

                  const uniqueObservations =
                    Array.from(
                      new Set(
                        groupRecords
                          .map((record) =>
                            record.observations?.trim() ?? ""
                          )
                          .filter(Boolean)
                      )
                    );

                  const groupObservation =
                    uniqueObservations.length === 0
                      ? null
                      : uniqueObservations.length === 1
                        ? uniqueObservations[0]
                        : uniqueObservations.join(" · ");

                  const expanded =
                    expandedBatchIds.has(
                      batchId
                    );

                  const selectedGroup =
                    selectedBatchId ===
                    batchId;

                  return (
                    <div
                      key={batchId}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        onSelectBatch?.(
                          kind,
                          batchId,
                          groupRecords
                        )
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" ||
                          event.key === " "
                        ) {
                          event.preventDefault();
                          onSelectBatch?.(
                            kind,
                            batchId,
                            groupRecords
                          );
                        }
                      }}
                      title={
                        isPlanned
                          ? "Hacé click para ubicar toda esta planificación por zona en el mapa"
                          : "Hacé click para ubicar todo este motonivelación realizado por zona en el mapa"
                      }
                      className={`cursor-pointer rounded-md border px-3 py-2.5 transition focus:outline-none focus:ring-2 ${
                        !isPlanned || pendingCount === 0
                          ? "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 focus:ring-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
                          : "bg-background hover:bg-blue-50/50 focus:ring-blue-300 dark:border-blue-900 dark:hover:bg-blue-950/20"
                      } ${
                        selectedGroup
                          ? !isPlanned || pendingCount === 0
                            ? "border-emerald-500 ring-2 ring-emerald-300 dark:bg-emerald-950/30"
                            : "border-blue-500 bg-blue-50 ring-2 ring-blue-300 dark:bg-blue-950/30"
                          : !isPlanned || pendingCount === 0
                            ? ""
                            : "border-blue-200"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold">
                            {isPlanned
                              ? "▣ Planificación por zona"
                              : "▣ Motonivelación realizado por zona"}
                          </p>

                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {firstRecord
                              ? formatDateAr(
                                  firstRecord.work_date
                                )
                              : ""}
                            {" · "}
                            {groupRecords.length}{" "}
                            {groupRecords.length === 1
                              ? "tramo"
                              : "tramos"}
                            {isPlanned ? (
                              <>
                                {" · "}
                                {pendingCount} pendientes
                                {" · "}
                                {realizedCount} realizados
                                {notCompletedCount > 0 && ` · ${notCompletedCount} no realizados`}
                              </>
                            ) : (
                              <>
                                {" · "}
                                {realizedCount} realizados
                              </>
                            )}
                          </p>

                          {groupObservation && (
                            <div className="mt-2 rounded-md border bg-muted/30 px-2.5 py-2 text-[11px] leading-relaxed">
                              <span className="font-semibold">
                                Observación:
                              </span>{" "}
                              <span className="text-muted-foreground">
                                {groupObservation}
                              </span>
                            </div>
                          )}

                          <p
                            className={`mt-2 text-[10px] font-medium ${
                              isPlanned
                                ? "text-blue-600 dark:text-blue-300"
                                : "text-emerald-600 dark:text-emerald-300"
                            }`}
                          >
                            Hacé click en la tarjeta para ubicar toda la zona en el mapa.
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                            isPlanned && pendingCount > 0
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          }`}
                        >
                          {!isPlanned
                            ? `${groupRecords.length} realizados`
                            : pendingCount > 0
                              ? `${pendingCount} pendientes`
                              : notCompletedCount > 0 ? `${notCompletedCount} no realizados` : "✓ Grupo completo"}
                        </span>
                      </div>

                      <div
                        className="mt-2 flex flex-wrap gap-2"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                        onKeyDown={(event) =>
                          event.stopPropagation()
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedBatchIds(
                              (previous) => {
                                const next =
                                  new Set(
                                    previous
                                  );

                                if (
                                  next.has(
                                    batchId
                                  )
                                ) {
                                  next.delete(
                                    batchId
                                  );
                                } else {
                                  next.add(
                                    batchId
                                  );
                                }

                                return next;
                              }
                            )
                          }
                          className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
                        >
                          {expanded
                            ? "Ocultar calles"
                            : `Ver ${groupRecords.length} calles`}
                        </button>

                        {isPlanned ? (
                          pendingCount > 0 ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  onMarkBatchCompleted?.(
                                    batchId,
                                    groupRecords
                                  )
                                }
                                disabled={
                                  actionsDisabled
                                }
                                className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                              >
                                {markingThisBatch
                                  ? "Registrando grupo..."
                                  : `✓ Marcar ${pendingCount} como realizados`}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  onDeleteBatch?.(
                                    batchId,
                                    groupRecords
                                  )
                                }
                                disabled={
                                  actionsDisabled
                                }
                                className="rounded-md border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                              >
                                {deletingThisBatch
                                  ? "Eliminando grupo..."
                                  : `Eliminar ${pendingCount} pendientes`}
                              </button>
                            </>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                              {notCompletedCount > 0 ? `${notCompletedCount} no realizados · sin pendientes` : "✓ Todos los tramos fueron realizados"}
                            </span>
                          )
                        ) : (
                          !readOnly && (
                            <button
                              type="button"
                              onClick={() =>
                                onDeleteCompletedBatch?.(
                                  batchId,
                                  groupRecords
                                )
                              }
                              disabled={
                                actionsDisabled
                              }
                              className="rounded-md border border-red-200 bg-background px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                            >
                              {deletingThisBatch
                                ? "Eliminando realizados..."
                                : `Eliminar ${groupRecords.length} realizados de esta zona`}
                            </button>
                          )
                        )}
                      </div>

                      {expanded && (
                        <div
                          className="mt-3 max-h-64 overflow-y-auto rounded-md border bg-muted/20"
                          onClick={(event) =>
                            event.stopPropagation()
                          }
                          onKeyDown={(event) =>
                            event.stopPropagation()
                          }
                        >
                          {groupRecords.map(
                            (
                              record,
                              recordIndex
                            ) => {
                              const isAlreadyRealized =
                                isPlanned
                                  ? Boolean(
                                      record.realized_record_id
                                    )
                                  : true;

                              return (
                                <div
                                  key={
                                    record.id
                                  }
                                  role="button"
                                  tabIndex={0}
                                  onClick={() =>
                                    onSelectRoute(
                                      kind,
                                      record
                                    )
                                  }
                                  onKeyDown={(event) => {
                                    if (
                                      event.key ===
                                        "Enter" ||
                                      event.key ===
                                        " "
                                    ) {
                                      event.preventDefault();

                                      onSelectRoute(
                                        kind,
                                        record
                                      );
                                    }
                                  }}
                                  className="flex w-full items-start justify-between gap-3 border-b px-3 py-2 text-left text-[11px] transition last:border-b-0 hover:bg-background"
                                >
                                  <div className="flex min-w-0 items-start gap-2">
                                    <span className="mt-0.5 shrink-0 font-semibold text-blue-600">
                                      {recordIndex +
                                        1}.
                                    </span>

                                    <span className="min-w-0">
                                      <span className="font-semibold">
                                        {
                                          record.main_street
                                        }
                                      </span>

                                      <span className="text-muted-foreground">
                                        {" "}
                                        —{" "}
                                        {
                                          record.from_street
                                        }{" "}
                                        →{" "}
                                        {
                                          record.to_street
                                        }
                                      </span>

                                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                        {isAlreadyRealized
                                          ? "Ya realizado"
                                          : record.result_status === "NO_REALIZADO" ? "No realizado" : "Pendiente"}
                                      </span>
                                    </span>
                                  </div>

                                  {!readOnly && (
                                    <div
                                      className="flex shrink-0 flex-wrap items-center gap-1.5"
                                      onClick={(
                                        event
                                      ) =>
                                        event.stopPropagation()
                                      }
                                      onKeyDown={(
                                        event
                                      ) =>
                                        event.stopPropagation()
                                      }
                                    >
                                      {isPlanned &&
                                        !isAlreadyRealized && record.result_status !== "NO_REALIZADO" && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onMarkCompleted?.(
                                              record
                                            )
                                          }
                                          disabled={
                                            actionsDisabled
                                          }
                                          className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                                        >
                                          {markingRealizedId ===
                                          record.id
                                            ? "Registrando..."
                                            : "✓ Realizado"}
                                        </button>
                                      )}

                                      {isPlanned && !isAlreadyRealized && (
                                        <button type="button" disabled={actionsDisabled}
                                          onClick={() => record.result_status === "NO_REALIZADO"
                                            ? onUndoNotCompleted?.(record) : onMarkNotCompleted?.(record)}
                                          className="rounded-md border border-red-300 px-2 py-1 text-[10px] font-semibold text-red-700 disabled:opacity-50">
                                          {record.result_status === "NO_REALIZADO" ? "Deshacer no realizado" : "✕ No realizado"}
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onDelete(
                                            record
                                          )
                                        }
                                        disabled={
                                          actionsDisabled
                                        }
                                        className="rounded-md border border-red-200 px-2 py-1 text-[10px] font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                                      >
                                        {deletingId ===
                                        record.id
                                          ? "Eliminando..."
                                          : "Eliminar"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

      {routes.length === 0 ? (
        <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          {isPlanned
            ? "No hay tramos planificados."
            : "No hay trabajos de motonivelación realizados."}
        </div>
      ) : filteredRoutes.length === 0 ? (
        <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          No hay tramos que coincidan con la búsqueda.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paginatedRoutes.map(
              (record, index) => {
                const isSelected =
                  selectedRouteId ===
                  record.id;

                return (
                  <div
                    key={record.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      onSelectRoute(
                        kind,
                        record
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();

                        onSelectRoute(
                          kind,
                          record
                        );
                      }
                    }}
                    title="Hacé click para ubicar este tramo en el mapa"
                    className={`flex cursor-pointer items-start gap-3 rounded-md border bg-background px-3 py-2 transition hover:bg-muted/40 focus:outline-none focus:ring-2 ${
                      editingRecordId === record.id
                        ? "ring-2 ring-amber-400"
                        : isSelected
                          ? isPlanned
                            ? "border-blue-500 bg-blue-50 ring-4 ring-blue-300 dark:bg-blue-950/30"
                            : "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-300 dark:bg-emerald-950/30"
                          : ""
                    }`}
                  >
                    {isPlanned ? (
                      <span
                        className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                          record.result_status === "NO_REALIZADO" ? "bg-red-600" : "bg-blue-600"
                        }`}
                      />
                    ) : (
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            record.color,
                        }}
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-xs">
                          <span className="font-semibold">
                            {pageStart +
                              index +
                              1}
                            .{" "}
                            {record.main_street}
                          </span>

                          <span className="text-muted-foreground">
                            {" "}
                            — {record.from_street} →{" "}
                            {record.to_street}
                          </span>
                        </p>

                      </div>

                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatDateAr(
                          record.work_date
                        )}
                        {isPlanned
                          ? " · Planificado"
                          : ` · Semana ${
                              record.weekIndex +
                              1
                            } · Realizado${
                              record.planned_record_id
                                ? " · Desde planificación"
                                : ""
                            }`}
                      </p>

                      {isPlanned && record.result_status === "NO_REALIZADO" && (
                        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700">
                          <strong>Motivo de no realización:</strong> {record.result_observation || "Sin motivo registrado"}
                          {record.result_date && ` · ${formatDateAr(record.result_date)}`}
                        </div>
                      )}
                      {record.observations?.trim() && (
                        <div className="mt-2 rounded-md border bg-muted/30 px-2.5 py-2 text-[11px] leading-relaxed">
                          <span className="font-semibold">
                            Observación:
                          </span>{" "}
                          <span className="text-muted-foreground">
                            {record.observations}
                          </span>
                        </div>
                      )}

                      <div
                        className="mt-2 flex flex-wrap gap-2"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                        onKeyDown={(event) =>
                          event.stopPropagation()
                        }
                      >
                        {isPlanned &&
                          (record.realized_record_id ? (
                            <button
                              type="button"
                              disabled
                              className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 opacity-90 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                            >
                              ✓ Ya realizado
                            </button>
                          ) : record.result_status === "NO_REALIZADO" ? (
                            <span className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">✕ No realizado</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onMarkCompleted?.(
                                  record
                                )
                              }
                              disabled={
                                actionsDisabled
                              }
                              className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                            >
                              {markingRealizedId ===
                              record.id
                                ? "Registrando..."
                                : "✓ Marcar como realizado"}
                            </button>
                          ))}

                        {isPlanned && !record.realized_record_id && (
                          <button type="button" disabled={actionsDisabled}
                            onClick={() => record.result_status === "NO_REALIZADO"
                              ? onUndoNotCompleted?.(record) : onMarkNotCompleted?.(record)}
                            className="rounded-md border border-red-300 px-2.5 py-1 text-[11px] font-semibold text-red-700 disabled:opacity-50">
                            {record.result_status === "NO_REALIZADO" ? "Deshacer no realizado" : "✕ No realizado"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            onEdit(record)
                          }
                          disabled={
                            actionsDisabled
                          }
                          className="rounded-md border px-2.5 py-1 text-[11px] font-medium transition hover:bg-muted disabled:opacity-50"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onDelete(record)
                          }
                          disabled={
                            actionsDisabled
                          }
                          className="rounded-md border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          {deletingId ===
                          record.id
                            ? "Eliminando..."
                            : "Eliminar"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <p className="text-[11px] text-muted-foreground">
                {visibleFrom}-{visibleTo} de{" "}
                {filteredRoutes.length}
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    goToPage(
                      currentPage - 1
                    )
                  }
                  disabled={
                    currentPage === 1
                  }
                  className="h-8 rounded-md border bg-background px-2.5 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Anterior
                </button>

                <span className="min-w-[88px] text-center text-xs text-muted-foreground">
                  {currentPage} /{" "}
                  {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    goToPage(
                      currentPage + 1
                    )
                  }
                  disabled={
                    currentPage ===
                    totalPages
                  }
                  className="h-8 rounded-md border bg-background px-2.5 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/*

 * ============================================================

 * FECHAS

 * ============================================================

 */

function dateFromYmd(

  value: string

) {

  const parts =

    value

      .split("-")

      .map(Number);

  if (

    parts.length !== 3 ||

    !parts[0] ||

    !parts[1] ||

    !parts[2]

  ) {

    return null;

  }

  return new Date(

    parts[0],

    parts[1] - 1,

    parts[2],

    12,

    0,

    0,

    0

  );

}

function dateToYmd(

  date: Date

) {

  const year =

    date.getFullYear();

  const month =

    String(

      date.getMonth() + 1

    ).padStart(

      2,

      "0"

    );

  const day =

    String(

      date.getDate()

    ).padStart(

      2,

      "0"

    );

  return `${year}-${month}-${day}`;

}

function getTodayYmd() {

  return dateToYmd(

    new Date()

  );

}

function addDays(

  date: Date,

  amount: number

) {

  const result =

    new Date(date);

  result.setDate(

    result.getDate() +

      amount

  );

  return result;

}

function differenceInDays(

  from: Date,

  to: Date

) {

  const milliseconds =

    to.getTime() -

    from.getTime();

  return Math.round(

    milliseconds /

      (

        1000 *

        60 *

        60 *

        24

      )

  );

}

function formatDateAr(

  value?: string | null

) {

  if (!value) {

    return "-";

  }

  const date =

    dateFromYmd(value);

  if (!date) {

    return value;

  }

  return new Intl.DateTimeFormat(

    "es-AR",

    {

      day: "2-digit",

      month: "2-digit",

      year: "numeric",

    }

  ).format(date);

}

/*

 * ============================================================

 * SEMANAS

 * ============================================================

 */

function getWeekIndex(

  workDate: string,

  rangeStart: string

) {

  const date =

    dateFromYmd(

      workDate

    );

  const start =

    dateFromYmd(

      rangeStart

    );

  if (!date || !start) {

    return 0;

  }

  const difference =

    differenceInDays(

      start,

      date

    );

  if (difference <= 0) {

    return 0;

  }

  return Math.min(

    Math.floor(

      difference / 7

    ),

    WEEK_COLORS.length - 1

  );

}

/*

 * ============================================================

 * GEOJSON → LEAFLET

 * ============================================================

 */

function geoJsonToLeaflet(

  geometry?: GeoJsonLineString | null

): LatLngExpression[] {

  if (

    !geometry ||

    geometry.type !==

      "LineString" ||

    !Array.isArray(

      geometry.coordinates

    )

  ) {

    return [];

  }

  return geometry.coordinates

    .filter(

      (coordinate) =>

        Array.isArray(

          coordinate

        ) &&

        coordinate.length >= 2 &&

        Number.isFinite(

          Number(

            coordinate[0]

          )

        ) &&

        Number.isFinite(

          Number(

            coordinate[1]

          )

        )

    )

    .map(

      (coordinate) =>

        [

          Number(

            coordinate[1]

          ),

          Number(

            coordinate[0]

          ),

        ] as [

          number,

          number

        ]

    );

}

/*

 * ============================================================

 * VALIDAR RANGO

 * ============================================================

 */

function validateRange(

  fromValue: string,

  toValue: string,

  maxDays: number

) {

  const from =

    dateFromYmd(

      fromValue

    );

  const to =

    dateFromYmd(

      toValue

    );

  if (!from || !to) {

    return {

      valid: false,

      error:

        "Seleccioná un rango de fechas válido.",

    };

  }

  if (

    to.getTime() <

    from.getTime()

  ) {

    return {

      valid: false,

      error:

        "La fecha hasta no puede ser anterior a la fecha desde.",

    };

  }

  const difference =

    differenceInDays(

      from,

      to

    );

  if (

    difference >

    maxDays - 1

  ) {

    return {

      valid: false,

      error:

        `El rango máximo permitido es de ${maxDays} días.`,

    };

  }

  return {

    valid: true,

    error: null,

  };

}

/*

 * ============================================================

 * FIT MAPA

 * ============================================================

 */

function FitRoutes({

  routes,

}: {

  routes: LatLngExpression[][];

}) {

  const map =

    useMap();

  useEffect(() => {

    const allPositions =

      routes.flat();

    if (

      allPositions.length ===

      0

    ) {

      return;

    }

    const bounds =

      L.latLngBounds(

        allPositions as L.LatLngExpression[]

      );

    if (

      !bounds.isValid()

    ) {

      return;

    }

    map.fitBounds(

      bounds as LatLngBoundsExpression,

      {

        padding: [

          40,

          40,

        ],

        maxZoom: 16,

      }

    );

  }, [

    map,

    routes,

  ]);

  return null;

}

function WorkOrderPreviewController({
  routes,
  savedView,
  fitToken,
  viewKey,
  onViewChange,
}: {
  routes: MapRoute[];
  savedView: WorkOrderMapView | null;
  fitToken: number;
  viewKey: string;
  onViewChange: (view: WorkOrderMapView) => void;
}) {
  const map = useMap();
  const previousFitTokenRef =
    useRef(fitToken);
  const previousViewKeyRef =
    useRef("");

  const reportView = () => {
    const center = map.getCenter();
    const size = map.getSize();

    onViewChange({
      center: [
        center.lat,
        center.lng,
      ],
      zoom: map.getZoom(),
      width: Math.max(
        1,
        size.x
      ),
      height: Math.max(
        1,
        size.y
      ),
    });
  };

  useMapEvents({
    moveend: reportView,
    zoomend: reportView,
  });

  useEffect(() => {
    const allPositions =
      routes.flatMap(
        (record) =>
          record.positions
      );

    if (
      allPositions.length === 0
    ) {
      return;
    }

    const forceFit =
      previousFitTokenRef.current !==
      fitToken;

    const changedView =
      previousViewKeyRef.current !==
      viewKey;

    previousFitTokenRef.current =
      fitToken;

    previousViewKeyRef.current =
      viewKey;

    if (
      !forceFit &&
      changedView &&
      savedView
    ) {
      map.setView(
        savedView.center,
        savedView.zoom,
        {
          animate: false,
        }
      );

      window.setTimeout(
        reportView,
        0
      );

      return;
    }

    if (
      !forceFit &&
      !changedView
    ) {
      return;
    }

    const bounds =
      L.latLngBounds(
        allPositions as L.LatLngExpression[]
      );

    if (!bounds.isValid()) {
      return;
    }

    map.fitBounds(
      bounds as LatLngBoundsExpression,
      {
        padding: [64, 48],
        maxZoom: 16,
        animate: false,
      }
    );

    window.setTimeout(
      reportView,
      0
    );
  }, [
    map,
    routes,
    savedView,
    fitToken,
    viewKey,
  ]);

  return null;
}

function FitComplaintPoints({
  complaints,
}: {
  complaints: SweepingComplaint[];
}) {
  const map = useMap();

  useEffect(() => {
    if (complaints.length === 0) {
      return;
    }

    const bounds = L.latLngBounds(
      complaints.map(
        (complaint) =>
          [
            complaint.lat,
            complaint.lng,
          ] as [number, number]
      )
    );

    if (!bounds.isValid()) {
      return;
    }

    map.fitBounds(
      bounds as LatLngBoundsExpression,
      {
        padding: [40, 40],
        maxZoom: 16,
      }
    );
  }, [map, complaints]);

  return null;
}

function FitAlltrackVehicles({
  vehicles,
}: {
  vehicles: SweepingAlltrackVehicle[];
}) {
  const map = useMap();

  useEffect(() => {
    const positions =
      vehicles
        .filter(
          (item) =>
            item.available_position &&
            item.position
        )
        .map(
          (item) =>
            [
              item.position!.lat,
              item.position!.lng,
            ] as [number, number]
        );

    if (positions.length === 0) {
      return;
    }

    const bounds =
      L.latLngBounds(
        positions
      );

    if (!bounds.isValid()) {
      return;
    }

    map.fitBounds(
      bounds as LatLngBoundsExpression,
      {
        padding: [45, 45],
        maxZoom: 15,
      }
    );
  }, [map, vehicles]);

  return null;
}

function FitAlltrackHistory({
  paths,
  stops,
}: {
  paths: AlltrackHistoryPoint[][];
  stops: AlltrackHistoryStop[];
}) {
  const map = useMap();

  useEffect(() => {
    const positions: [number, number][] = [
      ...paths.flatMap((path) =>
        path.map(
          (point) =>
            [
              Number(point.lat),
              Number(point.lon),
            ] as [number, number]
        )
      ),
      ...stops.map(
        (stop) =>
          [
            Number(stop.lat),
            Number(stop.lng),
          ] as [number, number]
      ),
    ].filter(
      ([lat, lng]) =>
        Number.isFinite(lat) &&
        Number.isFinite(lng)
    );

    if (positions.length === 0) {
      return;
    }

    const bounds =
      L.latLngBounds(positions);

    if (!bounds.isValid()) {
      return;
    }

    map.fitBounds(
      bounds as LatLngBoundsExpression,
      {
        padding: [45, 45],
        maxZoom: 16,
      }
    );
  }, [map, paths, stops]);

  return null;
}

function FocusSelectedRoute({
  positions,
  focusToken,
}: {
  positions: LatLngExpression[] | null;
  focusToken: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!positions || positions.length < 2) {
      return;
    }

    const bounds = L.latLngBounds(
      positions as L.LatLngExpression[]
    );

    if (!bounds.isValid()) {
      return;
    }

    map.fitBounds(
      bounds as LatLngBoundsExpression,
      {
        padding: [60, 60],
        maxZoom: 18,
      }
    );
  }, [map, positions, focusToken]);

  return null;
}

function InvalidateMapOnFullscreen({

  fullscreen,

}: {

  fullscreen: boolean;

}) {

  const map =

    useMap();

  useEffect(() => {

    const firstTimeout =
      window.setTimeout(

        () => {

          map.invalidateSize({

            pan: false,

          });

        },

        100

      );

    const secondTimeout =
      window.setTimeout(

        () => {

          map.invalidateSize({

            pan: false,

          });

        },

        350

      );

    const thirdTimeout =
      window.setTimeout(

        () => {

          map.invalidateSize({

            pan: false,

          });

        },

        700

      );

    const fourthTimeout =
      window.setTimeout(

        () => {

          map.invalidateSize({

            pan: false,

          });

        },

        1200

      );

    return () => {

      window.clearTimeout(

        firstTimeout

      );

      window.clearTimeout(

        secondTimeout

      );

      window.clearTimeout(

        thirdTimeout

      );

      window.clearTimeout(

        fourthTimeout

      );

    };

  }, [

    map,

    fullscreen,

  ]);

  return null;

}


function InvalidateMapOnResize() {
  const map = useMap();

  useEffect(() => {
    const mapContainer = map.getContainer();
    const sizeContainer = mapContainer.parentElement;

    let frameId: number | null = null;
    const timeoutIds: number[] = [];

    const invalidate = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        map.invalidateSize({
          pan: false,
        });
      });
    };

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            invalidate();
          })
        : null;

    if (sizeContainer && observer) {
      observer.observe(sizeContainer);
    }

    [0, 80, 180, 350, 700].forEach(
      (delay) => {
        timeoutIds.push(
          window.setTimeout(
            invalidate,
            delay
          )
        );
      }
    );

    return () => {
      observer?.disconnect();

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      timeoutIds.forEach((id) => {
        window.clearTimeout(id);
      });
    };
  }, [map]);

  return null;
}

function areaStreetToLeafletPaths(
  geometry?: AreaStreetGeometry | null
): LatLngExpression[][] {
  if (!geometry) {
    return [];
  }

  const toPath = (
    coordinates: number[][]
  ): LatLngExpression[] =>
    coordinates
      .filter(
        (coordinate) =>
          Array.isArray(coordinate) &&
          coordinate.length >= 2 &&
          Number.isFinite(Number(coordinate[0])) &&
          Number.isFinite(Number(coordinate[1]))
      )
      .map(
        (coordinate) =>
          [
            Number(coordinate[1]),
            Number(coordinate[0]),
          ] as [number, number]
      );

  if (geometry.type === "LineString") {
    const path = toPath(geometry.coordinates);
    return path.length >= 2 ? [path] : [];
  }

  return geometry.coordinates
    .map(toPath)
    .filter((path) => path.length >= 2);
}

function isAreaStreetSelectableByDefault(
  street: AreaStreet
) {
  const excludedHighwayTypes = new Set([
    "cycleway",
    "footway",
    "path",
    "steps",
    "bridleway",
    "construction",
    "proposed",
  ]);

  if (
    street.street_name
      .trim()
      .toLocaleLowerCase("es") === "bicisenda"
  ) {
    return false;
  }

  // Una calle puede tener partes OSM de distintos tipos.
  // No descartamos toda la calle si al menos una parte es vehicular.
  const types = (street.highway_types ?? [])
    .map((type) => String(type || "").trim().toLowerCase())
    .filter(Boolean);

  return types.length === 0 || types.some(
    (type) => !excludedHighwayTypes.has(type)
  );
}

type AreaSelectionDrawProps = {
  drawing: boolean;
  clearToken: number;
  finishToken: number;
  undoToken: number;
  onCreated: (geometry: GeoJsonPolygon) => void;
  onDrawingFinished: () => void;
};

function orientation(
  a: [number, number],
  b: [number, number],
  c: [number, number]
) {
  const value =
    (b[1] - a[1]) * (c[0] - b[0]) -
    (b[0] - a[0]) * (c[1] - b[1]);

  if (Math.abs(value) < 1e-12) {
    return 0;
  }

  return value > 0 ? 1 : 2;
}

function pointOnSegment(
  a: [number, number],
  b: [number, number],
  c: [number, number]
) {
  return (
    b[0] <= Math.max(a[0], c[0]) + 1e-12 &&
    b[0] + 1e-12 >= Math.min(a[0], c[0]) &&
    b[1] <= Math.max(a[1], c[1]) + 1e-12 &&
    b[1] + 1e-12 >= Math.min(a[1], c[1])
  );
}

function segmentsIntersect(
  p1: [number, number],
  q1: [number, number],
  p2: [number, number],
  q2: [number, number]
) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  if (o1 === 0 && pointOnSegment(p1, p2, q1)) return true;
  if (o2 === 0 && pointOnSegment(p1, q2, q1)) return true;
  if (o3 === 0 && pointOnSegment(p2, p1, q2)) return true;
  if (o4 === 0 && pointOnSegment(p2, q1, q2)) return true;

  return false;
}

function areaPolygonSelfIntersects(
  points: [number, number][]
) {
  if (points.length < 4) {
    return false;
  }

  for (let i = 0; i < points.length; i += 1) {
    const a1 = points[i];
    const a2 = points[(i + 1) % points.length];

    for (let j = i + 1; j < points.length; j += 1) {
      const b1 = points[j];
      const b2 = points[(j + 1) % points.length];

      const adjacent =
        i === j ||
        (i + 1) % points.length === j ||
        i === (j + 1) % points.length;

      if (adjacent) {
        continue;
      }

      if (segmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }

  return false;
}

function normalizeAreaPolygonPoints(
  points: [number, number][]
) {
  /*
   * Si el usuario marcó los puntos alrededor del perímetro,
   * respetamos exactamente ese orden. Solo corregimos cuando
   * los segmentos se cruzan (el típico "moño" que se veía en
   * el mapa al marcar las esquinas en un orden distinto).
   */
  if (
    points.length < 4 ||
    !areaPolygonSelfIntersects(points)
  ) {
    return points;
  }

  const centerLat =
    points.reduce((sum, point) => sum + point[0], 0) /
    points.length;

  const centerLng =
    points.reduce((sum, point) => sum + point[1], 0) /
    points.length;

  return [...points].sort((a, b) => {
    const angleA = Math.atan2(
      a[0] - centerLat,
      a[1] - centerLng
    );
    const angleB = Math.atan2(
      b[0] - centerLat,
      b[1] - centerLng
    );

    return angleA - angleB;
  });
}

function createAreaPointIcon(index: number) {
  return L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `
      <div style="
        width:24px;
        height:24px;
        border-radius:9999px;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#2563eb;
        color:white;
        border:2px solid white;
        box-shadow:0 2px 7px rgba(0,0,0,.35);
        font-size:10px;
        font-weight:800;
      ">${index + 1}</div>
    `,
  });
}

function AreaSelectionDraw({
  drawing,
  clearToken,
  finishToken,
  undoToken,
  onCreated,
  onDrawingFinished,
}: AreaSelectionDrawProps) {
  const [points, setPoints] =
    useState<[number, number][]>([]);

  const lastHandledFinishTokenRef =
    useRef(finishToken);

  const normalizedPoints = useMemo(
    () => normalizeAreaPolygonPoints(points),
    [points]
  );

  const wasAutoOrdered =
    points.length >= 4 &&
    areaPolygonSelfIntersects(points);

  useMapEvents({
    click(event) {
      if (!drawing) {
        return;
      }

      setPoints((previous) => [
        ...previous,
        [event.latlng.lat, event.latlng.lng],
      ]);
    },
  });

  useEffect(() => {
    setPoints([]);
  }, [clearToken]);

  useEffect(() => {
    if (!drawing) {
      return;
    }

    setPoints((previous) =>
      previous.slice(0, -1)
    );
  }, [undoToken, drawing]);

  useEffect(() => {
    if (
      !drawing ||
      finishToken === 0 ||
      finishToken === lastHandledFinishTokenRef.current
    ) {
      return;
    }

    lastHandledFinishTokenRef.current =
      finishToken;

    if (normalizedPoints.length < 3) {
      return;
    }

    const ring = [
      ...normalizedPoints.map(([lat, lng]) => [lng, lat]),
      [normalizedPoints[0][1], normalizedPoints[0][0]],
    ];

    onCreated({
      type: "Polygon",
      coordinates: [ring],
    });

    onDrawingFinished();
  }, [
    drawing,
    finishToken,
    normalizedPoints,
    onCreated,
    onDrawingFinished,
  ]);

  if (points.length === 0) {
    return null;
  }

  return (
    <>
      {normalizedPoints.length >= 3 ? (
        <Polygon
          positions={normalizedPoints}
          interactive={false}
          pathOptions={{
            color: wasAutoOrdered
              ? "#7c3aed"
              : "#2563eb",
            weight: 3,
            fillOpacity: 0.14,
          }}
        />
      ) : (
        <Polyline
          positions={points}
          interactive={false}
          pathOptions={{
            color: "#2563eb",
            weight: 3,
            dashArray: "6 6",
          }}
        />
      )}

      {points.map((point, index) => (
        <Marker
          key={`area-point-${index}`}
          position={point}
          icon={createAreaPointIcon(index)}
          interactive={false}
        />
      ))}
    </>
  );
}


function createMechanicalPointIcon(
  label: "A" | "B"
) {
  return L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `
      <div style="
        width:26px;
        height:26px;
        border-radius:9999px;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#2563eb;
        color:white;
        border:2px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,.35);
        font-size:11px;
        font-weight:900;
      ">${label}</div>
    `,
  });
}

function MechanicalCorridorMapSelector({
  active,
  startPoint,
  endPoint,
  onMapPoint,
}: {
  active: boolean;
  startPoint: MechanicalMapPoint | null;
  endPoint: MechanicalMapPoint | null;
  onMapPoint: (point: MechanicalMapPoint) => void;
}) {
  useMapEvents({
    click(event) {
      if (!active) {
        return;
      }

      onMapPoint({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    },
  });

  return (
    <>
      {startPoint && (
        <Marker
          position={[startPoint.lat, startPoint.lng]}
          icon={createMechanicalPointIcon("A")}
          interactive={false}
          zIndexOffset={1100}
        />
      )}

      {endPoint && (
        <Marker
          position={[endPoint.lat, endPoint.lng]}
          icon={createMechanicalPointIcon("B")}
          interactive={false}
          zIndexOffset={1100}
        />
      )}

      {startPoint && endPoint && (
        <Polyline
          positions={[
            [startPoint.lat, startPoint.lng],
            [endPoint.lat, endPoint.lng],
          ]}
          interactive={false}
          pathOptions={{
            color: "#f97316",
            weight: 2,
            opacity: 0.65,
            dashArray: "5 7",
          }}
        />
      )}
    </>
  );
}

/*

 * ============================================================

 * COMPONENTE

 * ============================================================

 */

type TestGradingMapProps = {
  readOnly?: boolean;
};

export default function TestGradingMap({
  readOnly = false,
}: TestGradingMapProps) {

  /*

   * ==========================================================

   * MODO DE CARGA

   * ==========================================================

   */

  const [

    loadMode,

    setLoadMode,

  ] = useState<LoadMode>(

    "automatic"

  );

  const [

    recordStatus,

    setRecordStatus,

  ] = useState<SweepingStatus>(

    "COMPLETADO"

  );

  /*

   * ==========================================================

   * CALLES

   * ==========================================================

   */

  const [

    street,

    setStreet,

  ] = useState("");

  const [

    fromStreet,

    setFromStreet,

  ] = useState("");

  const [

    toStreet,

    setToStreet,

  ] = useState("");

  const [

    observations,

    setObservations,

  ] = useState("");

  /*

   * ==========================================================

   * DIBUJO MANUAL

   * ==========================================================

   */

  const [

    drawingManual,

    setDrawingManual,

  ] = useState(false);

  const [

    manualGeometry,

    setManualGeometry,

  ] =

    useState<GeoJsonLineString | null>(

      null

    );

  const [

    manualClearToken,

    setManualClearToken,

  ] = useState(0);

  const [

    manualFinishToken,

    setManualFinishToken,

  ] = useState(0);

  const [

    manualUndoToken,

    setManualUndoToken,

  ] = useState(0);

  /*
   * ==========================================================
   * SELECCIÓN DE ZONA
   * ==========================================================
   */

  const [areaDrawing, setAreaDrawing] =
    useState(false);

  const [areaGeometry, setAreaGeometry] =
    useState<GeoJsonPolygon | null>(null);

  const [
    plannedAreaBatches,
    setPlannedAreaBatches,
  ] = useState<SweepingAreaBatch[]>([]);

  const [areaClearToken, setAreaClearToken] =
    useState(0);

  const [areaFinishToken, setAreaFinishToken] =
    useState(0);

  const [areaUndoToken, setAreaUndoToken] =
    useState(0);

  const [areaLoading, setAreaLoading] =
    useState(false);

  const [areaSaving, setAreaSaving] =
    useState(false);

  const [areaStreets, setAreaStreets] =
    useState<AreaStreet[]>([]);

  const [selectedAreaStreetKeys, setSelectedAreaStreetKeys] =
    useState<Set<string>>(new Set());

  const [
    planningFrom,
    setPlanningFrom,
  ] = useState(getTodayYmd());

  const [
    planningTo,
    setPlanningTo,
  ] = useState(getTodayYmd());

  const [areaColor, setAreaColor] =
    useState("#f97316");

  /*
   * ==========================================================
   * CORREDOR MECÁNICO - DOS PUNTOS
   * ==========================================================
   */

  const [
    mechanicalSelecting,
    setMechanicalSelecting,
  ] = useState(false);

  const [
    mechanicalStartPoint,
    setMechanicalStartPoint,
  ] = useState<MechanicalMapPoint | null>(null);

  const [
    mechanicalEndPoint,
    setMechanicalEndPoint,
  ] = useState<MechanicalMapPoint | null>(null);

  const [
    mechanicalPreview,
    setMechanicalPreview,
  ] = useState<MechanicalCorridorPreview | null>(null);

  const [
    mechanicalLoading,
    setMechanicalLoading,
  ] = useState(false);

  const [
    mechanicalSaving,
    setMechanicalSaving,
  ] = useState(false);

  /*
   * ==========================================================
   * ORDEN DE TRABAJO / PDF
   * ==========================================================
   */

  const [
    workOrderOpen,
    setWorkOrderOpen,
  ] = useState(false);

  const [
    workOrderDate,
    setWorkOrderDate,
  ] = useState(getTodayYmd());

  const [
    workOrderType,
    setWorkOrderType,
  ] = useState<
    "ALL" | "MANUAL" | "MECANICO"
  >("ALL");

  const [
    workOrderRoutes,
    setWorkOrderRoutes,
  ] = useState<MapRoute[]>([]);

  const [
    workOrderAreaBatches,
    setWorkOrderAreaBatches,
  ] = useState<SweepingAreaBatch[]>([]);

  const [
    workOrderLoading,
    setWorkOrderLoading,
  ] = useState(false);

  const [
    workOrderGenerating,
    setWorkOrderGenerating,
  ] = useState(false);

  const workOrderMapRef =
    useRef<HTMLDivElement | null>(null);

  const [
    workOrderPreviewKind,
    setWorkOrderPreviewKind,
  ] = useState<
    "MANUAL" | "MECANICO"
  >("MANUAL");

  const [
    workOrderManualView,
    setWorkOrderManualView,
  ] =
    useState<WorkOrderMapView | null>(
      null
    );

  const [
    workOrderMechanicalView,
    setWorkOrderMechanicalView,
  ] =
    useState<WorkOrderMapView | null>(
      null
    );

  const [
    workOrderFitToken,
    setWorkOrderFitToken,
  ] = useState(0);

  const [
    selectedWorkOrderBatchIds,
    setSelectedWorkOrderBatchIds,
  ] = useState<Set<string>>(
    () => new Set()
  );

  const filteredWorkOrderRoutes =
    useMemo(() => {
      if (
        workOrderType === "ALL"
      ) {
        return workOrderRoutes;
      }

      return workOrderRoutes.filter(
        (record) =>
          record.sweeping_type ===
          workOrderType
      );
    }, [
      workOrderRoutes,
      workOrderType,
    ]);

  const filteredWorkOrderAreas =
    useMemo(() => {
      if (
        workOrderType === "MECANICO"
      ) {
        return [];
      }

      return workOrderAreaBatches;
    }, [
      workOrderAreaBatches,
      workOrderType,
    ]);

  const workOrderManualCount =
    useMemo(
      () =>
        workOrderRoutes.filter(
          (record) =>
            record.sweeping_type ===
            "MANUAL"
        ).length,
      [workOrderRoutes]
    );

  const workOrderMechanicalCount =
    useMemo(
      () =>
        workOrderRoutes.filter(
          (record) =>
            record.sweeping_type ===
            "MECANICO"
        ).length,
      [workOrderRoutes]
    );

  const selectedWorkOrderManualRoutes =
    useMemo(
      () =>
        workOrderRoutes.filter(
          (record) => {
            if (
              record.sweeping_type !==
              "MANUAL"
            ) {
              return false;
            }

            const batchId =
              record.batch_id?.trim();

            /*
             * Los tramos manuales individuales que no pertenecen a
             * una zona se mantienen siempre. La selección controla
             * únicamente las planificaciones agrupadas por zona.
             */
            if (!batchId) {
              return true;
            }

            return selectedWorkOrderBatchIds.has(
              batchId
            );
          }
        ),
      [
        workOrderRoutes,
        selectedWorkOrderBatchIds,
      ]
    );

  const selectedWorkOrderAreas =
    useMemo(
      () =>
        workOrderAreaBatches.filter(
          (batch) =>
            selectedWorkOrderBatchIds.has(
              batch.batch_id
            )
        ),
      [
        workOrderAreaBatches,
        selectedWorkOrderBatchIds,
      ]
    );

  const workOrderPreviewRoutes =
    useMemo(
      () =>
        workOrderPreviewKind ===
        "MANUAL"
          ? selectedWorkOrderManualRoutes
          : workOrderRoutes.filter(
              (record) =>
                record.sweeping_type ===
                "MECANICO"
            ),
      [
        workOrderRoutes,
        workOrderPreviewKind,
        selectedWorkOrderManualRoutes,
      ]
    );

  const workOrderPreviewAreas =
    useMemo(
      () =>
        workOrderPreviewKind ===
        "MANUAL"
          ? selectedWorkOrderAreas
          : [],
      [
        workOrderPreviewKind,
        selectedWorkOrderAreas,
      ]
    );

  const workOrderPreviewView =
    workOrderPreviewKind === "MANUAL"
      ? workOrderManualView
      : workOrderMechanicalView;

  /*
   * La orden de trabajo se carga sola:
   * - al abrir el modal;
   * - al cambiar la fecha.
   *
   * El selector Manual / Mecánico NO vuelve a consultar la API:
   * filtra instantáneamente lo que ya se cargó.
   */
  useEffect(() => {
    if (
      !workOrderOpen ||
      !workOrderDate
    ) {
      return;
    }

    setWorkOrderRoutes([]);
    setWorkOrderAreaBatches([]);

    const timer =
      window.setTimeout(() => {
        void loadWorkOrderData(
          workOrderDate
        );
      }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    workOrderOpen,
    workOrderDate,
  ]);

  useEffect(() => {
    if (
      workOrderType === "MANUAL"
    ) {
      setWorkOrderPreviewKind(
        "MANUAL"
      );
      return;
    }

    if (
      workOrderType === "MECANICO"
    ) {
      setWorkOrderPreviewKind(
        "MECANICO"
      );
      return;
    }

    if (
      workOrderPreviewKind ===
        "MANUAL" &&
      workOrderManualCount === 0 &&
      workOrderMechanicalCount > 0
    ) {
      setWorkOrderPreviewKind(
        "MECANICO"
      );
    }

    if (
      workOrderPreviewKind ===
        "MECANICO" &&
      workOrderMechanicalCount === 0 &&
      workOrderManualCount > 0
    ) {
      setWorkOrderPreviewKind(
        "MANUAL"
      );
    }
  }, [
    workOrderType,
    workOrderPreviewKind,
    workOrderManualCount,
    workOrderMechanicalCount,
  ]);

  async function loadWorkOrderData(
    dateValue = workOrderDate
  ) {
    if (!dateValue) {
      setError(
        "Seleccioná una fecha para generar la orden de trabajo."
      );
      return false;
    }

    try {
      setWorkOrderLoading(true);
      setError(null);

      const [
        routes,
        areas,
      ] = await Promise.all([
        fetchRecordsForStatus(
          dateValue,
          dateValue,
          "PLANIFICADO"
        ),
        fetchPlannedAreaBatches(
          dateValue,
          dateValue
        ),
      ]);

      setWorkOrderRoutes(
        routes
      );

      setWorkOrderAreaBatches(
        areas
      );

      setSelectedWorkOrderBatchIds(
        new Set(
          areas.map(
            (batch) =>
              batch.batch_id
          )
        )
      );

      setWorkOrderManualView(null);
      setWorkOrderMechanicalView(null);
      setWorkOrderFitToken(
        (value) => value + 1
      );

      const hasManual =
        routes.some(
          (record) =>
            record.sweeping_type ===
            "MANUAL"
        );

      const hasMechanical =
        routes.some(
          (record) =>
            record.sweeping_type ===
            "MECANICO"
        );

      if (
        hasManual
      ) {
        setWorkOrderPreviewKind(
          "MANUAL"
        );
      } else if (
        hasMechanical
      ) {
        setWorkOrderPreviewKind(
          "MECANICO"
        );
      }

      return true;
    } catch (err) {
      console.error(
        "Error cargando orden de trabajo:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar la planificación para la orden de trabajo."
      );

      return false;
    } finally {
      setWorkOrderLoading(false);
    }
  }

  function openWorkOrderDialog() {
    setWorkOrderType("ALL");
    setWorkOrderOpen(true);
  }

  async function generateWorkOrderPdf() {
    const routes =
      filteredWorkOrderRoutes;

    if (
      routes.length === 0
    ) {
      setError(
        "No hay tramos planificados para generar la orden de trabajo con los filtros seleccionados."
      );
      return;
    }

    try {
      setWorkOrderGenerating(
        true
      );
      setError(null);

      const jsPdfModule =
        await import("jspdf");

      const jsPDF =
        jsPdfModule.jsPDF;

      const pdfSafeText = (
        value?: string | null
      ) => {
        const raw =
          String(value ?? "")
            .normalize("NFC")
            .replace(
              /[\u2010-\u2015\u2212]/g,
              "-"
            )
            .replace(
              /\u2192/g,
              " a "
            )
            .replace(
              /[\u2018\u2019\u201B\u2032\u00B4`]/g,
              "'"
            )
            .replace(
              /\u00A0/g,
              " "
            )
            .replace(
              /[^\x20-\x7E\u00C0-\u00FF]/g,
              " "
            )
            .replace(
              /\s+/g,
              " "
            )
            .trim();

        /*
         * Si algún dato vino guardado como "C a l l e",
         * recomponemos palabras de 3 o más letras.
         */
        return raw.replace(
          /\b(?:[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]\s+){2,}[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]\b/g,
          (match) =>
            match.replace(
              /\s+/g,
              ""
            )
        );
      };

      const cleanEndpoint = (
        value?: string | null
      ) =>
        pdfSafeText(value)
          .replace(
            /^Punto\s+A\s*[-:|/.]*\s*/i,
            ""
          )
          .replace(
            /^Punto\s+B\s*[-:|/.]*\s*/i,
            ""
          )
          .replace(
            /^Limite de zona$/i,
            "Límite de zona"
          );

      const cleanStreet = (
        value?: string | null
      ) =>
        pdfSafeText(value)
          .replace(
            /\s*[|]\s*/g,
            " / "
          )
          .replace(
            /\s+\/\s+/g,
            " / "
          );

      const routePoints = (
        record: MapRoute
      ) =>
        Array.isArray(
          record.geometry
            ?.coordinates
        )
          ? record.geometry.coordinates
              .filter(
                (point) =>
                  Array.isArray(
                    point
                  ) &&
                  point.length >= 2 &&
                  Number.isFinite(
                    Number(point[0])
                  ) &&
                  Number.isFinite(
                    Number(point[1])
                  )
              )
              .map(
                ([lng, lat]) => ({
                  lat: Number(lat),
                  lng: Number(lng),
                })
              )
          : [];

      const areaPoints = (
        batch: SweepingAreaBatch
      ) =>
        Array.isArray(
          batch.geometry
            ?.coordinates?.[0]
        )
          ? batch.geometry.coordinates[0]
              .filter(
                (point) =>
                  Array.isArray(
                    point
                  ) &&
                  point.length >= 2 &&
                  Number.isFinite(
                    Number(point[0])
                  ) &&
                  Number.isFinite(
                    Number(point[1])
                  )
              )
              .map(
                ([lng, lat]) => ({
                  lat: Number(lat),
                  lng: Number(lng),
                })
              )
          : [];

      const projectOsmPoint = (
        lat: number,
        lng: number,
        zoom: number
      ) => {
        const tileSize = 256;
        const scale =
          tileSize *
          Math.pow(
            2,
            zoom
          );

        const boundedLat =
          Math.max(
            -85.05112878,
            Math.min(
              85.05112878,
              lat
            )
          );

        const sin =
          Math.sin(
            (
              boundedLat *
              Math.PI
            ) /
              180
          );

        return {
          x:
            (
              (lng + 180) /
              360
            ) *
            scale,
          y:
            (
              0.5 -
              Math.log(
                (1 + sin) /
                  (1 - sin)
              ) /
                (
                  4 *
                  Math.PI
                )
            ) *
            scale,
        };
      };

      const loadCorsImage = (
        src: string
      ): Promise<HTMLImageElement> =>
        new Promise(
          (
            resolve,
            reject
          ) => {
            const image =
              new Image();

            image.crossOrigin =
              "anonymous";

            image.onload =
              () =>
                resolve(
                  image
                );

            image.onerror =
              () =>
                reject(
                  new Error(
                    `No se pudo cargar ${src}`
                  )
                );

            image.src = src;
          }
        );

      const renderPlanningMap =
        async (
          mapRoutes: MapRoute[],
          mapAreas: SweepingAreaBatch[],
          kind:
            | "MANUAL"
            | "MECANICO",
          customView?:
            | WorkOrderMapView
            | null
        ) => {
          /*
           * PDF: raster ancho y de alta definición.
           *
           * MUY IMPORTANTE:
           * el encuadre se calcula SOLO con las calles/tramos que
           * realmente se deben barrer. El polígono de zona se dibuja
           * después como referencia, pero NO participa del zoom.
           *
           * Esto evita que un vértice alejado del polígono achique
           * innecesariamente todas las calles en el PDF.
           */
          /*
           * La relación 3000 / 1800 = 1.667 coincide casi exactamente
           * con el rectángulo útil del mapa en la hoja A4 horizontal.
           * Así evitamos comprimir/estirar la captura al insertarla.
           */
          const width = 3000;
          const height = 1800;

          /*
           * Margen geográfico mínimo: queremos que el trabajo ocupe
           * la mayor parte posible de la hoja sin cortar ningún tramo.
           */
          const paddingX = 72;
          const paddingY = 42;

          const routeFitPoints =
            mapRoutes.flatMap(
              routePoints
            );

          const areaFitPoints =
            kind === "MANUAL"
              ? mapAreas.flatMap(
                  areaPoints
                )
              : [];

          const allPoints =
            routeFitPoints.length >= 2
              ? routeFitPoints
              : areaFitPoints;

          if (
            allPoints.length <
            2
          ) {
            return null;
          }

          let zoom = 11;
          let originX = 0;
          let originY = 0;

          /*
           * Escala de render:
           *
           * Leaflet define la vista usando el zoom + el tamaño del
           * viewport en píxeles CSS. El PDF usa un canvas mucho más
           * grande (3000x1800) sólo para ganar nitidez.
           *
           * Si usáramos el mismo zoom directamente sobre 3000 px,
           * el PDF mostraría mucho más territorio que el preview.
           *
           * Por eso, cuando existe una vista elegida por el usuario:
           * 1) calculamos el origen usando el tamaño REAL del preview;
           * 2) luego ampliamos ese mismo encuadre al canvas del PDF.
           *
           * Resultado: mismo centro + mismo zoom + mismo campo visual.
           */
          let renderScale = 1;

          if (customView) {
            zoom = Math.max(
              10,
              Math.min(
                19,
                Math.round(
                  customView.zoom
                )
              )
            );

            const viewportWidth =
              Math.max(
                1,
                Number(
                  customView.width
                ) || width
              );

            const viewportHeight =
              Math.max(
                1,
                Number(
                  customView.height
                ) || height
              );

            const scaleX =
              width /
              viewportWidth;

            const scaleY =
              height /
              viewportHeight;

            /*
             * El preview y el raster usan relación 5:3, por lo que
             * ambas escalas deberían ser prácticamente iguales.
             * Elegimos la menor para no recortar por diferencias de
             * 1-2 píxeles causadas por bordes/redondeos del navegador.
             */
            renderScale =
              Math.min(
                scaleX,
                scaleY
              );

            const sourceWidth =
              width /
              renderScale;

            const sourceHeight =
              height /
              renderScale;

            const projectedCenter =
              projectOsmPoint(
                customView.center[0],
                customView.center[1],
                zoom
              );

            originX =
              projectedCenter.x -
              sourceWidth / 2;

            originY =
              projectedCenter.y -
              sourceHeight / 2;
          } else {
            /*
             * Fallback automático si el usuario todavía no acomodó
             * manualmente esta vista.
             */
            for (
              let candidate = 19;
              candidate >= 10;
              candidate -= 1
            ) {
              const projected =
                allPoints.map(
                  (point) =>
                    projectOsmPoint(
                      point.lat,
                      point.lng,
                      candidate
                    )
                );

              const xs =
                projected.map(
                  (point) =>
                    point.x
                );

              const ys =
                projected.map(
                  (point) =>
                    point.y
                );

              const occupiedWidth =
                Math.max(...xs) -
                Math.min(...xs);

              const occupiedHeight =
                Math.max(...ys) -
                Math.min(...ys);

              if (
                occupiedWidth <=
                  width -
                    paddingX * 2 &&
                occupiedHeight <=
                  height -
                    paddingY * 2
              ) {
                zoom = candidate;
                break;
              }
            }

            const projectedAll =
              allPoints.map(
                (point) =>
                  projectOsmPoint(
                    point.lat,
                    point.lng,
                    zoom
                  )
              );

            const xs =
              projectedAll.map(
                (point) =>
                  point.x
              );

            const ys =
              projectedAll.map(
                (point) =>
                  point.y
              );

            const centerX =
              (
                Math.min(...xs) +
                Math.max(...xs)
              ) /
              2;

            const centerY =
              (
                Math.min(...ys) +
                Math.max(...ys)
              ) /
              2;

            originX =
              centerX -
              width / 2;

            originY =
              centerY -
              height / 2;
          }

          const canvas =
            document.createElement(
              "canvas"
            );

          canvas.width = width;
          canvas.height = height;

          const context =
            canvas.getContext(
              "2d"
            );

          if (!context) {
            return null;
          }

          context.fillStyle =
            "#f8fafc";

          context.fillRect(
            0,
            0,
            width,
            height
          );

          const tileSize = 256;
          const tileCount =
            Math.pow(
              2,
              zoom
            );

          const sourceWidth =
            width /
            renderScale;

          const sourceHeight =
            height /
            renderScale;

          const startTileX =
            Math.floor(
              originX /
                tileSize
            );

          const endTileX =
            Math.floor(
              (
                originX +
                sourceWidth
              ) /
                tileSize
            );

          const startTileY =
            Math.floor(
              originY /
                tileSize
            );

          const endTileY =
            Math.floor(
              (
                originY +
                sourceHeight
              ) /
                tileSize
            );

          const tileJobs: Array<
            Promise<void>
          > = [];

          for (
            let tileX =
              startTileX;
            tileX <=
            endTileX;
            tileX += 1
          ) {
            for (
              let tileY =
                startTileY;
              tileY <=
              endTileY;
              tileY += 1
            ) {
              if (
                tileY < 0 ||
                tileY >=
                  tileCount
              ) {
                continue;
              }

              const wrappedX =
                (
                  (
                    tileX %
                    tileCount
                  ) +
                  tileCount
                ) %
                tileCount;

              const tileUrl =
                `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`;

              tileJobs.push(
                loadCorsImage(
                  tileUrl
                )
                  .then(
                    (image) => {
                      context.drawImage(
                        image,
                        (
                          tileX *
                            tileSize -
                          originX
                        ) *
                          renderScale,
                        (
                          tileY *
                            tileSize -
                          originY
                        ) *
                          renderScale,
                        tileSize *
                          renderScale,
                        tileSize *
                          renderScale
                      );
                    }
                  )
                  .catch(
                    () => {
                      // Si falla un tile puntual dejamos el fondo claro.
                    }
                  )
              );
            }
          }

          await Promise.all(
            tileJobs
          );

          /*
           * Zonas manuales: primero el polígono,
           * después las calles, para que la red quede bien visible.
           */
          if (
            kind === "MANUAL"
          ) {
            for (
              const batch of
              mapAreas
            ) {
              const points =
                areaPoints(
                  batch
                );

              if (
                points.length <
                3
              ) {
                continue;
              }

              const projected =
                points.map(
                  (point) => {
                    const value =
                      projectOsmPoint(
                        point.lat,
                        point.lng,
                        zoom
                      );

                    return {
                      x:
                        (
                          value.x -
                          originX
                        ) *
                        renderScale,
                      y:
                        (
                          value.y -
                          originY
                        ) *
                        renderScale,
                    };
                  }
                );

              const fillColor =
                normalizeAreaColor(
                  batch.color
                );

              context.save();
              context.beginPath();

              projected.forEach(
                (
                  point,
                  index
                ) => {
                  if (
                    index === 0
                  ) {
                    context.moveTo(
                      point.x,
                      point.y
                    );
                  } else {
                    context.lineTo(
                      point.x,
                      point.y
                    );
                  }
                }
              );

              context.closePath();

              /*
               * El polígono queda sólo como referencia visual.
               * No debe competir con los nombres de calles ni con
               * los trazados que realmente hay que barrer.
               */
              context.globalAlpha =
                0.04;
              context.fillStyle =
                fillColor;
              context.fill();

              context.globalAlpha =
                0.5;
              context.strokeStyle =
                fillColor;
              context.lineWidth =
                2 * renderScale;
              context.setLineDash([
                14 * renderScale,
                10 * renderScale,
              ]);
              context.stroke();
              context.restore();

              const projectedXs =
                projected.map(
                  (point) => point.x
                );

              const projectedYs =
                projected.map(
                  (point) => point.y
                );

              const minProjectedX =
                Math.min(
                  ...projectedXs
                );
              const maxProjectedX =
                Math.max(
                  ...projectedXs
                );
              const minProjectedY =
                Math.min(
                  ...projectedYs
                );
              const maxProjectedY =
                Math.max(
                  ...projectedYs
                );

              /*
               * No dibujamos etiquetas dentro del mapa.
               * Los nombres de las zonas se muestran en una leyenda
               * fuera del área cartográfica para no tapar calles.
               */
            }
          }

          context.save();
          context.lineJoin =
            "round";
          context.lineCap =
            "round";

          for (
            const route of
            mapRoutes
          ) {
            const points =
              routePoints(
                route
              );

            if (
              points.length <
              2
            ) {
              continue;
            }

            const projected =
              points.map(
                (point) => {
                  const value =
                    projectOsmPoint(
                      point.lat,
                      point.lng,
                      zoom
                    );

                  return {
                    x:
                      (
                        value.x -
                        originX
                      ) *
                      renderScale,
                    y:
                      (
                        value.y -
                        originY
                      ) *
                      renderScale,
                  };
                }
              );

            /*
             * Halo blanco muy fino para despegar el recorrido
             * del mapa base.
             */
            context.beginPath();

            projected.forEach(
              (
                point,
                index
              ) => {
                if (
                  index === 0
                ) {
                  context.moveTo(
                    point.x,
                    point.y
                  );
                } else {
                  context.lineTo(
                    point.x,
                    point.y
                  );
                }
              }
            );

            context.strokeStyle =
              "#ffffff";
            context.lineWidth = 7 * renderScale;
            context.globalAlpha =
              0.82;
            context.setLineDash([]);
            context.stroke();

            context.beginPath();

            projected.forEach(
              (
                point,
                index
              ) => {
                if (
                  index === 0
                ) {
                  context.moveTo(
                    point.x,
                    point.y
                  );
                } else {
                  context.lineTo(
                    point.x,
                    point.y
                  );
                }
              }
            );

            context.strokeStyle = "#2563eb";

            context.lineWidth = 4 * renderScale;

            context.globalAlpha =
              0.96;

            context.setLineDash([]);

            context.stroke();
          }

          context.restore();

          context.fillStyle =
            "rgba(255,255,255,0.9)";

          context.fillRect(
            14 * renderScale,
            height -
              38 * renderScale,
            305 * renderScale,
            26 * renderScale
          );

          context.fillStyle =
            "#475569";
          context.font =
            `${16 * renderScale}px Arial`;

          context.fillText(
            "© OpenStreetMap contributors",
            22 * renderScale,
            height -
              20 * renderScale
          );

          return canvas.toDataURL(
            "image/jpeg",
            0.84
          );
        };

      const loadLogo =
        async () => {
          try {
            const image =
              await loadCorsImage(
                "/logo-general-pico-horizontal.png"
              );

            const originalWidth =
              image.naturalWidth ||
              image.width;

            const originalHeight =
              image.naturalHeight ||
              image.height;

            const targetWidth =
              Math.min(
                520,
                originalWidth
              );

            const scale =
              originalWidth > 0
                ? targetWidth /
                  originalWidth
                : 1;

            const targetHeight =
              Math.max(
                1,
                Math.round(
                  originalHeight *
                    scale
                )
              );

            const canvas =
              document.createElement(
                "canvas"
              );

            canvas.width =
              Math.max(
                1,
                Math.round(
                  targetWidth
                )
              );

            canvas.height =
              targetHeight;

            const context =
              canvas.getContext(
                "2d"
              );

            if (!context) {
              return null;
            }

            context.fillStyle =
              "#ffffff";

            context.fillRect(
              0,
              0,
              canvas.width,
              canvas.height
            );

            context.drawImage(
              image,
              0,
              0,
              canvas.width,
              canvas.height
            );

            return canvas.toDataURL(
              "image/jpeg",
              0.72
            );
          } catch {
            return null;
          }
        };

      const manualRoutes =
        routes.filter(
          (record) => {
            if (
              record.sweeping_type !==
              "MANUAL"
            ) {
              return false;
            }

            const batchId =
              record.batch_id?.trim();

            if (!batchId) {
              return true;
            }

            return selectedWorkOrderBatchIds.has(
              batchId
            );
          }
        );

      const mechanicalRoutes =
        routes.filter(
          (record) =>
            record.sweeping_type ===
            "MECANICO"
        );

      // Nombres de calles transversales para el PDF MECÁNICO solamente.
      // Se consultan las geometrías cercanas a los extremos A/B del recorrido;
      // no se modifican los registros, el dibujo ni las órdenes manuales.
      const mechanicalEndpointNames = new Map<string, {from: string; to: string}>();

      const normalizedRoadName = (value: string) =>
        value.toLocaleLowerCase("es")
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ").trim();

      type NearbyRoad = {
        street_name?: string;
        geometry?: AreaStreetGeometry;
      };
      type RoadPoint = [number, number]; // [longitud, latitud]

      const roadParts = (geometry?: AreaStreetGeometry): number[][][] => {
        if (!geometry) return [];
        return geometry.type === "LineString"
          ? [geometry.coordinates]
          : geometry.coordinates;
      };

      const distanceAndDirection = (
        point: RoadPoint,
        start: RoadPoint,
        end: RoadPoint
      ) => {
        // Aproximación métrica local, suficiente para comparar cruces cercanos.
        const scale = Math.cos(point[1] * Math.PI / 180);
        const ax = (start[0] - point[0]) * 111320 * scale;
        const ay = (start[1] - point[1]) * 111320;
        const bx = (end[0] - point[0]) * 111320 * scale;
        const by = (end[1] - point[1]) * 111320;
        const vx = bx - ax;
        const vy = by - ay;
        const lengthSquared = vx * vx + vy * vy;
        if (lengthSquared < 0.1) return null;
        const fraction = Math.max(0, Math.min(1,
          -(ax * vx + ay * vy) / lengthSquared));
        return {
          distance: Math.hypot(ax + fraction * vx, ay + fraction * vy),
          vx, vy,
        };
      };

      const findTransverseStreet = async (
        point: RoadPoint,
        tangentStart: RoadPoint,
        tangentEnd: RoadPoint,
        mainStreet: string
      ): Promise<string | null> => {
        // Cuadrado pequeño alrededor de A/B; la API existente aplica
        // además su margen espacial de búsqueda.
        const radiusMeters = 22;
        const latitudeOffset = radiusMeters / 111320;
        const longitudeOffset = radiusMeters /
          (111320 * Math.max(0.1, Math.cos(point[1] * Math.PI / 180)));
        const [lon, lat] = point;
        const area = {
          type: "Polygon" as const,
          coordinates: [[
            [lon - longitudeOffset, lat - latitudeOffset],
            [lon + longitudeOffset, lat - latitudeOffset],
            [lon + longitudeOffset, lat + latitudeOffset],
            [lon - longitudeOffset, lat + latitudeOffset],
            [lon - longitudeOffset, lat - latitudeOffset],
          ]],
        };
        try {
          const response = await fetch("/api/test-grading/area-streets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({geometry: area, min_length_meters: 0}),
          });
          if (!response.ok) return null;
          const data = await response.json();
          const candidates = (data?.streets ?? []) as NearbyRoad[];
          let best: {name: string; distance: number} | null = null;
          const direction = distanceAndDirection(point, tangentStart, tangentEnd);
          if (!direction) return null;

          for (const candidate of candidates) {
            const name = String(candidate.street_name ?? "").trim();
            if (!name || normalizedRoadName(name) === normalizedRoadName(mainStreet)) continue;
            for (const part of roadParts(candidate.geometry)) {
              for (let i = 1; i < part.length; i++) {
                const a = part[i - 1] as RoadPoint;
                const b = part[i] as RoadPoint;
                const hit = distanceAndDirection(point, a, b);
                if (!hit || hit.distance > 18) continue;
                const cosine = Math.abs(
                  (hit.vx * direction.vx + hit.vy * direction.vy) /
                  (Math.hypot(hit.vx, hit.vy) * Math.hypot(direction.vx, direction.vy))
                );
                // Solo calles transversales: por lo menos 35° de diferencia.
                if (cosine > 0.82) continue;
                if (!best || hit.distance < best.distance) best = {name, distance: hit.distance};
              }
            }
          }
          return best?.name ?? null;
        } catch {
          // Un fallo de búsqueda no debe impedir emitir la orden.
          return null;
        }
      };

      // Consultas solo para corredores mecánicos incluidos en la orden.
      await Promise.all(mechanicalRoutes.map(async (record) => {
        const coordinates = record.geometry?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) return;
        const first = coordinates[0] as RoadPoint;
        const second = coordinates[1] as RoadPoint;
        const last = coordinates[coordinates.length - 1] as RoadPoint;
        const beforeLast = coordinates[coordinates.length - 2] as RoadPoint;
        const [from, to] = await Promise.all([
          findTransverseStreet(first, first, second, record.main_street),
          findTransverseStreet(last, beforeLast, last, record.main_street),
        ]);
        mechanicalEndpointNames.set(record.id, {
          from: from ?? "inicio sin identificar",
          to: to ?? "final sin identificar",
        });
      }));

      const unknownRoutes =
        routes.filter(
          (record) =>
            !record.sweeping_type
        );

      const manualBatchIds =
        new Set(
          manualRoutes
            .map(
              (record) =>
                record.batch_id
            )
            .filter(
              (
                value
              ): value is string =>
                Boolean(value)
            )
        );

      const manualAreas =
        workOrderAreaBatches.filter(
          (batch) =>
            selectedWorkOrderBatchIds.has(
              batch.batch_id
            ) &&
            manualBatchIds.has(
              batch.batch_id
            )
        );

      const [
        logoDataUrl,
        manualMapImage,
        mechanicalMapImage,
      ] = await Promise.all([
        loadLogo(),
        manualRoutes.length > 0
          ? renderPlanningMap(
              manualRoutes,
              manualAreas,
              "MANUAL",
              workOrderManualView
            )
          : Promise.resolve(
              null
            ),
        mechanicalRoutes.length >
        0
          ? renderPlanningMap(
              mechanicalRoutes,
              [],
              "MECANICO",
              workOrderMechanicalView
            )
          : Promise.resolve(
              null
            ),
      ]);

      const pdf =
        new jsPDF({
          orientation:
            "landscape",
          unit: "mm",
          format: "a4",
          compress: true,
        });

      const pageWidth =
        pdf.internal.pageSize.getWidth();

      const pageHeight =
        pdf.internal.pageSize.getHeight();

      const marginX = 14;
      const contentWidth =
        pageWidth -
        marginX * 2;

      const addHeader = (
        title: string,
        subtitle: string
      ) => {
        if (logoDataUrl) {
          pdf.addImage(
            logoDataUrl,
            "JPEG",
            marginX,
            7,
            31,
            11,
            undefined,
            "FAST"
          );
        }

        pdf.setFont(
          "helvetica",
          "bold"
        );
        pdf.setFontSize(13.5);
        pdf.setTextColor(
          30,
          41,
          59
        );

        pdf.text(
          pdfSafeText(title),
          logoDataUrl
            ? 50
            : marginX,
          12.5
        );

        pdf.setFont(
          "helvetica",
          "normal"
        );
        pdf.setFontSize(8.5);
        pdf.setTextColor(
          71,
          85,
          105
        );

        pdf.text(
          pdfSafeText(subtitle),
          logoDataUrl
            ? 50
            : marginX,
          18
        );

        pdf.setDrawColor(
          226,
          232,
          240
        );

        pdf.line(
          marginX,
          24,
          pageWidth -
            marginX,
          24
        );
      };

      const drawSummaryCards = (
        kind:
          | "MANUAL"
          | "MECANICO",
        count: number,
        zoneCount = 0
      ) => {
        const y = 30;
        const gap = 4;
        const cardWidth =
          (
            contentWidth -
            gap * 2
          ) /
          3;

        const cards =
          kind === "MANUAL"
            ? [
                {
                  label:
                    "FECHA DE TRABAJO",
                  value:
                    formatDateAr(
                      workOrderDate
                    ),
                },
                {
                  label:
                    "TRAMOS DE MOTONIVELACIÓN",
                  value:
                    String(count),
                },
                {
                  label:
                    "ZONAS PLANIFICADAS",
                  value:
                    String(
                      zoneCount
                    ),
                },
              ]
            : [
                {
                  label:
                    "FECHA DE TRABAJO",
                  value:
                    formatDateAr(
                      workOrderDate
                    ),
                },
                {
                  label:
                    "TRAMOS DE MOTONIVELACIÓN",
                  value:
                    String(count),
                },
                {
                  label:
                    "EQUIPO",
                  value:
                    "Motoniveladora",
                },
              ];

        cards.forEach(
          (
            card,
            index
          ) => {
            const x =
              marginX +
              index *
                (
                  cardWidth +
                  gap
                );

            pdf.setFillColor(
              248,
              250,
              252
            );

            pdf.setDrawColor(
              226,
              232,
              240
            );

            pdf.roundedRect(
              x,
              y,
              cardWidth,
              15,
              2,
              2,
              "FD"
            );

            pdf.setFont(
              "helvetica",
              "normal"
            );

            pdf.setFontSize(
              6.8
            );

            pdf.setTextColor(
              100,
              116,
              139
            );

            pdf.text(
              card.label,
              x + 3,
              y + 5
            );

            pdf.setFont(
              "helvetica",
              "bold"
            );

            pdf.setFontSize(
              9.5
            );

            pdf.setTextColor(
              15,
              23,
              42
            );

            pdf.text(
              pdfSafeText(
                card.value
              ),
              x + 3,
              y + 11.5
            );
          }
        );
      };

      const drawMapPage = (
        kind:
          | "MANUAL"
          | "MECANICO",
        image: string,
        count: number,
        zoneCount = 0,
        areas: SweepingAreaBatch[] = []
      ) => {
        const isManual =
          kind === "MANUAL";

        /*
         * MAPA PROTAGONISTA:
         * usamos casi toda la hoja A4 horizontal.
         * Dejamos únicamente una cabecera institucional muy compacta.
         */
        const outerMargin = 2.8;
        const headerY = 3.8;
        const headerBottom = 17.5;
        const hasZoneLegend =
          isManual &&
          areas.length > 0;
        const legendY = 20;
        const mapY =
          hasZoneLegend
            ? 25
            : 19;
        const footerHeight = 2.8;
        const mapWidth =
          pageWidth -
          outerMargin * 2;
        const mapHeight =
          pageHeight -
          mapY -
          footerHeight -
          2;

        if (logoDataUrl) {
          pdf.addImage(
            logoDataUrl,
            "JPEG",
            outerMargin,
            headerY,
            20,
            7,
            undefined,
            "FAST"
          );
        }

        pdf.setFont(
          "helvetica",
          "bold"
        );
        pdf.setFontSize(15);
        pdf.setTextColor(
          15,
          23,
          42
        );

        pdf.text(
          pdfSafeText(
            "ORDEN DE TRABAJO - MOTONIVELACIÓN"
          ),
          logoDataUrl
            ? 25
            : outerMargin,
          8.3
        );

        pdf.setFont(
          "helvetica",
          "normal"
        );
        pdf.setFontSize(8);
        pdf.setTextColor(
          71,
          85,
          105
        );

        pdf.text(
          pdfSafeText(
            `Fecha: ${formatDateAr(
              workOrderDate
            )}`
          ),
          logoDataUrl
            ? 25
            : outerMargin,
          11.4
        );

        pdf.text(
          pdfSafeText(
            `${count} ${count === 1 ? "tramo de motonivelación" : "tramos de motonivelación"}${
              isManual && zoneCount > 0
                ? ` - ${zoneCount} ${zoneCount === 1 ? "zona planificada" : "zonas planificadas"}`
                : ""
            }`
          ),
          logoDataUrl
            ? 25
            : outerMargin,
          14.7
        );

        /*
         * Referencia mínima en la derecha, sin robar altura al mapa.
         */
        pdf.setFont(
          "helvetica",
          "bold"
        );
        pdf.setFontSize(9);

        pdf.setTextColor(37, 99, 235);
        pdf.text(
          "AZUL = CALLES A MOTONIVELAR",
          pageWidth - outerMargin,
          8.3,
          { align: "right" }
        );

        pdf.setFont(
          "helvetica",
          "normal"
        );
        pdf.setFontSize(7.2);
        pdf.setTextColor(
          100,
          116,
          139
        );

        pdf.text(
          pdfSafeText(
            "Sistema Integral SAySSPP - Secretaria de Ambiente y Servicios Publicos"
          ),
          pageWidth -
            outerMargin,
          11.4,
          {
            align: "right",
          }
        );

        pdf.setDrawColor(
          203,
          213,
          225
        );

        pdf.line(
          outerMargin,
          headerBottom,
          pageWidth -
            outerMargin,
          headerBottom
        );

        if (hasZoneLegend) {
          let cursorX =
            outerMargin;

          pdf.setFont(
            "helvetica",
            "bold"
          );
          pdf.setFontSize(7.5);

          for (
            const area of areas
          ) {
            const color =
              normalizeAreaColor(
                area.color
              );

            const label =
              pdfSafeText(
                area.observations?.trim() ||
                  "Zona planificada"
              );

            const rgb =
              hexToRgb(color) ?? {
                r: 37,
                g: 99,
                b: 235,
              };

            const textWidth =
              pdf.getTextWidth(
                label
              );

            const itemWidth =
              5.5 +
              textWidth +
              4;

            if (
              cursorX +
                itemWidth >
              pageWidth -
                outerMargin
            ) {
              break;
            }

            pdf.setFillColor(
              rgb.r,
              rgb.g,
              rgb.b
            );

            pdf.circle(
              cursorX + 1.8,
              legendY - 0.7,
              1.4,
              "F"
            );

            pdf.setTextColor(
              51,
              65,
              85
            );

            pdf.text(
              label,
              cursorX + 4.2,
              legendY
            );

            cursorX +=
              itemWidth;
          }
        }

        /*
         * El mapa ocupa prácticamente TODO el ancho y alto útil.
         */
        pdf.setDrawColor(
          148,
          163,
          184
        );
        pdf.setLineWidth(0.35);

        pdf.roundedRect(
          outerMargin,
          mapY,
          mapWidth,
          mapHeight,
          1.5,
          1.5,
          "S"
        );

        pdf.addImage(
          image,
          "JPEG",
          outerMargin + 0.7,
          mapY + 0.7,
          mapWidth - 1.4,
          mapHeight - 1.4,
          undefined,
          "FAST"
        );

        pdf.setFont(
          "helvetica",
          "normal"
        );
        pdf.setFontSize(6.5);
        pdf.setTextColor(
          100,
          116,
          139
        );

        pdf.text(
          "OpenStreetMap - Mapa de trabajo",
          outerMargin,
          pageHeight - 2.5
        );
      };

      const areaByBatch =
        new Map<
          string,
          SweepingAreaBatch
        >(
          manualAreas.map(
            (batch) => [
              batch.batch_id,
              batch,
            ]
          )
        );

      const manualGroups =
        new Map<
          string,
          MapRoute[]
        >();

      for (
        const route of
        manualRoutes
      ) {
        const key =
          route.batch_id ||
          `route-${route.id}`;

        const current =
          manualGroups.get(key) ||
          [];

        current.push(route);

        manualGroups.set(
          key,
          current
        );
      }

      const addManualDetailPages =
        () => {
          if (
            manualRoutes.length ===
            0
          ) {
            return;
          }

          pdf.addPage(
            "a4",
            "landscape"
          );

          addHeader(
            "Detalle de trabajo - Motonivelación",
            `Planificación del ${formatDateAr(
              workOrderDate
            )}`
          );

          let x = marginX;
          let y = 31;
          const columnGap = 8;
          const columnWidth =
            (
              contentWidth -
              columnGap
            ) /
            2;

          const moveColumnOrPage =
            () => {
              if (
                x === marginX
              ) {
                x =
                  marginX +
                  columnWidth +
                  columnGap;
                y = 31;
                return;
              }

              pdf.addPage(
                "a4",
                "landscape"
              );

              addHeader(
                "Detalle de trabajo - Motonivelación",
                `Planificación del ${formatDateAr(
                  workOrderDate
                )}`
              );

              x = marginX;
              y = 31;
            };

          const ensureManualSpace =
            (
              needed: number
            ) => {
              if (
                y + needed >
                pageHeight - 46
              ) {
                moveColumnOrPage();
              }
            };

          let groupIndex = 1;

          for (
            const [
              groupKey,
              groupRoutes,
            ] of manualGroups
          ) {
            const area =
              areaByBatch.get(
                groupKey
              );

            const title =
              pdfSafeText(
                area?.observations ||
                  groupRoutes[0]
                    ?.observations ||
                  (
                    groupRoutes[0]
                      ?.batch_id
                      ? `Zona ${groupIndex}`
                      : `Tramo ${groupIndex}`
                  )
              );

            const streetNames =
              Array.from(
                new Set(
                  groupRoutes
                    .map(
                      (route) =>
                        cleanStreet(
                          route.main_street
                        )
                    )
                    .filter(
                      Boolean
                    )
                )
              ).sort(
                (
                  a,
                  b
                ) =>
                  a.localeCompare(
                    b,
                    "es",
                    {
                      numeric: true,
                    }
                  )
              );

            const drawGroupHeader =
              (
                continued =
                  false
              ) => {
                ensureManualSpace(
                  15
                );

                pdf.setFillColor(
                  239,
                  246,
                  255
                );

                pdf.setDrawColor(
                  191,
                  219,
                  254
                );

                pdf.roundedRect(
                  x,
                  y,
                  columnWidth,
                  13,
                  2,
                  2,
                  "FD"
                );

                pdf.setFont(
                  "helvetica",
                  "bold"
                );

                pdf.setFontSize(
                  9
                );

                pdf.setTextColor(
                  37,
                  99,
                  235
                );

                const headerText =
                  `${groupIndex}. ${title}${
                    continued
                      ? " (continuación)"
                      : ""
                  }`;

                const headerLines =
                  pdf.splitTextToSize(
                    headerText,
                    columnWidth - 8
                  ) as string[];

                pdf.text(
                  headerLines.slice(
                    0,
                    2
                  ),
                  x + 4,
                  y + 5
                );

                pdf.setFont(
                  "helvetica",
                  "normal"
                );

                pdf.setFontSize(
                  7.2
                );

                pdf.setTextColor(
                  71,
                  85,
                  105
                );

                pdf.text(
                  `${groupRoutes.length} tramos - ${streetNames.length} calles`,
                  x + 4,
                  y + 10.5
                );

                y += 17;
              };

            drawGroupHeader();

            pdf.setFont(
              "helvetica",
              "normal"
            );

            pdf.setFontSize(
              8
            );

            pdf.setTextColor(
              15,
              23,
              42
            );

            for (
              const street of
              streetNames
            ) {
              const lines =
                pdf.splitTextToSize(
                  `- ${street}`,
                  columnWidth - 8
                ) as string[];

              const needed =
                Math.max(
                  4,
                  lines.length *
                    4
                );

              if (
                y + needed >
                pageHeight - 16
              ) {
                moveColumnOrPage();
                drawGroupHeader(
                  true
                );

                pdf.setFont(
                  "helvetica",
                  "normal"
                );

                pdf.setFontSize(
                  8
                );

                pdf.setTextColor(
                  15,
                  23,
                  42
                );
              }

              lines.forEach(
                (line) => {
                  pdf.text(
                    line,
                    x + 4,
                    y
                  );

                  y += 4;
                }
              );
            }

            y += 5;
            groupIndex += 1;
          }
        };

      const addMechanicalDetailPages =
        () => {
          if (mechanicalRoutes.length === 0) {
            return;
          }

          pdf.addPage("a4", "landscape");
          addHeader(
            "Detalle de trabajo - Motonivelación",
            `Planificación del ${formatDateAr(workOrderDate)} - Motoniveladora`
          );

          let x = marginX;
          let y = 31;
          const gap = 8;
          const columnWidth = (contentWidth - gap) / 2;

          const nextColumnOrPage = () => {
            if (x === marginX) {
              x = marginX + columnWidth + gap;
              y = 31;
              return;
            }

            pdf.addPage("a4", "landscape");
            addHeader(
              "Detalle de trabajo - Motonivelación",
              `Planificación del ${formatDateAr(workOrderDate)} - Motoniveladora`
            );
            x = marginX;
            y = 31;
          };

          mechanicalRoutes.forEach((route, index) => {
            const mainStreet = cleanStreet(route.main_street);
            const detectedEnds = mechanicalEndpointNames.get(route.id);
            const from = detectedEnds?.from ? cleanEndpoint(detectedEnds.from) : "";
            const to = detectedEnds?.to ? cleanEndpoint(detectedEnds.to) : "";
            const observation = pdfSafeText(route.observations);

            // Solo en el detalle mecánico del PDF: si ambos cruces son
            // confiables se muestran; de lo contrario solo la calle principal.
            // No se cambian los recorridos, geometrías ni datos guardados.
            const hasVerifiedEnds =
              Boolean(from && to) &&
              !/sin identificar|sin especificar/i.test(from) &&
              !/sin identificar|sin especificar/i.test(to) &&
              normalizedRoadName(from) !== normalizedRoadName(mainStreet) &&
              normalizedRoadName(to) !== normalizedRoadName(mainStreet);
            const description = hasVerifiedEnds
              ? `${index + 1}. ${mainStreet}, desde ${from} hasta ${to}.`
              : `${index + 1}. ${mainStreet}.`;

            const descriptionLines = pdf.splitTextToSize(
              description,
              columnWidth - 9
            ) as string[];

            const observationLines = observation
              ? (pdf.splitTextToSize(
                  `Observación: ${observation}`,
                  columnWidth - 9
                ) as string[])
              : [];

            const boxHeight =
              8 + descriptionLines.length * 4.3 +
              observationLines.length * 3.6;

            if (y + boxHeight > pageHeight - 46) {
              nextColumnOrPage();
            }

            pdf.setFillColor(255, 251, 235);
            pdf.setDrawColor(253, 186, 116);
            pdf.roundedRect(
              x, y, columnWidth, boxHeight, 2, 2, "FD"
            );

            let localY = y + 6;
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(9);
            pdf.setTextColor(194, 65, 12);

            descriptionLines.forEach((line) => {
              pdf.text(line, x + 4, localY);
              localY += 4.3;
            });

            if (observationLines.length > 0) {
              pdf.setFont("helvetica", "normal");
              pdf.setFontSize(7.5);
              pdf.setTextColor(71, 85, 105);
              observationLines.forEach((line) => {
                pdf.text(line, x + 4, localY);
                localY += 3.6;
              });
            }

            y += boxHeight + 4;
          });
        };

      let hasPage = false;

      if (
        manualRoutes.length >
          0 &&
        manualMapImage
      ) {
        drawMapPage(
          "MANUAL",
          manualMapImage,
          manualRoutes.length,
          manualAreas.length,
          manualAreas
        );

        hasPage = true;
      }

      if (
        mechanicalRoutes.length >
          0 &&
        mechanicalMapImage
      ) {
        if (hasPage) {
          pdf.addPage(
            "a4",
            "landscape"
          );
        }

        drawMapPage(
          "MECANICO",
          mechanicalMapImage,
          mechanicalRoutes.length
        );

        hasPage = true;
      }

      if (
        !hasPage
      ) {
        throw new Error(
          "No se pudo preparar ningún mapa para la orden de trabajo."
        );
      }

      addManualDetailPages();
      addMechanicalDetailPages();

      if (
        unknownRoutes.length >
        0
      ) {
        pdf.addPage(
          "a4",
          "landscape"
        );

        addHeader(
          "Otros tramos planificados",
          `Planificación del ${formatDateAr(
            workOrderDate
          )}`
        );

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setFontSize(9);
        pdf.setTextColor(
          15,
          23,
          42
        );

        let y = 34;

        unknownRoutes.forEach(
          (
            route,
            index
          ) => {
            const line =
              `${index + 1}. ${cleanStreet(
                route.main_street
              )} - ${cleanEndpoint(
                route.from_street
              )} a ${cleanEndpoint(
                route.to_street
              )}`;

            const lines =
              pdf.splitTextToSize(
                line,
                contentWidth
              ) as string[];

            if (
              y +
                lines.length *
                  4.5 >
              pageHeight - 46
            ) {
              pdf.addPage(
                "a4",
                "landscape"
              );

              addHeader(
                "Otros tramos planificados",
                `Planificación del ${formatDateAr(
                  workOrderDate
                )}`
              );

              y = 34;
            }

            lines.forEach(
              (item) => {
                pdf.text(
                  item,
                  marginX,
                  y
                );

                y += 4.5;
              }
            );

            y += 2;
          }
        );
      }

      /*
       * ==========================================================
       * FIRMA DEL CAPATAZ
       * ==========================================================
       *
       * Se imprime una sola vez, al pie de la última página,
       * dejando espacio suficiente durante la generación de los
       * detalles para que nunca se superponga con el contenido.
       */
      const lastContentPage =
        pdf.getNumberOfPages();

      pdf.setPage(
        lastContentPage
      );

      const signatureTop =
        pageHeight - 39;

      pdf.setDrawColor(
        203,
        213,
        225
      );

      pdf.setFillColor(
        248,
        250,
        252
      );

      pdf.roundedRect(
        marginX,
        signatureTop,
        contentWidth,
        25,
        2,
        2,
        "FD"
      );

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(8.5);

      pdf.setTextColor(
        51,
        65,
        85
      );

      pdf.text(
        "CAPATAZ RESPONSABLE",
        marginX + 4,
        signatureTop + 6
      );

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(8);

      pdf.setTextColor(
        71,
        85,
        105
      );

      const signatureLineY =
        signatureTop + 15;

      const firstColumnX =
        marginX + 4;

      const secondColumnX =
        marginX +
        contentWidth * 0.52;

      pdf.text(
        "Firma:",
        firstColumnX,
        signatureLineY
      );

      pdf.line(
        firstColumnX + 13,
        signatureLineY + 0.5,
        firstColumnX + 76,
        signatureLineY + 0.5
      );

      pdf.text(
        "Aclaración:",
        secondColumnX,
        signatureLineY
      );

      pdf.line(
        secondColumnX + 20,
        signatureLineY + 0.5,
        pageWidth -
          marginX -
          4,
        signatureLineY + 0.5
      );

      pdf.text(
        "Fecha:",
        firstColumnX,
        signatureTop + 22
      );

      pdf.text(
        "____ / ____ / ______",
        firstColumnX + 13,
        signatureTop + 22
      );

      const totalPages =
        pdf.getNumberOfPages();

      for (
        let page = 1;
        page <= totalPages;
        page += 1
      ) {
        pdf.setPage(page);

        pdf.setDrawColor(
          226,
          232,
          240
        );

        pdf.line(
          marginX,
          pageHeight - 11,
          pageWidth -
            marginX,
          pageHeight - 11
        );

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setFontSize(7);
        pdf.setTextColor(
          100,
          116,
          139
        );

        pdf.text(
          "Sistema Integral SAySSPP - Orden de trabajo de motonivelación",
          marginX,
          pageHeight - 6
        );

        pdf.text(
          `Página ${page} de ${totalPages}`,
          pageWidth -
            marginX,
          pageHeight - 6,
          {
            align:
              "right",
          }
        );
      }

      const fileType =
        workOrderType === "ALL"
          ? "completa"
          : workOrderType.toLowerCase();

      pdf.save(
        `orden-trabajo-motonivelacion-${workOrderDate}-${fileType}.pdf`
      );

      setSuccess(
        "La orden de trabajo fue generada correctamente."
      );
    } catch (err) {
      console.error(
        "Error generando orden de trabajo PDF:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "No se pudo generar el PDF de la orden de trabajo."
      );
    } finally {
      setWorkOrderGenerating(
        false
      );
    }
  }

  /*
   * ==========================================================
   * CENTRO DE MONITOREO / PANTALLA COMPLETA 4 MAPAS
   * ==========================================================
   */

  const [
    monitorMode,
    setMonitorMode,
  ] = useState(false);

  const [
    fullscreenActive,
    setFullscreenActive,
  ] = useState(false);

  const monitorCenterRef =
    useRef<HTMLDivElement | null>(null);

  // Solo el centro de monitoreo: recarga automática cada 10 minutos.
  const MONITOR_REFRESH_MS = 10 * 60 * 1000;
  const [monitorLastUpdated, setMonitorLastUpdated] =
    useState<Date | null>(null);
  const [monitorLastError, setMonitorLastError] =
    useState(false);
  const [monitorRefreshing, setMonitorRefreshing] =
    useState(false);
  const monitorRefreshingRef = useRef(false);
  const monitorRefreshFnRef = useRef<() => Promise<void>>(
    async () => {}
  );

  /*
   * ==========================================================
   * PANTALLA COMPLETA DE MAPAS
   * ==========================================================
   */

  const [

    fullscreenMap,

    setFullscreenMap,

  ] = useState<

    "planned" |

    "completed" |

    "complaints" |

    "alltrack" |

    null

  >(null);

  const plannedMapCardRef =

    useRef<HTMLDivElement | null>(

      null

    );

  const completedMapCardRef =

    useRef<HTMLDivElement | null>(

      null

    );

  const complaintsMapCardRef =

    useRef<HTMLDivElement | null>(

      null

    );

  const alltrackMapCardRef =

    useRef<HTMLDivElement | null>(

      null

    );

  useEffect(() => {

    function syncFullscreenState() {
      const element =
        document.fullscreenElement;

      setFullscreenActive(
        Boolean(element)
      );

      if (
        element ===
        monitorCenterRef.current
      ) {
        setMonitorMode(true);
        setFullscreenMap(null);
        return;
      }

      setMonitorMode(false);

      if (
        element ===
        plannedMapCardRef.current
      ) {
        setFullscreenMap(
          "planned"
        );
        return;
      }

      if (
        element ===
        completedMapCardRef.current
      ) {
        setFullscreenMap(
          "completed"
        );
        return;
      }

      if (
        element ===
        complaintsMapCardRef.current
      ) {
        setFullscreenMap(
          "complaints"
        );
        return;
      }

      if (
        element ===
        alltrackMapCardRef.current
      ) {
        setFullscreenMap(
          "alltrack"
        );
        return;
      }

      setFullscreenMap(null);

      /*
       * Al entrar o salir de Fullscreen el navegador restaura el layout
       * en varios pasos. Este resize diferido hace que Leaflet recalcule
       * también el mapa vecino cuando vuelve la grilla de dos columnas.
       */
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.dispatchEvent(
            new Event("resize")
          );
        });
      });
    }

    syncFullscreenState();

    document.addEventListener(
      "fullscreenchange",
      syncFullscreenState
    );

    window.addEventListener(
      "focus",
      syncFullscreenState
    );

    window.addEventListener(
      "resize",
      syncFullscreenState
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        syncFullscreenState
      );

      window.removeEventListener(
        "focus",
        syncFullscreenState
      );

      window.removeEventListener(
        "resize",
        syncFullscreenState
      );
    };

  }, []);

  async function toggleMapFullscreen(

    mapType:

      | "planned"

      | "completed"

      | "complaints"

      | "alltrack"

  ) {

    const target =

      mapType === "planned"

        ? plannedMapCardRef.current

        : mapType === "completed"

          ? completedMapCardRef.current

          : mapType === "complaints"

            ? complaintsMapCardRef.current

            : alltrackMapCardRef.current;

    if (!target) {

      return;

    }

    try {

      if (

        document.fullscreenElement ===

        target

      ) {

        await document.exitFullscreen();

        return;

      }

      if (

        document.fullscreenElement

      ) {

        await document.exitFullscreen();

      }

      await target.requestFullscreen();

    } catch (err) {

      console.error(

        "No se pudo cambiar el modo de pantalla completa:",

        err

      );

      setError(

        "No se pudo abrir el mapa en pantalla completa."

      );

    }

  }

  async function openMonitorCenter() {
    const target =
      monitorCenterRef.current;

    if (!target) {
      return;
    }

    try {
      /*
       * El elemento del centro siempre existe en el DOM, así el
       * Fullscreen API se ejecuta directamente desde el click del
       * usuario y el navegador permite ocultar pestañas/barra.
       */
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }

      await target.requestFullscreen();

      /*
       * Refrescamos los cuatro tableros ya dentro del modo monitor.
       * No esperamos estas consultas para no demorar la entrada.
       */
      void refreshMonitorCenter();
    } catch (err) {
      console.error(
        "No se pudo abrir el Centro de monitoreo:",
        err
      );

      setMonitorMode(false);
      setError(
        "No se pudo abrir el Centro de monitoreo en pantalla completa."
      );
    }
  }

  async function closeMonitorCenter() {
    try {
      if (
        document.fullscreenElement ===
        monitorCenterRef.current
      ) {
        await document.exitFullscreen();
      } else {
        setMonitorMode(false);
      }
    } catch (err) {
      console.error(
        "No se pudo cerrar el Centro de monitoreo:",
        err
      );
      setMonitorMode(false);
    }
  }

  async function refreshMonitorCenter() {
    // No lanzar consultas duplicadas mientras una actualización está en curso.
    if (monitorRefreshingRef.current) return;
    monitorRefreshingRef.current = true;
    setMonitorRefreshing(true);

    try {
      const results = await Promise.allSettled([
        loadPlannedRecords(plannedAppliedFrom, plannedAppliedTo),
        loadCompletedRecords(completedAppliedFrom, completedAppliedTo),
        loadSweepingComplaints(complaintsAppliedFrom, complaintsAppliedTo),
        refreshAlltrackActiveView(),
      ]);
      const allSucceeded = results.every(
        (result) => result.status === "fulfilled" && result.value === true
      );
      setMonitorLastError(!allSucceeded);
      if (allSucceeded) {
        setMonitorLastUpdated(new Date());
      }
    } catch (err) {
      console.error("Error al actualizar el centro de monitoreo:", err);
      setMonitorLastError(true);
    } finally {
      monitorRefreshingRef.current = false;
      setMonitorRefreshing(false);
    }
  }

  // Guardamos la versión actual para respetar los filtros vigentes sin
  // reiniciar el intervalo en cada render de Leaflet.
  monitorRefreshFnRef.current = refreshMonitorCenter;

  useEffect(() => {
    if (!monitorMode) return;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void monitorRefreshFnRef.current();
      }
    }, MONITOR_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [monitorMode]);

  /*
   * ==========================================================
   * FECHAS / FILTROS INDEPENDIENTES
   * ==========================================================
   */

  const today = getTodayYmd();

  const firstDayOfMonth = useMemo(() => {
    const now = new Date();

    return dateToYmd(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        12
      )
    );
  }, []);

  const lastDayOfMonth = useMemo(() => {
    const now = new Date();

    return dateToYmd(
      new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        12
      )
    );
  }, []);

  const oneMonthAgo = useMemo(() => {
    const now = new Date();

    const previousMonth =
      new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        now.getDate(),
        12
      );

    return dateToYmd(
      previousMonth
    );
  }, []);

  const [
    plannedFilterFrom,
    setPlannedFilterFrom,
  ] = useState(firstDayOfMonth);

  const [
    plannedFilterTo,
    setPlannedFilterTo,
  ] = useState(lastDayOfMonth);

  const [
    plannedAppliedFrom,
    setPlannedAppliedFrom,
  ] = useState(firstDayOfMonth);

  const [
    plannedAppliedTo,
    setPlannedAppliedTo,
  ] = useState(lastDayOfMonth);

  const [
    completedFilterFrom,
    setCompletedFilterFrom,
  ] = useState(firstDayOfMonth);

  const [
    completedFilterTo,
    setCompletedFilterTo,
  ] = useState(today);

  const [
    completedAppliedFrom,
    setCompletedAppliedFrom,
  ] = useState(firstDayOfMonth);

  const [
    completedAppliedTo,
    setCompletedAppliedTo,
  ] = useState(today);

  /*
   * ==========================================================
   * MAPA DE RECLAMOS DE BARRIDO
   * Se carga únicamente cuando el usuario lo abre.
   * ==========================================================
   */

  const [
    complaintsMapOpen,
    setComplaintsMapOpen,
  ] = useState(false);

  const [
    complaintsLoaded,
    setComplaintsLoaded,
  ] = useState(false);

  const [
    loadingComplaints,
    setLoadingComplaints,
  ] = useState(false);

  const [
    sweepingComplaints,
    setSweepingComplaints,
  ] = useState<SweepingComplaint[]>([]);

  const [
    complaintsTotal,
    setComplaintsTotal,
  ] = useState(0);

  const [
    complaintsWithoutGeo,
    setComplaintsWithoutGeo,
  ] = useState(0);

  const [
    complaintsFilterFrom,
    setComplaintsFilterFrom,
  ] = useState(oneMonthAgo);

  const [
    complaintsFilterTo,
    setComplaintsFilterTo,
  ] = useState(today);

  const [
    complaintsAppliedFrom,
    setComplaintsAppliedFrom,
  ] = useState(oneMonthAgo);

  const [
    complaintsAppliedTo,
    setComplaintsAppliedTo,
  ] = useState(today);

  /*
   * ==========================================================
   * MAPA DE VEHÍCULOS DE BARRIDO - ALL TRACK
   * Se consulta únicamente cuando el usuario lo abre o actualiza.
   * ==========================================================
   */

  const [
    alltrackMapOpen,
    setAlltrackMapOpen,
  ] = useState(false);

  const [
    alltrackLoaded,
    setAlltrackLoaded,
  ] = useState(false);

  const [
    loadingAlltrack,
    setLoadingAlltrack,
  ] = useState(false);

  const [
    alltrackVehicles,
    setAlltrackVehicles,
  ] = useState<SweepingAlltrackVehicle[]>([]);

  const [
    alltrackUpdatedAt,
    setAlltrackUpdatedAt,
  ] = useState<string | null>(null);

  const [
    alltrackLocated,
    setAlltrackLocated,
  ] = useState(0);

  const [
    alltrackWithoutPosition,
    setAlltrackWithoutPosition,
  ] = useState(0);

  const [
    alltrackViewMode,
    setAlltrackViewMode,
  ] = useState<"current" | "today">(
    "current"
  );

  const [
    selectedAlltrackVehicleCode,
    setSelectedAlltrackVehicleCode,
  ] = useState("M.C.1");

  const [
    loadingAlltrackHistory,
    setLoadingAlltrackHistory,
  ] = useState(false);

  const [
    alltrackHistory,
    setAlltrackHistory,
  ] = useState<SweepingAlltrackHistoryResponse | null>(null);

  /*
   * ==========================================================
   * TRAMOS POR MAPA
   * ==========================================================
   */

  const [
    plannedRoutes,
    setPlannedRoutes,
  ] = useState<MapRoute[]>([]);

  const [
    completedRoutes,
    setCompletedRoutes,
  ] = useState<MapRoute[]>([]);

  /*

   * ==========================================================

   * INTERACCIÓN MAPA

   * ==========================================================

   */

  const [

    hoveredRouteId,

    setHoveredRouteId,

  ] = useState<

    string | null

  >(null);

  const [

    selectedRouteId,

    setSelectedRouteId,

  ] = useState<

    string | null

  >(null);

  const [
    selectedBatchId,
    setSelectedBatchId,
  ] = useState<string | null>(
    null
  );

  const [
    focusedRouteKind,
    setFocusedRouteKind,
  ] = useState<
    "planned" |
    "completed" |
    null
  >(null);

  const [
    focusedRoutePositions,
    setFocusedRoutePositions,
  ] = useState<
    LatLngExpression[] |
    null
  >(null);

  const [
    focusedRouteToken,
    setFocusedRouteToken,
  ] = useState(0);

  /*
   * ==========================================================
   * EDICIÓN / ELIMINACIÓN
   * ==========================================================
   */

  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingWorkDate, setEditingWorkDate] = useState("");
  const [editingOriginalStreet, setEditingOriginalStreet] = useState("");
  const [editingOriginalFromStreet, setEditingOriginalFromStreet] = useState("");
  const [editingOriginalToStreet, setEditingOriginalToStreet] = useState("");
  const [editingOriginalGeometry, setEditingOriginalGeometry] =
    useState<GeoJsonLineString | null>(null);
  const [editingZone, setEditingZone] = useState<string | null>(null);
  const [editingObservations, setEditingObservations] =
    useState<string | null>(null);
  const [editingSaving, setEditingSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingRealizedId, setMarkingRealizedId] =
    useState<string | null>(null);
  const [deletingBatchId, setDeletingBatchId] =
    useState<string | null>(null);
  const [markingBatchId, setMarkingBatchId] =
    useState<string | null>(null);
  const [deletingAllPlanned, setDeletingAllPlanned] =
    useState(false);

  /*

   * ==========================================================

   * ESTADOS

   * ==========================================================

   */

  const [

    saving,

    setSaving,

  ] = useState(false);

  const [
    loadingPlanned,
    setLoadingPlanned,
  ] = useState(false);

  const [
    loadingCompleted,
    setLoadingCompleted,
  ] = useState(false);

  const [

    error,

    setError,

  ] = useState<

    string | null

  >(null);

  const [

    success,

    setSuccess,

  ] = useState<

    string | null

  >(null);

  const [
    confirmDialog,
    setConfirmDialog,
  ] = useState<
    ConfirmDialogConfig | null
  >(null);

  const [
    notCompletedDialog,
    setNotCompletedDialog,
  ] = useState<
    NotCompletedDialogState | null
  >(null);

  const confirmResolverRef =
    useRef<
      ((confirmed: boolean) => void) |
      null
    >(null);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timeout =
      window.setTimeout(
        () => {
          setSuccess(null);
        },
        3500
      );

    return () =>
      window.clearTimeout(timeout);
  }, [success]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timeout =
      window.setTimeout(
        () => {
          setError(null);
        },
        5000
      );

    return () =>
      window.clearTimeout(timeout);
  }, [error]);

  function requestConfirmation(
    config: ConfirmDialogConfig
  ) {
    return new Promise<boolean>(
      (resolve) => {
        confirmResolverRef.current =
          resolve;

        setConfirmDialog(
          config
        );
      }
    );
  }

  function closeConfirmation(
    confirmed: boolean
  ) {
    const resolver =
      confirmResolverRef.current;

    confirmResolverRef.current =
      null;

    setConfirmDialog(null);

    resolver?.(confirmed);
  }

  /*

   * ==========================================================

   * PREPARAR REGISTRO

   * ==========================================================

   */

  function prepareRecord(

    record: SweepingRecordApi,

    rangeStart: string

  ): MapRoute | null {

    const positions =

      geoJsonToLeaflet(

        record.geometry

      );

    if (

      positions.length < 2

    ) {

      return null;

    }

    const weekIndex =

      getWeekIndex(

        record.work_date,

        rangeStart

      );

    return {

      ...record,

      positions,

      weekIndex,

      color:

        WEEK_COLORS[

          weekIndex

        ] ??

        WEEK_COLORS[0],

    };

  }

  /*
   * ==========================================================
   * CARGAR REGISTROS POR ESTADO
   * ==========================================================
   */

  async function fetchRecordsForStatus(
    fromValue: string,
    toValue: string,
    status: SweepingStatus
  ) {
    const maxDays =
      status === "PLANIFICADO"
        ? 180
        : 31;

    const validation = validateRange(
      fromValue,
      toValue,
      maxDays
    );

    if (!validation.valid) {
      throw new Error(
        validation.error ??
          "El rango de fechas no es válido."
      );
    }

    const params = new URLSearchParams({
      from: fromValue,
      to: toValue,
      status,
    });

    const response = await fetch(
      `/api/test-grading/records?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const json = await response.json();

    if (!response.ok) {
      throw new Error(
        json?.error ||
          "No se pudieron cargar los trabajos de motonivelación."
      );
    }

    const records = Array.isArray(json)
      ? (json as SweepingRecordApi[])
      : [];

    return records
      .filter((record) => {
        const currentStatus =
          (record.status ?? "COMPLETADO")
            .toUpperCase();

        return status === "PLANIFICADO"
          ? currentStatus === "PLANIFICADO"
          : currentStatus !== "PLANIFICADO";
      })
      .map((record) =>
        prepareRecord(
          record,
          fromValue
        )
      )
      .filter(
        (
          record
        ): record is MapRoute =>
          record !== null
      );
  }

  async function fetchPlannedAreaBatches(
    fromValue: string,
    toValue: string
  ) {
    const params =
      new URLSearchParams({
        from: fromValue,
        to: toValue,
      });

    const response =
      await fetch(
        `/api/test-grading/area-batch?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

    const json =
      await response.json();

    if (!response.ok) {
      throw new Error(
        json?.error ||
          "No se pudieron cargar las zonas planificadas."
      );
    }

    return Array.isArray(json)
      ? (json as SweepingAreaBatch[])
      : [];
  }

  async function loadPlannedRecords(
    fromValue: string,
    toValue: string
  ) {
    const validation = validateRange(
      fromValue,
      toValue,
      180
    );

    if (!validation.valid) {
      setError(validation.error);
      return false;
    }

    try {
      setLoadingPlanned(true);
      setError(null);
      setHoveredRouteId(null);
      setSelectedRouteId(null);
      setSelectedBatchId(null);

      const [
        prepared,
        areaBatches,
      ] = await Promise.all([
        fetchRecordsForStatus(
          fromValue,
          toValue,
          "PLANIFICADO"
        ),
        fetchPlannedAreaBatches(
          fromValue,
          toValue
        ),
      ]);

      setPlannedRoutes(prepared);
      setPlannedAreaBatches(
        areaBatches
      );
      setPlannedAppliedFrom(fromValue);
      setPlannedAppliedTo(toValue);

      return true;
    } catch (err) {
      console.error(
        "Error cargando planificación:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al cargar la planificación."
      );

      return false;
    } finally {
      setLoadingPlanned(false);
    }
  }

  async function loadCompletedRecords(
    fromValue: string,
    toValue: string
  ) {
    const validation = validateRange(
      fromValue,
      toValue,
      31
    );

    if (!validation.valid) {
      setError(validation.error);
      return false;
    }

    try {
      setLoadingCompleted(true);
      setError(null);
      setHoveredRouteId(null);
      setSelectedRouteId(null);
      setSelectedBatchId(null);

      const prepared =
        await fetchRecordsForStatus(
          fromValue,
          toValue,
          "COMPLETADO"
        );

      setCompletedRoutes(prepared);
      setCompletedAppliedFrom(fromValue);
      setCompletedAppliedTo(toValue);

      return true;
    } catch (err) {
      console.error(
        "Error cargando trabajos de motonivelación realizados:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al cargar los trabajos de motonivelación realizados."
      );

      return false;
    } finally {
      setLoadingCompleted(false);
    }
  }

  /*
   * ==========================================================
   * CARGA INICIAL
   * ==========================================================
   */

  useEffect(() => {
    void Promise.all([
      loadPlannedRecords(
        firstDayOfMonth,
        lastDayOfMonth
      ),
      loadCompletedRecords(
        firstDayOfMonth,
        today
      ),
    ]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * ==========================================================
   * FIT
   * ==========================================================
   */

  const plannedRoutesToFit = useMemo(
    () =>
      plannedRoutes.map(
        (record) =>
          record.positions
      ),
    [plannedRoutes]
  );

  const completedRoutesToFit = useMemo(
    () =>
      completedRoutes.map(
        (record) =>
          record.positions
      ),
    [completedRoutes]
  );

  const plannedBaseWeight =
    getRouteWeight(
      plannedRoutes.length
    );

  const completedBaseWeight =
    getRouteWeight(
      completedRoutes.length
    );

  const plannedHoverEnabled =
    plannedRoutes.length < 300;

  const completedHoverEnabled =
    completedRoutes.length < 300;

  const plannedCanvasRenderer =
    useMemo(
      () =>
        L.canvas({
          padding: 0.5,
          tolerance: 8,
        }),
      []
    );

  const completedCanvasRenderer =
    useMemo(
      () =>
        L.canvas({
          padding: 0.5,
          tolerance: 8,
        }),
      []
    );

  /*
   * ==========================================================
   * LEYENDA DEL MAPA REALIZADO
   * ==========================================================
   */

  const weekLegend = useMemo(() => {
    const start = dateFromYmd(
      completedAppliedFrom
    );

    const end = dateFromYmd(
      completedAppliedTo
    );

    if (!start || !end) {
      return [];
    }

    const totalDifference =
      differenceInDays(
        start,
        end
      );

    const amountOfWeeks = Math.min(
      Math.floor(
        totalDifference / 7
      ) + 1,
      5
    );

    return Array.from(
      {
        length:
          amountOfWeeks,
      },
      (
        _,
        index
      ) => {
        const weekStart =
          addDays(
            start,
            index * 7
          );

        let weekEnd =
          addDays(
            weekStart,
            6
          );

        if (
          weekEnd.getTime() >
          end.getTime()
        ) {
          weekEnd = end;
        }

        return {
          index,
          label:
            `Semana ${index + 1}`,
          from:
            dateToYmd(
              weekStart
            ),
          to:
            dateToYmd(
              weekEnd
            ),
          color:
            WEEK_COLORS[
              index
            ],
        };
      }
    );
  }, [
    completedAppliedFrom,
    completedAppliedTo,
  ]);

  /*
   * ==========================================================
   * FILTROS DE PLANIFICACIÓN
   * ==========================================================
   */

  async function applyPlannedFilter() {
    setSuccess(null);

    await loadPlannedRecords(
      plannedFilterFrom,
      plannedFilterTo
    );
  }

  async function plannedFilterToday() {
    const currentToday =
      getTodayYmd();

    setPlannedFilterFrom(
      currentToday
    );

    setPlannedFilterTo(
      currentToday
    );

    setSuccess(null);

    await loadPlannedRecords(
      currentToday,
      currentToday
    );
  }

  async function plannedFilterThisWeek() {
    const now = new Date();
    const day = now.getDay();

    const daysSinceMonday =
      day === 0
        ? 6
        : day - 1;

    const monday =
      new Date(now);

    monday.setDate(
      monday.getDate() -
        daysSinceMonday
    );

    const sunday =
      addDays(
        monday,
        6
      );

    const from =
      dateToYmd(
        monday
      );

    const to =
      dateToYmd(
        sunday
      );

    setPlannedFilterFrom(
      from
    );

    setPlannedFilterTo(
      to
    );

    setSuccess(null);

    await loadPlannedRecords(
      from,
      to
    );
  }

  async function plannedFilterThisMonth() {
    setPlannedFilterFrom(
      firstDayOfMonth
    );

    setPlannedFilterTo(
      lastDayOfMonth
    );

    setSuccess(null);

    await loadPlannedRecords(
      firstDayOfMonth,
      lastDayOfMonth
    );
  }

  /*
   * ==========================================================
   * FILTROS DE BARRIDO REALIZADO
   * ==========================================================
   */

  async function applyCompletedFilter() {
    setSuccess(null);

    await loadCompletedRecords(
      completedFilterFrom,
      completedFilterTo
    );
  }

  async function completedFilterToday() {
    const currentToday =
      getTodayYmd();

    setCompletedFilterFrom(
      currentToday
    );

    setCompletedFilterTo(
      currentToday
    );

    setSuccess(null);

    await loadCompletedRecords(
      currentToday,
      currentToday
    );
  }

  async function completedFilterThisWeek() {
    const now = new Date();
    const day = now.getDay();

    const daysSinceMonday =
      day === 0
        ? 6
        : day - 1;

    const monday =
      new Date(now);

    monday.setDate(
      monday.getDate() -
        daysSinceMonday
    );

    const from =
      dateToYmd(
        monday
      );

    const to =
      getTodayYmd();

    setCompletedFilterFrom(
      from
    );

    setCompletedFilterTo(
      to
    );

    setSuccess(null);

    await loadCompletedRecords(
      from,
      to
    );
  }

  async function completedFilterThisMonth() {
    setCompletedFilterFrom(
      firstDayOfMonth
    );

    setCompletedFilterTo(
      today
    );

    setSuccess(null);

    await loadCompletedRecords(
      firstDayOfMonth,
      today
    );
  }

  /*
   * ==========================================================
   * RECLAMOS DE BARRIDO
   * ==========================================================
   */

  async function loadSweepingComplaints(
    fromValue: string,
    toValue: string
  ) {
    const validation = validateRange(
      fromValue,
      toValue,
      366
    );

    if (!validation.valid) {
      setError(validation.error);
      return false;
    }

    try {
      setLoadingComplaints(true);
      setError(null);

      const params =
        new URLSearchParams({
          from: fromValue,
          to: toValue,
        });

      const response = await fetch(
        `/api/test-grading/complaints?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const json =
        (await response.json()) as
          | SweepingComplaintsResponse
          | {
              error?: string;
            };

      if (!response.ok) {
        throw new Error(
          "error" in json &&
          json.error
            ? json.error
            : "No se pudieron cargar los reclamos de motonivelación."
        );
      }

      const result =
        json as SweepingComplaintsResponse;

      setSweepingComplaints(
        Array.isArray(result.data)
          ? result.data
          : []
      );

      setComplaintsTotal(
        Number(
          result.total ?? 0
        )
      );

      setComplaintsWithoutGeo(
        Number(
          result.without_georeference ??
            0
        )
      );

      setComplaintsAppliedFrom(
        fromValue
      );

      setComplaintsAppliedTo(
        toValue
      );

      setComplaintsLoaded(true);

      return true;
    } catch (err) {
      console.error(
        "Error cargando reclamos de motonivelación:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al cargar los reclamos de motonivelación."
      );

      return false;
    } finally {
      setLoadingComplaints(false);
    }
  }

  async function toggleComplaintsMap() {
    if (!document.fullscreenElement) {
      setFullscreenMap(null);
      setFullscreenActive(false);
      setMonitorMode(false);
    }

    if (complaintsMapOpen) {
      setComplaintsMapOpen(false);
      return;
    }

    setComplaintsMapOpen(true);

    if (!complaintsLoaded) {
      await loadSweepingComplaints(
        complaintsFilterFrom,
        complaintsFilterTo
      );
    }
  }

  async function refreshComplaintsMap() {
    await loadSweepingComplaints(
      complaintsAppliedFrom,
      complaintsAppliedTo
    );
  }

  async function applyComplaintsFilter() {
    await loadSweepingComplaints(
      complaintsFilterFrom,
      complaintsFilterTo
    );
  }

  async function complaintsFilterToday() {
    const currentToday =
      getTodayYmd();

    setComplaintsFilterFrom(
      currentToday
    );

    setComplaintsFilterTo(
      currentToday
    );

    await loadSweepingComplaints(
      currentToday,
      currentToday
    );
  }

  async function complaintsFilterThisWeek() {
    const now = new Date();
    const day = now.getDay();

    const daysSinceMonday =
      day === 0
        ? 6
        : day - 1;

    const monday =
      new Date(now);

    monday.setDate(
      monday.getDate() -
        daysSinceMonday
    );

    const from =
      dateToYmd(monday);

    const to =
      getTodayYmd();

    setComplaintsFilterFrom(
      from
    );

    setComplaintsFilterTo(
      to
    );

    await loadSweepingComplaints(
      from,
      to
    );
  }

  async function complaintsFilterThisMonth() {
    setComplaintsFilterFrom(
      firstDayOfMonth
    );

    setComplaintsFilterTo(
      today
    );

    await loadSweepingComplaints(
      firstDayOfMonth,
      today
    );
  }

  /*
   * ==========================================================
   * VEHÍCULOS DE BARRIDO - ALL TRACK
   * ==========================================================
   */

  async function loadAlltrackVehicles() {
    try {
      setLoadingAlltrack(true);
      setError(null);

      const response =
        await fetch(
          "/api/test-grading/alltrack-vehicles",
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const json =
        (await response.json()) as
          | SweepingAlltrackResponse
          | {
              error?: string;
            };

      if (!response.ok) {
        throw new Error(
          "error" in json &&
          json.error
            ? json.error
            : "No se pudieron cargar los vehículos de motonivelación."
        );
      }

      const result =
        json as SweepingAlltrackResponse;

      setAlltrackVehicles(
        Array.isArray(result.data)
          ? result.data
          : []
      );

      setAlltrackLocated(
        Number(
          result.located ?? 0
        )
      );

      setAlltrackWithoutPosition(
        Number(
          result.without_position ?? 0
        )
      );

      setAlltrackUpdatedAt(
        result.updated_at ??
          new Date().toISOString()
      );

      setAlltrackLoaded(true);

      return true;
    } catch (err) {
      console.error(
        "Error cargando vehículos de motonivelación desde All Track:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al cargar los vehículos de motonivelación."
      );

      return false;
    } finally {
      setLoadingAlltrack(false);
    }
  }

  async function toggleAlltrackMap() {
    if (!document.fullscreenElement) {
      setFullscreenMap(null);
      setFullscreenActive(false);
      setMonitorMode(false);
    }

    if (alltrackMapOpen) {
      setAlltrackMapOpen(false);
      return;
    }

    setAlltrackMapOpen(true);

    /*
     * Como este mapa representa ubicación actual, cada vez que
     * se vuelve a abrir consultamos de nuevo All Track.
     */
    await loadAlltrackVehicles();
  }

  async function refreshAlltrackVehicles() {
    return await loadAlltrackVehicles();
  }

  async function loadAlltrackHistory(
    vehicleCode =
      selectedAlltrackVehicleCode
  ) {
    try {
      setLoadingAlltrackHistory(true);
      setError(null);

      const currentToday =
        getTodayYmd();

      const params =
        new URLSearchParams({
          from: currentToday,
          to: currentToday,
          includeRoute: "1",
        });

      const response =
        await fetch(
          `/api/test-grading/alltrack-history/${encodeURIComponent(
            vehicleCode
          )}?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const json =
        (await response.json()) as
          | SweepingAlltrackHistoryResponse
          | {
              error?: string;
              data?: unknown;
              vehicle?: unknown;
              summary?: unknown;
              stops?: unknown;
              route?: unknown;
            };

      if (!response.ok) {
        throw new Error(
          "error" in json &&
          json.error
            ? json.error
            : "No se pudo cargar el recorrido de hoy."
        );
      }

      /*
       * El historial debe venir con:
       * { data: { vehicle, summary, stops, route } }
       *
       * Para evitar que una respuesta 200 con otra envoltura rompa
       * todo React, normalizamos también dos variantes posibles:
       * { data: { data: {...} } } y { vehicle, summary, ... }.
       */
      const rawHistory =
        json as any;

      const normalizedHistory:
        SweepingAlltrackHistoryResponse | null =
        rawHistory?.data?.vehicle &&
        rawHistory?.data?.summary
          ? rawHistory
          : rawHistory?.data?.data?.vehicle &&
              rawHistory?.data?.data?.summary
            ? rawHistory.data
            : rawHistory?.vehicle &&
                rawHistory?.summary
              ? {
                  meta:
                    rawHistory.meta,
                  data: {
                    vehicle:
                      rawHistory.vehicle,
                    period:
                      rawHistory.period ?? {
                        from:
                          currentToday,
                        to:
                          currentToday,
                      },
                    summary:
                      rawHistory.summary,
                    stops:
                      Array.isArray(
                        rawHistory.stops
                      )
                        ? rawHistory.stops
                        : [],
                    route:
                      rawHistory.route ??
                      null,
                  },
                }
              : null;

      if (
        !normalizedHistory ||
        !normalizedHistory.data ||
        !normalizedHistory.data.vehicle ||
        !normalizedHistory.data.summary
      ) {
        console.error(
          "Respuesta inesperada de All Track historial:",
          json
        );

        throw new Error(
          "All Track respondió correctamente, pero el formato del recorrido no es el esperado."
        );
      }

      setAlltrackHistory(
        normalizedHistory
      );

      return true;
    } catch (err) {
      console.error(
        "Error cargando recorrido de All Track:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al cargar el recorrido de hoy."
      );

      return false;
    } finally {
      setLoadingAlltrackHistory(false);
    }
  }

  async function showAlltrackCurrentView() {
    setAlltrackViewMode("current");

    if (!alltrackLoaded) {
      await loadAlltrackVehicles();
    }
  }

  async function selectAlltrackHistoryVehicle(
    vehicleCode: string
  ) {
    setSelectedAlltrackVehicleCode(
      vehicleCode
    );

    setAlltrackViewMode("today");
    setAlltrackHistory(null);

    await loadAlltrackHistory(
      vehicleCode
    );
  }

  async function refreshAlltrackActiveView() {
    if (alltrackViewMode === "today") {
      return await loadAlltrackHistory();
    }

    return await refreshAlltrackVehicles();
  }

  /*
   * ==========================================================
   * RECARGAR EL MAPA CORRESPONDIENTE AL GUARDAR
   * ==========================================================
   */

  async function reloadIfDateVisible(
    workDate: string,
    status: SweepingStatus
  ) {
    const date =
      dateFromYmd(
        workDate
      );

    if (!date) {
      return;
    }

    if (
      status ===
      "PLANIFICADO"
    ) {
      const from =
        dateFromYmd(
          plannedAppliedFrom
        );

      const to =
        dateFromYmd(
          plannedAppliedTo
        );

      const isVisible =
        from &&
        to &&
        date.getTime() >=
          from.getTime() &&
        date.getTime() <=
          to.getTime();

      if (isVisible) {
        await loadPlannedRecords(
          plannedAppliedFrom,
          plannedAppliedTo
        );
      }

      return;
    }

    const from =
      dateFromYmd(
        completedAppliedFrom
      );

    const to =
      dateFromYmd(
        completedAppliedTo
      );

    const isVisible =
      from &&
      to &&
      date.getTime() >=
        from.getTime() &&
      date.getTime() <=
        to.getTime();

    if (isVisible) {
      await loadCompletedRecords(
        completedAppliedFrom,
        completedAppliedTo
      );
    }
  }

  /*

   * ==========================================================

   * GUARDADO COMÚN

   * ==========================================================

   */

  function validatePlanningPeriod() {
    if (!planningFrom || !planningTo) {
      setError(
        "Seleccioná las fechas Desde y Hasta de la planificación."
      );
      return false;
    }

    const from = dateFromYmd(
      planningFrom
    );
    const to = dateFromYmd(
      planningTo
    );

    if (!from || !to) {
      setError(
        "El período de planificación no es válido."
      );
      return false;
    }

    if (to.getTime() < from.getTime()) {
      setError(
        "La fecha Hasta no puede ser anterior a la fecha Desde."
      );
      return false;
    }

    const diffDays = Math.floor(
      (to.getTime() - from.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (diffDays > 179) {
      setError(
        "El período máximo de planificación es de 180 días."
      );
      return false;
    }

    return true;
  }

  async function saveGeometry(

    geometry: GeoJsonLineString,

    cleanStreet: string,

    cleanFrom: string,

    cleanTo: string,

    status: SweepingStatus

  ) {

    const isPlanned =
      status === "PLANIFICADO";

    if (
      isPlanned &&
      !validatePlanningPeriod()
    ) {
      throw new Error(
        "Revisá el período de planificación."
      );
    }

    const workDate =
      isPlanned
        ? planningFrom
        : getTodayYmd();

    const saveResponse =

      await fetch(

        "/api/test-grading/records",

        {

          method:

            "POST",

          headers: {

            "Content-Type":

              "application/json",

          },

          body:

            JSON.stringify({

              main_street:

                cleanStreet,

              from_street:

                cleanFrom,

              to_street:

                cleanTo,

              geometry,

              work_date:

                workDate,

              planned_from:
                isPlanned
                  ? planningFrom
                  : null,

              planned_to:
                isPlanned
                  ? planningTo
                  : null,

              status,

              observations:
                observations.trim() ||
                null,

            }),

        }

      );

    const saveJson =

      await saveResponse.json();

    if (

      !saveResponse.ok

    ) {

      throw new Error(

        saveJson?.error ||

          "No se pudo guardar el tramo."

      );

    }

    await reloadIfDateVisible(
      workDate,
      status
    );

  }

  /*

   * ==========================================================

   * AUTOMÁTICO

   * ==========================================================

   */

  async function addStreetSegment() {

    const cleanStreet =

      street.trim();

    const cleanFrom =

      fromStreet.trim();

    const cleanTo =

      toStreet.trim();

    if (

      !cleanStreet ||

      !cleanFrom ||

      !cleanTo

    ) {

      setError(

        "Seleccioná la calle principal, desde calle y hasta calle desde el desplegable."

      );

      setSuccess(null);

      return;

    }

    try {

      setSaving(true);

      setError(null);

      setSuccess(null);

      const params =

        new URLSearchParams({

          street:

            cleanStreet,

          from:

            cleanFrom,

          to:

            cleanTo,

        });

      const segmentResponse =

        await fetch(

          `/api/test-grading/segment?${params.toString()}`,

          {

            method:

              "GET",

            cache:

              "no-store",

          }

        );

      const segmentJson =

        await segmentResponse.json();

      if (

        !segmentResponse.ok

      ) {

        throw new Error(

          segmentJson?.error ||

            "No se pudo calcular el tramo."

        );

      }

      const segment:

        SegmentResponse =

          segmentJson?.data ??

          segmentJson;

      if (

        !segment.geometry ||

        segment.geometry.type !==

          "LineString" ||

        !Array.isArray(

          segment.geometry

            .coordinates

        ) ||

        segment.geometry

          .coordinates

          .length < 2

      ) {

        throw new Error(

          "La geometría calculada no es válida."

        );

      }

      await saveGeometry(

        segment.geometry,

        cleanStreet,

        cleanFrom,

        cleanTo,

        recordStatus

      );

      setStreet("");

      setFromStreet("");

      setToStreet("");

      setObservations("");

      setSuccess(

        `${cleanStreet} desde ${cleanFrom} hasta ${cleanTo} fue guardado correctamente.`

      );

    } catch (err) {

      console.error(

        "Error agregando tramo automático:",

        err

      );

      setError(

        err instanceof Error

          ? err.message

          : "Ocurrió un error al guardar el tramo."

      );

    } finally {

      setSaving(false);

    }

  }

  /*

   * ==========================================================

   * INICIAR DIBUJO MANUAL

   * ==========================================================

   */

  function startManualDrawing() {

    const cleanStreet =

      street.trim();

    const cleanFrom =

      fromStreet.trim();

    const cleanTo =

      toStreet.trim();

    if (

      !cleanStreet ||

      !cleanFrom ||

      !cleanTo

    ) {

      setError(

        "Seleccioná la calle principal, desde calle y hasta calle desde el desplegable antes de dibujar."

      );

      return;

    }

    setError(null);

    setSuccess(null);

    setManualGeometry(

      null

    );

    setManualClearToken(

      (previous) =>

        previous + 1

    );

    setDrawingManual(

      true

    );

  }

  /*

   * ==========================================================

   * CANCELAR MANUAL

   * ==========================================================

   */

  function cancelManualDrawing() {

    setDrawingManual(

      false

    );

    setManualGeometry(

      null

    );

    setManualClearToken(

      (previous) =>

        previous + 1

    );

    setError(null);

  }

  /*

   * ==========================================================

   * GUARDAR MANUAL

   * ==========================================================

   */

  async function saveManualSegment() {

    const cleanStreet =

      street.trim();

    const cleanFrom =

      fromStreet.trim();

    const cleanTo =

      toStreet.trim();

    if (

      !cleanStreet ||

      !cleanFrom ||

      !cleanTo

    ) {

      setError(

        "Seleccioná la calle principal, desde calle y hasta calle desde el desplegable."

      );

      return;

    }

    if (

      !manualGeometry

    ) {

      setError(

        "Primero dibujá el tramo sobre el mapa."

      );

      return;

    }

    try {

      setSaving(true);

      setError(null);

      setSuccess(null);

      if (editingRecordId) {
        await patchEditedRecord(
          manualGeometry
        );
      } else {
        await saveGeometry(
          manualGeometry,
          cleanStreet,
          cleanFrom,
          cleanTo,
          recordStatus
        );
      }

      if (!editingRecordId) {
        setDrawingManual(
          false
        );

        setManualGeometry(
          null
        );

        setManualClearToken(
          (previous) =>
            previous + 1
        );

        setStreet("");
        setFromStreet("");
        setToStreet("");
        setObservations("");

        setSuccess(
          `${cleanStreet} desde ${cleanFrom} hasta ${cleanTo} fue guardado correctamente.`
        );
      }

    } catch (err) {

      console.error(

        "Error guardando dibujo manual:",

        err

      );

      setError(

        err instanceof Error

          ? err.message

          : "Ocurrió un error al guardar el dibujo."

      );

    } finally {

      setSaving(false);

    }

  }

  /*
   * ==========================================================
   * SELECCIONAR ZONA
   * ==========================================================
   */

  function resetAreaSelection() {
    setAreaDrawing(false);
    setAreaGeometry(null);
    setAreaStreets([]);
    setSelectedAreaStreetKeys(new Set());
    setAreaClearToken((previous) => previous + 1);
  }

  function switchToArea() {
    if (recordStatus !== "PLANIFICADO") {
      setRecordStatus("PLANIFICADO");
    }

    setLoadMode("area");
    setDrawingManual(false);
    setManualGeometry(null);
    setManualClearToken((previous) => previous + 1);
    resetAreaSelection();
    resetMechanicalSelection();
    setError(null);
    setSuccess(null);
  }

  function startAreaDrawing() {
    setError(null);
    setSuccess(null);
    setAreaGeometry(null);
    setAreaStreets([]);
    setSelectedAreaStreetKeys(new Set());
    setAreaClearToken((previous) => previous + 1);
    setAreaDrawing(true);
  }

  function cancelAreaDrawing() {
    resetAreaSelection();
    setError(null);
  }

  async function analyzeArea(
    geometry: GeoJsonPolygon
  ) {
    try {
      setAreaLoading(true);
      setError(null);
      setSuccess(null);
      setAreaGeometry(geometry);

      const response = await fetch(
        "/api/test-grading/area-streets",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            geometry,
            min_length_meters: 2,
          }),
        }
      );

      const json =
        (await response.json()) as
          AreaStreetsResponse & {
            error?: string;
          };

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "No se pudieron detectar las calles de la zona."
        );
      }

      const streets =
        Array.isArray(json.streets)
          ? json.streets
          : [];

      // Diagnóstico: si falta una calle en la vista previa, comprobar
      // primero si la API realmente devolvió su geometría.
      const returnedPaths = streets.reduce(
        (total, item) => total + areaStreetToLeafletPaths(item.geometry).length,
        0
      );
      console.info("[Motonivelación] Calles recibidas por zona", {
        calles: streets.length,
        trazados: returnedPaths,
        callesSinGeometria: streets
          .filter((item) => areaStreetToLeafletPaths(item.geometry).length === 0)
          .map((item) => item.street_name),
      });

      setAreaStreets(streets);
      setSelectedAreaStreetKeys(
        new Set(
          streets
            .filter(
              isAreaStreetSelectableByDefault
            )
            .map(
              (item) => item.corridor_key
            )
        )
      );

      if (streets.length === 0) {
        setError(
          "No se encontraron calles dentro de la zona dibujada."
        );
      }
    } catch (err) {
      console.error(
        "Error analizando zona:",
        err
      );
      setAreaStreets([]);
      setSelectedAreaStreetKeys(new Set());
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al analizar la zona."
      );
    } finally {
      setAreaLoading(false);
    }
  }

  function toggleAreaStreet(
    corridorKey: string
  ) {
    setSelectedAreaStreetKeys(
      (previous) => {
        const next = new Set(previous);

        if (next.has(corridorKey)) {
          next.delete(corridorKey);
        } else {
          next.add(corridorKey);
        }

        return next;
      }
    );
  }

  function selectAllAreaStreets() {
    setSelectedAreaStreetKeys(
      new Set(
        areaStreets.map(
          (item) => item.corridor_key
        )
      )
    );
  }



  // Busca una calle transversal en el extremo real del trazado.
  // No altera las geometrías ni consulta otra API: usa las calles
  // que ya devolvió el análisis de la zona.
  function findAreaCrossStreet(
    street: AreaStreet,
    endpoint: L.LatLng,
    adjacentPoint: L.LatLng
  ): string {
    const latRadians = endpoint.lat * Math.PI / 180;
    const metersLon = 111320 * Math.cos(latRadians);
    const metersLat = 110540;
    const dx = (adjacentPoint.lng - endpoint.lng) * metersLon;
    const dy = (adjacentPoint.lat - endpoint.lat) * metersLat;
    const directionSize = Math.hypot(dx, dy);
    if (directionSize < 0.5) return "Límite de zona";

    let best: { name: string; distance: number } | null = null;
    const candidates = areaStreets.filter(
      (candidate) =>
        candidate.corridor_key !== street.corridor_key &&
        candidate.street_name.trim() !== "" &&
        candidate.street_name.trim().toLocaleLowerCase("es") !==
          street.street_name.trim().toLocaleLowerCase("es")
    );

    for (const candidate of candidates) {
      for (const path of areaStreetToLeafletPaths(candidate.geometry)) {
        const points = path.map((point) => L.latLng(point));
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1];
          const b = points[i];
          const ax = (a.lng - endpoint.lng) * metersLon;
          const ay = (a.lat - endpoint.lat) * metersLat;
          const bx = (b.lng - endpoint.lng) * metersLon;
          const by = (b.lat - endpoint.lat) * metersLat;
          const vx = bx - ax;
          const vy = by - ay;
          const lengthSquared = vx * vx + vy * vy;
          if (lengthSquared < 0.25) continue;

          // Evita confundir calles paralelas o fragmentos de la misma vía.
          const sineAngle =
            Math.abs(dx * vy - dy * vx) /
            (directionSize * Math.sqrt(lengthSquared));
          if (sineAngle < 0.5) continue;

          const projection = -(ax * vx + ay * vy) / lengthSquared;
          // El cruce debe caer dentro del segmento transversal (con
          // una tolerancia pequeña para extremos OSM no conectados).
          const tolerance = 4 / Math.sqrt(lengthSquared);
          if (projection < -tolerance || projection > 1 + tolerance) continue;
          const t = Math.max(0, Math.min(1, projection));
          const distance = Math.hypot(ax + t * vx, ay + t * vy);
          if (distance > 8) continue;

          if (!best || distance < best.distance) {
            best = { name: candidate.street_name.trim(), distance };
          }
        }
      }
    }

    return best?.name ?? "Límite de zona";
  }

  async function saveAreaPlanning() {
    if (!validatePlanningPeriod()) {
      return;
    }

    if (!areaGeometry) {
      setError(
        "Primero dibujá la zona sobre el mapa."
      );
      return;
    }

    const selectedStreets =
      areaStreets.filter((item) =>
        selectedAreaStreetKeys.has(
          item.corridor_key
        )
      );

    if (selectedStreets.length === 0) {
      setError(
        "Seleccioná al menos una calle de la zona."
      );
      return;
    }

    const recordsToSave =
      selectedStreets.flatMap((item) =>
        areaStreetToLeafletPaths(item.geometry).map((path) => {
          const points = path.map((position) =>
            L.latLng(position as L.LatLngExpression)
          );
          const start = points[0];
          const end = points[points.length - 1];
          return {
            main_street: item.street_name,
            from_street: findAreaCrossStreet(item, start, points[1]),
            to_street: findAreaCrossStreet(item, end, points[points.length - 2]),
            geometry: {
              type: "LineString" as const,
              coordinates: points.map((point) => [point.lng, point.lat]),
            },
          };
        })
      );

    if (recordsToSave.length === 0) {
      setError(
        "Las calles seleccionadas no tienen geometrías válidas para guardar."
      );
      return;
    }

    const areaBatchId =
      window.crypto.randomUUID();

    const areaObservation =
      observations.trim() ||
      "Planificación por zona";

    try {
      setAreaSaving(true);
      setError(null);
      setSuccess(null);

      /*
       * UNA sola llamada HTTP + UNA sola RPC/transacción SQL.
       * Antes una zona grande podía generar decenas de POST separados.
       */
      const response =
        await fetch(
          "/api/test-grading/area-batch",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              batch_id:
                areaBatchId,
              work_date:
                planningFrom,
              planned_from:
                planningFrom,
              planned_to:
                planningTo,
              observations:
                areaObservation,
              color:
                areaColor,
              geometry:
                areaGeometry,
              records:
                recordsToSave,
            }),
          }
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "No se pudo guardar la planificación por zona."
        );
      }

      const savedCount =
        Number(
          json?.saved_count
        ) ||
        recordsToSave.length;

      setSuccess(
        `Planificación creada: ${selectedStreets.length} calles y ${savedCount} tramos guardados en una sola operación.`
      );

      /*
       * Mostramos el polígono y su etiqueta inmediatamente.
       * El refresco completo de los tramos se hace en segundo plano,
       * así el usuario no queda mirando "Creando planificación..."
       * mientras vuelve a descargarse todo el mes.
       */
      setPlannedAreaBatches(
        (previous) => [
          ...previous.filter(
            (item) =>
              item.batch_id !==
              areaBatchId
          ),
          {
            batch_id:
              areaBatchId,
            work_date:
              planningFrom,
            planned_from:
              planningFrom,
            planned_to:
              planningTo,
            observations:
              areaObservation,
            color:
              areaColor,
            geometry:
              areaGeometry,
            pending_count:
              savedCount,
            realized_count:
              0,
            created_at:
              new Date().toISOString(),
          },
        ]
      );

      setObservations("");
      resetAreaSelection();

      void loadPlannedRecords(
        plannedAppliedFrom,
        plannedAppliedTo
      );
    } catch (err) {
      console.error(
        "Error guardando planificación por zona:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al guardar la planificación por zona."
      );
    } finally {
      setAreaSaving(false);
    }
  }

  /*
   * ==========================================================
   * CORREDOR MECÁNICO POR DOS PUNTOS
   * ==========================================================
   */

  function resetMechanicalSelection() {
    setMechanicalSelecting(false);
    setMechanicalStartPoint(null);
    setMechanicalEndPoint(null);
    setMechanicalPreview(null);
  }

  function switchToMechanical() {
    if (recordStatus !== "PLANIFICADO") {
      setRecordStatus("PLANIFICADO");
    }

    setLoadMode("mechanical");
    setDrawingManual(false);
    setManualGeometry(null);
    setManualClearToken(
      (previous) => previous + 1
    );
    resetAreaSelection();
    resetMechanicalSelection();
    setError(null);
    setSuccess(null);
  }

  function startMechanicalSelection() {
    setError(null);
    setSuccess(null);
    setMechanicalStartPoint(null);
    setMechanicalEndPoint(null);
    setMechanicalPreview(null);
    setMechanicalSelecting(true);
  }

  async function detectMechanicalCorridor(
    startPoint: MechanicalMapPoint,
    endPoint: MechanicalMapPoint
  ) {
    try {
      setMechanicalLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(
        "/api/test-grading/mechanical-corridor",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "detect",
            start: startPoint,
            end: endPoint,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "No se pudo detectar el trazado por dos puntos."
        );
      }

      const corridor =
        json?.data as MechanicalCorridorPreview;

      if (
        !corridor?.geometry ||
        corridor.geometry.type !== "LineString"
      ) {
        throw new Error(
          "El corredor detectado no tiene una geometría válida."
        );
      }

      setMechanicalPreview(corridor);
    } catch (err) {
      // Error de validación/detección esperado: lo mostramos en la UI
      // sin disparar el overlay rojo de Next.js en desarrollo.
      setMechanicalPreview(null);
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al detectar el trazado por dos puntos."
      );
    } finally {
      setMechanicalLoading(false);
    }
  }

  function handleMechanicalMapPoint(
    point: MechanicalMapPoint
  ) {
    if (
      !mechanicalSelecting ||
      mechanicalLoading
    ) {
      return;
    }

    if (
      !mechanicalStartPoint ||
      mechanicalEndPoint
    ) {
      setMechanicalStartPoint(point);
      setMechanicalEndPoint(null);
      setMechanicalPreview(null);
      return;
    }

    setMechanicalEndPoint(point);
    setMechanicalSelecting(false);

    void detectMechanicalCorridor(
      mechanicalStartPoint,
      point
    );
  }

  async function saveMechanicalCorridor() {
    if (
      !mechanicalStartPoint ||
      !mechanicalEndPoint ||
      !mechanicalPreview
    ) {
      setError(
        "Seleccioná dos puntos y esperá a que el sistema detecte el corredor."
      );
      return;
    }

    if (!validatePlanningPeriod()) {
      return;
    }

    try {
      setMechanicalSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(
        "/api/test-grading/mechanical-corridor",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "save",
            start: mechanicalStartPoint,
            end: mechanicalEndPoint,
            work_date: planningFrom,
            planned_from: planningFrom,
            planned_to: planningTo,
            observations:
              observations.trim() || null,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "No se pudo guardar el trazado por dos puntos."
        );
      }

      setSuccess(
        `${mechanicalPreview.street_name} fue agregado a la planificación mecánica.`
      );

      setObservations("");
      resetMechanicalSelection();

      void loadPlannedRecords(
        plannedAppliedFrom,
        plannedAppliedTo
      );
    } catch (err) {
      console.error(
        "Error guardando trazado por dos puntos:",
        err
      );
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al guardar el trazado por dos puntos."
      );
    } finally {
      setMechanicalSaving(false);
    }
  }

  /*

   * ==========================================================

   * CAMBIO DE MODO

   * ==========================================================

   */

  function switchToAutomatic() {

    setLoadMode(

      "automatic"

    );

    setDrawingManual(

      false

    );

    setManualGeometry(

      null

    );

    setManualClearToken(

      (previous) =>

        previous + 1

    );

    resetAreaSelection();
    resetMechanicalSelection();

    setError(null);

    setSuccess(null);

  }

  function switchToManual() {

    setLoadMode(

      "manual"

    );

    setDrawingManual(

      false

    );

    setManualGeometry(

      null

    );

    setManualClearToken(

      (previous) =>

        previous + 1

    );

    resetAreaSelection();
    resetMechanicalSelection();

    setError(null);

    setSuccess(null);

  }

  /*

   * ==========================================================

   * LIMPIAR HISTÓRICO DE LA VISTA

   * ==========================================================

   */

  function selectRouteFromList(
    kind:
      | "planned"
      | "completed",
    record: MapRoute
  ) {
    setSelectedBatchId(
      null
    );

    setSelectedRouteId(
      record.id
    );

    setHoveredRouteId(null);

    setFocusedRouteKind(
      kind
    );

    setFocusedRoutePositions(
      record.positions
    );

    setFocusedRouteToken(
      (previous) =>
        previous + 1
    );
  }

  /*
   * ==========================================================
   * EDITAR / ELIMINAR
   * ==========================================================
   */

  function selectBatchFromList(
    kind:
      | "planned"
      | "completed",
    batchId: string,
    records: MapRoute[]
  ) {
    const positions =
      records.flatMap(
        (record) =>
          record.positions
      );

    if (
      positions.length < 2
    ) {
      return;
    }

    setSelectedRouteId(
      null
    );

    setSelectedBatchId(
      batchId
    );

    setHoveredRouteId(
      null
    );

    setFocusedRouteKind(
      kind
    );

    setFocusedRoutePositions(
      positions
    );

    setFocusedRouteToken(
      (previous) =>
        previous + 1
    );
  }

  function startEditingRecord(record: MapRoute) {
    setEditingRecordId(record.id);
    setEditingWorkDate(record.work_date);
    setEditingOriginalStreet(record.main_street);
    setEditingOriginalFromStreet(record.from_street);
    setEditingOriginalToStreet(record.to_street);
    setEditingOriginalGeometry(record.geometry);
    setEditingZone(record.zone ?? null);
    setEditingObservations(record.observations ?? null);

    setStreet(record.main_street);
    setFromStreet(record.from_street);
    setToStreet(record.to_street);
    setObservations(record.observations ?? "");
    setRecordStatus(
      (record.status ?? "").toUpperCase() === "PLANIFICADO"
        ? "PLANIFICADO"
        : "COMPLETADO"
    );

    setLoadMode("automatic");
    setDrawingManual(false);
    setManualGeometry(null);
    setManualClearToken((previous) => previous + 1);
    resetAreaSelection();

    setError(null);
    setSuccess(null);
    setSelectedRouteId(record.id);

    window.requestAnimationFrame(() => {
      document
        .getElementById("sweeping-editor-form")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  }

  function cancelEditingRecord() {
    setEditingRecordId(null);
    setEditingWorkDate("");
    setEditingOriginalStreet("");
    setEditingOriginalFromStreet("");
    setEditingOriginalToStreet("");
    setEditingOriginalGeometry(null);
    setEditingZone(null);
    setEditingObservations(null);

    setStreet("");
    setFromStreet("");
    setToStreet("");
    setObservations("");
    setRecordStatus("COMPLETADO");

    setDrawingManual(false);
    setManualGeometry(null);
    setManualClearToken((previous) => previous + 1);
    resetAreaSelection();
    setLoadMode("automatic");

    setError(null);
    setSuccess(null);
  }

  async function patchEditedRecord(
    geometryToSave: GeoJsonLineString
  ) {
    if (!editingRecordId) {
      return;
    }

    const cleanStreet = street.trim();
    const cleanFrom = fromStreet.trim();
    const cleanTo = toStreet.trim();

    if (!cleanStreet || !cleanFrom || !cleanTo) {
      setError(
        "Seleccioná la calle principal, desde calle y hasta calle desde el desplegable."
      );
      return;
    }

    if (!editingWorkDate) {
      setError(
        "El tramo que estás editando no tiene una fecha válida."
      );
      return;
    }

    try {
      setEditingSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(
        "/api/test-grading/records",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: editingRecordId,
            main_street: cleanStreet,
            from_street: cleanFrom,
            to_street: cleanTo,
            geometry: geometryToSave,
            work_date: editingWorkDate,
            zone: editingZone,
            observations:
              observations.trim() ||
              null,
            status: recordStatus,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "No se pudo actualizar el tramo."
        );
      }

      const successMessage =
        `${cleanStreet} fue actualizado correctamente.`;

      cancelEditingRecord();
      setSuccess(successMessage);

      await Promise.all([
        loadPlannedRecords(
          plannedAppliedFrom,
          plannedAppliedTo
        ),
        loadCompletedRecords(
          completedAppliedFrom,
          completedAppliedTo
        ),
      ]);
    } catch (err) {
      console.error(
        "Error actualizando tramo:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al actualizar el tramo."
      );
    } finally {
      setEditingSaving(false);
    }
  }

  async function saveEditedAutomaticSegment() {
    if (!editingRecordId) {
      return;
    }

    const cleanStreet = street.trim();
    const cleanFrom = fromStreet.trim();
    const cleanTo = toStreet.trim();

    if (!cleanStreet || !cleanFrom || !cleanTo) {
      setError(
        "Seleccioná la calle principal, desde calle y hasta calle desde el desplegable."
      );
      return;
    }

    const streetChanged =
      cleanStreet !== editingOriginalStreet ||
      cleanFrom !== editingOriginalFromStreet ||
      cleanTo !== editingOriginalToStreet;

    if (!streetChanged) {
      if (!editingOriginalGeometry) {
        setError(
          "El tramo original no tiene una geometría válida."
        );
        return;
      }

      await patchEditedRecord(
        editingOriginalGeometry
      );
      return;
    }

    try {
      setEditingSaving(true);
      setError(null);
      setSuccess(null);

      const params = new URLSearchParams({
        street: cleanStreet,
        from: cleanFrom,
        to: cleanTo,
      });

      const segmentResponse = await fetch(
        `/api/test-grading/segment?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const segmentJson =
        await segmentResponse.json();

      if (!segmentResponse.ok) {
        throw new Error(
          segmentJson?.error ||
            "No se pudo calcular el nuevo recorrido."
        );
      }

      const segment: SegmentResponse =
        segmentJson?.data ?? segmentJson;

      if (
        !segment.geometry ||
        segment.geometry.type !== "LineString" ||
        !Array.isArray(
          segment.geometry.coordinates
        ) ||
        segment.geometry.coordinates.length < 2
      ) {
        throw new Error(
          "La nueva geometría calculada no es válida."
        );
      }

      setEditingSaving(false);

      await patchEditedRecord(
        segment.geometry
      );
    } catch (err) {
      console.error(
        "Error recalculando tramo editado:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al recalcular el tramo."
      );

      setEditingSaving(false);
    }
  }

  async function markPlannedAsCompleted(
    record: MapRoute
  ) {
    if (record.result_status === "NO_REALIZADO") {
      setError("Primero deshacé el resultado NO REALIZADO.");
      return;
    }
    if (record.realized_record_id) {
      setSuccess(
        "Este tramo ya está registrado como realizado."
      );
      return;
    }

    const confirmed =
      await requestConfirmation({
        title:
          "Marcar tramo como realizado",
        message:
          `${record.main_street} — ${record.from_street} → ${record.to_street}`,
        detail:
          "El tramo planificado se conservará y se creará una copia en Realizados con la fecha de hoy.",
        confirmLabel:
          "Marcar como realizado",
        variant:
          "success",
      });

    if (!confirmed) {
      return;
    }

    const workDate =
      getTodayYmd();

    try {
      setMarkingRealizedId(
        record.id
      );
      setError(null);
      setSuccess(null);

      const response = await fetch(
        "/api/test-grading/records",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action:
              "mark_completed",
            planned_record_id:
              record.id,
            work_date:
              workDate,
          }),
        }
      );

      const json =
        await response.json();

      if (!response.ok) {
        if (
          response.status === 409
        ) {
          await loadPlannedRecords(
            plannedAppliedFrom,
            plannedAppliedTo
          );

          setSuccess(
            "Este tramo ya estaba registrado como realizado."
          );

          return;
        }

        throw new Error(
          json?.error ||
            "No se pudo registrar el tramo como realizado."
        );
      }

      /*
       * Siempre actualizamos Planificados para que aparezca
       * inmediatamente como “Ya realizado”.
       */
      await loadPlannedRecords(
        plannedAppliedFrom,
        plannedAppliedTo
      );

      /*
       * Si HOY está dentro del filtro actual de Realizados,
       * mantenemos ese filtro.
       *
       * Si no está, pasamos el mapa de Realizados a HOY para
       * que el nuevo tramo se vea automáticamente.
       */
      const currentDate =
        dateFromYmd(
          workDate
        );

      const completedFrom =
        dateFromYmd(
          completedAppliedFrom
        );

      const completedTo =
        dateFromYmd(
          completedAppliedTo
        );

      const todayIsVisible =
        currentDate &&
        completedFrom &&
        completedTo &&
        currentDate.getTime() >=
          completedFrom.getTime() &&
        currentDate.getTime() <=
          completedTo.getTime();

      if (todayIsVisible) {
        await loadCompletedRecords(
          completedAppliedFrom,
          completedAppliedTo
        );
      } else {
        setCompletedFilterFrom(
          workDate
        );
        setCompletedFilterTo(
          workDate
        );

        await loadCompletedRecords(
          workDate,
          workDate
        );
      }

      setSuccess(
        `${record.main_street} se registró como realizado. La planificación original se conserva.`
      );
    } catch (err) {
      console.error(
        "Error marcando tramo como realizado:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al registrar el tramo como realizado."
      );
    } finally {
      setMarkingRealizedId(
        null
      );
    }
  }

  function openNotCompletedDialog(record: MapRoute) {
    if (readOnly || record.realized_record_id) return;

    if (record.result_status === "REALIZADO") {
      setError("Este tramo tiene una marca histórica REALIZADO. No se modifica automáticamente.");
      return;
    }

    setNotCompletedDialog({
      record,
      observation: record.result_observation ?? "",
      error: null,
    });
  }

  async function submitNotCompletedDialog() {
    if (!notCompletedDialog) return;

    const observation = notCompletedDialog.observation.trim();

    if (!observation || observation.length > 500) {
      setNotCompletedDialog((current) =>
        current
          ? {
              ...current,
              error: "Ingresá un motivo de entre 1 y 500 caracteres.",
            }
          : current
      );
      return;
    }

    const record = notCompletedDialog.record;

    try {
      setMarkingRealizedId(record.id);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/test-grading/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_not_completed",
          planned_record_id: record.id,
          result_observation: observation,
          result_date: getTodayYmd(),
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "No se pudo actualizar el resultado."
        );
      }

      setNotCompletedDialog(null);
      await loadPlannedRecords(
        plannedAppliedFrom,
        plannedAppliedTo
      );
      setSuccess(
        "Tramo registrado como NO REALIZADO."
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el resultado.";

      setNotCompletedDialog((current) =>
        current
          ? {
              ...current,
              error: message,
            }
          : current
      );
    } finally {
      setMarkingRealizedId(null);
    }
  }

  async function changeNotCompleted(record: MapRoute, undo = false) {
    if (readOnly || record.realized_record_id) return;

    if (!undo) {
      openNotCompletedDialog(record);
      return;
    }

    const confirmed = await requestConfirmation({
      title: "Deshacer no realizado",
      message: `${record.main_street} — ${record.from_street} → ${record.to_street}`,
      detail: "Se quitará el motivo registrado y el tramo volverá a estar pendiente.",
      confirmLabel: "Deshacer no realizado",
      variant: "danger",
    });

    if (!confirmed) return;

    try {
      setMarkingRealizedId(record.id);
      setError(null);
      setSuccess(null);
      const response = await fetch("/api/test-grading/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "undo_not_completed",
          planned_record_id: record.id,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "No se pudo actualizar el resultado.");
      await loadPlannedRecords(plannedAppliedFrom, plannedAppliedTo);
      setSuccess("El tramo volvió a pendiente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el resultado.");
    } finally {
      setMarkingRealizedId(null);
    }
  }

  async function markBatchAsCompleted(
    batchId: string,
    records: MapRoute[]
  ) {
    const pendingRecords =
      records.filter(
        (record) =>
          !record.realized_record_id && record.result_status !== "NO_REALIZADO"
      );

    if (pendingRecords.length === 0) {
      setSuccess(
        "Todos los tramos de esta zona ya están registrados como realizados."
      );
      return;
    }

    const confirmed =
      await requestConfirmation({
        title:
          "Marcar zona como realizada",
        message:
          `Se registrarán ${pendingRecords.length} tramos pendientes como realizados.`,
        detail:
          "Los tramos planificados originales se conservarán. Solo se crearán realizados para los pendientes del grupo.",
        confirmLabel:
          "Marcar grupo como realizado",
        variant:
          "success",
      });

    if (!confirmed) {
      return;
    }

    const workDate =
      getTodayYmd();

    try {
      setMarkingBatchId(
        batchId
      );
      setError(null);
      setSuccess(null);

      const response = await fetch(
        "/api/test-grading/records",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action:
              "mark_batch_completed",
            batch_id:
              batchId,
            work_date:
              workDate,
          }),
        }
      );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "No se pudo registrar el grupo como realizado."
        );
      }

      await loadPlannedRecords(
        plannedAppliedFrom,
        plannedAppliedTo
      );

      const currentDate =
        dateFromYmd(
          workDate
        );

      const completedFrom =
        dateFromYmd(
          completedAppliedFrom
        );

      const completedTo =
        dateFromYmd(
          completedAppliedTo
        );

      const todayIsVisible =
        currentDate &&
        completedFrom &&
        completedTo &&
        currentDate.getTime() >=
          completedFrom.getTime() &&
        currentDate.getTime() <=
          completedTo.getTime();

      if (todayIsVisible) {
        await loadCompletedRecords(
          completedAppliedFrom,
          completedAppliedTo
        );
      } else {
        setCompletedFilterFrom(
          workDate
        );
        setCompletedFilterTo(
          workDate
        );

        await loadCompletedRecords(
          workDate,
          workDate
        );
      }

      const completedCount =
        Number(
          json?.completed_count ??
            pendingRecords.length
        );

      setSuccess(
        `${completedCount} tramos de la zona se registraron como realizados. La planificación original se conserva.`
      );
    } catch (err) {
      console.error(
        "Error marcando grupo como realizado:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al registrar el grupo como realizado."
      );
    } finally {
      setMarkingBatchId(
        null
      );
    }
  }

  async function deleteBatchPending(
    batchId: string,
    records: MapRoute[]
  ) {
    const pendingRecords =
      records.filter(
        (record) =>
          !record.realized_record_id && record.result_status !== "NO_REALIZADO"
      );

    const realizedCount =
      records.length -
      pendingRecords.length;

    if (pendingRecords.length === 0) {
      setSuccess(
        "Este grupo no tiene tramos planificados pendientes para eliminar."
      );
      return;
    }

    const confirmed =
      await requestConfirmation({
        title:
          "Eliminar planificación por zona",
        message:
          `Se eliminarán ${pendingRecords.length} tramos planificados pendientes.`,
        detail:
          realizedCount > 0
            ? `${realizedCount} tramos del grupo ya tienen un realizado asociado y se conservarán junto con su histórico.`
            : "Se eliminará únicamente esta planificación agrupada. Esta acción no se puede deshacer.",
        confirmLabel:
          "Eliminar pendientes",
        variant:
          "danger",
      });

    if (!confirmed) {
      return;
    }

    try {
      setDeletingBatchId(
        batchId
      );
      setError(null);
      setSuccess(null);

      const response = await fetch(
        `/api/test-grading/records?batch_id=${encodeURIComponent(
          batchId
        )}`,
        {
          method: "DELETE",
        }
      );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "No se pudo eliminar la planificación por zona."
        );
      }

      if (
        editingRecordId &&
        pendingRecords.some(
          (record) =>
            record.id ===
            editingRecordId
        )
      ) {
        cancelEditingRecord();
      }

      await Promise.all([
        loadPlannedRecords(
          plannedAppliedFrom,
          plannedAppliedTo
        ),
        loadCompletedRecords(
          completedAppliedFrom,
          completedAppliedTo
        ),
      ]);

      const deletedCount =
        Number(
          json?.deleted_count ??
            pendingRecords.length
        );

      setSuccess(
        `${deletedCount} tramos pendientes de la zona fueron eliminados correctamente.`
      );
    } catch (err) {
      console.error(
        "Error eliminando grupo de planificación:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al eliminar la planificación por zona."
      );
    } finally {
      setDeletingBatchId(
        null
      );
    }
  }

  async function runDeleteRequestsInChunks(
    urls: string[],
    chunkSize = 8
  ) {
    let deleted = 0;

    for (
      let index = 0;
      index < urls.length;
      index += chunkSize
    ) {
      const chunk =
        urls.slice(
          index,
          index + chunkSize
        );

      const results =
        await Promise.all(
          chunk.map(
            async (url) => {
              const response =
                await fetch(
                  url,
                  {
                    method: "DELETE",
                  }
                );

              const json =
                await response.json();

              if (!response.ok) {
                throw new Error(
                  json?.error ||
                    "No se pudo completar una de las eliminaciones."
                );
              }

              return Number(
                json?.deleted_count ??
                  1
              );
            }
          )
        );

      deleted +=
        results.reduce(
          (sum, value) =>
            sum + value,
          0
        );
    }

    return deleted;
  }

  async function deleteAllPendingPlanning() {
    const pendingRecords =
      plannedRoutes.filter(
        (record) =>
          !record.realized_record_id && record.result_status !== "NO_REALIZADO"
      );

    if (
      pendingRecords.length === 0
    ) {
      setSuccess(
        "No hay tramos planificados pendientes en el período visible."
      );
      return;
    }

    const confirmed =
      await requestConfirmation({
        title:
          "Eliminar planificación pendiente",
        message:
          `Se eliminarán ${pendingRecords.length} tramos planificados pendientes del período visible.`,
        detail:
          `Período: ${formatDateAr(plannedAppliedFrom)} al ${formatDateAr(plannedAppliedTo)}. Los tramos que ya tienen un motonivelación realizado asociado NO se eliminarán.`,
        confirmLabel:
          `Eliminar ${pendingRecords.length} pendientes`,
        variant:
          "danger",
      });

    if (!confirmed) {
      return;
    }

    try {
      setDeletingAllPlanned(
        true
      );
      setError(null);
      setSuccess(null);

      const batchIds =
        Array.from(
          new Set<string>(
            pendingRecords
              .map(
                (record) =>
                  record.batch_id?.trim() ||
                  ""
              )
              .filter(Boolean)
          )
        );

      const standaloneIds =
        pendingRecords
          .filter(
            (record) =>
              !record.batch_id?.trim()
          )
          .map(
            (record) =>
              record.id
          );

      const urls = [
        ...batchIds.map(
          (batchId) =>
            `/api/test-grading/records?batch_id=${encodeURIComponent(
              batchId
            )}`
        ),
        ...standaloneIds.map(
          (id) =>
            `/api/test-grading/records?id=${encodeURIComponent(
              id
            )}`
        ),
      ];

      await runDeleteRequestsInChunks(
        urls
      );

      if (
        editingRecordId &&
        pendingRecords.some(
          (record) =>
            record.id ===
            editingRecordId
        )
      ) {
        cancelEditingRecord();
      }

      await Promise.all([
        loadPlannedRecords(
          plannedAppliedFrom,
          plannedAppliedTo
        ),
        loadCompletedRecords(
          completedAppliedFrom,
          completedAppliedTo
        ),
      ]);

      setSuccess(
        `${pendingRecords.length} tramos planificados pendientes fueron eliminados. Los realizados se conservaron.`
      );
    } catch (err) {
      console.error(
        "Error eliminando planificación pendiente del período:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al eliminar la planificación pendiente."
      );
    } finally {
      setDeletingAllPlanned(
        false
      );
    }
  }

  async function deleteCompletedBatch(
    batchId: string,
    records: MapRoute[]
  ) {
    if (
      records.length === 0
    ) {
      return;
    }

    const confirmed =
      await requestConfirmation({
        title:
          "Eliminar trabajos de motonivelación realizados de la zona",
        message:
          `Se eliminarán ${records.length} registros realizados de esta zona.`,
        detail:
          "Usá esta opción solamente para corregir una carga realizada por error. Si estos realizados provienen de una planificación, los tramos planificados quedarán nuevamente pendientes.",
        confirmLabel:
          `Eliminar ${records.length} realizados`,
        variant:
          "danger",
      });

    if (!confirmed) {
      return;
    }

    try {
      setDeletingBatchId(
        batchId
      );
      setError(null);
      setSuccess(null);

      const urls =
        records.map(
          (record) =>
            `/api/test-grading/records?id=${encodeURIComponent(
              record.id
            )}`
        );

      await runDeleteRequestsInChunks(
        urls
      );

      if (
        editingRecordId &&
        records.some(
          (record) =>
            record.id ===
            editingRecordId
        )
      ) {
        cancelEditingRecord();
      }

      await Promise.all([
        loadPlannedRecords(
          plannedAppliedFrom,
          plannedAppliedTo
        ),
        loadCompletedRecords(
          completedAppliedFrom,
          completedAppliedTo
        ),
      ]);

      setSuccess(
        `${records.length} trabajos de motonivelación realizados de la zona fueron eliminados.`
      );
    } catch (err) {
      console.error(
        "Error eliminando realizados de la zona:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al eliminar los realizados de la zona."
      );
    } finally {
      setDeletingBatchId(
        null
      );
    }
  }

  async function deleteRecord(record: MapRoute) {
    const confirmed =
      await requestConfirmation({
        title:
          "Eliminar tramo",
        message:
          `${record.main_street} — ${record.from_street} → ${record.to_street}`,
        detail:
          record.status?.toUpperCase() ===
          "COMPLETADO"
            ? "Se eliminará este motonivelación realizado. Si provino de una planificación, el tramo planificado quedará nuevamente pendiente."
            : "Esta acción no se puede deshacer.",
        confirmLabel:
          "Eliminar tramo",
        variant:
          "danger",
      });

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(record.id);
      setError(null);
      setSuccess(null);

      const response = await fetch(
        `/api/test-grading/records?id=${encodeURIComponent(record.id)}`,
        {
          method: "DELETE",
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "No se pudo eliminar el tramo."
        );
      }

      if (editingRecordId === record.id) {
        cancelEditingRecord();
      }

      setSuccess(
        `${record.main_street} fue eliminado correctamente.`
      );

      await Promise.all([
        loadPlannedRecords(
          plannedAppliedFrom,
          plannedAppliedTo
        ),
        loadCompletedRecords(
          completedAppliedFrom,
          completedAppliedTo
        ),
      ]);
    } catch (err) {
      console.error(
        "Error eliminando tramo:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al eliminar el tramo."
      );
    } finally {
      setDeletingId(null);
    }
  }

  function clearCurrentMap() {
    setPlannedRoutes([]);
    setCompletedRoutes([]);

    setHoveredRouteId(

      null

    );

    setSelectedRouteId(

      null

    );

    setSelectedBatchId(
      null
    );

    setSuccess(null);

    setError(null);

  }

  /*

   * ==========================================================

   * RENDER

   * ==========================================================

   */

  const globalLoading =
    saving ||
    editingSaving ||
    deletingId !== null ||
    markingRealizedId !== null ||
    deletingBatchId !== null ||
    markingBatchId !== null ||
    loadingPlanned ||
    loadingCompleted ||
    loadingComplaints ||
    loadingAlltrack;

  const globalLoadingText =
    deletingBatchId !== null
      ? "Eliminando planificación por zona..."
      : markingBatchId !== null
        ? "Registrando zona como realizada..."
        : deletingId !== null
          ? "Eliminando tramo..."
          : markingRealizedId !== null
            ? "Registrando motonivelación realizado..."
            : saving
          ? "Guardando tramo..."
          : editingSaving
            ? "Guardando cambios..."
            : loadingPlanned &&
                loadingCompleted
              ? "Actualizando mapas..."
              : loadingPlanned
                ? "Cargando planificación..."
                : loadingCompleted
                  ? "Cargando trabajos de motonivelación realizados..."
                  : loadingComplaints
                    ? "Cargando reclamos de motonivelación..."
                    : loadingAlltrack
                      ? "Consultando ubicación de vehículos en All Track..."
                      : "Procesando...";

  const plannedFullscreen =
    fullscreenActive &&
    fullscreenMap === "planned";

  const completedFullscreen =
    fullscreenActive &&
    fullscreenMap === "completed";

  const complaintsFullscreen =
    fullscreenActive &&
    fullscreenMap === "complaints";

  const alltrackFullscreen =
    fullscreenActive &&
    fullscreenMap === "alltrack";

  const monitorFullscreen =
    fullscreenActive &&
    monitorMode;

  return (

    <div className="space-y-4">

      {/* =====================================================
          CENTRO DE MONITOREO - 4 MAPAS EN FULLSCREEN NATIVO
      ===================================================== */}

      <div
        ref={monitorCenterRef}
        className={
          monitorFullscreen
            ? "fixed inset-0 z-[20000] flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-white"
            : "pointer-events-none fixed -left-[10000px] top-0 h-px w-px overflow-hidden opacity-0"
        }
        style={
          monitorFullscreen
            ? {
                width: "100vw",
                height: "100dvh",
                minWidth: "100vw",
                minHeight: "100dvh",
                background: "#020617",
              }
            : undefined
        }
      >
        {monitorFullscreen && (
          <>
            <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 px-3">
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-wide text-white">
                  Centro de monitoreo de motonivelación
                </p>
                <p className="text-[10px] text-slate-400">
                  Planificación · realizado · reclamos · vehículos All Track
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <div className="hidden text-right text-[10px] leading-tight text-slate-300 sm:block" aria-live="polite">
                  <div className={monitorLastError ? "text-amber-300" : "text-slate-300"}>
                    {monitorLastError
                      ? "Error en última actualización"
                      : monitorLastUpdated
                        ? `Última actualización: ${monitorLastUpdated.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                        : "Sin actualización completa"}
                  </div>
                  <div className="text-slate-500">Automática cada 10 min</div>
                </div>
                {(monitorRefreshing || loadingPlanned ||
                  loadingCompleted ||
                  loadingComplaints ||
                  loadingAlltrack) && (
                  <span className="hidden items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 sm:flex">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-600 border-t-white" />
                    Actualizando...
                  </span>
                )}

                <button
                  type="button"
                  onClick={() =>
                    void refreshMonitorCenter()
                  }
                  disabled={
                    monitorRefreshing ||
                    loadingPlanned ||
                    loadingCompleted ||
                    loadingComplaints ||
                    loadingAlltrack ||
                    loadingAlltrackHistory
                  }
                  className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  ↻ Actualizar todo
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void closeMonitorCenter()
                  }
                  className="rounded-md border border-red-800 bg-red-950/60 px-2.5 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-900"
                >
                  ✕ Salir
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1 p-1">
              {/* PLANIFICACIÓN */}
              <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-blue-900/70 bg-white text-slate-900 shadow-xl">
                <div className="flex h-9 shrink-0 items-center justify-between border-b bg-blue-50 px-3">
                  <div>
                    <p className="text-xs font-bold text-blue-700">Planificación de motonivelación</p>
                    <p className="text-[10px] text-slate-500">{formatDateAr(plannedAppliedFrom)} al {formatDateAr(plannedAppliedTo)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {plannedAreaBatches.length > 0 && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                        {plannedAreaBatches.length} {plannedAreaBatches.length === 1 ? "zona" : "zonas"}
                      </span>
                    )}
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      {plannedRoutes.length} tramos
                    </span>
                  </div>
                </div>
                <div className="relative min-h-0 flex-1">
                  <MapContainer
                    center={GENERAL_PICO_CENTER}
                    zoom={13}
                    scrollWheelZoom
                    preferCanvas
                    className="h-full w-full"
                    style={{ width: "100%", height: "100%" }}
                  >
                    <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                    {plannedAreaBatches.flatMap(
                      (batch) => {
                        const positions =
                          areaPolygonToLeaflet(
                            batch.geometry
                          );

                        const center =
                          areaPolygonCenter(
                            batch.geometry
                          );

                        if (
                          positions.length < 3
                        ) {
                          return [];
                        }

                        const batchColor =
                          normalizeAreaColor(
                            batch.color
                          );

                        const layers = [
                          <Polygon
                            key={`monitor-planned-area-${batch.batch_id}`}
                            positions={
                              positions
                            }
                            interactive={false}
                            pathOptions={{
                              color:
                                batchColor,
                              weight: 4,
                              opacity: 0.95,
                              fillColor:
                                batchColor,
                              fillOpacity:
                                0.24,
                            }}
                          />,
                        ];

                        if (center) {
                          layers.push(
                            <Marker
                              key={`monitor-planned-area-label-${batch.batch_id}`}
                              position={
                                center
                              }
                              icon={createAreaPlanningLabelIcon(
                                batch.observations ||
                                  "Zona planificada",
                                batchColor
                              )}
                              interactive={
                                false
                              }
                              zIndexOffset={
                                900
                              }
                            />
                          );
                        }

                        return layers;
                      }
                    )}

                    {plannedRoutes.map((record) => (
                      <Polyline
                        key={`monitor-planned-${record.id}`}
                        positions={record.positions}
                        smoothFactor={2}
                        pathOptions={{
                          color:
                            record.result_status === "NO_REALIZADO" ? "#dc2626" : "#2563eb",
                          weight: 3,
                          opacity: 0.9,
                          
                        }}
                      >
                        <Popup>
                          <div className="min-w-[190px]">
                            <p className="font-bold">{record.main_street}</p>
                            <p className="mt-1 text-sm"><strong>Desde:</strong> {record.from_street}</p>
                            <p className="text-sm"><strong>Hasta:</strong> {record.to_street}</p>
                            <p className="mt-1 text-sm"><strong>Fecha:</strong> {formatDateAr(record.work_date)}</p>
                            
                          </div>
                        </Popup>
                      </Polyline>
                    ))}
                    <FitRoutes routes={plannedRoutesToFit} />
                    <InvalidateMapOnFullscreen fullscreen={monitorFullscreen} />

                    <InvalidateMapOnResize />
                  </MapContainer>
                </div>
              </div>

              {/* REALIZADO */}
              <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-emerald-900/70 bg-white text-slate-900 shadow-xl">
                <div className="flex h-9 shrink-0 items-center justify-between border-b bg-emerald-50 px-3">
                  <div>
                    <p className="text-xs font-bold text-emerald-700">Motonivelación realizado</p>
                    <p className="text-[10px] text-slate-500">{formatDateAr(completedAppliedFrom)} al {formatDateAr(completedAppliedTo)}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{completedRoutes.length} tramos</span>
                </div>
                <div className="relative min-h-0 flex-1">
                  <MapContainer
                    center={GENERAL_PICO_CENTER}
                    zoom={13}
                    scrollWheelZoom
                    preferCanvas
                    className="h-full w-full"
                    style={{ width: "100%", height: "100%" }}
                  >
                    <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {completedRoutes.map((record) => (
                      <Polyline
                        key={`monitor-completed-${record.id}`}
                        positions={record.positions}
                        smoothFactor={2}
                        pathOptions={{
                          color: record.color,
                          weight: 3,
                          opacity: 0.9,
                          
                        }}
                      >
                        <Popup>
                          <div className="min-w-[190px]">
                            <p className="font-bold">{record.main_street}</p>
                            <p className="mt-1 text-sm"><strong>Desde:</strong> {record.from_street}</p>
                            <p className="text-sm"><strong>Hasta:</strong> {record.to_street}</p>
                            <p className="mt-1 text-sm"><strong>Fecha:</strong> {formatDateAr(record.work_date)}</p>
                            
                          </div>
                        </Popup>
                      </Polyline>
                    ))}
                    <FitRoutes routes={completedRoutesToFit} />
                    <InvalidateMapOnFullscreen fullscreen={monitorFullscreen} />

                    <InvalidateMapOnResize />
                  </MapContainer>
                </div>
              </div>

              {/* RECLAMOS */}
              <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-amber-900/70 bg-white text-slate-900 shadow-xl">
                <div className="flex h-9 shrink-0 items-center justify-between border-b bg-amber-50 px-3">
                  <div>
                    <p className="text-xs font-bold text-amber-700">Reclamos georreferenciados de motonivelación</p>
                    <p className="text-[10px] text-slate-500">{formatDateAr(complaintsAppliedFrom)} al {formatDateAr(complaintsAppliedTo)}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{sweepingComplaints.length} ubicados</span>
                </div>
                <div className="relative min-h-0 flex-1">
                  <MapContainer
                    center={GENERAL_PICO_CENTER}
                    zoom={13}
                    scrollWheelZoom
                    className="h-full w-full"
                    style={{ width: "100%", height: "100%" }}
                  >
                    <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {sweepingComplaints.map((complaint) => {
                      const status = (complaint.status ?? "").toLowerCase();
                      const color =
                        status.includes("resuelto") && !status.includes("no resuelto")
                          ? "#16a34a"
                          : status.includes("no resuelto")
                            ? "#dc2626"
                            : "#f59e0b";
                      return (
                        <Marker
                          key={`monitor-complaint-${complaint.id}`}
                          position={[complaint.lat, complaint.lng]}
                          icon={createComplaintPinIcon(color)}
                        >
                          <Popup>
                            <div className="min-w-[220px] space-y-2">
                              <p className="font-semibold">Reclamo #{complaint.id}</p>
                              <p className="text-sm"><strong>Dirección:</strong> {complaint.address ?? "Sin calle"} {complaint.street_number ?? ""}</p>
                              <p className="text-sm"><strong>Fecha:</strong> {formatDateAr(complaint.complaint_date)}</p>
                              <p className="text-sm"><strong>Estado:</strong> {complaint.status ?? "-"}</p>
                              {complaint.details && (
                                <p className="text-sm leading-relaxed"><strong>Detalle:</strong> {complaint.details}</p>
                              )}
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                    <FitComplaintPoints complaints={sweepingComplaints} />
                    <InvalidateMapOnFullscreen fullscreen={monitorFullscreen} />

                    <InvalidateMapOnResize />
                  </MapContainer>
                </div>
              </div>

              {/* ALL TRACK */}
              <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-sky-900/70 bg-white text-slate-900 shadow-xl">
                <div className="flex min-h-9 shrink-0 items-center justify-between gap-2 border-b bg-sky-50 px-2 py-1">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-sky-700">
                      Vehículos de motonivelación · All Track
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {alltrackViewMode === "current"
                        ? "Ubicación actual de la flota de motonivelación"
                        : `Recorrido de hoy · ${selectedAlltrackVehicleCode}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        void showAlltrackCurrentView()
                      }
                      className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition ${
                        alltrackViewMode === "current"
                          ? "border-sky-600 bg-sky-600 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Ubicación actual
                    </button>

                    <details className="group relative">
                      <summary
                        className={`cursor-pointer list-none rounded-md border px-2 py-1 text-[10px] font-semibold transition [&::-webkit-details-marker]:hidden ${
                          alltrackViewMode === "today"
                            ? "border-sky-600 bg-sky-600 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        Recorrido de hoy
                        <span className="ml-1 inline-block transition-transform group-open:rotate-180">
                          ▾
                        </span>
                      </summary>

                      <div className="absolute right-0 top-full z-[25000] mt-1.5 min-w-[220px] overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5 shadow-2xl">
                        <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Seleccionar vehículo
                        </p>

                        {["M.C.1", "M.C.2", "M.C.3", "M.C.4", "M.C.5", "M.C.6"].map((code) => {
                          const vehicle =
                            alltrackVehicles.find(
                              (item) =>
                                item.code === code
                            );

                          return (
                            <button
                              key={`monitor-history-${code}`}
                              type="button"
                              onClick={(event) => {
                                event.currentTarget
                                  .closest("details")
                                  ?.removeAttribute("open");

                                void selectAlltrackHistoryVehicle(
                                  code
                                );
                              }}
                              className={`flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition hover:bg-slate-100 ${
                                alltrackViewMode === "today" &&
                                selectedAlltrackVehicleCode === code
                                  ? "bg-sky-50"
                                  : ""
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-slate-800">
                                  {code}
                                </p>
                                <p className="truncate text-[10px] text-slate-500">
                                  {vehicle?.vehicle?.name ??
                                    "Vehículo de motonivelación"}
                                </p>
                              </div>

                              {alltrackViewMode === "today" &&
                                selectedAlltrackVehicleCode === code && (
                                  <span className="text-xs font-bold text-sky-600">
                                    ✓
                                  </span>
                                )}
                            </button>
                          );
                        })}
                      </div>
                    </details>

                    {alltrackViewMode === "current" ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                        {alltrackLocated} ubicados
                      </span>
                    ) : loadingAlltrackHistory ? (
                      <span className="flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                        <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700" />
                        Cargando
                      </span>
                    ) : alltrackHistory ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                        {alltrackHistory.data.summary.distance_km.toLocaleString(
                          "es-AR",
                          {
                            maximumFractionDigits: 2,
                          }
                        )} km · {alltrackHistory.data.stops.length} paradas
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="relative min-h-0 flex-1">
                  <MapContainer
                    center={GENERAL_PICO_CENTER}
                    zoom={13}
                    scrollWheelZoom
                    className="h-full w-full"
                    style={{ width: "100%", height: "100%" }}
                  >
                    <TileLayer
                      attribution='&copy; OpenStreetMap contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {alltrackViewMode === "current" ? (
                      <>
                        {alltrackVehicles.map((item) => {
                          if (
                            !item.available_position ||
                            !item.position
                          ) {
                            return null;
                          }

                          const freshness =
                            getAlltrackFreshness(
                              item.position.date,
                              item.position.time
                            );

                          return (
                            <Marker
                              key={`monitor-alltrack-${item.code}`}
                              position={[
                                item.position.lat,
                                item.position.lng,
                              ]}
                              icon={createAlltrackVehicleIcon(
                                item.code,
                                freshness.color
                              )}
                            >
                              <Popup>
                                <div className="min-w-[210px] space-y-1">
                                  <p className="font-bold">{item.code}</p>
                                  <p className="text-sm">
                                    {item.vehicle?.name ??
                                      "Vehículo de motonivelación"}
                                  </p>
                                  <p className="text-sm">
                                    <strong>Estado:</strong>{" "}
                                    {item.position.status ?? "-"}
                                  </p>
                                  <p className="text-sm">
                                    <strong>Velocidad:</strong>{" "}
                                    {item.position.speed ?? 0} km/h
                                  </p>
                                  <p className="text-sm">
                                    <strong>Última posición:</strong>{" "}
                                    {item.position.date ?? "-"}{" "}
                                    {item.position.time ?? ""}
                                  </p>
                                </div>
                              </Popup>
                            </Marker>
                          );
                        })}

                        <FitAlltrackVehicles
                          vehicles={alltrackVehicles}
                        />
                      </>
                    ) : (
                      <>
                        {(alltrackHistory?.data.route?.paths ?? []).map(
                          (path, index) => {
                            const positions = path
                              .map(
                                (point) =>
                                  [
                                    Number(point.lat),
                                    Number(point.lon),
                                  ] as [number, number]
                              )
                              .filter(
                                ([lat, lng]) =>
                                  Number.isFinite(lat) &&
                                  Number.isFinite(lng)
                              );

                            if (positions.length < 2) {
                              return null;
                            }

                            return (
                              <Polyline
                                key={`monitor-history-path-${index}`}
                                positions={positions}
                                pathOptions={{
                                  color: "#0284c7",
                                  weight: 4,
                                  opacity: 0.95,
                                }}
                                smoothFactor={1.5}
                              />
                            );
                          }
                        )}

                        {(alltrackHistory?.data.stops ?? []).map(
                          (stop, index) => (
                            <Marker
                              key={`monitor-history-stop-${index}`}
                              position={[
                                stop.lat,
                                stop.lng,
                              ]}
                              icon={createAlltrackStopIcon(
                                stop.minutes
                              )}
                            >
                              <Popup>
                                <div className="min-w-[205px] space-y-1.5">
                                  <p className="font-semibold">
                                    Detención del vehículo
                                  </p>
                                  <p className="text-sm">
                                    <strong>Desde:</strong>{" "}
                                    {stop.from_time ?? "-"}
                                  </p>
                                  <p className="text-sm">
                                    <strong>Hasta:</strong>{" "}
                                    {stop.to_time ?? "-"}
                                  </p>
                                  <p className="text-sm">
                                    <strong>Duración:</strong>{" "}
                                    {stop.minutes !== null
                                      ? `${stop.minutes} minutos`
                                      : "-"}
                                  </p>

                                  {false &&
                                    stop.validation === "spatial_b6" && (
                                      <p className="border-t pt-1.5 text-xs text-slate-500">
                                        Parada validada por quietud real de la motoniveladora.
                                      </p>
                                    )}
                                </div>
                              </Popup>
                            </Marker>
                          )
                        )}

                        {(() => {
                          const points =
                            alltrackHistory?.data.route?.points ?? [];

                          if (points.length === 0) {
                            return null;
                          }

                          const first = points[0];
                          const last = points[points.length - 1];

                          return (
                            <>
                              <Marker
                                position={[first.lat, first.lon]}
                                icon={createAlltrackEndpointIcon(
                                  "I",
                                  "#16a34a"
                                )}
                              >
                                <Popup>
                                  <strong>Inicio del recorrido</strong>
                                  <br />
                                  {first.time ?? "-"}
                                </Popup>
                              </Marker>

                              <Marker
                                position={[last.lat, last.lon]}
                                icon={createAlltrackEndpointIcon(
                                  "F",
                                  "#dc2626"
                                )}
                              >
                                <Popup>
                                  <strong>
                                    Fin / última posición del recorrido
                                  </strong>
                                  <br />
                                  {last.time ?? "-"}
                                </Popup>
                              </Marker>
                            </>
                          );
                        })()}

                        <FitAlltrackHistory
                          paths={
                            alltrackHistory?.data.route?.paths ?? []
                          }
                          stops={
                            alltrackHistory?.data.stops ?? []
                          }
                        />
                      </>
                    )}

                    <InvalidateMapOnFullscreen
                      fullscreen={monitorFullscreen}
                    />
                    <InvalidateMapOnResize />
                  </MapContainer>

                  {alltrackViewMode === "today" &&
                    loadingAlltrackHistory && (
                      <div className="pointer-events-none absolute inset-0 z-[900] flex items-center justify-center bg-white/45 backdrop-blur-[1px]">
                        <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg">
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
                          Cargando recorrido de {selectedAlltrackVehicleCode}...
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* =====================================================
          MODAL DE CONFIRMACIÓN
      ===================================================== */}

      {confirmDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sweeping-confirm-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border bg-background shadow-2xl"
          >
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                    confirmDialog.variant ===
                    "danger"
                      ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                      : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                  }`}
                >
                  <span className="text-xl font-bold">
                    {confirmDialog.variant ===
                    "danger"
                      ? "!"
                      : "✓"}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <h3
                    id="sweeping-confirm-title"
                    className="text-base font-semibold"
                  >
                    {confirmDialog.title}
                  </h3>

                  <p className="mt-2 text-sm font-medium">
                    {confirmDialog.message}
                  </p>

                  {confirmDialog.detail && (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {confirmDialog.detail}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-5 py-4">
              <button
                type="button"
                onClick={() =>
                  closeConfirmation(
                    false
                  )
                }
                className="rounded-lg border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() =>
                  closeConfirmation(
                    true
                  )
                }
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                  confirmDialog.variant ===
                  "danger"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {confirmDialog.confirmLabel ??
                  "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}


      {notCompletedDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="not-completed-title"
            className="w-full max-w-lg overflow-hidden rounded-2xl border bg-background shadow-2xl"
          >
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-300">
                    Motonivelación no realizado
                  </p>
                  <h3 id="not-completed-title" className="mt-1 text-base font-semibold">
                    Registrar motivo
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setNotCompletedDialog(null)}
                  className="rounded-lg border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted"
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-red-200 bg-red-50/70 p-3 dark:border-red-900 dark:bg-red-950/30">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  {notCompletedDialog.record.main_street}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {notCompletedDialog.record.from_street} → {notCompletedDialog.record.to_street}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Fecha planificada: {formatDateAr(notCompletedDialog.record.work_date)}
                </p>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="not-completed-observation"
                  className="text-sm font-medium"
                >
                  Motivo / observación
                </label>

                <textarea
                  id="not-completed-observation"
                  value={notCompletedDialog.observation}
                  onChange={(event) =>
                    setNotCompletedDialog((current) =>
                      current
                        ? {
                            ...current,
                            observation: event.target.value.slice(0, 500),
                            error: null,
                          }
                        : current
                    )
                  }
                  rows={4}
                  maxLength={500}
                  className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  placeholder="Ej.: No se pudo realizar por vehículos estacionados."
                />

                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>La observación es obligatoria.</span>
                  <span>{notCompletedDialog.observation.trim().length}/500</span>
                </div>

                {notCompletedDialog.error && (
                  <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-300">
                    {notCompletedDialog.error}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-5 py-4">
              <button
                type="button"
                onClick={() => setNotCompletedDialog(null)}
                className="rounded-lg border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void submitNotCompletedDialog()}
                disabled={markingRealizedId !== null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {markingRealizedId === notCompletedDialog.record.id ? "Guardando..." : "Guardar como no realizado"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          PANTALLA DE CARGA
      ===================================================== */}

      {globalLoading &&
        !confirmDialog && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/25 px-4 backdrop-blur-[1px]">
            <div className="flex min-w-[250px] items-center gap-4 rounded-2xl border bg-background px-5 py-4 shadow-2xl">
              <div className="relative h-9 w-9 shrink-0">
                <div className="absolute inset-0 rounded-full border-4 border-muted" />
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-emerald-500" />
              </div>

              <div>
                <p className="text-sm font-semibold">
                  Procesando
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {globalLoadingText}
                </p>
              </div>
            </div>
          </div>
        )}

      {/* =====================================================
          NOTIFICACIONES
      ===================================================== */}

      {(success || error) &&
        !confirmDialog && (
          <div className="fixed right-4 top-24 z-[9997] w-[calc(100%-2rem)] max-w-sm">
            <div
              className={`overflow-hidden rounded-2xl border bg-background shadow-2xl ${
                error
                  ? "border-red-200 dark:border-red-900"
                  : "border-emerald-200 dark:border-emerald-900"
              }`}
            >
              <div className="flex items-start gap-3 p-4">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    error
                      ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                      : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                  }`}
                >
                  <span className="text-base font-bold">
                    {error
                      ? "!"
                      : "✓"}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold ${
                      error
                        ? "text-red-700 dark:text-red-300"
                        : "text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    {error
                      ? "Ocurrió un problema"
                      : "Operación realizada"}
                  </p>

                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {error ?? success}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                  }}
                  aria-label="Cerrar notificación"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  ×
                </button>
              </div>

              <div
                className={`h-1 w-full ${
                  error
                    ? "bg-red-500"
                    : "bg-emerald-500"
                }`}
              />
            </div>
          </div>
        )}

      {readOnly && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 shadow-sm dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
          Estás viendo el Mapa de Motonivelación en modo solo lectura. Podés consultar mapas, filtros e histórico, pero no crear, editar ni eliminar tramos.
        </div>
      )}

      {/* =====================================================

          CARGA

      ===================================================== */}

      {!readOnly && (
      <div
        id="sweeping-editor-form"
        className="scroll-mt-24 rounded-xl border bg-background p-4 shadow-sm"
      >

        <div className="mb-4">

          <h2 className="text-lg font-semibold">

            Mapa de Motonivelación

          </h2>

          <p className="text-sm text-muted-foreground">

            Agregá los tramos que se van motonivelando.

            Podés calcularlos por calles, dibujarlos

            manualmente o seleccionar una zona para detectar sus calles automáticamente.

          </p>

        </div>

        {editingRecordId && (
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/30">
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Editando tramo
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ya cargamos sus datos arriba. Podés modificar las calles y guardar, o elegir “Dibujar trazado libre” para reemplazar el recorrido.
              </p>
            </div>

            <button
              type="button"
              onClick={cancelEditingRecord}
              disabled={editingSaving}
              className="shrink-0 rounded-md border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
            >
              Cancelar edición
            </button>
          </div>
        )}

        <div className="mb-4 rounded-lg border bg-muted/20 p-3">

          <p className="mb-2 text-sm font-semibold">¿Qué querés cargar?</p>

          <div className="flex flex-wrap gap-2">

            <button

              type="button"

              onClick={() => {

                setRecordStatus("PLANIFICADO");

                setDrawingManual(false);

                setManualGeometry(null);

                setManualClearToken((previous) => previous + 1);

                resetAreaSelection();
                resetMechanicalSelection();

                setError(null);

                setSuccess(null);

              }}

              className={`rounded-md border px-4 py-2 text-sm font-medium transition ${

                recordStatus === "PLANIFICADO"

                  ? "border-blue-600 bg-blue-600 text-white"

                  : "bg-background hover:bg-muted"

              }`}

            >

              Planificar motonivelación

            </button>

            <button

              type="button"

              onClick={() => {

                setRecordStatus("COMPLETADO");

                setDrawingManual(false);

                setManualGeometry(null);

                setManualClearToken((previous) => previous + 1);

                resetAreaSelection();
                resetMechanicalSelection();

                if (
                  loadMode === "area" ||
                  loadMode === "mechanical"
                ) {
                  setLoadMode("automatic");
                }

                setError(null);

                setSuccess(null);

              }}

              className={`rounded-md border px-4 py-2 text-sm font-medium transition ${

                recordStatus === "COMPLETADO"

                  ? "border-emerald-600 bg-emerald-600 text-white"

                  : "bg-background hover:bg-muted"

              }`}

            >

              Registrar motonivelación realizado

            </button>

          </div>

          <p className="mt-2 text-xs text-muted-foreground">

            {recordStatus === "PLANIFICADO"

              ? "Los tramos que cargues se mostrarán en el mapa de planificación."

              : "Los tramos que cargues se mostrarán en el mapa de motonivelación realizado."}

          </p>

        </div>

        {recordStatus === "PLANIFICADO" && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                  Período de planificación
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Este período se aplicará a cualquier modalidad: por calles, dibujo manual, zona o trazado por dos puntos. Si es para un solo día, usá la misma fecha en Desde y Hasta.
                </p>
              </div>

              <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[420px]">
                <label className="text-xs font-medium">
                  Desde
                  <input
                    type="date"
                    value={planningFrom}
                    onChange={(event) => {
                      const next = event.target.value;
                      setPlanningFrom(next);

                      if (
                        planningTo &&
                        next &&
                        planningTo < next
                      ) {
                        setPlanningTo(next);
                      }
                    }}
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </label>

                <label className="text-xs font-medium">
                  Hasta
                  <input
                    type="date"
                    value={planningTo}
                    min={planningFrom || undefined}
                    onChange={(event) =>
                      setPlanningTo(
                        event.target.value
                      )
                    }
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </label>
              </div>
            </div>

            <div className="mt-2 rounded-md border border-blue-100 bg-background/70 px-3 py-2 text-[11px] text-muted-foreground dark:border-blue-900">
              {planningFrom && planningTo
                ? planningFrom === planningTo
                  ? `Planificado para el ${formatDateAr(planningFrom)}.`
                  : `Planificado del ${formatDateAr(planningFrom)} al ${formatDateAr(planningTo)}.`
                : "Completá ambas fechas antes de guardar la planificación."}
            </div>
          </div>
        )}

        {/* ===================================================

            MODO

        =================================================== */}

        <div className="mb-4 flex flex-wrap gap-2">

          <button

            type="button"

            onClick={

              switchToAutomatic

            }

            className={`rounded-md border px-4 py-2 text-sm font-medium transition ${

              loadMode ===

              "automatic"

                ? "bg-primary text-primary-foreground"

                : "bg-background hover:bg-muted"

            }`}

          >

            Por calles

          </button>

          <button

            type="button"

            onClick={

              switchToManual

            }

            className={`rounded-md border px-4 py-2 text-sm font-medium transition ${

              loadMode ===

              "manual"

                ? "bg-primary text-primary-foreground"

                : "bg-background hover:bg-muted"

            }`}

          >

            Dibujar trazado libre

          </button>

          <button
            type="button"
            onClick={switchToArea}
            disabled={Boolean(editingRecordId)}
            title={editingRecordId ? "Terminá o cancelá la edición antes de seleccionar una zona." : undefined}
            className={`rounded-md border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              loadMode === "area"
                ? "border-blue-600 bg-blue-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Seleccionar zona
          </button>

          <button
            type="button"
            onClick={switchToMechanical}
            disabled={Boolean(editingRecordId)}
            title={
              editingRecordId
                ? "Terminá o cancelá la edición antes de crear un trazado por dos puntos."
                : "Elegí dos puntos sobre una misma calle para crear el corredor de la motoniveladora."
            }
            className={`rounded-md border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              loadMode === "mechanical"
                ? "border-orange-500 bg-orange-500 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            🚜 Trazado por dos puntos
          </button>

        </div>

        {/* ===================================================

            INPUTS

        =================================================== */}

        {loadMode !== "area" &&
         loadMode !== "mechanical" && (
        <div className="grid gap-3 lg:grid-cols-4">

          <div>

            <RequiredStreetAutocomplete

              label="Calle principal"

              value={

                street

              }

              onSelectedChange={

                setStreet

              }

              placeholder="Ej: Calle 21"

            />

          </div>

          <div>

            <RequiredStreetAutocomplete

              label="Desde calle"

              value={

                fromStreet

              }

              onSelectedChange={

                setFromStreet

              }

              placeholder="Ej: Calle 2"

            />

          </div>

          <div>

            <RequiredStreetAutocomplete

              label="Hasta calle"

              value={

                toStreet

              }

              onSelectedChange={

                setToStreet

              }

              placeholder="Ej: Calle 56"

            />

          </div>

          <div className="flex items-end">

            {loadMode ===

            "automatic" ? (

              <button

                type="button"

                onClick={
                  editingRecordId
                    ? saveEditedAutomaticSegment
                    : addStreetSegment
                }

                disabled={
                  saving ||
                  editingSaving
                }

                className="h-10 w-full rounded-md bg-emerald-500 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"

              >

                {saving || editingSaving
                  ? "Guardando..."
                  : editingRecordId
                    ? "Guardar cambios"
                    : "Agregar tramo"}

              </button>

            ) : (

              <button

                type="button"

                onClick={

                  startManualDrawing

                }

                disabled={

                  saving ||

                  drawingManual

                }

                className="h-10 w-full rounded-md bg-emerald-500 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"

              >

                {drawingManual
                  ? "Dibujando..."
                  : manualGeometry
                    ? "Dibujar de nuevo"
                    : editingRecordId
                      ? "Redibujar tramo"
                      : "Dibujar tramo"}

              </button>

            )}

          </div>

        </div>
        )}

        <LocalObservationInput
          value={observations}
          onCommit={
            setObservations
          }
        />

        {/* ===================================================

            PANEL MANUAL

        =================================================== */}

        {loadMode === "manual" && (

          <div className="mt-4 rounded-lg border bg-muted/20 p-3">

            {!drawingManual && !manualGeometry ? (

              <div>

                <p className="text-sm font-medium">

                  Dibujo manual

                </p>

                <p className="mt-1 text-sm text-muted-foreground">

                  {editingRecordId
                    ? "Presioná “Redibujar tramo” para reemplazar el recorrido actual."
                    : "Completá los datos del tramo y presioná “Dibujar tramo”."}

                </p>

                <p className="mt-1 text-xs text-muted-foreground">

                  Después hacé clic sobre el mapa para marcar los puntos del recorrido.

                  Podés arrastrar el mapa normalmente para desplazarte.

                </p>

              </div>

            ) : null}

            {drawingManual && (

              <div>

                <p className="text-sm font-semibold">

                  Dibujando tramo...

                </p>

                <p className="mt-1 text-sm text-muted-foreground">

                  Hacé clic sobre el mapa para agregar puntos. Los puntos se unen con

                  líneas rectas y podés usar varios puntos para acompañar curvas.

                </p>

                <p className="mt-1 text-xs text-muted-foreground">

                  Podés arrastrar el mapa normalmente para desplazarte. Si te equivocás,

                  usá “Deshacer último punto”. Cuando termines, presioná “Finalizar tramo”.

                </p>

                <div className="mt-3 flex flex-wrap gap-2">

                  <button

                    type="button"

                    onClick={() => {

                      setManualUndoToken(

                        (previous) => previous + 1

                      );

                    }}

                    className="rounded-md border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted"

                  >

                    Deshacer último punto

                  </button>

                  <button

                    type="button"

                    onClick={() => {

                      setManualClearToken(

                        (previous) => previous + 1

                      );

                    }}

                    className="rounded-md border border-red-200 bg-background px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"

                  >

                    Limpiar dibujo

                  </button>

                  <button

                    type="button"

                    onClick={() => {

                      setManualFinishToken(

                        (previous) => previous + 1

                      );

                    }}

                    className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"

                  >

                    Finalizar tramo

                  </button>

                  <button

                    type="button"

                    onClick={cancelManualDrawing}

                    className="rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted"

                  >

                    Cancelar dibujo

                  </button>

                </div>

              </div>

            )}

            {manualGeometry && !drawingManual && (

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <p className="text-sm font-semibold">

                    Tramo dibujado

                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">

                    Revisá la línea sobre el mapa. Si quedó bien, guardala. Si no,

                    podés volver a dibujarla.

                  </p>

                </div>

                <div className="flex flex-wrap gap-2">

                  <button

                    type="button"

                    onClick={cancelManualDrawing}

                    disabled={saving}

                    className="rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted disabled:opacity-60"

                  >

                    Cancelar

                  </button>

                  <button

                    type="button"

                    onClick={startManualDrawing}

                    disabled={saving}

                    className="rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted disabled:opacity-60"

                  >

                    Dibujar de nuevo

                  </button>

                  <button

                    type="button"

                    onClick={saveManualSegment}

                    disabled={saving || editingSaving}

                    className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"

                  >

                    {saving || editingSaving
                      ? "Guardando..."
                      : editingRecordId
                        ? "Guardar cambios"
                        : "Guardar dibujo"}

                  </button>

                </div>

              </div>

            )}

          </div>

        )}

        {loadMode === "area" && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-950/20">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                  Seleccionar zona para planificación
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Dibujá un polígono sobre el mapa de Planificación. Al finalizar, el sistema detecta automáticamente las calles que quedan dentro.
                </p>
                <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                  El color identifica visualmente la zona; las líneas azules siguen representando los tramos individuales.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {!areaDrawing && (
                  <button
                    type="button"
                    onClick={startAreaDrawing}
                    disabled={areaLoading || areaSaving}
                    className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    {areaGeometry ? "Dibujar otra zona" : "Dibujar zona"}
                  </button>
                )}

                {(areaGeometry || areaStreets.length > 0) && !areaDrawing && (
                  <button
                    type="button"
                    onClick={cancelAreaDrawing}
                    disabled={areaSaving}
                    className="rounded-md border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
                  >
                    Limpiar zona
                  </button>
                )}
              </div>
            </div>

            {areaDrawing && (
              <div className="mt-3 rounded-md border bg-background p-3">
                <p className="text-xs font-semibold">Dibujando zona...</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Hacé clic en al menos 3 puntos del mapa. Cuando cierres visualmente el sector, presioná “Finalizar zona”.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAreaUndoToken((previous) => previous + 1)}
                    className="rounded-md border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted"
                  >
                    Deshacer último punto
                  </button>

                  <button
                    type="button"
                    onClick={() => setAreaClearToken((previous) => previous + 1)}
                    className="rounded-md border border-red-200 bg-background px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900"
                  >
                    Limpiar dibujo
                  </button>

                  <button
                    type="button"
                    onClick={() => setAreaFinishToken((previous) => previous + 1)}
                    className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                  >
                    Finalizar zona
                  </button>

                  <button
                    type="button"
                    onClick={cancelAreaDrawing}
                    className="rounded-md border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {areaLoading && (
              <div className="mt-3 rounded-md border bg-background p-3 text-xs text-muted-foreground">
                Detectando calles dentro de la zona...
              </div>
            )}

            {!areaLoading && areaStreets.length > 0 && (
              <div className="mt-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md border bg-background p-2">
                    <p className="text-[10px] text-muted-foreground">Calles detectadas</p>
                    <p className="text-base font-bold">{areaStreets.length}</p>
                  </div>
                  <div className="rounded-md border bg-background p-2">
                    <p className="text-[10px] text-muted-foreground">Seleccionadas</p>
                    <p className="text-base font-bold text-blue-700">{selectedAreaStreetKeys.size}</p>
                  </div>
                  <div className="rounded-md border bg-background p-2">
                    <p className="text-[10px] text-muted-foreground">Longitud detectada</p>
                    <p className="text-base font-bold">{(areaStreets.reduce((total, item) => total + Number(item.length_meters || 0), 0) / 1000).toFixed(2)} km</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <button
                    type="button"
                    onClick={selectAllAreaStreets}
                    disabled={areaSaving}
                    className="rounded-md border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
                  >
                    Seleccionar todas
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAreaStreetKeys(new Set())}
                    disabled={areaSaving}
                    className="rounded-md border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
                  >
                    Desmarcar todas
                  </button>

                  <div className="ml-auto">
                    <p className="mb-1 text-xs font-medium">
                      Color de la zona
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {AREA_COLOR_OPTIONS.map(
                        (option) => {
                          const active =
                            areaColor ===
                            option.value;

                          return (
                            <button
                              key={
                                option.value
                              }
                              type="button"
                              title={
                                option.label
                              }
                              aria-label={`Usar color ${option.label}`}
                              onClick={() =>
                                setAreaColor(
                                  option.value
                                )
                              }
                              disabled={
                                areaSaving
                              }
                              className={`h-8 w-8 rounded-full border-2 transition hover:scale-110 disabled:opacity-50 ${
                                active
                                  ? "border-slate-900 ring-2 ring-offset-2 dark:border-white"
                                  : "border-white shadow"
                              }`}
                              style={{
                                backgroundColor:
                                  option.value,
                              }}
                            />
                          );
                        }
                      )}
                    </div>
                  </div>


                </div>

                <div className="mt-3 max-h-[300px] overflow-y-auto rounded-md border bg-background">
                  {areaStreets.map((item) => {
                    const selected = selectedAreaStreetKeys.has(item.corridor_key);
                    const autoExcluded = !isAreaStreetSelectableByDefault(item);

                    return (
                      <label
                        key={item.corridor_key}
                        className={`flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-xs last:border-b-0 ${selected ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleAreaStreet(item.corridor_key)}
                          disabled={areaSaving}
                          className="h-4 w-4"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{item.street_name}</span>
                            {autoExcluded && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                                no vehicular
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {Math.round(item.length_meters)} m dentro de la zona
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void saveAreaPlanning()}
                    disabled={areaSaving || selectedAreaStreetKeys.size === 0}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {areaSaving
                      ? "Creando planificación..."
                      : `Crear planificación (${selectedAreaStreetKeys.size})`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {loadMode === "mechanical" && (
          <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50/50 p-3 dark:border-orange-900 dark:bg-orange-950/20">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                  Planificación de motonivelación por dos puntos
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Elegí dos puntos A y B. El sistema los ajusta a la red vial y busca el recorrido conectado entre ambos; puede atravesar varias piezas o calles si la cartografía lo necesita.
                </p>
                <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                  El trazado por dos puntos queda naranja y discontinuo para identificarlo en el mapa.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {!mechanicalSelecting && (
                  <button
                    type="button"
                    onClick={startMechanicalSelection}
                    disabled={
                      mechanicalLoading ||
                      mechanicalSaving
                    }
                    className="rounded-md bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                  >
                    {mechanicalPreview
                      ? "Elegir otros 2 puntos"
                      : "Seleccionar 2 puntos"}
                  </button>
                )}

                {(mechanicalStartPoint ||
                  mechanicalPreview) &&
                  !mechanicalSelecting && (
                    <button
                      type="button"
                      onClick={resetMechanicalSelection}
                      disabled={mechanicalSaving}
                      className="rounded-md border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
                    >
                      Limpiar
                    </button>
                  )}
              </div>
            </div>

            {mechanicalSelecting && (
              <div className="mt-3 rounded-md border border-orange-200 bg-background p-3">
                <p className="text-xs font-semibold text-orange-700">
                  {!mechanicalStartPoint
                    ? "1. Hacé click en el punto inicial del corredor."
                    : "2. Hacé click en el punto final sobre la misma calle."}
                </p>

                <button
                  type="button"
                  onClick={resetMechanicalSelection}
                  className="mt-2 rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted"
                >
                  Cancelar selección
                </button>
              </div>
            )}

            {mechanicalLoading && (
              <div className="mt-3 rounded-md border bg-background p-3 text-xs text-muted-foreground">
                Detectando calle y calculando corredor real...
              </div>
            )}

            {!mechanicalLoading &&
              mechanicalPreview && (
                <div className="mt-3 rounded-lg border border-orange-200 bg-background p-3">
                  <div className="grid gap-2 md:grid-cols-4">
                    <div className="rounded-md border bg-orange-50/40 p-2 dark:bg-orange-950/20">
                      <p className="text-[10px] text-muted-foreground">
                        Corredor detectado
                      </p>
                      <p className="mt-1 text-sm font-bold text-orange-700 dark:text-orange-300">
                        {mechanicalPreview.street_name}
                      </p>
                      {mechanicalPreview.streets_used &&
                        mechanicalPreview.streets_used.length > 1 && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Vías utilizadas:{" "}
                            {mechanicalPreview.streets_used.join(
                              " → "
                            )}
                          </p>
                        )}
                    </div>

                    <div className="rounded-md border p-2">
                      <p className="text-[10px] text-muted-foreground">Desde</p>
                      <p className="mt-1 text-xs font-semibold">
                        {mechanicalPreview.from_street}
                      </p>
                    </div>

                    <div className="rounded-md border p-2">
                      <p className="text-[10px] text-muted-foreground">Hasta</p>
                      <p className="mt-1 text-xs font-semibold">
                        {mechanicalPreview.to_street}
                      </p>
                    </div>

                    <div className="rounded-md border p-2">
                      <p className="text-[10px] text-muted-foreground">Longitud</p>
                      <p className="mt-1 text-sm font-bold">
                        {(Number(
                          mechanicalPreview.length_meters
                        ) / 1000).toFixed(2)} km
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void saveMechanicalCorridor()
                      }
                      disabled={mechanicalSaving}
                      className="h-9 rounded-md bg-orange-500 px-4 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                    >
                      {mechanicalSaving
                        ? "Guardando corredor..."
                        : "Guardar trazado por dos puntos"}
                    </button>
                  </div>
                </div>
              )}
          </div>
        )}



      </div>

      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={openWorkOrderDialog}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 dark:border-emerald-800"
        >
          <span aria-hidden="true">
            📄
          </span>
          Generar orden de trabajo
        </button>

        <button
          type="button"
          onClick={() =>
            void openMonitorCenter()
          }
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:border-slate-700"
        >
          <span className="grid grid-cols-2 gap-0.5">
            <span className="h-1.5 w-1.5 rounded-[1px] bg-blue-400" />
            <span className="h-1.5 w-1.5 rounded-[1px] bg-emerald-400" />
            <span className="h-1.5 w-1.5 rounded-[1px] bg-amber-400" />
            <span className="h-1.5 w-1.5 rounded-[1px] bg-sky-400" />
          </span>
          Centro de monitoreo
        </button>
      </div>

      {workOrderOpen && (
        <div className="fixed inset-0 z-[19000] flex items-center justify-center bg-black/55 p-3 backdrop-blur-[1px]">
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-bold">
                  Orden de trabajo de motonivelación
                </h2>

                <p className="mt-1 text-xs text-muted-foreground">
                  Elegí la fecha y el tipo de motonivelación. El PDF incluye únicamente la planificación correspondiente a ese día.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setWorkOrderOpen(false)
                }
                className="rounded-md border px-3 py-1.5 text-xs font-semibold transition hover:bg-muted"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-[220px_1fr] md:items-end">
                <label className="text-xs font-semibold">
                  Fecha de trabajo
                  <input
                    type="date"
                    value={workOrderDate}
                    onChange={(event) =>
                      setWorkOrderDate(
                        event.target.value
                      )
                    }
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </label>

                <div>
                  <p className="mb-1 text-xs font-semibold">
                    Tipo de trazado
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {([
                      ["ALL", "Todos"],
                      ["MANUAL", "✏️ Trazado libre"],
                      ["MECANICO", "🚜 Por puntos"],
                    ] as const).map(
                      ([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setWorkOrderType(
                              value
                            )
                          }
                          className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                            workOrderType === value
                              ? value === "MECANICO"
                                ? "border-orange-500 bg-orange-500 text-white"
                                : value === "MANUAL"
                                  ? "border-blue-600 bg-blue-600 text-white"
                                  : "border-slate-700 bg-slate-800 text-white"
                              : "bg-background hover:bg-muted"
                          }`}
                        >
                          {label}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  {workOrderLoading ? (
                    <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                      Cargando planificación del día...
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      La vista previa se actualiza automáticamente al cambiar la fecha. Los filtros por tipo de trazado se actualizan al instante.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Mostrados
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {workOrderType === "MECANICO"
                      ? filteredWorkOrderRoutes.length
                      : workOrderType === "MANUAL"
                        ? selectedWorkOrderManualRoutes.length
                        : selectedWorkOrderManualRoutes.length +
                          workOrderMechanicalCount}
                  </p>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                  <p className="text-[10px] uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    Trazado libre del día
                  </p>
                  <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {workOrderManualCount}
                  </p>
                </div>

                <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3 dark:border-orange-900 dark:bg-orange-950/20">
                  <p className="text-[10px] uppercase tracking-wide text-orange-700 dark:text-orange-300">
                    Por puntos del día
                  </p>
                  <p className="mt-1 text-2xl font-bold text-orange-700 dark:text-orange-300">
                    {workOrderMechanicalCount}
                  </p>
                </div>
              </div>

              {workOrderType !== "MECANICO" &&
                workOrderAreaBatches.length > 0 && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Zonas a incluir en el PDF
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Desmarcá las zonas que no querés imprimir. El preview, el mapa y el detalle respetan esta selección.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWorkOrderBatchIds(
                              new Set(
                                workOrderAreaBatches.map(
                                  (batch) => batch.batch_id
                                )
                              )
                            );
                            setWorkOrderManualView(null);
                            setWorkOrderFitToken(
                              (value) => value + 1
                            );
                          }}
                          className="rounded-md border bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 dark:bg-slate-950 dark:text-slate-200"
                        >
                          Seleccionar todas
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWorkOrderBatchIds(
                              new Set()
                            );
                            setWorkOrderManualView(null);
                            setWorkOrderFitToken(
                              (value) => value + 1
                            );
                          }}
                          className="rounded-md border bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 dark:bg-slate-950 dark:text-slate-200"
                        >
                          Desmarcar todas
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {workOrderAreaBatches.map(
                        (batch) => {
                          const selected =
                            selectedWorkOrderBatchIds.has(
                              batch.batch_id
                            );
                          const color =
                            normalizeAreaColor(
                              batch.color
                            );
                          const label =
                            batch.observations?.trim() ||
                            "Zona planificada";

                          return (
                            <label
                              key={`work-order-zone-selector-${batch.batch_id}`}
                              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                selected
                                  ? "border-blue-400 bg-white shadow-sm dark:bg-slate-950"
                                  : "border-slate-200 bg-slate-100/70 text-slate-500 dark:border-slate-800 dark:bg-slate-900/60"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => {
                                  setSelectedWorkOrderBatchIds(
                                    (current) => {
                                      const next =
                                        new Set(current);

                                      if (
                                        next.has(
                                          batch.batch_id
                                        )
                                      ) {
                                        next.delete(
                                          batch.batch_id
                                        );
                                      } else {
                                        next.add(
                                          batch.batch_id
                                        );
                                      }

                                      return next;
                                    }
                                  );

                                  setWorkOrderManualView(null);
                                  setWorkOrderFitToken(
                                    (value) => value + 1
                                  );
                                }}
                                className="h-4 w-4"
                              />

                              <span
                                className="h-3 w-3 rounded-full border border-white shadow-sm"
                                style={{
                                  backgroundColor: color,
                                }}
                              />

                              <span>{label}</span>
                            </label>
                          );
                        }
                      )}
                    </div>

                    <p className="mt-3 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                      {selectedWorkOrderBatchIds.size} de {workOrderAreaBatches.length} zonas seleccionadas
                    </p>
                  </div>
                )}

              <div className="mt-4 overflow-hidden rounded-xl border bg-white">
                <div className="border-b bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        Vista del PDF
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Mové el mapa y usá + / - hasta dejarlo exactamente como querés que salga exportado.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                        Zoom{" "}
                        {workOrderPreviewView
                          ? workOrderPreviewView.zoom.toFixed(0)
                          : "-"}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setWorkOrderFitToken(
                            (value) =>
                              value + 1
                          )
                        }
                        disabled={
                          workOrderPreviewRoutes.length === 0
                        }
                        className="rounded-md border bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                      >
                        ⛶ Ajustar al trabajo
                      </button>

                      <span className="rounded-full border bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                        {formatDateAr(workOrderDate)}
                      </span>
                    </div>
                  </div>

                  {workOrderType === "ALL" &&
                    workOrderManualCount > 0 &&
                    workOrderMechanicalCount > 0 && (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setWorkOrderPreviewKind(
                              "MANUAL"
                            )
                          }
                          className={`rounded-md border px-3 py-1.5 text-[11px] font-semibold transition ${
                            workOrderPreviewKind === "MANUAL"
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          ✏️ Vista trazado libre
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setWorkOrderPreviewKind(
                              "MECANICO"
                            )
                          }
                          className={`rounded-md border px-3 py-1.5 text-[11px] font-semibold transition ${
                            workOrderPreviewKind === "MECANICO"
                              ? "border-orange-500 bg-orange-500 text-white"
                              : "bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          🚜 Vista trazado por puntos
                        </button>
                      </div>
                    )}

                  {workOrderPreviewKind === "MANUAL" &&
                    workOrderPreviewAreas.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 pt-3">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Zonas mostradas
                        </span>

                        {workOrderPreviewAreas.map(
                          (batch) => {
                            const color =
                              normalizeAreaColor(
                                batch.color
                              );

                            const label =
                              batch.observations?.trim() ||
                              "Zona planificada";

                            return (
                              <div
                                key={`work-order-preview-legend-${batch.batch_id}`}
                                className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"
                              >
                                <span
                                  className="h-3 w-3 rounded-full border border-white shadow-sm"
                                  style={{
                                    backgroundColor:
                                      color,
                                  }}
                                />
                                <span>
                                  {label}
                                </span>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                </div>

                <div
                  ref={workOrderMapRef}
                  className="relative w-full bg-white"
                  style={{
                    aspectRatio: "5 / 3",
                  }}
                >
                  {workOrderLoading && (
                    <div className="absolute inset-0 z-[1500] flex items-center justify-center bg-white/80 backdrop-blur-[1px]">
                      <div className="flex items-center gap-2 rounded-lg border bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-r-transparent" />
                        Cargando mapa del día...
                      </div>
                    </div>
                  )}

                  <MapContainer
                    center={GENERAL_PICO_CENTER}
                    zoom={13}
                    scrollWheelZoom
                    preferCanvas
                    className="h-full w-full"
                    style={{
                      width: "100%",
                      height: "100%",
                    }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      crossOrigin="anonymous"
                    />

                    {workOrderPreviewAreas.flatMap(
                      (batch) => {
                        const positions =
                          areaPolygonToLeaflet(
                            batch.geometry
                          );

                        if (positions.length < 3) {
                          return [];
                        }

                        const color =
                          normalizeAreaColor(
                            batch.color
                          );

                        return [
                          <Polygon
                            key={`work-order-area-${batch.batch_id}`}
                            positions={positions}
                            interactive={false}
                            pathOptions={{
                              color,
                              weight: 4,
                              opacity: 0.95,
                              fillColor: color,
                              fillOpacity: 0.22,
                            }}
                          />,
                        ];
                      }
                    )}

                    {workOrderPreviewRoutes.map(
                      (record) => (
                        <Polyline
                          key={`work-order-route-${record.id}`}
                          positions={record.positions}
                          interactive={false}
                          pathOptions={{
                            color: "#2563eb",
                            weight: 5,
                            opacity: 0.95,
                            lineCap: "round",
                            lineJoin: "round",
                          }}
                        />
                      )
                    )}

                    <WorkOrderPreviewController
                      routes={workOrderPreviewRoutes}
                      savedView={workOrderPreviewView}
                      fitToken={workOrderFitToken}
                      viewKey={`${workOrderDate}-${workOrderPreviewKind}`}
                      onViewChange={(view) => {
                        if (
                          workOrderPreviewKind ===
                          "MANUAL"
                        ) {
                          setWorkOrderManualView(
                            view
                          );
                        } else {
                          setWorkOrderMechanicalView(
                            view
                          );
                        }
                      }}
                    />
                  </MapContainer>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-slate-50 px-4 py-2.5">
                  <p className="text-[11px] text-slate-600">
                    La posición, el zoom y el encuadre exacto que dejás acá se usan en el PDF.
                  </p>

                  <p className="text-[11px] font-semibold text-slate-700">
                    {workOrderPreviewKind === "MANUAL"
                      ? "✏️ Vista de trazado libre guardada"
                      : "🚛 Vista mecánica guardada"}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">
                      Tareas incluidas
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Este listado será incorporado a la orden de trabajo.
                    </p>
                  </div>

                  <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold">
                    {filteredWorkOrderRoutes.length}{" "}
                    {filteredWorkOrderRoutes.length === 1
                      ? "tramo"
                      : "tramos"}
                  </span>
                </div>

                {filteredWorkOrderRoutes.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    {workOrderType === "MECANICO"
                      ? "No hay trabajos de motonivelación por puntos planificados para esta fecha."
                      : workOrderType === "MANUAL"
                        ? "No hay trabajos de motonivelación por trazado libre planificados para esta fecha."
                        : "No hay trabajos de motonivelación planificados para esta fecha."}
                  </div>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {filteredWorkOrderRoutes.map(
                      (record, index) => (
                        <div
                          key={`work-order-list-${record.id}`}
                          className={`rounded-lg border px-3 py-2 ${
                            record.sweeping_type === "MECANICO"
                              ? "border-orange-200 bg-orange-50/40 dark:border-orange-900 dark:bg-orange-950/20"
                              : "border-blue-100 bg-blue-50/30 dark:border-blue-950 dark:bg-blue-950/10"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold">
                              {index + 1}.{" "}
                              {record.main_street}
                            </span>

                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                                record.sweeping_type === "MECANICO"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {record.sweeping_type === "MECANICO"
                                ? "🚜 Por puntos"
                                : "✏️ Trazado libre"}
                            </span>
                          </div>

                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {record.from_street} →{" "}
                            {record.to_street}
                          </p>

                          {record.observations?.trim() && (
                            <p className="mt-1 text-[11px]">
                              <strong>Observación:</strong>{" "}
                              {record.observations.trim()}
                            </p>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-5 py-4">
              <p className="text-[11px] text-muted-foreground">
                El PDF se genera con la planificación guardada para la fecha seleccionada.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setWorkOrderOpen(false)
                  }
                  className="rounded-md border bg-background px-4 py-2 text-xs font-semibold transition hover:bg-muted"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void generateWorkOrderPdf()
                  }
                  disabled={
                    workOrderGenerating ||
                    workOrderLoading ||
                    filteredWorkOrderRoutes.length === 0
                  }
                  className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {workOrderGenerating
                    ? "Generando PDF..."
                    : "📄 Generar PDF"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================

          MAPAS: PLANIFICADO / REALIZADO

      ===================================================== */}

      <div className="grid gap-4 xl:grid-cols-2">

        {/* ================= PLANIFICADO ================= */}

        <div className="relative isolate z-0 overflow-hidden rounded-xl border bg-background shadow-sm">

          <div className="border-b p-4">

            <div className="flex items-center justify-between gap-3">

              <div>

                <h3 className="font-semibold text-blue-700">Planificación de motonivelación</h3>

                <p className="mt-1 text-xs text-muted-foreground">

                  Tramos previstos para el período seleccionado. Podés consultar hasta 180 días.

                </p>

              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">

                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">

                  {plannedRoutes.length} {plannedRoutes.length === 1 ? "tramo" : "tramos"}

                </span>

                <button
                  type="button"
                  onClick={() =>
                    void toggleMapFullscreen(
                      "planned"
                    )
                  }
                  className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
                >
                  ⛶ Pantalla completa
                </button>

              </div>

            </div>

          </div>

          <div className="border-b bg-blue-50/40 p-3 dark:bg-blue-950/10">
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={plannedFilterToday}
                disabled={loadingPlanned}
                className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
              >
                Hoy
              </button>

              <button
                type="button"
                onClick={plannedFilterThisWeek}
                disabled={loadingPlanned}
                className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
              >
                Esta semana
              </button>

              <button
                type="button"
                onClick={plannedFilterThisMonth}
                disabled={loadingPlanned}
                className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
              >
                Este mes
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Desde
                </label>
                <input
                  type="date"
                  value={plannedFilterFrom}
                  onChange={(event) =>
                    setPlannedFilterFrom(
                      event.target.value
                    )
                  }
                  max={
                    plannedFilterTo ||
                    undefined
                  }
                  className="h-9 w-full rounded-md border bg-background px-2 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Hasta
                </label>
                <input
                  type="date"
                  value={plannedFilterTo}
                  onChange={(event) =>
                    setPlannedFilterTo(
                      event.target.value
                    )
                  }
                  min={
                    plannedFilterFrom ||
                    undefined
                  }
                  className="h-9 w-full rounded-md border bg-background px-2 text-xs"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={applyPlannedFilter}
                  disabled={loadingPlanned}
                  className="h-9 w-full rounded-md bg-blue-600 px-4 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
                >
                  {loadingPlanned
                    ? "Cargando..."
                    : "Aplicar"}
                </button>
              </div>
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground">
              Mostrando planificación del {formatDateAr(plannedAppliedFrom)} al {formatDateAr(plannedAppliedTo)}.
            </p>
          </div>

          <div
            ref={plannedMapCardRef}
            className={`relative w-full overflow-hidden bg-background ${
              plannedFullscreen
                ? "h-screen"
                : "h-[560px]"
            }`}
            style={
              plannedFullscreen
                ? {
                    width: "100vw",
                    height: "100dvh",
                    minHeight: "100dvh",
                    maxHeight: "100dvh",
                    background: "#ffffff",
                  }
                : {
                    width: "100%",
                    height: "560px",
                  }
            }
          >
            {plannedFullscreen && (
              <button
                type="button"
                onClick={() =>
                  void toggleMapFullscreen(
                    "planned"
                  )
                }
                className="absolute right-4 top-4 z-[2000] rounded-md border bg-white/95 px-3 py-2 text-xs font-semibold text-slate-800 shadow-lg backdrop-blur transition hover:bg-white"
              >
                ✕ Salir de pantalla completa
              </button>
            )}

            <MapContainer

              center={GENERAL_PICO_CENTER}

              zoom={13}

              scrollWheelZoom

              preferCanvas

              className="relative z-0 h-full w-full"

              style={{
                width: "100%",
                height: "100%",
              }}

            >

            <TileLayer

              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"

            />

            {plannedAreaBatches.flatMap(
              (batch) => {
                const positions =
                  areaPolygonToLeaflet(
                    batch.geometry
                  );

                const center =
                  areaPolygonCenter(
                    batch.geometry
                  );

                if (
                  positions.length < 3
                ) {
                  return [];
                }

                const selected =
                  selectedBatchId ===
                  batch.batch_id;

                const batchColor =
                  normalizeAreaColor(
                    batch.color
                  );

                const layers = [
                  <Polygon
                    key={`planned-area-polygon-${batch.batch_id}`}
                    positions={
                      positions
                    }
                    interactive={false}
                    pathOptions={{
                      color:
                        batchColor,
                      weight:
                        selected
                          ? 6
                          : 4,
                      opacity: 0.95,
                      fillColor:
                        batchColor,
                      fillOpacity:
                        selected
                          ? 0.34
                          : 0.24,
                    }}
                  />,
                ];

                if (center) {
                  layers.push(
                    <Marker
                      key={`planned-area-label-${batch.batch_id}`}
                      position={
                        center
                      }
                      icon={createAreaPlanningLabelIcon(
                        batch.observations ||
                          "Zona planificada",
                        batchColor
                      )}
                      interactive={
                        false
                      }
                      zIndexOffset={
                        900
                      }
                    />
                  );
                }

                return layers;
              }
            )}

            {!readOnly && loadMode === "manual" && recordStatus === "PLANIFICADO" && (

              <GradingRouteDraw

                drawing={drawingManual}

                clearToken={manualClearToken}

                finishToken={manualFinishToken}

                undoToken={manualUndoToken}

                onCreated={(geometry) => setManualGeometry(geometry)}

                onDrawingFinished={() => setDrawingManual(false)}

              />

            )}

            {!readOnly &&
              loadMode === "mechanical" &&
              recordStatus === "PLANIFICADO" && (
                <>
                  <MechanicalCorridorMapSelector
                    active={mechanicalSelecting}
                    startPoint={mechanicalStartPoint}
                    endPoint={mechanicalEndPoint}
                    onMapPoint={handleMechanicalMapPoint}
                  />

                  {mechanicalPreview && (
                    <Polyline
                      positions={
                        mechanicalPreview.geometry.coordinates.map(
                          ([lng, lat]) =>
                            [lat, lng] as [number, number]
                        )
                      }
                      interactive={false}
                      pathOptions={{
                        color: "#2563eb",
                        weight: 7,
                        opacity: 0.95,
                        lineCap: "round",
                      }}
                    />
                  )}
                </>
              )}

            {!readOnly && loadMode === "area" && recordStatus === "PLANIFICADO" && (
              <>
                <AreaSelectionDraw
                  drawing={areaDrawing}
                  clearToken={areaClearToken}
                  finishToken={areaFinishToken}
                  undoToken={areaUndoToken}
                  onCreated={(geometry) => {
                    setAreaGeometry(geometry);
                    void analyzeArea(geometry);
                  }}
                  onDrawingFinished={() => setAreaDrawing(false)}
                />

                {areaGeometry && (
                  <>
                    <Polygon
                      positions={
                        areaGeometry.coordinates[0].map(
                          ([lng, lat]) =>
                            [lat, lng] as [number, number]
                        )
                      }
                      interactive={false}
                      pathOptions={{
                        color:
                          areaColor,
                        weight: 4,
                        opacity: 0.95,
                        fillColor:
                          areaColor,
                        fillOpacity: 0.24,
                      }}
                    />

                    {areaPolygonCenter(
                      areaGeometry
                    ) && (
                      <Marker
                        position={
                          areaPolygonCenter(
                            areaGeometry
                          ) as [number, number]
                        }
                        icon={createAreaPlanningLabelIcon(
                          observations.trim() ||
                            "Zona seleccionada",
                          areaColor
                        )}
                        interactive={false}
                        zIndexOffset={1000}
                      />
                    )}
                  </>
                )}

                {areaStreets.flatMap((item) =>
                  areaStreetToLeafletPaths(item.geometry).map((positions, pathIndex) => {
                    const selected = selectedAreaStreetKeys.has(item.corridor_key);

                    return (
                      <Polyline
                        key={`area-${item.corridor_key}-${pathIndex}`}
                        positions={positions}
                        interactive={false}
                        pathOptions={{
                          color: selected
                            ? "#2563eb"
                            : "#94a3b8",
                          weight: selected ? 6 : 3,
                          opacity: selected ? 0.95 : 0.35,
                          lineCap: "round",
                          lineJoin: "round",
                        }}
                      />
                    );
                  })
                )}
              </>
            )}

            {plannedRoutes.map((record) => (

              <Polyline

                key={record.id}

                positions={record.positions}

                renderer={plannedCanvasRenderer}

                smoothFactor={2}

                pathOptions={{

                  color:
                    record.result_status === "NO_REALIZADO" ? "#dc2626" : "#2563eb",

                  

                  weight:
                    selectedRouteId === record.id
                      ? Math.max(
                          plannedBaseWeight + 7,
                          10
                        )
                      : selectedBatchId &&
                          record.batch_id ===
                            selectedBatchId
                        ? Math.max(
                            plannedBaseWeight + 3,
                            7
                          )
                        : hoveredRouteId === record.id
                          ? plannedBaseWeight + 2
                          : plannedBaseWeight,

                  opacity:
                    selectedRouteId === record.id ||
                    (
                      selectedBatchId &&
                      record.batch_id ===
                        selectedBatchId
                    )
                      ? 1
                      : 0.9,

                }}

                eventHandlers={{
                  ...(plannedHoverEnabled
                    ? {
                        mouseover: (event) => {
                          setHoveredRouteId(record.id);
                          event.target.bringToFront();
                        },
                        mouseout: () =>
                          setHoveredRouteId(null),
                      }
                    : {}),

                  click: (event) => {

                    setSelectedBatchId(
                      null
                    );

                    setSelectedRouteId(record.id);

                    setFocusedRouteKind(
                      "planned"
                    );

                    setFocusedRoutePositions(
                      record.positions
                    );

                    event.target.bringToFront();

                  },

                  popupclose: () => setSelectedRouteId(null),

                }}

              >

                <Popup>

                  <div className="min-w-[220px]">

                    <p className="font-bold">{record.main_street}</p>

                    <p className="mt-2 text-sm"><strong>Desde:</strong> {record.from_street}</p>

                    <p className="text-sm"><strong>Hasta:</strong> {record.to_street}</p>

                    <p className="mt-2 text-sm"><strong>Fecha:</strong> {formatDateAr(record.work_date)}</p>

                    <p className="text-sm"><strong>Estado:</strong> {record.result_status === "NO_REALIZADO" ? "NO REALIZADO" : "PLANIFICADO"}</p>
                    {record.result_status === "NO_REALIZADO" && <p className="mt-2 text-sm text-red-700"><strong>Motivo:</strong> {record.result_observation}</p>}

                    {record.observations && (

                      <p className="mt-2 text-sm">
                        <strong>Observación:</strong>{" "}
                        {record.observations}
                      </p>

                    )}

                    {!readOnly && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {record.result_status !== "NO_REALIZADO" && <button
                          type="button"
                          onClick={() =>
                            void markPlannedAsCompleted(
                              record
                            )
                          }
                          disabled={
                            markingRealizedId ===
                              record.id ||
                            deletingId ===
                              record.id
                          }
                          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                        >
                          {markingRealizedId ===
                          record.id
                            ? "Marcando..."
                            : "✓ Marcar como realizado"}
                        </button>}
                        <button type="button" onClick={() => void changeNotCompleted(record, record.result_status === "NO_REALIZADO")}
                          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">
                          {record.result_status === "NO_REALIZADO" ? "Deshacer no realizado" : "✕ No realizado"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void deleteRecord(
                              record
                            )
                          }
                          disabled={
                            deletingId ===
                              record.id ||
                            markingRealizedId ===
                              record.id
                          }
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          {deletingId ===
                          record.id
                            ? "Eliminando..."
                            : "Eliminar tramo"}
                        </button>
                      </div>
                    )}

                  </div>

                </Popup>

              </Polyline>

            ))}

            <FitRoutes routes={plannedRoutesToFit} />

            <FocusSelectedRoute
              positions={
                focusedRouteKind ===
                "planned"
                  ? focusedRoutePositions
                  : null
              }
              focusToken={
                focusedRouteToken
              }
            />

            <InvalidateMapOnFullscreen
              fullscreen={
                fullscreenMap ===
                "planned"
              }
            />

            <InvalidateMapOnResize />

            </MapContainer>

          </div>

          {/* Referencias exclusivas del mapa de planificación. */}
          <div className="border-t bg-blue-50/30 px-4 py-3 dark:bg-blue-950/10">
            <p className="mb-2 text-xs font-semibold text-blue-800 dark:text-blue-300">
              Referencias · Trabajos de motonivelación planificados
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-block h-1 w-7 shrink-0 rounded-full bg-blue-600" />
                <span>Planificado</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-1 w-7 shrink-0 rounded-full bg-red-600" />
                <span>No realizado</span>
              </div>
            </div>
          </div>

        </div>

        {/* ================= REALIZADO ================= */}

        <div className="relative isolate z-0 overflow-hidden rounded-xl border bg-background shadow-sm">

          <div className="border-b p-4">

            <div className="flex items-center justify-between gap-3">

              <div>

                <h3 className="font-semibold text-emerald-700">Motonivelación realizado</h3>

                <p className="mt-1 text-xs text-muted-foreground">

                  Tramos efectivamente trabajos de motonivelación en el período seleccionado.

                </p>

              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">

                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">

                  {completedRoutes.length} {completedRoutes.length === 1 ? "tramo" : "tramos"}

                </span>

                <button
                  type="button"
                  onClick={() =>
                    void toggleMapFullscreen(
                      "completed"
                    )
                  }
                  className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
                >
                  ⛶ Pantalla completa
                </button>

              </div>

            </div>

          </div>

          <div className="border-b bg-emerald-50/40 p-3 dark:bg-emerald-950/10">
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={completedFilterToday}
                disabled={loadingCompleted}
                className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
              >
                Hoy
              </button>

              <button
                type="button"
                onClick={completedFilterThisWeek}
                disabled={loadingCompleted}
                className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
              >
                Esta semana
              </button>

              <button
                type="button"
                onClick={completedFilterThisMonth}
                disabled={loadingCompleted}
                className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
              >
                Este mes
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Desde
                </label>
                <input
                  type="date"
                  value={completedFilterFrom}
                  onChange={(event) =>
                    setCompletedFilterFrom(
                      event.target.value
                    )
                  }
                  max={
                    completedFilterTo ||
                    undefined
                  }
                  className="h-9 w-full rounded-md border bg-background px-2 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Hasta
                </label>
                <input
                  type="date"
                  value={completedFilterTo}
                  onChange={(event) =>
                    setCompletedFilterTo(
                      event.target.value
                    )
                  }
                  min={
                    completedFilterFrom ||
                    undefined
                  }
                  className="h-9 w-full rounded-md border bg-background px-2 text-xs"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={applyCompletedFilter}
                  disabled={loadingCompleted}
                  className="h-9 w-full rounded-md bg-emerald-600 px-4 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
                >
                  {loadingCompleted
                    ? "Cargando..."
                    : "Aplicar"}
                </button>
              </div>
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground">
              Mostrando trabajos de motonivelación realizados del {formatDateAr(completedAppliedFrom)} al {formatDateAr(completedAppliedTo)}.
            </p>
          </div>

          <div
            ref={completedMapCardRef}
            className={`relative w-full overflow-hidden bg-background ${
              completedFullscreen
                ? "h-screen"
                : "h-[560px]"
            }`}
            style={
              completedFullscreen
                ? {
                    width: "100vw",
                    height: "100dvh",
                    minHeight: "100dvh",
                    maxHeight: "100dvh",
                    background: "#ffffff",
                  }
                : {
                    width: "100%",
                    height: "560px",
                  }
            }
          >
            {completedFullscreen && (
              <button
                type="button"
                onClick={() =>
                  void toggleMapFullscreen(
                    "completed"
                  )
                }
                className="absolute right-4 top-4 z-[2000] rounded-md border bg-white/95 px-3 py-2 text-xs font-semibold text-slate-800 shadow-lg backdrop-blur transition hover:bg-white"
              >
                ✕ Salir de pantalla completa
              </button>
            )}

            <MapContainer

              center={GENERAL_PICO_CENTER}

              zoom={13}

              scrollWheelZoom

              preferCanvas

              className="relative z-0 h-full w-full"

              style={{
                width: "100%",
                height: "100%",
              }}

            >

            <TileLayer

              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"

            />

            {!readOnly && loadMode === "manual" && recordStatus === "COMPLETADO" && (

              <GradingRouteDraw

                drawing={drawingManual}

                clearToken={manualClearToken}

                finishToken={manualFinishToken}

                undoToken={manualUndoToken}

                onCreated={(geometry) => setManualGeometry(geometry)}

                onDrawingFinished={() => setDrawingManual(false)}

              />

            )}

            {completedRoutes.map((record) => {

              const isHovered = hoveredRouteId === record.id;

              const isSelected = selectedRouteId === record.id;

              return (

                <Polyline

                  key={record.id}

                  positions={record.positions}

                  renderer={completedCanvasRenderer}

                  smoothFactor={2}

                  pathOptions={{

                    color: record.color,

                    

                    weight:
                      isSelected
                        ? Math.max(
                            completedBaseWeight + 7,
                            10
                          )
                        : isHovered
                          ? completedBaseWeight + 2
                          : completedBaseWeight,

                    opacity:
                      isSelected
                        ? 1
                        : isHovered
                          ? 1
                          : 0.85,

                  }}

                  eventHandlers={{
                    ...(completedHoverEnabled
                      ? {
                          mouseover: (event) => {
                            setHoveredRouteId(record.id);
                            event.target.bringToFront();
                          },
                          mouseout: () =>
                            setHoveredRouteId(null),
                        }
                      : {}),

                    click: (event) => {

                      setSelectedRouteId(record.id);

                      setFocusedRouteKind(
                        "completed"
                      );

                      setFocusedRoutePositions(
                        record.positions
                      );

                      event.target.bringToFront();

                    },

                    popupclose: () => setSelectedRouteId(null),

                  }}

                >

                  <Popup>

                    <div className="min-w-[220px]">

                      <p className="font-bold">{record.main_street}</p>

                      <p className="mt-2 text-sm"><strong>Desde:</strong> {record.from_street}</p>

                      <p className="text-sm"><strong>Hasta:</strong> {record.to_street}</p>

                      <p className="mt-2 text-sm"><strong>Fecha:</strong> {formatDateAr(record.work_date)}</p>

                      <p className="text-sm"><strong>Semana:</strong> {record.weekIndex + 1}</p>

                      <p className="text-sm"><strong>Estado:</strong> {record.status || "COMPLETADO"}</p>

                      {record.observations && (

                        <p className="mt-2 text-sm"><strong>Observaciones:</strong> {record.observations}</p>

                      )}

                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            void deleteRecord(
                              record
                            )
                          }
                          disabled={
                            deletingId === record.id
                          }
                          className="mt-3 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          {deletingId === record.id
                            ? "Eliminando..."
                            : "Eliminar tramo"}
                        </button>
                      )}

                    </div>

                  </Popup>

                </Polyline>

              );

            })}

            <FitRoutes routes={completedRoutesToFit} />

            <FocusSelectedRoute
              positions={
                focusedRouteKind ===
                "completed"
                  ? focusedRoutePositions
                  : null
              }
              focusToken={
                focusedRouteToken
              }
            />

            <InvalidateMapOnFullscreen
              fullscreen={
                fullscreenMap ===
                "completed"
              }
            />

            <InvalidateMapOnResize />

            </MapContainer>

          </div>

          {weekLegend.length > 0 && (
            <div className="border-t bg-emerald-50/30 px-4 py-3 dark:bg-emerald-950/10">
              <p className="mb-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Referencias por semana · Trabajos de motonivelación realizados
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {weekLegend.map((week) => (
                  <div key={week.index} className="flex items-center gap-2 text-xs">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: week.color }}
                    />
                    <span className="font-medium">{week.label}</span>
                    <span className="text-muted-foreground">
                      {formatDateAr(week.from)} - {formatDateAr(week.to)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* =====================================================
          MAPAS COMPLEMENTARIOS
          Reclamos ocupa una columna; la segunda queda preparada
          para el futuro mapa de vehículos All Track.
      ===================================================== */}

      <div
        className={`grid gap-4 lg:grid-cols-2 ${
          complaintsMapOpen &&
          alltrackMapOpen
            ? "items-stretch"
            : "items-start"
        }`}
      >

        <div
          className={`rounded-xl border bg-background shadow-sm ${
            complaintsMapOpen &&
            alltrackMapOpen
              ? "flex h-full flex-col"
              : ""
          }`}
        >
        <div className="flex w-full items-center justify-between gap-4 px-4 py-4">
          <button
            type="button"
            onClick={() =>
              void toggleComplaintsMap()
            }
            className="min-w-0 flex-1 text-left"
          >
            <p className="text-sm font-semibold">
              Reclamos georreferenciados de motonivelación
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Se carga únicamente cuando abrís este mapa.
            </p>
          </button>

          <div className="flex shrink-0 items-center gap-2">
            {complaintsLoaded && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                {sweepingComplaints.length} ubicados
              </span>
            )}

            {complaintsMapOpen && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    void refreshComplaintsMap()
                  }
                  disabled={
                    loadingComplaints
                  }
                  className="rounded-md border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
                >
                  ↻ Actualizar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void toggleMapFullscreen(
                      "complaints"
                    )
                  }
                  className="rounded-md border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted"
                >
                  ⛶ Pantalla completa
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() =>
                void toggleComplaintsMap()
              }
              className="rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted"
            >
              {complaintsMapOpen
                ? "Ocultar mapa"
                : "Ver reclamos de motonivelación"}
            </button>
          </div>
        </div>

        {complaintsMapOpen && (
          <div
            className={`border-t ${
              alltrackMapOpen
                ? "flex flex-1 flex-col"
                : ""
            }`}
          >
            <div className="bg-amber-50/40 p-4 dark:bg-amber-950/10">
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void complaintsFilterToday()
                  }
                  disabled={
                    loadingComplaints
                  }
                  className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
                >
                  Hoy
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void complaintsFilterThisWeek()
                  }
                  disabled={
                    loadingComplaints
                  }
                  className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
                >
                  Esta semana
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void complaintsFilterThisMonth()
                  }
                  disabled={
                    loadingComplaints
                  }
                  className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
                >
                  Este mes
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Desde
                  </label>

                  <input
                    type="date"
                    value={
                      complaintsFilterFrom
                    }
                    onChange={(event) =>
                      setComplaintsFilterFrom(
                        event.target.value
                      )
                    }
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Hasta
                  </label>

                  <input
                    type="date"
                    value={
                      complaintsFilterTo
                    }
                    onChange={(event) =>
                      setComplaintsFilterTo(
                        event.target.value
                      )
                    }
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void applyComplaintsFilter()
                  }
                  disabled={
                    loadingComplaints
                  }
                  className="self-end rounded-md bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                >
                  Aplicar
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Mostrando reclamos del{" "}
                  {formatDateAr(
                    complaintsAppliedFrom
                  )}{" "}
                  al{" "}
                  {formatDateAr(
                    complaintsAppliedTo
                  )}.
                </span>

                <span>
                  {sweepingComplaints.length} georreferenciados
                </span>

                <span>
                  {complaintsWithoutGeo} sin ubicación
                </span>

                <span>
                  {complaintsTotal} reclamos en el período
                </span>
              </div>
            </div>

            <div
              ref={complaintsMapCardRef}
              className={`relative w-full overflow-hidden bg-background ${
                complaintsFullscreen
                  ? "h-screen"
                  : alltrackMapOpen
                    ? "min-h-[560px] flex-1 rounded-b-xl"
                    : "h-[560px] rounded-b-xl"
              }`}
              style={
                complaintsFullscreen
                  ? {
                      width: "100vw",
                      height: "100dvh",
                      minHeight: "100dvh",
                      maxHeight: "100dvh",
                      background: "#ffffff",
                    }
                  : alltrackMapOpen
                    ? {
                        width: "100%",
                        minHeight: "560px",
                        flex: "1 1 0%",
                      }
                    : {
                        width: "100%",
                        height: "560px",
                      }
              }
            >
              {complaintsFullscreen && (
                <button
                  type="button"
                  onClick={() =>
                    void toggleMapFullscreen(
                      "complaints"
                    )
                  }
                  className="absolute right-4 top-4 z-[2000] rounded-md border bg-white/95 px-3 py-2 text-xs font-semibold text-slate-800 shadow-lg backdrop-blur transition hover:bg-white"
                >
                  ✕ Salir de pantalla completa
                </button>
              )}

              <MapContainer
                center={
                  GENERAL_PICO_CENTER
                }
                zoom={13}
                scrollWheelZoom
                className="relative z-0 h-full w-full"
                style={{
                  width: "100%",
                  height: "100%",
                }}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {sweepingComplaints.map(
                  (complaint) => {
                    const status =
                      (
                        complaint.status ??
                        ""
                      ).toLowerCase();

                    const color =
                      status.includes(
                        "resuelto"
                      ) &&
                      !status.includes(
                        "no resuelto"
                      )
                        ? "#16a34a"
                        : status.includes(
                              "no resuelto"
                            )
                          ? "#dc2626"
                          : "#f59e0b";

                    return (
                      <Marker
                        key={
                          complaint.id
                        }
                        position={[
                          complaint.lat,
                          complaint.lng,
                        ]}
                        icon={
                          createComplaintPinIcon(
                            color
                          )
                        }
                      >
                        <Popup>
                          <div className="min-w-[220px] space-y-2">
                            <p className="font-semibold">
                              Reclamo #
                              {complaint.id}
                            </p>

                            <p className="text-sm">
                              <strong>
                                Dirección:
                              </strong>{" "}
                              {complaint.address ??
                                "Sin calle"}{" "}
                              {complaint.street_number ??
                                ""}
                            </p>

                            <p className="text-sm">
                              <strong>
                                Fecha:
                              </strong>{" "}
                              {formatDateAr(
                                complaint.complaint_date
                              )}
                            </p>

                            <p className="text-sm">
                              <strong>
                                Estado:
                              </strong>{" "}
                              {complaint.status ??
                                "-"}
                            </p>

                            {complaint.details && (
                              <p className="text-sm leading-relaxed">
                                <strong>
                                  Detalle:
                                </strong>{" "}
                                {complaint.details}
                              </p>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    );
                  }
                )}

                <FitComplaintPoints
                  complaints={
                    sweepingComplaints
                  }
                />

                <InvalidateMapOnFullscreen
                  fullscreen={
                    fullscreenMap ===
                    "complaints"
                  }
                />

                <InvalidateMapOnResize />
              </MapContainer>
            </div>

            <div className="flex flex-wrap gap-4 border-t px-4 py-3 text-xs">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-500" />
                En proceso
              </span>

              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-600" />
                Resuelto
              </span>

              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-600" />
                No resuelto
              </span>
            </div>
          </div>
        )}
        </div>

        {/* ===================================================
            VEHÍCULOS DE BARRIDO - ALL TRACK
        =================================================== */}

        <div
          className={`rounded-xl border bg-background shadow-sm ${
            complaintsMapOpen &&
            alltrackMapOpen
              ? "flex h-full flex-col"
              : ""
          }`}
        >
          <div className="flex w-full items-center justify-between gap-4 px-4 py-4">
            <button
              type="button"
              onClick={() =>
                void toggleAlltrackMap()
              }
              className="min-w-0 flex-1 text-left"
            >
              <p className="text-sm font-semibold">
                Vehículos de motonivelación · All Track
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Ubicación actual de los móviles vinculados a motonivelación.
              </p>
            </button>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {alltrackLoaded && (
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                  {alltrackLocated} ubicados
                </span>
              )}

              {alltrackMapOpen && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      void refreshAlltrackActiveView()
                    }
                    disabled={
                      loadingAlltrack
                    }
                    className="rounded-md border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
                  >
                    ↻ Actualizar
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void toggleMapFullscreen(
                        "alltrack"
                      )
                    }
                    className="rounded-md border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted"
                  >
                    ⛶ Pantalla completa
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() =>
                  void toggleAlltrackMap()
                }
                className="rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted"
              >
                {alltrackMapOpen
                  ? "Ocultar mapa"
                  : "Ver vehículos"}
              </button>
            </div>
          </div>

          {alltrackMapOpen && (
            <div
              className={`border-t ${
                complaintsMapOpen
                  ? "flex flex-1 flex-col"
                  : ""
              }`}
            >
              <div className="bg-sky-50/40 p-4 dark:bg-sky-950/10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void showAlltrackCurrentView()
                      }
                      className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                        alltrackViewMode === "current"
                          ? "border-sky-600 bg-sky-600 text-white"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      Ubicación actual
                    </button>

                    <details className="group relative">
                      <summary
                        className={`cursor-pointer list-none rounded-md border px-3 py-2 text-xs font-semibold transition [&::-webkit-details-marker]:hidden ${
                          alltrackViewMode === "today"
                            ? "border-sky-600 bg-sky-600 text-white"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        Recorrido de hoy
                        <span className="ml-1.5 inline-block transition-transform group-open:rotate-180">
                          ▾
                        </span>
                      </summary>

                      <div className="absolute left-0 top-full z-[1200] mt-2 min-w-[235px] overflow-hidden rounded-lg border bg-background p-1.5 shadow-xl">
                        <p className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Seleccionar vehículo
                        </p>

                        {["M.C.1", "M.C.2", "M.C.3", "M.C.4", "M.C.5", "M.C.6"].map((code) => {
                          const vehicle =
                            alltrackVehicles.find(
                              (item) =>
                                item.code === code
                            );

                          return (
                            <button
                              key={code}
                              type="button"
                              onClick={(event) => {
                                event.currentTarget
                                  .closest("details")
                                  ?.removeAttribute("open");

                                void selectAlltrackHistoryVehicle(
                                  code
                                );
                              }}
                              className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition hover:bg-muted ${
                                alltrackViewMode === "today" &&
                                selectedAlltrackVehicleCode === code
                                  ? "bg-sky-50 dark:bg-sky-950/30"
                                  : ""
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold">
                                  {code}
                                </p>

                                <p className="truncate text-[11px] text-muted-foreground">
                                  {vehicle?.vehicle?.name ??
                                    "Vehículo de motonivelación"}
                                </p>
                              </div>

                              {alltrackViewMode === "today" &&
                                selectedAlltrackVehicleCode === code && (
                                  <span className="text-xs font-bold text-sky-600">
                                    ✓
                                  </span>
                                )}
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  </div>

                  {alltrackViewMode === "current" ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border bg-background px-2.5 py-1">
                        {alltrackLocated} con posición
                      </span>

                      {alltrackWithoutPosition > 0 && (
                        <span className="rounded-full border bg-background px-2.5 py-1 text-muted-foreground">
                          {alltrackWithoutPosition} sin posición
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-full border bg-background px-3 py-1.5 text-xs font-semibold">
                      {selectedAlltrackVehicleCode}
                    </div>
                  )}
                </div>

                {alltrackViewMode === "current" ? (
                  <>
                    <p className="mt-3 text-xs text-muted-foreground">
                      M.C.1 · M.C.2 · M.C.3 · M.C.4 · M.C.5 · M.C.6
                    </p>

                    {alltrackUpdatedAt && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Consulta realizada:{" "}
                        {new Date(
                          alltrackUpdatedAt
                        ).toLocaleString(
                          "es-AR"
                        )}
                      </p>
                    )}
                  </>
                ) : loadingAlltrackHistory ? (
                  <div className="mt-3 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
                    Cargando recorrido de {selectedAlltrackVehicleCode}...
                  </div>
                ) : alltrackHistory?.data?.vehicle &&
                    alltrackHistory?.data?.summary ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <div className="rounded-md border bg-background px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Vehículo
                      </p>
                      <p className="mt-1 text-xs font-semibold">
                        {alltrackHistory.data.vehicle.code} · {alltrackHistory.data.vehicle.name}
                      </p>
                    </div>

                    <div className="rounded-md border bg-background px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Distancia
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {Number(
                          alltrackHistory.data.summary.distance_km ?? 0
                        ).toLocaleString("es-AR", {
                          maximumFractionDigits: 2,
                        })} km
                      </p>
                    </div>

                    <div className="rounded-md border bg-background px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Sesión
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {alltrackHistory.data.summary.session_time}
                      </p>
                    </div>

                    <div className="rounded-md border bg-background px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Detenciones
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {alltrackHistory.data.stops?.length ?? 0}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Seleccioná un vehículo para consultar su recorrido de hoy.
                  </p>
                )}

                {alltrackViewMode === "today" &&
                  false && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      
                    </p>
                  )}
              </div>

              <div
                ref={alltrackMapCardRef}
                className={`relative w-full overflow-hidden bg-background ${
                  alltrackFullscreen
                    ? "h-screen"
                    : complaintsMapOpen
                      ? "min-h-[560px] flex-1 rounded-b-xl"
                      : "h-[560px] rounded-b-xl"
                }`}
                style={
                  alltrackFullscreen
                    ? {
                        width: "100vw",
                        height: "100dvh",
                        minHeight: "100dvh",
                        maxHeight: "100dvh",
                        background: "#ffffff",
                      }
                    : complaintsMapOpen
                      ? {
                          width: "100%",
                          minHeight: "560px",
                          flex: "1 1 0%",
                        }
                      : {
                          width: "100%",
                          height: "560px",
                        }
                }
              >
                {alltrackFullscreen && (
                  <button
                    type="button"
                    onClick={() =>
                      void toggleMapFullscreen(
                        "alltrack"
                      )
                    }
                    className="absolute right-4 top-4 z-[2000] rounded-md border bg-white/95 px-3 py-2 text-xs font-semibold text-slate-800 shadow-lg backdrop-blur transition hover:bg-white"
                  >
                    ✕ Salir de pantalla completa
                  </button>
                )}

                <MapContainer
                  center={GENERAL_PICO_CENTER}
                  zoom={13}
                  scrollWheelZoom
                  className="relative z-0 h-full w-full"
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {alltrackViewMode === "current" ? (
                    <>
                      {alltrackVehicles.map(
                        (item) => {
                          if (
                            !item.available_position ||
                            !item.position
                          ) {
                            return null;
                          }

                          const freshness =
                            getAlltrackFreshness(
                              item.position.date,
                              item.position.time
                            );

                          return (
                            <Marker
                              key={item.code}
                              position={[
                                item.position.lat,
                                item.position.lng,
                              ]}
                              icon={
                                createAlltrackVehicleIcon(
                                  item.code,
                                  freshness.color
                                )
                              }
                            >
                              <Popup>
                                <div className="min-w-[250px] space-y-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-base font-bold">
                                        {item.code}
                                      </p>

                                      <p className="text-sm text-muted-foreground">
                                        {item.vehicle?.name ??
                                          "Vehículo de motonivelación"}
                                      </p>
                                    </div>

                                    <span
                                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${freshness.className}`}
                                    >
                                      {freshness.label}
                                    </span>
                                  </div>

                                  <div className="border-t pt-2">
                                    <p className="text-sm">
                                      <strong>Patente:</strong>{" "}
                                      {item.vehicle?.license_plate ??
                                        item.position.alltrack_plate ??
                                        "-"}
                                    </p>

                                    <p className="mt-1 text-sm">
                                      <strong>Estado All Track:</strong>{" "}
                                      {item.position.status ?? "-"}
                                    </p>

                                    <p className="mt-1 text-sm">
                                      <strong>Velocidad:</strong>{" "}
                                      {item.position.speed ?? 0} km/h
                                    </p>

                                    <p className="mt-1 text-sm">
                                      <strong>Conductor:</strong>{" "}
                                      {item.position.driver ??
                                        item.vehicle?.primary_driver_1 ??
                                        "-"}
                                    </p>

                                    <p className="mt-1 text-sm">
                                      <strong>Última posición:</strong>{" "}
                                      {item.position.date ?? "-"}{" "}
                                      {item.position.time ?? ""}
                                    </p>
                                  </div>

                                  {item.position.address && (
                                    <p className="border-t pt-2 text-sm leading-relaxed">
                                      <strong>Dirección:</strong>{" "}
                                      {item.position.address}
                                    </p>
                                  )}

                                  <div className="border-t pt-2 text-xs text-muted-foreground">
                                    <p>
                                      Estado municipal:{" "}
                                      {item.vehicle?.operational_status ?? "-"}
                                    </p>

                                    {item.vehicle?.utilization && (
                                      <p className="mt-1">
                                        Uso: {item.vehicle.utilization}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </Popup>
                            </Marker>
                          );
                        }
                      )}

                      <FitAlltrackVehicles
                        vehicles={alltrackVehicles}
                      />
                    </>
                  ) : (
                    <>
                      {(alltrackHistory?.data.route?.paths ?? []).map(
                        (path, index) => {
                          const positions = path
                            .map(
                              (point) =>
                                [
                                  Number(point.lat),
                                  Number(point.lon),
                                ] as [number, number]
                            )
                            .filter(
                              ([lat, lng]) =>
                                Number.isFinite(lat) &&
                                Number.isFinite(lng)
                            );

                          if (positions.length < 2) {
                            return null;
                          }

                          return (
                            <Polyline
                              key={`history-path-${index}`}
                              positions={positions}
                              pathOptions={{
                                color: "#0284c7",
                                weight: 5,
                                opacity: 0.9,
                              }}
                              smoothFactor={1.5}
                            />
                          );
                        }
                      )}

                      {(alltrackHistory?.data.stops ?? []).map(
                        (stop, index) => (
                          <Marker
                            key={`history-stop-${index}`}
                            position={[
                              stop.lat,
                              stop.lng,
                            ]}
                            icon={createAlltrackStopIcon(
                              stop.minutes
                            )}
                          >
                            <Popup>
                              <div className="min-w-[220px] space-y-2">
                                <p className="font-semibold">
                                  Detención del vehículo
                                </p>

                                <p className="text-sm">
                                  <strong>Desde:</strong>{" "}
                                  {stop.from_time ?? "-"}
                                </p>

                                <p className="text-sm">
                                  <strong>Hasta:</strong>{" "}
                                  {stop.to_time ?? "-"}
                                </p>

                                <p className="text-sm">
                                  <strong>Duración:</strong>{" "}
                                  {stop.minutes !== null
                                    ? `${stop.minutes} minutos`
                                    : "-"}
                                </p>

                                {false &&
                                  stop.validation === "spatial_b6" && (
                                    <p className="border-t pt-2 text-xs text-muted-foreground">
                                      Parada validada por quietud real de la motoniveladora.
                                    </p>
                                  )}
                              </div>
                            </Popup>
                          </Marker>
                        )
                      )}

                      {(() => {
                        const points =
                          alltrackHistory?.data.route?.points ?? [];

                        if (points.length === 0) {
                          return null;
                        }

                        const first = points[0];
                        const last = points[points.length - 1];

                        return (
                          <>
                            <Marker
                              position={[first.lat, first.lon]}
                              icon={createAlltrackEndpointIcon(
                                "I",
                                "#16a34a"
                              )}
                            >
                              <Popup>
                                <strong>Inicio del recorrido</strong>
                                <br />
                                {first.time ?? "-"}
                              </Popup>
                            </Marker>

                            <Marker
                              position={[last.lat, last.lon]}
                              icon={createAlltrackEndpointIcon(
                                "F",
                                "#dc2626"
                              )}
                            >
                              <Popup>
                                <strong>Fin / última posición del recorrido</strong>
                                <br />
                                {last.time ?? "-"}
                              </Popup>
                            </Marker>
                          </>
                        );
                      })()}

                      <FitAlltrackHistory
                        paths={
                          alltrackHistory?.data.route?.paths ?? []
                        }
                        stops={
                          alltrackHistory?.data.stops ?? []
                        }
                      />
                    </>
                  )}

                  <InvalidateMapOnFullscreen
                    fullscreen={
                      alltrackFullscreen
                    }
                  />

                  <InvalidateMapOnResize />
                </MapContainer>
              </div>

              <div className="flex flex-wrap gap-4 border-t px-4 py-3 text-xs">
                {alltrackViewMode === "current" ? (
                  <>
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-green-600" />
                      Posición reciente (hasta 2 h)
                    </span>

                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-amber-500" />
                      Posición de hoy, no reciente
                    </span>

                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-slate-500" />
                      Posición antigua
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-2">
                      <span className="h-1 w-6 rounded-full bg-sky-600" />
                      Recorrido GPS de hoy
                    </span>

                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-orange-500" />
                      Detención de 10 min o más
                    </span>

                    <span className="flex items-center gap-2">
                      <span className="font-bold text-green-600">I</span>
                      Inicio
                    </span>

                    <span className="flex items-center gap-2">
                      <span className="font-bold text-red-600">F</span>
                      Fin / última posición
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* =====================================================

          BARRIDOS MOSTRADOS

      ===================================================== */}

      <div className="rounded-xl border bg-background p-4 shadow-sm">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <p className="text-sm font-semibold">Trabajos de motonivelación mostrados</p>

            <p className="mt-1 text-sm text-muted-foreground">
              {loadingPlanned || loadingCompleted
                ? "Actualizando información..."
                : `${plannedRoutes.length} planificados · ${completedRoutes.length} realizados · ${plannedRoutes.filter(r => r.result_status === "NO_REALIZADO").length} no realizados`}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Planificación: {formatDateAr(plannedAppliedFrom)} al {formatDateAr(plannedAppliedTo)}
              {" · "}
              Realizado: {formatDateAr(completedAppliedFrom)} al {formatDateAr(completedAppliedTo)}
            </p>

          </div>

          <button type="button" onClick={clearCurrentMap} className="rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted">

            Limpiar vista

          </button>

        </div>

        {!loadingPlanned &&
        !loadingCompleted &&
        plannedRoutes.length === 0 &&
        completedRoutes.length === 0 ? (

          <div className="mt-4 rounded-md border border-dashed px-3 py-5 text-center text-sm text-muted-foreground">

            No hay tramos para los períodos seleccionados.

          </div>

        ) : (

          <div className="mt-4 grid gap-4 lg:grid-cols-2">

            <ShownRoutesPanel
              kind="planned"
              routes={plannedRoutes}
              fromDate={plannedAppliedFrom}
              toDate={plannedAppliedTo}
              editingRecordId={editingRecordId}
              selectedRouteId={selectedRouteId}
              selectedBatchId={selectedBatchId}
              readOnly={readOnly}
              editingSaving={editingSaving}
              deletingId={deletingId}
              markingRealizedId={markingRealizedId}
              deletingBatchId={deletingBatchId}
              markingBatchId={markingBatchId}
              deletingAllPending={deletingAllPlanned}
              onEdit={
                startEditingRecord
              }
              onDelete={(record) =>
                void deleteRecord(
                  record
                )
              }
              onSelectRoute={
                selectRouteFromList
              }
              onSelectBatch={
                selectBatchFromList
              }
              onMarkCompleted={(record) =>
                void markPlannedAsCompleted(
                  record
                )
              }
              onMarkNotCompleted={(record) => void changeNotCompleted(record)}
              onUndoNotCompleted={(record) => void changeNotCompleted(record, true)}
              onMarkBatchCompleted={(
                batchId,
                records
              ) =>
                void markBatchAsCompleted(
                  batchId,
                  records
                )
              }
              onDeleteBatch={(
                batchId,
                records
              ) =>
                void deleteBatchPending(
                  batchId,
                  records
                )
              }
              onDeleteAllPending={() =>
                void deleteAllPendingPlanning()
              }
            />

            <ShownRoutesPanel
              kind="completed"
              routes={completedRoutes}
              fromDate={completedAppliedFrom}
              toDate={completedAppliedTo}
              editingRecordId={editingRecordId}
              selectedRouteId={selectedRouteId}
              selectedBatchId={selectedBatchId}
              readOnly={readOnly}
              editingSaving={editingSaving}
              deletingId={deletingId}
              markingRealizedId={markingRealizedId}
              deletingBatchId={deletingBatchId}
              markingBatchId={markingBatchId}
              deletingAllPending={deletingAllPlanned}
              onEdit={
                startEditingRecord
              }
              onDelete={(record) =>
                void deleteRecord(
                  record
                )
              }
              onSelectRoute={
                selectRouteFromList
              }
              onSelectBatch={
                selectBatchFromList
              }
              onDeleteCompletedBatch={(
                batchId,
                records
              ) =>
                void deleteCompletedBatch(
                  batchId,
                  records
                )
              }
            />


            <div className="rounded-lg border border-red-200 bg-red-50/40 p-3 dark:border-red-900 dark:bg-red-950/20 lg:col-span-2">
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">No realizados · {plannedRoutes.filter(r => r.result_status === "NO_REALIZADO").length}</h3>
              <p className="mt-1 text-xs text-muted-foreground">Tramos planificados que no pudieron ejecutarse. Hacé clic en un tramo para ubicarlo en el mapa.</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {plannedRoutes.filter(r => r.result_status === "NO_REALIZADO").map(record => (
                  <div key={record.id} className="rounded-md border border-red-200 bg-background p-3 text-xs">
                    <button type="button" className="text-left font-semibold text-red-700 hover:underline"
                      onClick={() => selectRouteFromList("planned", record)}>
                      {record.main_street} — {record.from_street} → {record.to_street}
                    </button>
                    <p className="mt-1 text-muted-foreground">Planificado: {formatDateAr(record.work_date)} · Resultado: {record.result_date ? formatDateAr(record.result_date) : "Sin fecha"}</p>
                    <p className="mt-2">Motivo: {record.result_observation || "Sin observación"}</p>
                    {!readOnly && <button type="button" disabled={markingRealizedId !== null}
                      onClick={() => void changeNotCompleted(record, true)}
                      className="mt-2 rounded-md border border-red-300 px-2 py-1 text-red-700 disabled:opacity-50">Deshacer no realizado</button>}
                  </div>
                ))}
                {plannedRoutes.every(r => r.result_status !== "NO_REALIZADO") && <p className="text-xs text-muted-foreground">No hay tramos no realizados en el período.</p>}
              </div>
            </div>
          </div>

        )}

      </div>

    </div>

  );

}
