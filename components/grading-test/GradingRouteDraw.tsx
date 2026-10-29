"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

type GeoJsonLineString = {
  type: "LineString";
  coordinates: number[][];
};

type GradingRouteDrawProps = {
  drawing: boolean;
  clearToken: number;
  finishToken: number;
  undoToken: number;

  onCreated: (
    geometry: GeoJsonLineString
  ) => void;

  onDrawingFinished: () => void;
};

export default function GradingRouteDraw({
  drawing,
  clearToken,
  finishToken,
  undoToken,
  onCreated,
  onDrawingFinished,
}: GradingRouteDrawProps) {
  const map = useMap();

  const pointsRef =
    useRef<L.LatLng[]>([]);

  const polylineRef =
    useRef<L.Polyline | null>(null);

  const markersRef =
    useRef<L.CircleMarker[]>([]);

  /*
   * Guardamos callbacks en refs para que un render del padre
   * no vuelva a registrar innecesariamente los eventos del mapa.
   */
  const onCreatedRef =
    useRef(onCreated);

  const onDrawingFinishedRef =
    useRef(onDrawingFinished);

  useEffect(() => {
    onCreatedRef.current =
      onCreated;
  }, [
    onCreated,
  ]);

  useEffect(() => {
    onDrawingFinishedRef.current =
      onDrawingFinished;
  }, [
    onDrawingFinished,
  ]);

  /*
   * ==========================================================
   * ACTUALIZAR LÍNEA
   * ==========================================================
   */

  function refreshPolyline() {
    const points =
      pointsRef.current;

    /*
     * Sin puntos:
     * sacamos la línea temporal.
     */
    if (
      points.length === 0
    ) {
      if (
        polylineRef.current &&
        map.hasLayer(
          polylineRef.current
        )
      ) {
        map.removeLayer(
          polylineRef.current
        );
      }

      polylineRef.current =
        null;

      return;
    }

    /*
     * Si todavía no existe,
     * la creamos.
     */
    if (
      !polylineRef.current
    ) {
      polylineRef.current =
        L.polyline(
          points,
          {
            color:
              "#10b981",

            weight:
              6,

            opacity:
              0.95,

            lineCap:
              "round",

            lineJoin:
              "round",

            interactive:
              false,
          }
        ).addTo(map);

      return;
    }

    /*
     * Si ya existe,
     * actualizamos todos sus puntos.
     */
    polylineRef.current.setLatLngs(
      points
    );
  }

  /*
   * ==========================================================
   * LIMPIAR DIBUJO COMPLETO
   * ==========================================================
   */

  function clearDrawing() {
    if (
      polylineRef.current &&
      map.hasLayer(
        polylineRef.current
      )
    ) {
      map.removeLayer(
        polylineRef.current
      );
    }

    markersRef.current.forEach(
      (marker) => {
        if (
          map.hasLayer(
            marker
          )
        ) {
          map.removeLayer(
            marker
          );
        }
      }
    );

    polylineRef.current =
      null;

    markersRef.current = [];

    pointsRef.current = [];
  }

  /*
   * ==========================================================
   * DESHACER ÚLTIMO PUNTO
   * ==========================================================
   */

  function undoLastPoint() {
    if (
      pointsRef.current.length ===
      0
    ) {
      return;
    }

    /*
     * Quitamos el último punto.
     */
    pointsRef.current.pop();

    /*
     * Quitamos también su marcador.
     */
    const lastMarker =
      markersRef.current.pop();

    if (
      lastMarker &&
      map.hasLayer(
        lastMarker
      )
    ) {
      map.removeLayer(
        lastMarker
      );
    }

    /*
     * Redibujamos la polyline
     * con los puntos que quedaron.
     */
    refreshPolyline();
  }

  /*
   * ==========================================================
   * FINALIZAR DIBUJO
   * ==========================================================
   */

  function finishDrawing() {
    /*
     * Necesitamos mínimo dos puntos.
     */
    if (
      pointsRef.current.length <
      2
    ) {
      return;
    }

    const geometry:
      GeoJsonLineString = {
        type:
          "LineString",

        coordinates:
          pointsRef.current.map(
            (point) => [
              point.lng,
              point.lat,
            ]
          ),
      };

    onCreatedRef.current(
      geometry
    );

    onDrawingFinishedRef.current();
  }

  /*
   * ==========================================================
   * CLEAR TOKEN
   *
   * Limpia todo, pero si drawing sigue en true
   * permite continuar dibujando desde cero.
   * ==========================================================
   */

  useEffect(() => {
    clearDrawing();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clearToken,
  ]);

  /*
   * ==========================================================
   * UNDO TOKEN
   *
   * El padre incrementa este valor cuando se presiona
   * "Deshacer último punto".
   * ==========================================================
   */

  useEffect(() => {
    if (!drawing) {
      return;
    }

    undoLastPoint();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    undoToken,
  ]);

  /*
   * ==========================================================
   * FINISH TOKEN
   * ==========================================================
   */

  useEffect(() => {
    if (!drawing) {
      return;
    }

    finishDrawing();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    finishToken,
  ]);

  /*
   * ==========================================================
   * DIBUJO
   * ==========================================================
   */

  useEffect(() => {
    if (!drawing) {
      return;
    }

    function handleClick(
      event: L.LeafletMouseEvent
    ) {
      const point =
        event.latlng;

      pointsRef.current.push(
        point
      );

      /*
       * Punto visual.
       */
      const marker =
        L.circleMarker(
          point,
          {
            radius:
              5,

            color:
              "#ffffff",

            weight:
              2,

            fillColor:
              "#10b981",

            fillOpacity:
              1,

            interactive:
              false,
          }
        ).addTo(map);

      markersRef.current.push(
        marker
      );

      refreshPolyline();
    }

    map.on(
      "click",
      handleClick
    );

    return () => {
      map.off(
        "click",
        handleClick
      );
    };
  }, [
    map,
    drawing,
  ]);

  /*
   * ==========================================================
   * DESMONTAR
   * ==========================================================
   */

  useEffect(() => {
    return () => {
      clearDrawing();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    map,
  ]);

  return null;
}
