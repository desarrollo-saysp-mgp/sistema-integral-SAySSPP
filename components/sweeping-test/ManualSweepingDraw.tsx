"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

type GeoJsonLineString = {
  type: "LineString";
  coordinates: number[][];
};

type ManualSweepingDrawProps = {
  drawing: boolean;
  clearToken: number;
  finishToken: number;

  onCreated: (
    geometry: GeoJsonLineString
  ) => void;

  onDrawingFinished: () => void;
};

export default function ManualSweepingDraw({
  drawing,
  clearToken,
  finishToken,
  onCreated,
  onDrawingFinished,
}: ManualSweepingDrawProps) {
  const map = useMap();

  const pointsRef =
    useRef<L.LatLng[]>([]);

  const polylineRef =
    useRef<L.Polyline | null>(null);

  const markersRef =
    useRef<L.CircleMarker[]>([]);

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

  function finishDrawing() {
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

    onCreated(
      geometry
    );

    onDrawingFinished();
  }

  useEffect(() => {
    clearDrawing();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clearToken,
  ]);

  useEffect(() => {
    if (!drawing) {
      return;
    }

    finishDrawing();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    finishToken,
  ]);

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

      const marker =
        L.circleMarker(
          point,
          {
            radius: 5,

            color:
              "#ffffff",

            weight: 2,

            fillColor:
              "#10b981",

            fillOpacity: 1,

            interactive:
              false,
          }
        ).addTo(map);

      markersRef.current.push(
        marker
      );

      if (
        !polylineRef.current
      ) {
        polylineRef.current =
          L.polyline(
            pointsRef.current,
            {
              color:
                "#10b981",

              weight: 6,

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

      polylineRef.current.setLatLngs(
        pointsRef.current
      );
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
