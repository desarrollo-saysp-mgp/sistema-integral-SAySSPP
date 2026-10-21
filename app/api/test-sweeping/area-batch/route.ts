import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type GeoJsonLineString = {
  type: "LineString";
  coordinates: number[][];
};

type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

type AreaBatchRecord = {
  main_street?: string;
  from_street?: string;
  to_street?: string;
  geometry?: GeoJsonLineString;
};

type CreateAreaBatchBody = {
  batch_id?: string;
  work_date?: string | null;
  observations?: string | null;
  color?: string | null;
  geometry?: GeoJsonPolygon;
  records?: AreaBatchRecord[];
};

const SWEEPING_EDITOR_EMAILS = [
  "waldaquin84@gmail.com",
  "adm.serviciospublicos.mgp@gmail.com",
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

function parseDate(
  value: string | null
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      `${value}T00:00:00`
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function daysBetween(
  from: Date,
  to: Date
) {
  return Math.floor(
    (
      to.getTime() -
      from.getTime()
    ) /
      (
        1000 *
        60 *
        60 *
        24
      )
  );
}

function isUuid(
  value?: string | null
) {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function isLineString(
  value: unknown
): value is GeoJsonLineString {
  const geometry =
    value as GeoJsonLineString;

  return Boolean(
    geometry &&
    geometry.type ===
      "LineString" &&
    Array.isArray(
      geometry.coordinates
    ) &&
    geometry.coordinates.length >= 2
  );
}

function isPolygon(
  value: unknown
): value is GeoJsonPolygon {
  const geometry =
    value as GeoJsonPolygon;

  return Boolean(
    geometry &&
    geometry.type ===
      "Polygon" &&
    Array.isArray(
      geometry.coordinates
    ) &&
    Array.isArray(
      geometry.coordinates[0]
    ) &&
    geometry.coordinates[0].length >= 4
  );
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
      .eq(
        "id",
        user.id
      )
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
    userRole ===
    "adminlectura";

  const isServiciosPublicos =
    SWEEPING_EDITOR_EMAILS
      .map(
        normalizeAccessValue
      )
      .includes(
        userEmail
      );

  const canView =
    isAdmin ||
    isAdminLectura ||
    isServiciosPublicos;

  const canEdit =
    (
      isAdmin ||
      isServiciosPublicos
    ) &&
    profile?.is_readonly !==
      true;

  return {
    supabase,
    authenticated: true,
    canView,
    canEdit,
  };
}

function unauthorizedResponse() {
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

function readOnlyResponse() {
  return NextResponse.json(
    {
      error:
        "Tu cuenta tiene acceso de solo lectura al Mapa de Barrido.",
    },
    {
      status: 403,
    }
  );
}

export async function GET(
  request: Request
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
      return unauthorizedResponse();
    }

    const url =
      new URL(
        request.url
      );

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    const fromString =
      url.searchParams.get(
        "from"
      ) || today;

    const toString =
      url.searchParams.get(
        "to"
      ) || today;

    const fromDate =
      parseDate(
        fromString
      );

    const toDate =
      parseDate(
        toString
      );

    if (!fromDate || !toDate) {
      return NextResponse.json(
        {
          error:
            "El rango de fechas no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      toDate.getTime() <
      fromDate.getTime()
    ) {
      return NextResponse.json(
        {
          error:
            "La fecha hasta no puede ser anterior a la fecha desde.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      daysBetween(
        fromDate,
        toDate
      ) > 179
    ) {
      return NextResponse.json(
        {
          error:
            "El rango máximo permitido es de 180 días.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data,
      error,
    } =
      await access.supabase.rpc(
        "test_get_sweeping_area_batches_filtered",
        {
          p_from_date:
            fromString,
          p_to_date:
            toString,
        }
      );

    if (error) {
      console.error(
        "Error obteniendo zonas de barrido:",
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

    return NextResponse.json(
      data ?? []
    );
  } catch (error) {
    console.error(
      "Error interno obteniendo zonas de barrido:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Error interno obteniendo zonas de barrido.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: Request
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
      return unauthorizedResponse();
    }

    if (!access.canEdit) {
      return readOnlyResponse();
    }

    const body =
      (await request.json()) as
        CreateAreaBatchBody;

    const batchId =
      body.batch_id?.trim() ??
      "";

    if (!isUuid(batchId)) {
      return NextResponse.json(
        {
          error:
            "El identificador de la zona no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      body.work_date &&
      !parseDate(
        body.work_date
      )
    ) {
      return NextResponse.json(
        {
          error:
            "La fecha de planificación no es válida.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !isPolygon(
        body.geometry
      )
    ) {
      return NextResponse.json(
        {
          error:
            "El polígono de la zona no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    const records =
      Array.isArray(
        body.records
      )
        ? body.records
        : [];

    if (
      records.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No hay tramos para guardar.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      records.length > 1500
    ) {
      return NextResponse.json(
        {
          error:
            "La zona contiene demasiados tramos para una sola planificación.",
        },
        {
          status: 400,
        }
      );
    }

    const invalidRecord =
      records.some(
        (record) =>
          !record.main_street?.trim() ||
          !record.from_street?.trim() ||
          !record.to_street?.trim() ||
          !isLineString(
            record.geometry
          )
      );

    if (invalidRecord) {
      return NextResponse.json(
        {
          error:
            "Hay al menos un tramo inválido dentro de la zona.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data,
      error,
    } =
      await access.supabase.rpc(
        "test_create_sweeping_area_batch",
        {
          p_batch_id:
            batchId,
          p_work_date:
            body.work_date ??
            null,
          p_observations:
            body.observations?.trim() ||
            null,
          p_color:
            body.color?.trim() ||
            "#f97316",
          p_geometry_geojson:
            JSON.stringify(
              body.geometry
            ),
          p_records:
            records,
        }
      );

    if (error) {
      console.error(
        "Error guardando zona de barrido:",
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

    return NextResponse.json(
      {
        success: true,
        batch_id:
          batchId,
        saved_count:
          Number(data) || 0,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Error interno guardando zona de barrido:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Error interno guardando la zona de barrido.",
      },
      {
        status: 500,
      }
    );
  }
}
