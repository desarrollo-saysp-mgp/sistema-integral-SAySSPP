import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Coordinate = [number, number]; // [lon, lat]

type StreetRow = {
  id: number;
  osm_id: number;
  name: string | null;
  highway_type: string | null;
  geometry: {
    type: "LineString";
    coordinates: Coordinate[];
  };
};

type GraphEdge = {
  to: string;
  distance: number;
  streetId: number;
  streetName: string | null;
};

type Graph = Map<string, GraphEdge[]>;

type RawSegment = {
  id: number;
  streetId: number;
  streetName: string | null;
  a: Coordinate;
  b: Coordinate;
};

type SegmentCut = {
  t: number;
  coordinate: Coordinate;
};

type RoutedSegment = {
  streetId: number;
  streetName: string | null;
  a: Coordinate;
  b: Coordinate;
  aKey: string;
  bKey: string;
  lengthMeters: number;
};

const NODE_PRECISION = 7;

/*
 * Para la detección espacial usamos una grilla.
 * 0.002° son aproximadamente 180-220 m en General Pico.
 */
const GRID_SIZE_DEGREES = 0.002;

/*
 * Evita crear conexiones por cruces extremadamente lejanos
 * debido a errores numéricos.
 */
const INTERSECTION_EPSILON = 1e-10;

const nodeKey = (
  lon: number,
  lat: number
) =>
  `${lon.toFixed(NODE_PRECISION)},${lat.toFixed(
    NODE_PRECISION
  )}`;

const parseNodeKey = (
  key: string
): Coordinate => {
  const [lon, lat] = key
    .split(",")
    .map(Number);

  return [lon, lat];
};

const haversineMeters = (
  a: Coordinate,
  b: Coordinate
) => {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;

  const toRad = (
    value: number
  ) => (value * Math.PI) / 180;

  const earthRadius =
    6_371_000;

  const dLat = toRad(
    lat2 - lat1
  );

  const dLon = toRad(
    lon2 - lon1
  );

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return (
    earthRadius *
    2 *
    Math.atan2(
      Math.sqrt(x),
      Math.sqrt(1 - x)
    )
  );
};

const bearingDegrees = (
  a: Coordinate,
  b: Coordinate
) => {
  const toRad = (
    value: number
  ) => (value * Math.PI) / 180;

  const toDeg = (
    value: number
  ) => (value * 180) / Math.PI;

  const lat1 =
    toRad(a[1]);

  const lat2 =
    toRad(b[1]);

  const dLon =
    toRad(b[0] - a[0]);

  const y =
    Math.sin(dLon) *
    Math.cos(lat2);

  const x =
    Math.cos(lat1) *
      Math.sin(lat2) -
    Math.sin(lat1) *
      Math.cos(lat2) *
      Math.cos(dLon);

  return (
    toDeg(
      Math.atan2(y, x)
    ) +
    360
  ) % 360;
};

const angleDifference = (
  a: number,
  b: number
) => {
  let diff =
    Math.abs(a - b) %
    360;

  if (diff > 180) {
    diff =
      360 - diff;
  }

  return diff;
};

const undirectedBearingDifference = (
  segmentBearing: number,
  preferredBearing: number
) => {
  return Math.min(
    angleDifference(
      segmentBearing,
      preferredBearing
    ),
    angleDifference(
      (segmentBearing + 180) %
        360,
      preferredBearing
    )
  );
};


const addEdge = (
  graph: Graph,
  from: string,
  edge: GraphEdge
) => {
  const list =
    graph.get(from) ?? [];

  list.push(edge);

  graph.set(
    from,
    list
  );
};

/*
 * Proyección local de un GPS sobre un segmento vial.
 * Sirve para hacer snap exacto sobre la calle.
 */
const projectPointOnSegment = (
  point: Coordinate,
  a: Coordinate,
  b: Coordinate
) => {
  const referenceLat =
    ((point[1] +
      a[1] +
      b[1]) /
      3) *
    (Math.PI / 180);

  const metersPerDegreeLat =
    111_320;

  const metersPerDegreeLon =
    111_320 *
    Math.cos(referenceLat);

  const px =
    point[0] *
    metersPerDegreeLon;

  const py =
    point[1] *
    metersPerDegreeLat;

  const ax =
    a[0] *
    metersPerDegreeLon;

  const ay =
    a[1] *
    metersPerDegreeLat;

  const bx =
    b[0] *
    metersPerDegreeLon;

  const by =
    b[1] *
    metersPerDegreeLat;

  const abX =
    bx - ax;

  const abY =
    by - ay;

  const abLengthSquared =
    abX * abX +
    abY * abY;

  let t = 0;

  if (
    abLengthSquared >
    0
  ) {
    t =
      ((px - ax) * abX +
        (py - ay) * abY) /
      abLengthSquared;
  }

  t = Math.max(
    0,
    Math.min(1, t)
  );

  const projectedX =
    ax + t * abX;

  const projectedY =
    ay + t * abY;

  const projected:
    Coordinate = [
    projectedX /
      metersPerDegreeLon,
    projectedY /
      metersPerDegreeLat,
  ];

  return {
    coordinate:
      projected,
    t,
    distanceMeters:
      haversineMeters(
        point,
        projected
      ),
  };
};

const cross2d = (
  ax: number,
  ay: number,
  bx: number,
  by: number
) =>
  ax * by -
  ay * bx;

/*
 * Intersección exacta entre dos segmentos 2D.
 *
 * Devuelve:
 * - coordinate: punto de cruce
 * - tA: posición 0..1 sobre segmento A
 * - tB: posición 0..1 sobre segmento B
 *
 * Los segmentos colineales superpuestos no se parten acá.
 * En nuestra red OSM, normalmente comparten vértices ya existentes.
 */
const segmentIntersection = (
  a1: Coordinate,
  a2: Coordinate,
  b1: Coordinate,
  b2: Coordinate
):
  | {
      coordinate: Coordinate;
      tA: number;
      tB: number;
    }
  | null => {
  const rX =
    a2[0] - a1[0];

  const rY =
    a2[1] - a1[1];

  const sX =
    b2[0] - b1[0];

  const sY =
    b2[1] - b1[1];

  const denominator =
    cross2d(
      rX,
      rY,
      sX,
      sY
    );

  if (
    Math.abs(
      denominator
    ) <
    INTERSECTION_EPSILON
  ) {
    return null;
  }

  const qMinusPX =
    b1[0] - a1[0];

  const qMinusPY =
    b1[1] - a1[1];

  const t =
    cross2d(
      qMinusPX,
      qMinusPY,
      sX,
      sY
    ) /
    denominator;

  const u =
    cross2d(
      qMinusPX,
      qMinusPY,
      rX,
      rY
    ) /
    denominator;

  if (
    t <
      -INTERSECTION_EPSILON ||
    t >
      1 +
        INTERSECTION_EPSILON ||
    u <
      -INTERSECTION_EPSILON ||
    u >
      1 +
        INTERSECTION_EPSILON
  ) {
    return null;
  }

  const safeT =
    Math.max(
      0,
      Math.min(1, t)
    );

  const safeU =
    Math.max(
      0,
      Math.min(1, u)
    );

  return {
    coordinate: [
      a1[0] +
        safeT * rX,
      a1[1] +
        safeT * rY,
    ],
    tA: safeT,
    tB: safeU,
  };
};

const rawSegmentsFromStreets = (
  streets: StreetRow[]
) => {
  const segments:
    RawSegment[] = [];

  let id = 1;

  for (const street of streets) {
    if (
      street.geometry
        ?.type !==
        "LineString" ||
      !Array.isArray(
        street.geometry
          .coordinates
      )
    ) {
      continue;
    }

    const coords =
      street.geometry
        .coordinates;

    for (
      let index = 1;
      index <
      coords.length;
      index += 1
    ) {
      const a =
        coords[
          index - 1
        ];

      const b =
        coords[index];

      if (
        haversineMeters(
          a,
          b
        ) <
        0.05
      ) {
        continue;
      }

      segments.push({
        id,
        streetId:
          street.id,
        streetName:
          street.name,
        a,
        b,
      });

      id += 1;
    }
  }

  return segments;
};

const gridCellKey = (
  x: number,
  y: number
) =>
  `${x}:${y}`;

const segmentGridCells = (
  segment: RawSegment
) => {
  const minLon =
    Math.min(
      segment.a[0],
      segment.b[0]
    );

  const maxLon =
    Math.max(
      segment.a[0],
      segment.b[0]
    );

  const minLat =
    Math.min(
      segment.a[1],
      segment.b[1]
    );

  const maxLat =
    Math.max(
      segment.a[1],
      segment.b[1]
    );

  const minX =
    Math.floor(
      minLon /
        GRID_SIZE_DEGREES
    );

  const maxX =
    Math.floor(
      maxLon /
        GRID_SIZE_DEGREES
    );

  const minY =
    Math.floor(
      minLat /
        GRID_SIZE_DEGREES
    );

  const maxY =
    Math.floor(
      maxLat /
        GRID_SIZE_DEGREES
    );

  const keys: string[] =
    [];

  for (
    let x = minX;
    x <= maxX;
    x += 1
  ) {
    for (
      let y = minY;
      y <= maxY;
      y += 1
    ) {
      keys.push(
        gridCellKey(
          x,
          y
        )
      );
    }
  }

  return keys;
};

const addCut = (
  cuts: Map<
    number,
    SegmentCut[]
  >,
  segmentId: number,
  cut: SegmentCut
) => {
  const list =
    cuts.get(
      segmentId
    ) ?? [];

  /*
   * Evitamos duplicar la misma intersección varias veces
   * cuando dos segmentos comparten más de una celda de la grilla.
   */
  const exists =
    list.some(
      (item) =>
        Math.abs(
          item.t -
            cut.t
        ) <
        1e-9
    );

  if (!exists) {
    list.push(
      cut
    );

    cuts.set(
      segmentId,
      list
    );
  }
};

const buildNodedStreetGraph = (
  streets: StreetRow[]
) => {
  const rawSegments =
    rawSegmentsFromStreets(
      streets
    );

  const cuts =
    new Map<
      number,
      SegmentCut[]
    >();

  /*
   * Cada segmento empieza con sus extremos.
   */
  for (const segment of rawSegments) {
    cuts.set(
      segment.id,
      [
        {
          t: 0,
          coordinate:
            segment.a,
        },
        {
          t: 1,
          coordinate:
            segment.b,
        },
      ]
    );
  }

  /*
   * Índice espacial muy simple para no comparar todos contra todos.
   */
  const buckets =
    new Map<
      string,
      RawSegment[]
    >();

  for (const segment of rawSegments) {
    for (
      const key of
      segmentGridCells(
        segment
      )
    ) {
      const list =
        buckets.get(
          key
        ) ?? [];

      list.push(
        segment
      );

      buckets.set(
        key,
        list
      );
    }
  }

  const comparedPairs =
    new Set<string>();

  let intersectionCount =
    0;

  for (
    const bucketSegments
    of buckets.values()
  ) {
    for (
      let i = 0;
      i <
      bucketSegments.length;
      i += 1
    ) {
      for (
        let j =
          i + 1;
        j <
        bucketSegments.length;
        j += 1
      ) {
        const a =
          bucketSegments[i];

        const b =
          bucketSegments[j];

        /*
         * Si son exactamente el mismo segmento, no comparamos.
         */
        if (
          a.id === b.id
        ) {
          continue;
        }

        const minId =
          Math.min(
            a.id,
            b.id
          );

        const maxId =
          Math.max(
            a.id,
            b.id
          );

        const pairKey =
          `${minId}:${maxId}`;

        if (
          comparedPairs.has(
            pairKey
          )
        ) {
          continue;
        }

        comparedPairs.add(
          pairKey
        );

        const intersection =
          segmentIntersection(
            a.a,
            a.b,
            b.a,
            b.b
          );

        if (
          !intersection
        ) {
          continue;
        }

        /*
         * No hace falta crear una intersección extra
         * si ambos segmentos ya comparten exactamente un extremo.
         * Igual agregamos los cortes porque después se deduplican.
         */
        addCut(
          cuts,
          a.id,
          {
            t:
              intersection.tA,
            coordinate:
              intersection.coordinate,
          }
        );

        addCut(
          cuts,
          b.id,
          {
            t:
              intersection.tB,
            coordinate:
              intersection.coordinate,
          }
        );

        intersectionCount +=
          1;
      }
    }
  }

  const graph:
    Graph =
    new Map();

  const nodeCoordinates =
    new Map<
      string,
      Coordinate
    >();

  const routedSegments:
    RoutedSegment[] = [];

  /*
   * Partimos cada segmento original en todos sus puntos de cruce.
   */
  for (const segment of rawSegments) {
    const segmentCuts =
      (cuts.get(
        segment.id
      ) ?? [])
        .sort(
          (a, b) =>
            a.t - b.t
        );

    for (
      let index = 1;
      index <
      segmentCuts.length;
      index += 1
    ) {
      const previous =
        segmentCuts[
          index - 1
        ];

      const current =
        segmentCuts[
          index
        ];

      const a =
        previous.coordinate;

      const b =
        current.coordinate;

      const distance =
        haversineMeters(
          a,
          b
        );

      if (
        !Number.isFinite(
          distance
        ) ||
        distance <
          0.05
      ) {
        continue;
      }

      const aKey =
        nodeKey(
          a[0],
          a[1]
        );

      const bKey =
        nodeKey(
          b[0],
          b[1]
        );

      nodeCoordinates.set(
        aKey,
        a
      );

      nodeCoordinates.set(
        bKey,
        b
      );

      addEdge(
        graph,
        aKey,
        {
          to: bKey,
          distance,
          streetId:
            segment.streetId,
          streetName:
            segment.streetName,
        }
      );

      addEdge(
        graph,
        bKey,
        {
          to: aKey,
          distance,
          streetId:
            segment.streetId,
          streetName:
            segment.streetName,
        }
      );

      routedSegments.push({
        streetId:
          segment.streetId,
        streetName:
          segment.streetName,
        a,
        b,
        aKey,
        bKey,
        lengthMeters:
          distance,
      });
    }
  }

  return {
    graph,
    nodeCoordinates,
    segments:
      routedSegments,
    rawSegments:
      rawSegments.length,
    intersections:
      intersectionCount,
  };
};

const findNearestSegmentSnap = (
  point: Coordinate,
  segments:
    RoutedSegment[],
  preferredBearing?: number | null
) => {
  let best:
    | {
        segment:
          RoutedSegment;
        coordinate:
          Coordinate;
        t: number;
        distanceMeters:
          number;
        score:
          number;
        bearingMismatch:
          number | null;
      }
    | null = null;

  for (const segment of segments) {
    const projection =
      projectPointOnSegment(
        point,
        segment.a,
        segment.b
      );

    let bearingMismatch:
      number | null = null;

    let directionPenalty =
      0;

    /*
     * Si dos calles están casi igual de cerca, preferimos
     * la que tiene una orientación compatible con el movimiento GPS.
     *
     * Importante:
     * esto NO descarta calles por velocidad/estado.
     */
    if (
      preferredBearing !==
        undefined &&
      preferredBearing !==
        null &&
      projection.distanceMeters <=
        45
    ) {
      const segmentBearing =
        bearingDegrees(
          segment.a,
          segment.b
        );

      bearingMismatch =
        undirectedBearingDifference(
          segmentBearing,
          preferredBearing
        );

      /*
       * Hasta ~14 m de penalización equivalente.
       * La distancia real al GPS sigue siendo el criterio principal.
       */
      directionPenalty =
        (bearingMismatch /
          90) *
        14;
    }

    const score =
      projection.distanceMeters +
      directionPenalty;

    if (
      !best ||
      score <
        best.score
    ) {
      best = {
        segment,
        coordinate:
          projection.coordinate,
        t:
          projection.t,
        distanceMeters:
          projection.distanceMeters,
        score,
        bearingMismatch,
      };
    }
  }

  return best;
};

const connectVirtualNodeToSegment =
  ({
    graph,
    nodeCoordinates,
    virtualKey,
    snappedCoordinate,
    segment,
    t,
  }: {
    graph: Graph;
    nodeCoordinates:
      Map<
        string,
        Coordinate
      >;
    virtualKey:
      string;
    snappedCoordinate:
      Coordinate;
    segment:
      RoutedSegment;
    t: number;
  }) => {
    nodeCoordinates.set(
      virtualKey,
      snappedCoordinate
    );

    const distanceToA =
      segment.lengthMeters *
      t;

    const distanceToB =
      segment.lengthMeters *
      (1 - t);

    addEdge(
      graph,
      virtualKey,
      {
        to:
          segment.aKey,
        distance:
          distanceToA,
        streetId:
          segment.streetId,
        streetName:
          segment.streetName,
      }
    );

    addEdge(
      graph,
      segment.aKey,
      {
        to:
          virtualKey,
        distance:
          distanceToA,
        streetId:
          segment.streetId,
        streetName:
          segment.streetName,
      }
    );

    addEdge(
      graph,
      virtualKey,
      {
        to:
          segment.bKey,
        distance:
          distanceToB,
        streetId:
          segment.streetId,
        streetName:
          segment.streetName,
      }
    );

    addEdge(
      graph,
      segment.bKey,
      {
        to:
          virtualKey,
        distance:
          distanceToB,
        streetId:
          segment.streetId,
        streetName:
          segment.streetName,
      }
    );
  };

const shortestPath = (
  graph: Graph,
  nodeCoordinates:
    Map<string, Coordinate>,
  start: string,
  goal: string,
  preferredBearing?: number | null
) => {
  type State = {
    node: string;
    previousNode:
      string | null;
  };

  const stateKey = (
    state: State
  ) =>
    `${state.previousNode ?? "__START__"}>${state.node}`;

  const distances =
    new Map<
      string,
      number
    >();

  const previousState =
    new Map<
      string,
      string
    >();

  const states =
    new Map<
      string,
      State
    >();

  const visited =
    new Set<string>();

  const queue: Array<{
    key: string;
    distance: number;
  }> = [];

  const initialState:
    State = {
    node: start,
    previousNode:
      null,
  };

  const initialKey =
    stateKey(
      initialState
    );

  states.set(
    initialKey,
    initialState
  );

  distances.set(
    initialKey,
    0
  );

  queue.push({
    key:
      initialKey,
    distance: 0,
  });

  let bestGoalState:
    string | null = null;

  while (
    queue.length > 0
  ) {
    queue.sort(
      (a, b) =>
        a.distance -
        b.distance
    );

    const current =
      queue.shift();

    if (!current) {
      break;
    }

    if (
      visited.has(
        current.key
      )
    ) {
      continue;
    }

    visited.add(
      current.key
    );

    const currentState =
      states.get(
        current.key
      );

    if (
      !currentState
    ) {
      continue;
    }

    if (
      currentState.node ===
      goal
    ) {
      bestGoalState =
        current.key;
      break;
    }

    const edges =
      graph.get(
        currentState.node
      ) ?? [];

    const currentCoordinate =
      nodeCoordinates.get(
        currentState.node
      );

    const previousCoordinate =
      currentState.previousNode
        ? nodeCoordinates.get(
            currentState.previousNode
          )
        : null;

    for (const edge of edges) {
      if (
        edge.to ===
        currentState.previousNode
      ) {
        /*
         * U-turn inmediato:
         * no lo prohibimos, pero lo penalizamos fuerte.
         */
      }

      let penalty =
        0;

      const nextCoordinate =
        nodeCoordinates.get(
          edge.to
        );

      if (
        currentCoordinate &&
        nextCoordinate
      ) {
        const outgoingBearing =
          bearingDegrees(
            currentCoordinate,
            nextCoordinate
          );

        /*
         * Al comenzar, orientamos la salida con el sentido GPS.
         */
        if (
          !currentState.previousNode &&
          preferredBearing !==
            undefined &&
          preferredBearing !==
            null
        ) {
          const startMismatch =
            angleDifference(
              outgoingBearing,
              preferredBearing
            );

          penalty +=
            (startMismatch /
              180) *
            20;
        }

        /*
         * En nodos intermedios penalizamos giros bruscos.
         * No buscamos "siempre recto": un giro de 90° es normal,
         * pero un U-turn o zigzag innecesario cuesta más.
         */
        if (
          previousCoordinate
        ) {
          const incomingBearing =
            bearingDegrees(
              previousCoordinate,
              currentCoordinate
            );

          const turn =
            angleDifference(
              incomingBearing,
              outgoingBearing
            );

          if (
            turn > 150
          ) {
            penalty += 35;
          } else if (
            turn > 115
          ) {
            penalty += 12;
          } else if (
            turn > 75
          ) {
            penalty += 4;
          }
        }
      }

      const nextState:
        State = {
        node:
          edge.to,
        previousNode:
          currentState.node,
      };

      const nextKey =
        stateKey(
          nextState
        );

      const candidate =
        current.distance +
        edge.distance +
        penalty;

      const known =
        distances.get(
          nextKey
        ) ??
        Number.POSITIVE_INFINITY;

      if (
        candidate <
        known
      ) {
        distances.set(
          nextKey,
          candidate
        );

        previousState.set(
          nextKey,
          current.key
        );

        states.set(
          nextKey,
          nextState
        );

        queue.push({
          key:
            nextKey,
          distance:
            candidate,
        });
      }
    }
  }

  if (
    !bestGoalState
  ) {
    return null;
  }

  const statePath:
    string[] = [];

  let cursor =
    bestGoalState;

  statePath.push(
    cursor
  );

  while (
    cursor !==
    initialKey
  ) {
    const previous =
      previousState.get(
        cursor
      );

    if (!previous) {
      return null;
    }

    cursor =
      previous;

    statePath.push(
      cursor
    );
  }

  statePath.reverse();

  const nodeKeys:
    string[] = [];

  for (const key of statePath) {
    const state =
      states.get(key);

    if (!state) {
      continue;
    }

    if (
      nodeKeys[
        nodeKeys.length - 1
      ] !== state.node
    ) {
      nodeKeys.push(
        state.node
      );
    }
  }

  /*
   * La distancia que devolvemos debe seguir siendo distancia física,
   * no el costo con penalizaciones.
   */
  let physicalDistance =
    0;

  for (
    let index = 1;
    index <
    nodeKeys.length;
    index += 1
  ) {
    const a =
      nodeCoordinates.get(
        nodeKeys[
          index - 1
        ]
      );

    const b =
      nodeCoordinates.get(
        nodeKeys[index]
      );

    if (a && b) {
      physicalDistance +=
        haversineMeters(
          a,
          b
        );
    }
  }

  return {
    nodeKeys,
    distanceMeters:
      physicalDistance,
  };
};

type InputTrackPoint = {
  lat: number;
  lon: number;
  timestamp?: string | null;
  time?: string | null;
};

const routeBetweenCoordinates = ({
  graph,
  nodeCoordinates,
  segments,
  start,
  end,
  preferredBearing,
}: {
  graph: Graph;
  nodeCoordinates: Map<string, Coordinate>;
  segments: RoutedSegment[];
  start: Coordinate;
  end: Coordinate;
  preferredBearing?: number | null;
}) => {
  const startSnap =
    findNearestSegmentSnap(
      start,
      segments,
      preferredBearing
    );

  const endSnap =
    findNearestSegmentSnap(
      end,
      segments,
      preferredBearing
    );

  if (!startSnap || !endSnap) {
    return {
      ok: false as const,
      reason: "No se encontró una calle cercana.",
    };
  }

  const MAX_SNAP_METERS = 80;

  if (
    startSnap.distanceMeters >
      MAX_SNAP_METERS ||
    endSnap.distanceMeters >
      MAX_SNAP_METERS
  ) {
    return {
      ok: false as const,
      reason:
        "Uno de los puntos está demasiado lejos de la red vial.",
      start_snap_m: Number(
        startSnap.distanceMeters.toFixed(2)
      ),
      end_snap_m: Number(
        endSnap.distanceMeters.toFixed(2)
      ),
    };
  }

  /*
   * Copiamos el grafo superficialmente para que los nodos
   * virtuales de un par GPS no contaminen el siguiente par.
   */
  const localGraph: Graph =
    new Map();

  for (const [key, edges] of graph) {
    localGraph.set(
      key,
      [...edges]
    );
  }

  const localNodeCoordinates =
    new Map(
      nodeCoordinates
    );

  const startKey =
    "__virtual_start__";

  const endKey =
    "__virtual_end__";

  connectVirtualNodeToSegment({
    graph: localGraph,
    nodeCoordinates:
      localNodeCoordinates,
    virtualKey:
      startKey,
    snappedCoordinate:
      startSnap.coordinate,
    segment:
      startSnap.segment,
    t:
      startSnap.t,
  });

  connectVirtualNodeToSegment({
    graph: localGraph,
    nodeCoordinates:
      localNodeCoordinates,
    virtualKey:
      endKey,
    snappedCoordinate:
      endSnap.coordinate,
    segment:
      endSnap.segment,
    t:
      endSnap.t,
  });

  const sameSegment =
    startSnap.segment.streetId ===
      endSnap.segment.streetId &&
    startSnap.segment.aKey ===
      endSnap.segment.aKey &&
    startSnap.segment.bKey ===
      endSnap.segment.bKey;

  if (sameSegment) {
    const directDistance =
      Math.abs(
        startSnap.t -
          endSnap.t
      ) *
      startSnap.segment.lengthMeters;

    addEdge(
      localGraph,
      startKey,
      {
        to: endKey,
        distance:
          directDistance,
        streetId:
          startSnap.segment.streetId,
        streetName:
          startSnap.segment.streetName,
      }
    );

    addEdge(
      localGraph,
      endKey,
      {
        to: startKey,
        distance:
          directDistance,
        streetId:
          startSnap.segment.streetId,
        streetName:
          startSnap.segment.streetName,
      }
    );
  }

  const result =
    shortestPath(
      localGraph,
      localNodeCoordinates,
      startKey,
      endKey,
      preferredBearing
    );

  if (!result) {
    return {
      ok: false as const,
      reason:
        "No se encontró un camino conectado entre ambos puntos.",
      start_snap_m: Number(
        startSnap.distanceMeters.toFixed(2)
      ),
      end_snap_m: Number(
        endSnap.distanceMeters.toFixed(2)
      ),
    };
  }

  const routeCoordinates =
    result.nodeKeys.map(
      (key) => {
        const coordinate =
          localNodeCoordinates.get(
            key
          );

        return (
          coordinate ??
          parseNodeKey(key)
        );
      }
    );

  return {
    ok: true as const,
    start: {
      original:
        start,
      snapped:
        startSnap.coordinate,
      snap_distance_m:
        Number(
          startSnap.distanceMeters.toFixed(
            2
          )
        ),
      street: {
        id:
          startSnap.segment.streetId,
        name:
          startSnap.segment.streetName,
      },
    },
    end: {
      original:
        end,
      snapped:
        endSnap.coordinate,
      snap_distance_m:
        Number(
          endSnap.distanceMeters.toFixed(
            2
          )
        ),
      street: {
        id:
          endSnap.segment.streetId,
        name:
          endSnap.segment.streetName,
      },
    },
    distance_m:
      Number(
        result.distanceMeters.toFixed(
          2
        )
      ),
    geometry: {
      type:
        "LineString" as const,
      coordinates:
        routeCoordinates,
    },
  };
};


const SWEEPING_EDITOR_EMAILS = [
  "waldaquin84@gmail.com",
  "adm.serviciospublicos.mgp@gmail.com",
  "martincornejo.gp@gmail.com",
];

function normalizeAccessValue(
  value: unknown
) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

async function getSweepingAccess() {
  const supabase =
    await createClient();

  const {
    data: { user },
    error: authError,
  } =
    await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      authenticated: false,
      canView: false,
      canEdit: false,
    };
  }

  const { data: profile } =
    await supabase
      .from("users")
      .select(
        "email, role, is_readonly"
      )
      .eq("id", user.id)
      .single();

  const role =
    normalizeAccessValue(
      profile?.role
    );

  const email =
    normalizeAccessValue(
      profile?.email ||
        user.email
    );

  const isAdmin =
    role === "admin";

  const isAdminLectura =
    role === "adminlectura";

  const isServiciosPublicos =
    SWEEPING_EDITOR_EMAILS
      .map(normalizeAccessValue)
      .includes(email);

  return {
    supabase,
    authenticated: true,
    canView:
      isAdmin ||
      isAdminLectura ||
      isServiciosPublicos,
    canEdit:
      (
        isAdmin ||
        isServiciosPublicos
      ) &&
      profile?.is_readonly !== true,
  };
}

function routeStreetNames(
  coordinates: Coordinate[],
  graph: Graph,
  startStreet?: string | null,
  endStreet?: string | null
) {
  const names: string[] = [];

  const pushName = (
    value?: string | null
  ) => {
    const clean =
      value?.trim();

    if (
      clean &&
      !names.includes(clean)
    ) {
      names.push(clean);
    }
  };

  pushName(startStreet);

  for (
    let index = 1;
    index < coordinates.length - 1;
    index += 1
  ) {
    const currentKey =
      nodeKey(
        coordinates[index][0],
        coordinates[index][1]
      );

    const nextKey =
      nodeKey(
        coordinates[index + 1][0],
        coordinates[index + 1][1]
      );

    const edge =
      graph
        .get(currentKey)
        ?.find(
          (item) =>
            item.to === nextKey
        );

    pushName(
      edge?.streetName
    );
  }

  pushName(endStreet);

  return names;
}

function chooseMechanicalTitle(
  names: string[],
  startStreet?: string | null,
  endStreet?: string | null
) {
  const cleanStart =
    startStreet?.trim() || "";

  const cleanEnd =
    endStreet?.trim() || "";

  const normalize = (
    value: string
  ) =>
    value
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  if (
    cleanStart &&
    cleanEnd &&
    normalize(cleanStart) ===
      normalize(cleanEnd)
  ) {
    return cleanStart;
  }

  if (names.length === 1) {
    return names[0];
  }

  if (
    cleanStart &&
    cleanEnd
  ) {
    return `${cleanStart} → ${cleanEnd}`;
  }

  return (
    names[0] ||
    "Corredor mecánico"
  );
}

function parsePlanningDate(
  value?: string | null
) {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return null;
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

type MechanicalBody = {
  action?: "detect" | "save";
  start?: {
    lat?: number;
    lng?: number;
  };
  end?: {
    lat?: number;
    lng?: number;
  };
  work_date?: string | null;
  planned_from?: string | null;
  planned_to?: string | null;
  observations?: string | null;
};

export async function POST(
  request: NextRequest
) {
  try {
    const access =
      await getSweepingAccess();

    if (!access.authenticated) {
      return NextResponse.json(
        {
          error:
            "No autenticado.",
        },
        {
          status: 401,
        }
      );
    }

    if (!access.canView) {
      return NextResponse.json(
        {
          error:
            "No tenés permisos para acceder al Mapa de Barrido.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      (await request.json()) as
        MechanicalBody;

    const action =
      body.action === "save"
        ? "save"
        : "detect";

    const startLat =
      Number(body.start?.lat);

    const startLon =
      Number(body.start?.lng);

    const endLat =
      Number(body.end?.lat);

    const endLon =
      Number(body.end?.lng);

    if (
      !Number.isFinite(startLat) ||
      !Number.isFinite(startLon) ||
      !Number.isFinite(endLat) ||
      !Number.isFinite(endLon)
    ) {
      return NextResponse.json(
        {
          error:
            "Los dos puntos seleccionados no son válidos.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * En lugar de exigir que A y B pertenezcan a la misma pieza/calle,
     * usamos el grafo vial completo. Esto permite atravesar todos los
     * segmentos OSM necesarios entre ambos puntos.
     */
    const {
      data,
      error,
    } =
      await access.supabase.rpc(
        "test_get_city_street_graph"
      );

    if (error) {
      return NextResponse.json(
        {
          error:
            `No se pudo cargar la red vial: ${error.message}`,
        },
        {
          status: 500,
        }
      );
    }

    const streets =
      Array.isArray(data)
        ? (data as StreetRow[])
        : [];

    if (streets.length === 0) {
      return NextResponse.json(
        {
          error:
            "La red vial está vacía.",
        },
        {
          status: 500,
        }
      );
    }

    const {
      graph,
      nodeCoordinates,
      segments,
    } =
      buildNodedStreetGraph(
        streets
      );

    const start:
      Coordinate = [
      startLon,
      startLat,
    ];

    const end:
      Coordinate = [
      endLon,
      endLat,
    ];

    const routed =
      routeBetweenCoordinates({
        graph,
        nodeCoordinates,
        segments,
        start,
        end,
        preferredBearing:
          bearingDegrees(
            start,
            end
          ),
      });

    if (!routed.ok) {
      return NextResponse.json(
        {
          error:
            routed.reason ||
            "No se encontró un recorrido conectado entre los dos puntos.",
          start_snap_m:
            routed.start_snap_m,
          end_snap_m:
            routed.end_snap_m,
        },
        {
          status: 422,
        }
      );
    }

    const streetNames =
      routeStreetNames(
        routed.geometry.coordinates,
        graph,
        routed.start.street.name,
        routed.end.street.name
      );

    const streetTitle =
      chooseMechanicalTitle(
        streetNames,
        routed.start.street.name,
        routed.end.street.name
      );

    const corridor = {
      corridor_key:
        streetNames
          .map(
            (name) =>
              name
                .toUpperCase()
                .normalize("NFD")
                .replace(
                  /[\u0300-\u036f]/g,
                  ""
                )
                .replace(
                  /\s+/g,
                  " "
                )
                .trim()
          )
          .join(" > ") ||
        "CORREDOR_MECANICO",

      street_name:
        streetTitle,

      from_street:
        routed.start.street.name
          ? `Punto A · ${routed.start.street.name}`
          : "Punto A",

      to_street:
        routed.end.street.name
          ? `Punto B · ${routed.end.street.name}`
          : "Punto B",

      start_distance_meters:
        routed.start.snap_distance_m,

      end_distance_meters:
        routed.end.snap_distance_m,

      length_meters:
        routed.distance_m,

      streets_used:
        streetNames,

      geometry:
        routed.geometry,
    };

    if (action === "detect") {
      return NextResponse.json({
        success: true,
        routing_mode:
          "street_graph",
        data:
          corridor,
      });
    }

    if (!access.canEdit) {
      return NextResponse.json(
        {
          error:
            "Tu cuenta tiene acceso de solo lectura.",
        },
        {
          status: 403,
        }
      );
    }

    const plannedFrom =
      body.planned_from ??
      body.work_date ??
      null;

    const plannedTo =
      body.planned_to ??
      body.work_date ??
      null;

    const plannedFromDate =
      parsePlanningDate(
        plannedFrom
      );

    const plannedToDate =
      parsePlanningDate(
        plannedTo
      );

    if (
      !plannedFromDate ||
      !plannedToDate
    ) {
      return NextResponse.json(
        {
          error:
            "El período de planificación no es válido.",
        },
        { status: 400 }
      );
    }

    if (
      plannedToDate.getTime() <
      plannedFromDate.getTime()
    ) {
      return NextResponse.json(
        {
          error:
            "La fecha Hasta no puede ser anterior a la fecha Desde.",
        },
        { status: 400 }
      );
    }

    const planningDays =
      Math.floor(
        (
          plannedToDate.getTime() -
          plannedFromDate.getTime()
        ) /
          (1000 * 60 * 60 * 24)
      );

    if (planningDays > 179) {
      return NextResponse.json(
        {
          error:
            "El período máximo de planificación es de 180 días.",
        },
        { status: 400 }
      );
    }

    const {
      data: savedId,
      error: saveError,
    } =
      await access.supabase.rpc(
        "test_create_mechanical_sweeping_record",
        {
          p_main_street:
            corridor.street_name,
          p_from_street:
            corridor.from_street,
          p_to_street:
            corridor.to_street,
          p_geometry_geojson:
            JSON.stringify(
              corridor.geometry
            ),
          p_work_date:
            body.work_date ??
            null,
          p_observations:
            body.observations?.trim() ||
            null,
        }
      );

    if (saveError) {
      return NextResponse.json(
        {
          error:
            saveError.message,
        },
        {
          status: 500,
        }
      );
    }

    const createdId =
      typeof savedId === "string"
        ? savedId
        : String(
            (savedId as any)?.id ??
              ""
          ).trim();

    if (createdId) {
      const {
        error: periodError,
      } = await access.supabase.rpc(
        "test_set_sweeping_record_planning_period",
        {
          p_record_id:
            createdId,
          p_planned_from:
            plannedFrom,
          p_planned_to:
            plannedTo,
        }
      );

      if (periodError) {
        console.error(
          "Error guardando período del corredor mecánico:",
          periodError
        );

        return NextResponse.json(
          { error: periodError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        id:
          savedId,
        routing_mode:
          "street_graph",
        data:
          corridor,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Error en corredor mecánico por red vial:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error interno procesando el corredor mecánico.",
      },
      {
        status: 500,
      }
    );
  }
}
