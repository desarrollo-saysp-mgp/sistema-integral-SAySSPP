"use client";

import {

  MapContainer,

  Polyline,

  Popup,

  TileLayer,

  useMap,

} from "react-leaflet";

import type {

  LatLngBoundsExpression,

  LatLngExpression,

} from "leaflet";

import L from "leaflet";

import {

  useEffect,

  useMemo,

  useState,

} from "react";

import "leaflet/dist/leaflet.css";

import StreetAutocomplete from "./StreetAutocomplete";

import ManualSweepingDraw from "./ManualSweepingDraw";

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

};

type MapRoute = SweepingRecordApi & {

  positions: LatLngExpression[];

  weekIndex: number;

  color: string;

};

type LoadMode =

  | "automatic"

  | "manual";

type SweepingStatus =

  | "PLANIFICADO"

  | "COMPLETADO";

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

  "#2563eb",

  "#f97316",

  "#8b5cf6",

  "#ef4444",

  "#14b8a6",

];

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

  toValue: string

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

  if (difference > 30) {

    return {

      valid: false,

      error:

        "El rango máximo permitido es de 31 días.",

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

/*

 * ============================================================

 * COMPONENTE

 * ============================================================

 */

type TestSweepingMapProps = {
  readOnly?: boolean;
};

export default function TestSweepingMap({
  readOnly = false,
}: TestSweepingMapProps) {

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

  /*
   * ==========================================================
   * EDICIÓN / ELIMINACIÓN
   * ==========================================================
   */

  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editStreet, setEditStreet] = useState("");
  const [editFromStreet, setEditFromStreet] = useState("");
  const [editToStreet, setEditToStreet] = useState("");
  const [editWorkDate, setEditWorkDate] = useState("");
  const [editStatus, setEditStatus] = useState<SweepingStatus>("COMPLETADO");
  const [editZone, setEditZone] = useState("");
  const [editObservations, setEditObservations] = useState("");
  const [editGeometry, setEditGeometry] = useState<GeoJsonLineString | null>(null);
  const [editRecalculateGeometry, setEditRecalculateGeometry] = useState(false);
  const [editingSaving, setEditingSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    const validation = validateRange(
      fromValue,
      toValue
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
    });

    const response = await fetch(
      `/api/test-sweeping/records?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const json = await response.json();

    if (!response.ok) {
      throw new Error(
        json?.error ||
          "No se pudieron cargar los barridos."
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

  async function loadPlannedRecords(
    fromValue: string,
    toValue: string
  ) {
    const validation = validateRange(
      fromValue,
      toValue
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

      const prepared =
        await fetchRecordsForStatus(
          fromValue,
          toValue,
          "PLANIFICADO"
        );

      setPlannedRoutes(prepared);
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
      toValue
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
        "Error cargando barridos realizados:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al cargar los barridos realizados."
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

  async function saveGeometry(

    geometry: GeoJsonLineString,

    cleanStreet: string,

    cleanFrom: string,

    cleanTo: string,

    status: SweepingStatus

  ) {

    const workDate =

      getTodayYmd();

    const saveResponse =

      await fetch(

        "/api/test-sweeping/records",

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

              status,

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

        "Completá la calle principal, desde calle y hasta calle."

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

          `/api/test-sweeping/segment?${params.toString()}`,

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

        "Completá la calle principal, desde calle y hasta calle antes de dibujar."

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

        "Completá la calle principal, desde calle y hasta calle."

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

      await saveGeometry(

        manualGeometry,

        cleanStreet,

        cleanFrom,

        cleanTo,

        recordStatus

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

      setStreet("");

      setFromStreet("");

      setToStreet("");

      setSuccess(

        `${cleanStreet} desde ${cleanFrom} hasta ${cleanTo} fue guardado correctamente.`

      );

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

    setError(null);

    setSuccess(null);

  }

  /*

   * ==========================================================

   * LIMPIAR HISTÓRICO DE LA VISTA

   * ==========================================================

   */

  /*
   * ==========================================================
   * EDITAR / ELIMINAR
   * ==========================================================
   */

  function startEditingRecord(record: MapRoute) {
    setEditingRecordId(record.id);
    setEditStreet(record.main_street);
    setEditFromStreet(record.from_street);
    setEditToStreet(record.to_street);
    setEditWorkDate(record.work_date);
    setEditStatus(
      (record.status ?? "").toUpperCase() === "PLANIFICADO"
        ? "PLANIFICADO"
        : "COMPLETADO"
    );
    setEditZone(record.zone ?? "");
    setEditObservations(record.observations ?? "");
    setEditGeometry(record.geometry);
    setEditRecalculateGeometry(false);
    setError(null);
    setSuccess(null);
  }

  function cancelEditingRecord() {
    setEditingRecordId(null);
    setEditStreet("");
    setEditFromStreet("");
    setEditToStreet("");
    setEditWorkDate("");
    setEditStatus("COMPLETADO");
    setEditZone("");
    setEditObservations("");
    setEditGeometry(null);
    setEditRecalculateGeometry(false);
    setError(null);
  }

  async function saveEditedRecord() {
    if (!editingRecordId) {
      return;
    }

    const cleanStreet = editStreet.trim();
    const cleanFrom = editFromStreet.trim();
    const cleanTo = editToStreet.trim();

    if (!cleanStreet || !cleanFrom || !cleanTo) {
      setError(
        "Completá la calle principal, desde calle y hasta calle."
      );
      return;
    }

    if (!editWorkDate) {
      setError("Seleccioná una fecha válida.");
      return;
    }

    if (!editGeometry) {
      setError("El tramo no tiene una geometría válida.");
      return;
    }

    try {
      setEditingSaving(true);
      setError(null);
      setSuccess(null);

      let geometryToSave = editGeometry;

      if (editRecalculateGeometry) {
        const params = new URLSearchParams({
          street: cleanStreet,
          from: cleanFrom,
          to: cleanTo,
        });

        const segmentResponse = await fetch(
          `/api/test-sweeping/segment?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const segmentJson = await segmentResponse.json();

        if (!segmentResponse.ok) {
          throw new Error(
            segmentJson?.error ||
              "No se pudo recalcular el recorrido con las calles indicadas."
          );
        }

        const segment: SegmentResponse =
          segmentJson?.data ?? segmentJson;

        if (
          !segment.geometry ||
          segment.geometry.type !== "LineString" ||
          !Array.isArray(segment.geometry.coordinates) ||
          segment.geometry.coordinates.length < 2
        ) {
          throw new Error(
            "La nueva geometría calculada no es válida."
          );
        }

        geometryToSave = segment.geometry;
      }

      const response = await fetch(
        "/api/test-sweeping/records",
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
            work_date: editWorkDate,
            zone: editZone.trim() || null,
            observations:
              editObservations.trim() || null,
            status: editStatus,
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

      cancelEditingRecord();

      setSuccess(
        `${cleanStreet} fue actualizado correctamente.`
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

  async function deleteRecord(record: MapRoute) {
    const confirmed = window.confirm(
      `¿Eliminar el tramo "${record.main_street}" desde ${record.from_street} hasta ${record.to_street}?\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(record.id);
      setError(null);
      setSuccess(null);

      const response = await fetch(
        `/api/test-sweeping/records?id=${encodeURIComponent(record.id)}`,
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

    setSuccess(null);

    setError(null);

  }

  /*

   * ==========================================================

   * RENDER

   * ==========================================================

   */

  return (

    <div className="space-y-4">

      {readOnly && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 shadow-sm dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
          Estás viendo el Mapa de Barrido en modo solo lectura. Podés consultar mapas, filtros e histórico, pero no crear, editar ni eliminar tramos.
        </div>
      )}

      {/* =====================================================

          CARGA

      ===================================================== */}

      {!readOnly && (
      <div className="rounded-xl border bg-background p-4 shadow-sm">

        <div className="mb-4">

          <h2 className="text-lg font-semibold">

            Mapa de Barrido

          </h2>

          <p className="text-sm text-muted-foreground">

            Agregá los tramos que se van barriendo.

            Podés calcularlos por calles o dibujarlos

            manualmente punto por punto sobre el mapa.

          </p>

        </div>

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

                setError(null);

                setSuccess(null);

              }}

              className={`rounded-md border px-4 py-2 text-sm font-medium transition ${

                recordStatus === "PLANIFICADO"

                  ? "border-blue-600 bg-blue-600 text-white"

                  : "bg-background hover:bg-muted"

              }`}

            >

              Planificar barrido

            </button>

            <button

              type="button"

              onClick={() => {

                setRecordStatus("COMPLETADO");

                setDrawingManual(false);

                setManualGeometry(null);

                setManualClearToken((previous) => previous + 1);

                setError(null);

                setSuccess(null);

              }}

              className={`rounded-md border px-4 py-2 text-sm font-medium transition ${

                recordStatus === "COMPLETADO"

                  ? "border-emerald-600 bg-emerald-600 text-white"

                  : "bg-background hover:bg-muted"

              }`}

            >

              Registrar barrido realizado

            </button>

          </div>

          <p className="mt-2 text-xs text-muted-foreground">

            {recordStatus === "PLANIFICADO"

              ? "Los tramos que cargues se mostrarán en el mapa de planificación."

              : "Los tramos que cargues se mostrarán en el mapa de barrido realizado."}

          </p>

        </div>

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

            Dibujar manualmente

          </button>

        </div>

        {/* ===================================================

            INPUTS

        =================================================== */}

        <div className="grid gap-3 lg:grid-cols-4">

          <div>

            <StreetAutocomplete

              label="Calle principal"

              value={

                street

              }

              onChange={

                setStreet

              }

              placeholder="Ej: Calle 21"

            />

          </div>

          <div>

            <StreetAutocomplete

              label="Desde calle"

              value={

                fromStreet

              }

              onChange={

                setFromStreet

              }

              placeholder="Ej: Calle 2"

            />

          </div>

          <div>

            <StreetAutocomplete

              label="Hasta calle"

              value={

                toStreet

              }

              onChange={

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

                  addStreetSegment

                }

                disabled={

                  saving

                }

                className="h-10 w-full rounded-md bg-emerald-500 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"

              >

                {saving

                  ? "Guardando..."

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

                    : "Dibujar tramo"}

              </button>

            )}

          </div>

        </div>

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

                  Completá los datos del tramo y presioná “Dibujar tramo”.

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

                  Podés arrastrar el mapa normalmente para desplazarte. Cuando termines,

                  presioná “Finalizar tramo”.

                </p>

                <div className="mt-3 flex flex-wrap gap-2">

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

                    disabled={saving}

                    className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"

                  >

                    {saving ? "Guardando..." : "Guardar dibujo"}

                  </button>

                </div>

              </div>

            )}

          </div>

        )}

        {/* ===================================================

            ERROR

        =================================================== */}

        {error && (

          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">

            {error}

          </div>

        )}

        {/* ===================================================

            ÉXITO

        =================================================== */}

        {success &&

          !error && (

            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">

              {success}

            </div>

          )}

      </div>

      )}

      {/* =====================================================
          EDICIÓN DE TRAMO
      ===================================================== */}

      {!readOnly && editingRecordId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm dark:border-amber-900 dark:bg-amber-950/20">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-300">
                Editar tramo
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Modificá los datos y guardá los cambios. El recorrido actual se conserva salvo que marques “Recalcular recorrido”.
              </p>
            </div>

            <button
              type="button"
              onClick={cancelEditingRecord}
              disabled={editingSaving}
              className="rounded-md border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
            >
              Cancelar edición
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <StreetAutocomplete
              label="Calle principal"
              value={editStreet}
              onChange={setEditStreet}
              placeholder="Ej: Calle 21"
            />

            <StreetAutocomplete
              label="Desde calle"
              value={editFromStreet}
              onChange={setEditFromStreet}
              placeholder="Ej: Calle 2"
            />

            <StreetAutocomplete
              label="Hasta calle"
              value={editToStreet}
              onChange={setEditToStreet}
              placeholder="Ej: Calle 56"
            />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Fecha
              </label>
              <input
                type="date"
                value={editWorkDate}
                onChange={(event) =>
                  setEditWorkDate(event.target.value)
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Estado
              </label>
              <select
                value={editStatus}
                onChange={(event) =>
                  setEditStatus(
                    event.target.value as SweepingStatus
                  )
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="PLANIFICADO">
                  Planificado
                </option>
                <option value="COMPLETADO">
                  Realizado
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Zona
              </label>
              <input
                type="text"
                value={editZone}
                onChange={(event) =>
                  setEditZone(event.target.value)
                }
                placeholder="Opcional"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>

            <label className="flex min-h-10 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={editRecalculateGeometry}
                onChange={(event) =>
                  setEditRecalculateGeometry(
                    event.target.checked
                  )
                }
              />
              <span>
                Recalcular recorrido por calles
              </span>
            </label>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium">
              Observaciones
            </label>
            <textarea
              value={editObservations}
              onChange={(event) =>
                setEditObservations(event.target.value)
              }
              rows={3}
              placeholder="Opcional"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          {editRecalculateGeometry && (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-100/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Al guardar, el sistema volverá a calcular la línea usando Calle principal, Desde y Hasta. Si el tramo fue dibujado manualmente y querés conservar ese dibujo, dejá esta opción desmarcada.
            </div>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={cancelEditingRecord}
              disabled={editingSaving}
              className="rounded-md border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={saveEditedRecord}
              disabled={editingSaving}
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editingSaving
                ? "Guardando cambios..."
                : "Guardar cambios"}
            </button>
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

                <h3 className="font-semibold text-blue-700">Planificación de barrido</h3>

                <p className="mt-1 text-xs text-muted-foreground">

                  Tramos previstos para el período seleccionado.

                </p>

              </div>

              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">

                {plannedRoutes.length} {plannedRoutes.length === 1 ? "tramo" : "tramos"}

              </span>

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

          <MapContainer

            center={GENERAL_PICO_CENTER}

            zoom={13}

            scrollWheelZoom

            className="relative z-0 h-[560px] w-full"

          >

            <TileLayer

              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"

            />

            {!readOnly && loadMode === "manual" && recordStatus === "PLANIFICADO" && (

              <ManualSweepingDraw

                drawing={drawingManual}

                clearToken={manualClearToken}

                finishToken={manualFinishToken}

                onCreated={(geometry) => setManualGeometry(geometry)}

                onDrawingFinished={() => setDrawingManual(false)}

              />

            )}

            {plannedRoutes.map((record) => (

              <Polyline

                key={record.id}

                positions={record.positions}

                pathOptions={{

                  color: "#2563eb",

                  weight: selectedRouteId === record.id ? 9 : hoveredRouteId === record.id ? 8 : 6,

                  opacity: 0.9,

                }}

                eventHandlers={{

                  mouseover: (event) => {

                    setHoveredRouteId(record.id);

                    event.target.bringToFront();

                  },

                  mouseout: () => setHoveredRouteId(null),

                  click: (event) => {

                    setSelectedRouteId(record.id);

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

                    <p className="text-sm"><strong>Estado:</strong> PLANIFICADO</p>

                  </div>

                </Popup>

              </Polyline>

            ))}

            <FitRoutes routes={plannedRoutesToFit} />

          </MapContainer>

        </div>

        {/* ================= REALIZADO ================= */}

        <div className="relative isolate z-0 overflow-hidden rounded-xl border bg-background shadow-sm">

          <div className="border-b p-4">

            <div className="flex items-center justify-between gap-3">

              <div>

                <h3 className="font-semibold text-emerald-700">Barrido realizado</h3>

                <p className="mt-1 text-xs text-muted-foreground">

                  Tramos efectivamente barridos en el período seleccionado.

                </p>

              </div>

              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">

                {completedRoutes.length} {completedRoutes.length === 1 ? "tramo" : "tramos"}

              </span>

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
              Mostrando barridos realizados del {formatDateAr(completedAppliedFrom)} al {formatDateAr(completedAppliedTo)}.
            </p>
          </div>

          <MapContainer

            center={GENERAL_PICO_CENTER}

            zoom={13}

            scrollWheelZoom

            className="relative z-0 h-[560px] w-full"

          >

            <TileLayer

              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"

            />

            {!readOnly && loadMode === "manual" && recordStatus === "COMPLETADO" && (

              <ManualSweepingDraw

                drawing={drawingManual}

                clearToken={manualClearToken}

                finishToken={manualFinishToken}

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

                  pathOptions={{

                    color: record.color,

                    weight: isSelected ? 10 : isHovered ? 8 : 6,

                    opacity: isSelected || isHovered ? 1 : 0.85,

                  }}

                  eventHandlers={{

                    mouseover: (event) => {

                      setHoveredRouteId(record.id);

                      event.target.bringToFront();

                    },

                    mouseout: () => setHoveredRouteId(null),

                    click: (event) => {

                      setSelectedRouteId(record.id);

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

                    </div>

                  </Popup>

                </Polyline>

              );

            })}

            <FitRoutes routes={completedRoutesToFit} />

          </MapContainer>

        </div>

      </div>

      {/* =====================================================

          LEYENDA

      ===================================================== */}

      {weekLegend.length >

        0 && (

        <div className="rounded-xl border bg-background p-4 shadow-sm">

          <p className="mb-3 text-sm font-semibold">

            Referencias por semana

          </p>

          <div className="flex flex-wrap gap-x-6 gap-y-3">

            {weekLegend.map(

              (week) => (

                <div

                  key={

                    week.index

                  }

                  className="flex items-center gap-2 text-sm"

                >

                  <span

                    className="inline-block h-3 w-3 rounded-full"

                    style={{

                      backgroundColor:

                        week.color,

                    }}

                  />

                  <span className="font-medium">

                    {

                      week.label

                    }

                  </span>

                  <span className="text-muted-foreground">

                    {formatDateAr(

                      week.from

                    )}{" "}

                    -{" "}

                    {formatDateAr(

                      week.to

                    )}

                  </span>

                </div>

              )

            )}

          </div>

        </div>

      )}

      {/* =====================================================

          BARRIDOS MOSTRADOS

      ===================================================== */}

      <div className="rounded-xl border bg-background p-4 shadow-sm">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <p className="text-sm font-semibold">Barridos mostrados</p>

            <p className="mt-1 text-sm text-muted-foreground">
              {loadingPlanned || loadingCompleted
                ? "Actualizando información..."
                : `${plannedRoutes.length} planificados · ${completedRoutes.length} realizados`}
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

            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-950/20">

              <div className="mb-3 flex items-center justify-between gap-2">

                <div>

                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Planificados</p>

                  <p className="text-xs text-muted-foreground">Del {formatDateAr(plannedAppliedFrom)} al {formatDateAr(plannedAppliedTo)}.</p>

                </div>

                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">

                  {plannedRoutes.length}

                </span>

              </div>

              {plannedRoutes.length > 0 ? (

                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">

                  {plannedRoutes.map((record, index) => (

                    <div
                      key={record.id}
                      className={`flex items-start gap-3 rounded-md border bg-background px-3 py-2 ${
                        editingRecordId === record.id
                          ? "ring-2 ring-amber-400"
                          : ""
                      }`}
                    >

                      <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-blue-600" />

                      <div className="min-w-0 flex-1">

                        <p className="text-xs">

                          <span className="font-semibold">{index + 1}. {record.main_street}</span>

                          <span className="text-muted-foreground"> — {record.from_street} → {record.to_street}</span>

                        </p>

                        <p className="mt-1 text-[11px] text-muted-foreground">

                          {formatDateAr(record.work_date)} · Planificado

                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">

                          <button
                            type="button"
                            onClick={() => startEditingRecord(record)}
                            disabled={readOnly || editingSaving || deletingId !== null}
                            className="rounded-md border px-2.5 py-1 text-[11px] font-medium transition hover:bg-muted disabled:opacity-50"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => void deleteRecord(record)}
                            disabled={readOnly || editingSaving || deletingId !== null}
                            className="rounded-md border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                          >
                            {deletingId === record.id
                              ? "Eliminando..."
                              : "Eliminar"}
                          </button>

                        </div>

                      </div>

                    </div>

                  ))}

                </div>

              ) : (

                <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">No hay tramos planificados.</div>

              )}

            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">

              <div className="mb-3 flex items-center justify-between gap-2">

                <div>

                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Realizados</p>

                  <p className="text-xs text-muted-foreground">Del {formatDateAr(completedAppliedFrom)} al {formatDateAr(completedAppliedTo)}.</p>

                </div>

                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">

                  {completedRoutes.length}

                </span>

              </div>

              {completedRoutes.length > 0 ? (

                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">

                  {completedRoutes.map((record, index) => (

                    <div
                      key={record.id}
                      className={`flex items-start gap-3 rounded-md border bg-background px-3 py-2 ${
                        editingRecordId === record.id
                          ? "ring-2 ring-amber-400"
                          : ""
                      }`}
                    >

                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: record.color }}
                      />

                      <div className="min-w-0 flex-1">

                        <p className="text-xs">

                          <span className="font-semibold">{index + 1}. {record.main_street}</span>

                          <span className="text-muted-foreground"> — {record.from_street} → {record.to_street}</span>

                        </p>

                        <p className="mt-1 text-[11px] text-muted-foreground">

                          {formatDateAr(record.work_date)} · Semana {record.weekIndex + 1} · Realizado

                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">

                          <button
                            type="button"
                            onClick={() => startEditingRecord(record)}
                            disabled={readOnly || editingSaving || deletingId !== null}
                            className="rounded-md border px-2.5 py-1 text-[11px] font-medium transition hover:bg-muted disabled:opacity-50"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => void deleteRecord(record)}
                            disabled={readOnly || editingSaving || deletingId !== null}
                            className="rounded-md border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                          >
                            {deletingId === record.id
                              ? "Eliminando..."
                              : "Eliminar"}
                          </button>

                        </div>

                      </div>

                    </div>

                  ))}

                </div>

              ) : (

                <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">No hay barridos realizados.</div>

              )}

            </div>

          </div>

        )}

      </div>

    </div>

  );

}
