import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* ============================================================
 * TIPOS
 * ============================================================ */

type PolygonGeometry = {
  type: "Polygon";
  coordinates: number[][][];
};

type MultiPolygonGeometry = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

type AreaGeometry =
  | PolygonGeometry
  | MultiPolygonGeometry;

type AreaStreetsBody = {
  geometry?: AreaGeometry;
  min_length_meters?: number;
};

/* ============================================================
 * PERMISOS
 * ============================================================ */

const GRADING_EDITOR_EMAILS = [
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

async function getGradingAccess() {
  const supabase =
    await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

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

  const userRole =
    normalizeAccessValue(
      profile?.role
    );

  const userEmail =
    normalizeAccessValue(
      profile?.email ||
        user.email
    );

  const isAdmin =
    userRole === "admin";

  const isAdminLectura =
    userRole === "adminlectura";

  const isServiciosPublicos =
    GRADING_EDITOR_EMAILS
      .map(normalizeAccessValue)
      .includes(userEmail);

  const canView =
    isAdmin ||
    isAdminLectura ||
    isServiciosPublicos;

  const canEdit =
    (isAdmin ||
      isServiciosPublicos) &&
    profile?.is_readonly !== true;

  return {
    supabase,
    authenticated: true,
    canView,
    canEdit,
  };
}

/* ============================================================
 * VALIDACIÓN
 * ============================================================ */

function isValidAreaGeometry(
  geometry: unknown
): geometry is AreaGeometry {
  if (
    !geometry ||
    typeof geometry !== "object"
  ) {
    return false;
  }

  const value =
    geometry as {
      type?: unknown;
      coordinates?: unknown;
    };

  if (
    value.type !== "Polygon" &&
    value.type !== "MultiPolygon"
  ) {
    return false;
  }

  if (
    !Array.isArray(
      value.coordinates
    )
  ) {
    return false;
  }

  return true;
}

/* ============================================================
 * POST
 *
 * Recibe un polígono GeoJSON y devuelve las calles
 * que intersectan esa zona.
 * ============================================================ */

export async function POST(
  request: Request
) {
  try {
    const access =
      await getGradingAccess();

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
            "No tenés permisos para acceder al Mapa de Motonivelación.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      (await request.json()) as
        AreaStreetsBody;

    const geometry =
      body.geometry;

    if (
      !isValidAreaGeometry(
        geometry
      )
    ) {
      return NextResponse.json(
        {
          error:
            "La zona dibujada no es válida.",
        },
        {
          status: 400,
        }
      );
    }

    let minLengthMeters =
      Number(
        body.min_length_meters ??
          15
      );

    if (
      !Number.isFinite(
        minLengthMeters
      )
    ) {
      minLengthMeters = 15;
    }

    minLengthMeters =
      Math.max(
        0,
        Math.min(
          minLengthMeters,
          500
        )
      );

    const supabase =
      access.supabase;

    const {
      data,
      error,
    } = await supabase.rpc(
      "test_get_grading_streets_in_area",
      {
        p_area_geojson:
          JSON.stringify(
            geometry
          ),

        p_min_length_meters:
          minLengthMeters,
      }
    );

    if (error) {
      console.error(
        "Error obteniendo calles de la zona:",
        error
      );

      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 500,
        }
      );
    }

    const streets =
      Array.isArray(data)
        ? data
        : [];

    const highPriority =
      streets.filter(
        (street: any) =>
          street.priority ===
          "ALTA"
      ).length;

    const mediumPriority =
      streets.filter(
        (street: any) =>
          street.priority ===
          "MEDIA"
      ).length;

    const lowPriority =
      streets.filter(
        (street: any) =>
          street.priority ===
          "BAJA"
      ).length;

    const totalLengthMeters =
      streets.reduce(
        (
          total: number,
          street: any
        ) =>
          total +
          Number(
            street.length_meters ||
              0
          ),
        0
      );

    return NextResponse.json(
      {
        success: true,

        summary: {
          total:
            streets.length,

          high_priority:
            highPriority,

          medium_priority:
            mediumPriority,

          low_priority:
            lowPriority,

          total_length_meters:
            Math.round(
              totalLengthMeters *
                10
            ) / 10,

          total_length_km:
            Math.round(
              (totalLengthMeters /
                1000) *
                100
            ) / 100,
        },

        streets,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Error interno obteniendo calles de la zona:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Error interno obteniendo las calles de la zona.",
      },
      {
        status: 500,
      }
    );
  }
}