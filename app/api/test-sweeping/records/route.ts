import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type GeoJsonLineString = {
  type: "LineString";
  coordinates: number[][];
};

type CreateSweepingRecordBody = {
  main_street?: string;
  from_street?: string;
  to_street?: string;

  geometry?: GeoJsonLineString;

  work_date?: string | null;
  zone?: string | null;
  observations?: string | null;
  status?: string | null;
};

type UpdateSweepingRecordBody = {
  id?: string;

  main_street?: string;
  from_street?: string;
  to_street?: string;

  geometry?: GeoJsonLineString;

  work_date?: string | null;
  zone?: string | null;
  observations?: string | null;
  status?: string | null;
};

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function daysBetween(
  from: Date,
  to: Date
) {
  const milliseconds =
    to.getTime() -
    from.getTime();

  return Math.floor(
    milliseconds /
      (
        1000 *
        60 *
        60 *
        24
      )
  );
}

/*
 * ============================================================
 * GET
 *
 * Traer barridos guardados por rango.
 *
 * Máximo permitido: 31 días.
 *
 * Ejemplo:
 *
 * /api/test-sweeping/records?from=2026-09-01&to=2026-09-30
 * ============================================================
 */

export async function GET(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    const url =
      new URL(
        request.url
      );

    const fromParam =
      url.searchParams.get(
        "from"
      );

    const toParam =
      url.searchParams.get(
        "to"
      );

    /*
     * Si no mandamos fechas,
     * usamos HOY.
     */

    const today =
      new Date()
        .toISOString()
        .slice(
          0,
          10
        );

    const fromString =
      fromParam ||
      today;

    const toString =
      toParam ||
      today;

    const fromDate =
      parseDate(
        fromString
      );

    const toDate =
      parseDate(
        toString
      );

    if (
      !fromDate ||
      !toDate
    ) {
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

    const difference =
      daysBetween(
        fromDate,
        toDate
      );

    /*
     * 01 → 31 = diferencia 30.
     *
     * Por eso:
     * difference > 30
     * significa más de 31 días inclusivos.
     */

    if (
      difference >
      30
    ) {
      return NextResponse.json(
        {
          error:
            "El rango máximo permitido es de 31 días.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ======================================================
     * LEER MEDIANTE RPC
     *
     * Evitamos SELECT directo sobre la tabla
     * para no depender de RLS.
     * ======================================================
     */

    const {
      data,
      error,
    } = await supabase.rpc(
      "test_get_sweeping_records_filtered",
      {
        p_from_date:
          fromString,

        p_to_date:
          toString,
      }
    );

    if (error) {
      console.error(
        "Error obteniendo barridos guardados:",
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
      data ??
        []
    );
  } catch (error) {
    console.error(
      "Error interno obteniendo barridos:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Error interno obteniendo barridos.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * ============================================================
 * POST
 *
 * Guardar un nuevo tramo
 * ============================================================
 */

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    const body =
      (
        await request.json()
      ) as CreateSweepingRecordBody;

    const mainStreet =
      body.main_street?.trim() ??
      "";

    const fromStreet =
      body.from_street?.trim() ??
      "";

    const toStreet =
      body.to_street?.trim() ??
      "";

    const geometry =
      body.geometry;

    /*
     * --------------------------------------------------------
     * VALIDACIONES
     * --------------------------------------------------------
     */

    if (!mainStreet) {
      return NextResponse.json(
        {
          error:
            "Falta la calle principal.",
        },
        {
          status: 400,
        }
      );
    }

    if (!fromStreet) {
      return NextResponse.json(
        {
          error:
            "Falta la calle de inicio.",
        },
        {
          status: 400,
        }
      );
    }

    if (!toStreet) {
      return NextResponse.json(
        {
          error:
            "Falta la calle final.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !geometry ||
      geometry.type !==
        "LineString" ||
      !Array.isArray(
        geometry.coordinates
      ) ||
      geometry.coordinates.length <
        2
    ) {
      return NextResponse.json(
        {
          error:
            "La geometría del tramo no es válida.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * GEOJSON A STRING
     * --------------------------------------------------------
     */

    const geoJsonString =
      JSON.stringify(
        geometry
      );

    /*
     * --------------------------------------------------------
     * GUARDAR MEDIANTE RPC
     * --------------------------------------------------------
     */

    const {
      data,
      error,
    } = await supabase.rpc(
      "test_create_sweeping_record",
      {
        p_main_street:
          mainStreet,

        p_from_street:
          fromStreet,

        p_to_street:
          toStreet,

        p_geometry_geojson:
          geoJsonString,

        p_work_date:
          body.work_date ??
          null,

        p_zone:
          body.zone?.trim() ||
          null,

        p_observations:
          body.observations?.trim() ||
          null,

        p_status:
          body.status?.trim() ||
          "COMPLETADO",
      }
    );

    if (error) {
      console.error(
        "Error guardando barrido:",
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
        record:
          data,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Error interno guardando barrido:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Error interno guardando barrido.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * ============================================================
 * PUT
 *
 * Editar tramo completo
 *
 * IMPORTANTE:
 *
 * Si cambian calle principal,
 * desde o hasta,
 * el frontend debe recalcular geometry
 * antes de llamar a este endpoint.
 * ============================================================
 */

export async function PUT(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    const body =
      (
        await request.json()
      ) as UpdateSweepingRecordBody;

    const id =
      body.id?.trim() ??
      "";

    const mainStreet =
      body.main_street?.trim() ??
      "";

    const fromStreet =
      body.from_street?.trim() ??
      "";

    const toStreet =
      body.to_street?.trim() ??
      "";

    const geometry =
      body.geometry;

    /*
     * --------------------------------------------------------
     * VALIDACIONES
     * --------------------------------------------------------
     */

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Falta el ID del tramo.",
        },
        {
          status: 400,
        }
      );
    }

    if (!mainStreet) {
      return NextResponse.json(
        {
          error:
            "Falta la calle principal.",
        },
        {
          status: 400,
        }
      );
    }

    if (!fromStreet) {
      return NextResponse.json(
        {
          error:
            "Falta la calle de inicio.",
        },
        {
          status: 400,
        }
      );
    }

    if (!toStreet) {
      return NextResponse.json(
        {
          error:
            "Falta la calle final.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !geometry ||
      geometry.type !==
        "LineString" ||
      !Array.isArray(
        geometry.coordinates
      ) ||
      geometry.coordinates.length <
        2
    ) {
      return NextResponse.json(
        {
          error:
            "La geometría del tramo no es válida.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * FECHA
     * --------------------------------------------------------
     */

    if (
      body.work_date
    ) {
      const workDate =
        parseDate(
          body.work_date
        );

      if (!workDate) {
        return NextResponse.json(
          {
            error:
              "La fecha de trabajo no es válida.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * --------------------------------------------------------
     * GEOJSON A STRING
     * --------------------------------------------------------
     */

    const geoJsonString =
      JSON.stringify(
        geometry
      );

    /*
     * --------------------------------------------------------
     * ACTUALIZAR MEDIANTE RPC
     * --------------------------------------------------------
     */

    const {
      data,
      error,
    } = await supabase.rpc(
      "test_update_sweeping_record",
      {
        p_id:
          id,

        p_main_street:
          mainStreet,

        p_from_street:
          fromStreet,

        p_to_street:
          toStreet,

        p_geometry_geojson:
          geoJsonString,

        p_work_date:
          body.work_date ??
          null,

        p_observations:
          body.observations?.trim() ||
          "",

        p_status:
          body.status?.trim() ||
          "COMPLETADO",
      }
    );

    if (error) {
      console.error(
        "Error actualizando tramo:",
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
        record:
          data,
      }
    );
  } catch (error) {
    console.error(
      "Error interno actualizando tramo:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Error interno actualizando tramo.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * ============================================================
 * DELETE
 *
 * Eliminar tramo mediante RPC
 *
 * Ejemplo:
 *
 * /api/test-sweeping/records?id=UUID
 * ============================================================
 */

export async function DELETE(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    const url =
      new URL(
        request.url
      );

    const id =
      url.searchParams.get(
        "id"
      );

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Falta el ID del tramo.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * ELIMINAR MEDIANTE RPC
     * --------------------------------------------------------
     */

    const {
      data,
      error,
    } = await supabase.rpc(
      "test_delete_sweeping_record",
      {
        p_id:
          id,
      }
    );

    if (error) {
      console.error(
        "Error eliminando tramo:",
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

    /*
     * La RPC devuelve boolean.
     *
     * true:
     * encontró y eliminó.
     *
     * false:
     * no existía ese ID.
     */

    if (
      data !==
      true
    ) {
      return NextResponse.json(
        {
          error:
            "No se encontró el tramo a eliminar.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
      }
    );
  } catch (error) {
    console.error(
      "Error interno eliminando tramo:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Error interno eliminando tramo.",
      },
      {
        status: 500,
      }
    );
  }
}