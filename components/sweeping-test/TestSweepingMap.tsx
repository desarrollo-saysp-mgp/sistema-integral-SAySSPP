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
  "#2563eb", // Semana 1
  "#f97316", // Semana 2
  "#8b5cf6", // Semana 3
  "#ef4444", // Semana 4
  "#14b8a6", // Semana 5
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
 * SEMANA VISUAL
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
    WEEK_COLORS.length -
      1
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
        coordinate.length >=
          2 &&
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
 * AJUSTAR MAPA A LOS TRAMOS
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

export default function TestSweepingMap() {
  /*
   * ==========================================================
   * NUEVO TRAMO
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
   * FECHAS
   * ==========================================================
   */

  const today =
    getTodayYmd();

  const firstDayOfMonth =
    useMemo(() => {
      const now =
        new Date();

      return dateToYmd(
        new Date(
          now.getFullYear(),
          now.getMonth(),
          1,
          12
        )
      );
    }, []);

  const [
    filterFrom,
    setFilterFrom,
  ] = useState(
    firstDayOfMonth
  );

  const [
    filterTo,
    setFilterTo,
  ] = useState(
    today
  );

  const [
    appliedFrom,
    setAppliedFrom,
  ] = useState(
    firstDayOfMonth
  );

  const [
    appliedTo,
    setAppliedTo,
  ] = useState(
    today
  );

  /*
   * ==========================================================
   * TRAMOS
   * ==========================================================
   */

  const [
    routes,
    setRoutes,
  ] = useState<
    MapRoute[]
  >([]);

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
   * ESTADOS
   * ==========================================================
   */

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    loadingRecords,
    setLoadingRecords,
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
   * CARGAR HISTÓRICO
   * ==========================================================
   */

  async function loadRecords(
    fromValue: string,
    toValue: string
  ) {
    const validation =
      validateRange(
        fromValue,
        toValue
      );

    if (
      !validation.valid
    ) {
      setError(
        validation.error
      );

      return false;
    }

    try {
      setLoadingRecords(
        true
      );

      setError(null);

      setHoveredRouteId(
        null
      );

      setSelectedRouteId(
        null
      );

      const params =
        new URLSearchParams({
          from:
            fromValue,

          to:
            toValue,
        });

      const response =
        await fetch(
          `/api/test-sweeping/records?${params.toString()}`,
          {
            method:
              "GET",

            cache:
              "no-store",
          }
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "No se pudieron cargar los barridos."
        );
      }

      const records =
        Array.isArray(json)
          ? (
              json as SweepingRecordApi[]
            )
          : [];

      const prepared =
        records
          .map(
            (record) =>
              prepareRecord(
                record,
                fromValue
              )
          )
          .filter(
            (
              record
            ): record is MapRoute =>
              record !==
              null
          );

      setRoutes(
        prepared
      );

      setAppliedFrom(
        fromValue
      );

      setAppliedTo(
        toValue
      );

      return true;
    } catch (err) {
      console.error(
        "Error cargando barridos:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al cargar los barridos."
      );

      return false;
    } finally {
      setLoadingRecords(
        false
      );
    }
  }

  /*
   * ==========================================================
   * CARGA INICIAL
   * ==========================================================
   */

  useEffect(() => {
    void loadRecords(
      firstDayOfMonth,
      today
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * ==========================================================
   * FIT BOUNDS
   * ==========================================================
   */

  const routesToFit =
    useMemo(
      () =>
        routes.map(
          (record) =>
            record.positions
        ),
      [routes]
    );

  /*
   * ==========================================================
   * LEYENDA
   * ==========================================================
   */

  const weekLegend =
    useMemo(() => {
      const start =
        dateFromYmd(
          appliedFrom
        );

      const end =
        dateFromYmd(
          appliedTo
        );

      if (
        !start ||
        !end
      ) {
        return [];
      }

      const totalDifference =
        differenceInDays(
          start,
          end
        );

      const amountOfWeeks =
        Math.min(
          Math.floor(
            totalDifference /
              7
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
              index *
                7
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
            weekEnd =
              end;
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
      appliedFrom,
      appliedTo,
    ]);

  /*
   * ==========================================================
   * APLICAR FILTRO
   * ==========================================================
   */

  async function applyFilter() {
    setSuccess(null);

    await loadRecords(
      filterFrom,
      filterTo
    );
  }

  /*
   * ==========================================================
   * HOY
   * ==========================================================
   */

  async function filterToday() {
    const currentToday =
      getTodayYmd();

    setFilterFrom(
      currentToday
    );

    setFilterTo(
      currentToday
    );

    setSuccess(null);

    await loadRecords(
      currentToday,
      currentToday
    );
  }

  /*
   * ==========================================================
   * ESTA SEMANA
   * ==========================================================
   */

  async function filterThisWeek() {
    const now =
      new Date();

    const day =
      now.getDay();

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

    setFilterFrom(
      from
    );

    setFilterTo(
      to
    );

    setSuccess(null);

    await loadRecords(
      from,
      to
    );
  }

  /*
   * ==========================================================
   * ESTE MES
   * ==========================================================
   */

  async function filterThisMonth() {
    const now =
      new Date();

    const start =
      dateToYmd(
        new Date(
          now.getFullYear(),
          now.getMonth(),
          1,
          12
        )
      );

    const end =
      getTodayYmd();

    setFilterFrom(
      start
    );

    setFilterTo(
      end
    );

    setSuccess(null);

    await loadRecords(
      start,
      end
    );
  }

  /*
   * ==========================================================
   * AGREGAR TRAMO
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

      /*
       * ======================================================
       * CALCULAR GEOMETRÍA
       * ======================================================
       */

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

      const segment: SegmentResponse =
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

      /*
       * ======================================================
       * GUARDAR
       * ======================================================
       */

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

                geometry:
                  segment.geometry,

                work_date:
                  workDate,

                status:
                  "COMPLETADO",
              }),
          }
        );

      const saveJson =
        await saveResponse.json();

      if (!saveResponse.ok) {
        throw new Error(
          saveJson?.error ||
            "No se pudo guardar el tramo."
        );
      }

      /*
       * ======================================================
       * LIMPIAR
       * ======================================================
       */

      setStreet("");
      setFromStreet("");
      setToStreet("");

      /*
       * ======================================================
       * RECARGAR SI HOY ESTÁ VISIBLE
       * ======================================================
       */

      const todayDate =
        dateFromYmd(
          workDate
        );

      const fromDate =
        dateFromYmd(
          appliedFrom
        );

      const toDate =
        dateFromYmd(
          appliedTo
        );

      const isInsideRange =
        todayDate &&
        fromDate &&
        toDate &&
        todayDate.getTime() >=
          fromDate.getTime() &&
        todayDate.getTime() <=
          toDate.getTime();

      if (
        isInsideRange
      ) {
        await loadRecords(
          appliedFrom,
          appliedTo
        );
      }

      setSuccess(
        `${cleanStreet} desde ${cleanFrom} hasta ${cleanTo} fue guardado correctamente.`
      );
    } catch (err) {
      console.error(
        "Error agregando tramo:",
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
   * LIMPIAR VISTA
   * ==========================================================
   */

  function clearCurrentMap() {
    setRoutes([]);

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
      {/* =====================================================
          NUEVO TRAMO
      ===================================================== */}

      <div className="rounded-xl border bg-background p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            Mapa de Barrido
          </h2>

          <p className="text-sm text-muted-foreground">
            Agregá los tramos que se van barriendo.
            Cada tramo queda guardado en la base de datos.
          </p>
        </div>

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
              placeholder="Ej: Calle 10"
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
              placeholder="Ej: Calle 300"
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
              placeholder="Ej: RP 1"
            />
          </div>

          <div className="flex items-end">
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
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {success &&
          !error && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
              {success}
            </div>
          )}
      </div>

      {/* =====================================================
          HISTÓRICO
      ===================================================== */}

      <div className="rounded-xl border bg-background p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="font-semibold">
              Histórico de barrido
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Seleccioná un rango máximo de 31 días.
              Cada semana se muestra con un color diferente.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={
                filterToday
              }
              disabled={
                loadingRecords
              }
              className="rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
            >
              Hoy
            </button>

            <button
              type="button"
              onClick={
                filterThisWeek
              }
              disabled={
                loadingRecords
              }
              className="rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
            >
              Esta semana
            </button>

            <button
              type="button"
              onClick={
                filterThisMonth
              }
              disabled={
                loadingRecords
              }
              className="rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
            >
              Este mes
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Desde fecha
              </label>

              <input
                type="date"
                value={
                  filterFrom
                }
                onChange={(
                  event
                ) =>
                  setFilterFrom(
                    event
                      .target
                      .value
                  )
                }
                max={
                  filterTo ||
                  undefined
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Hasta fecha
              </label>

              <input
                type="date"
                value={
                  filterTo
                }
                onChange={(
                  event
                ) =>
                  setFilterTo(
                    event
                      .target
                      .value
                  )
                }
                min={
                  filterFrom ||
                  undefined
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={
                  applyFilter
                }
                disabled={
                  loadingRecords
                }
                className="h-10 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingRecords
                  ? "Cargando..."
                  : "Aplicar filtro"}
              </button>
            </div>
          </div>
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
          LISTADO
      ===================================================== */}

      <div className="rounded-xl border bg-background p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">
              Barridos mostrados
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {loadingRecords
                ? "Cargando..."
                : routes.length ===
                    1
                  ? "1 tramo encontrado."
                  : `${routes.length} tramos encontrados.`}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateAr(
                appliedFrom
              )}{" "}
              al{" "}
              {formatDateAr(
                appliedTo
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={
              clearCurrentMap
            }
            className="rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted"
          >
            Limpiar vista
          </button>
        </div>

        {routes.length >
          0 ? (
          <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
            {routes.map(
              (
                record,
                index
              ) => (
                <div
                  key={
                    record.id
                  }
                  className="flex items-center gap-3 rounded-md border bg-background px-3 py-2"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        record.color,
                    }}
                  />

                  <div className="min-w-0">
                    <p className="text-xs">
                      <span className="font-semibold">
                        {index +
                          1}
                        .{" "}
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
                    </p>

                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDateAr(
                        record.work_date
                      )}{" "}
                      · Semana{" "}
                      {record.weekIndex +
                        1}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          !loadingRecords && (
            <div className="mt-3 rounded-md border border-dashed px-3 py-5 text-center text-sm text-muted-foreground">
              No hay tramos de barrido para el período seleccionado.
            </div>
          )
        )}
      </div>

      {/* =====================================================
          MAPA
      ===================================================== */}

      <div className="overflow-hidden rounded-xl border">
        <MapContainer
          center={
            GENERAL_PICO_CENTER
          }
          zoom={13}
          scrollWheelZoom
          className="h-[650px] w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {routes.map(
            (record) => {
              const isHovered =
                hoveredRouteId ===
                record.id;

              const isSelected =
                selectedRouteId ===
                record.id;

              return (
                <Polyline
                  key={
                    record.id
                  }
                  positions={
                    record.positions
                  }
                  pathOptions={{
                    color:
                      record.color,

                    weight:
                      isSelected
                        ? 10
                        : isHovered
                          ? 8
                          : 6,

                    opacity:
                      isSelected
                        ? 1
                        : isHovered
                          ? 1
                          : 0.85,
                  }}
                  eventHandlers={{
                    mouseover: (
                      event
                    ) => {
                      setHoveredRouteId(
                        record.id
                      );

                      event.target.bringToFront();
                    },

                    mouseout: () => {
                      setHoveredRouteId(
                        null
                      );
                    },

                    click: (
                      event
                    ) => {
                      setSelectedRouteId(
                        record.id
                      );

                      event.target.bringToFront();
                    },

                    popupclose: () => {
                      setSelectedRouteId(
                        null
                      );
                    },
                  }}
                >
                  <Popup>
                    <div className="min-w-[250px]">
                      {/* =====================================
                          CALLE PRINCIPAL
                      ===================================== */}

                      <div className="mb-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Calle principal
                        </p>

                        <p className="mt-1 text-base font-bold text-gray-900">
                          {
                            record.main_street
                          }
                        </p>
                      </div>

                      {/* =====================================
                          TRAMO
                      ===================================== */}

                      <div className="rounded-md bg-gray-50 px-3 py-2">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Tramo barrido
                        </p>

                        <div className="space-y-1.5 text-sm">
                          <p>
                            <span className="font-semibold text-gray-700">
                              Desde:
                            </span>{" "}
                            <span className="text-gray-900">
                              {
                                record.from_street
                              }
                            </span>
                          </p>

                          <p>
                            <span className="font-semibold text-gray-700">
                              Hasta:
                            </span>{" "}
                            <span className="text-gray-900">
                              {
                                record.to_street
                              }
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="my-3 border-t" />

                      {/* =====================================
                          DATOS
                      ===================================== */}

                      <div className="space-y-2 text-sm">
                        <p>
                          <span className="font-semibold">
                            Fecha:
                          </span>{" "}
                          {formatDateAr(
                            record.work_date
                          )}
                        </p>

                        <p>
                          <span className="font-semibold">
                            Semana:
                          </span>{" "}
                          {record.weekIndex +
                            1}
                        </p>

                        <p>
                          <span className="font-semibold">
                            Estado:
                          </span>{" "}
                          {record.status ||
                            "-"}
                        </p>

                        {record.observations && (
                          <div className="pt-1">
                            <p className="font-semibold">
                              Observaciones:
                            </p>

                            <p className="mt-1 text-gray-700">
                              {
                                record.observations
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Polyline>
              );
            }
          )}

          <FitRoutes
            routes={
              routesToFit
            }
          />
        </MapContainer>
      </div>
    </div>
  );
}