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

  planned_from?: string | null;

  planned_to?: string | null;

  zone?: string | null;

  observations?: string | null;

  status?: string | null;

  action?: "mark_completed" | "mark_batch_completed" | "mark_not_completed" | "undo_not_completed" | null;


  planned_record_id?: string | null;

  batch_id?: string | null;
  result_observation?: string | null;
  result_date?: string | null;

};

type UpdateSweepingRecordBody = CreateSweepingRecordBody & {

  id?: string;

};

/* ============================================================

 * HELPERS

 * ============================================================ */

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

function daysBetween(from: Date, to: Date) {

  const milliseconds = to.getTime() - from.getTime();

  return Math.floor(

    milliseconds / (1000 * 60 * 60 * 24)

  );

}

function ymdFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftYmd(value: string, days: number) {
  const date = parseDate(value);

  if (!date) {
    return value;
  }

  date.setDate(date.getDate() + days);
  return ymdFromDate(date);
}

function rangesOverlap(
  fromA: string,
  toA: string,
  fromB: string,
  toB: string
) {
  return fromA <= toB && toA >= fromB;
}

function isValidGeometry(

  geometry?: GeoJsonLineString | null

) {

  return Boolean(

    geometry &&

      geometry.type === "LineString" &&

      Array.isArray(geometry.coordinates) &&

      geometry.coordinates.length >= 2

  );

}

function normalizeStatus(

  value?: string | null

) {

  const status = (value || "COMPLETADO")

    .trim()

    .toUpperCase();

  if (

    status !== "PLANIFICADO" &&

    status !== "COMPLETADO"

  ) {

    return null;

  }

  return status;

}

/* ============================================================

 * GET

 * Traer barridos guardados por rango.

 * Planificación: máximo 180 días. Realizados: máximo 31 días.

 * ============================================================ */

const SWEEPING_EDITOR_EMAILS = [
  "waldaquin84@gmail.com",
  "adm.serviciospublicos.mgp@gmail.com",
];

function normalizeAccessValue(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

async function getSweepingAccess() {
  const supabase = await createClient();

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

  const { data: profile } = await supabase
    .from("users")
    .select("email, role, is_readonly")
    .eq("id", user.id)
    .single();

  const userRole = normalizeAccessValue(
    profile?.role
  );

  const userEmail = normalizeAccessValue(
    profile?.email || user.email
  );

  const isAdmin =
    userRole === "admin";

  const isAdminLectura =
    userRole === "adminlectura";

  const isServiciosPublicos =
    SWEEPING_EDITOR_EMAILS
      .map(normalizeAccessValue)
      .includes(userEmail);

  const canView =
    isAdmin ||
    isAdminLectura ||
    isServiciosPublicos;

  const canEdit =
    (isAdmin || isServiciosPublicos) &&
    profile?.is_readonly !== true;

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

export async function GET(request: Request) {

  try {

    const access = await getSweepingAccess();

    if (!access.authenticated) {
      return NextResponse.json(
        { error: "No autenticado." },
        { status: 401 }
      );
    }

    if (!access.canView) {
      return unauthorizedResponse();
    }

    const supabase = access.supabase;
    const url = new URL(request.url);

    const today = new Date()

      .toISOString()

      .slice(0, 10);

    const fromString =

      url.searchParams.get("from") || today;

    const toString =

      url.searchParams.get("to") || today;

    const fromDate = parseDate(fromString);

    const toDate = parseDate(toString);

    const statusParam =
      url.searchParams
        .get("status")
        ?.trim()
        .toUpperCase() ?? null;

    if (
      statusParam !== null &&
      statusParam !== "PLANIFICADO" &&
      statusParam !== "COMPLETADO"
    ) {
      return NextResponse.json(
        {
          error:
            "El estado de filtro no es válido.",
        },
        {
          status: 400,
        }
      );
    }

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

    const maxDays =
      statusParam === "PLANIFICADO"
        ? 180
        : 31;

    if (

      daysBetween(

        fromDate,

        toDate

      ) > maxDays - 1

    ) {

      return NextResponse.json(

        {

          error:

            `El rango máximo permitido para ${
              statusParam === "PLANIFICADO"
                ? "Planificación"
                : "Barrido realizado"
            } es de ${maxDays} días.`,

        },

        {

          status: 400,

        }

      );

    }

    /*
     * --------------------------------------------------------
     * PAGINACIÓN INTERNA
     *
     * Supabase/PostgREST puede limitar una respuesta a 1.000
     * filas. Traemos el RPC por páginas y unimos todo antes
     * de responder al frontend.
     * --------------------------------------------------------
     */

    const rpcFromString =
      statusParam === "PLANIFICADO"
        ? shiftYmd(fromString, -179)
        : fromString;

    const pageSize = 1000;
    let offset = 0;
    const records: any[] = [];

    while (true) {
      const {
        data,
        error,
      } = await supabase
        .rpc(
          "test_get_sweeping_records_filtered_v2",
          {
            p_from_date: rpcFromString,
            p_to_date: toString,
          }
        )
        .range(
          offset,
          offset + pageSize - 1
        );

      if (error) {
        console.error(
          "Error obteniendo barridos guardados:",
          error
        );

        return NextResponse.json(
          {
            error: error.message,
          },
          {
            status: 500,
          }
        );
      }

      const pageRecords =
        Array.isArray(data)
          ? data
          : [];

      records.push(
        ...pageRecords
      );

      if (
        pageRecords.length <
        pageSize
      ) {
        break;
      }

      offset += pageSize;
    }

    const recordIds = records
      .map((record) =>
        String(record?.id ?? "").trim()
      )
      .filter(Boolean);

    const periodById =
      new Map<
        string,
        {
          planned_from: string | null;
          planned_to: string | null;
        }
      >();

    if (recordIds.length > 0) {
      const chunkSize = 500;

      for (
        let index = 0;
        index < recordIds.length;
        index += chunkSize
      ) {
        const chunk = recordIds.slice(
          index,
          index + chunkSize
        );

        const {
          data: periodRows,
          error: periodError,
        } = await supabase.rpc(
          "test_get_sweeping_record_periods",
          {
            p_ids: chunk,
          }
        );

        if (periodError) {
          console.error(
            "Error obteniendo períodos de planificación:",
            periodError
          );

          return NextResponse.json(
            { error: periodError.message },
            { status: 500 }
          );
        }

        for (const row of periodRows ?? []) {
          periodById.set(
            String(row.id),
            {
              planned_from:
                row.planned_from ?? null,
              planned_to:
                row.planned_to ?? null,
            }
          );
        }
      }
    }

    const recordsWithPeriods =
      records.map((record) => {
        const period = periodById.get(
          String(record?.id ?? "")
        );

        return {
          ...record,
          planned_from:
            period?.planned_from ??
            record?.planned_from ??
            null,
          planned_to:
            period?.planned_to ??
            record?.planned_to ??
            null,
        };
      });

    const filteredRecords =
      recordsWithPeriods.filter(
        (record) => {
          const currentStatus =
            String(
              record?.status ??
                "COMPLETADO"
            )
              .trim()
              .toUpperCase();

          if (
            statusParam === "PLANIFICADO"
          ) {
            if (
              currentStatus !==
              "PLANIFICADO"
            ) {
              return false;
            }

            const periodFrom =
              String(
                record?.planned_from ??
                  record?.work_date ??
                  ""
              );

            const periodTo =
              String(
                record?.planned_to ??
                  record?.work_date ??
                  ""
              );

            return Boolean(
              periodFrom &&
                periodTo &&
                rangesOverlap(
                  periodFrom,
                  periodTo,
                  fromString,
                  toString
                )
            );
          }

          if (
            statusParam === "COMPLETADO"
          ) {
            return (
              currentStatus !==
              "PLANIFICADO"
            );
          }

          return true;
        }
      );

    // Sólo enriquecemos los planificados; no cambiamos los RPC de lectura actuales.
    if (statusParam === "PLANIFICADO" && filteredRecords.length > 0) {
      const resultIds = filteredRecords.map((item) => String(item.id));
      const resultsById = new Map<string, any>();
      for (let i = 0; i < resultIds.length; i += 500) {
        const { data: details, error: detailsError } = await supabase.rpc(
          "test_get_sweeping_result_details",
          { p_ids: resultIds.slice(i, i + 500) }
        );
        if (detailsError) {
          console.error("Error consultando resultados de barrido:", detailsError);
          return NextResponse.json({ error: detailsError.message }, { status: 500 });
        }
        for (const detail of details ?? []) {
          resultsById.set(String(detail.id), detail);
        }
      }
      return NextResponse.json(filteredRecords.map((item) => ({
        ...item,
        result_status: resultsById.get(String(item.id))?.result_status ?? null,
        result_observation: resultsById.get(String(item.id))?.result_observation ?? null,
        result_date: resultsById.get(String(item.id))?.result_date ?? null,
      })));
    }

    return NextResponse.json(filteredRecords);

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

/* ============================================================

 * POST

 * Guardar un nuevo tramo.

 * Se mantiene la lógica que ya estaba funcionando.

 * ============================================================ */

export async function POST(

  request: Request

) {

  try {

    const access =
      await getSweepingAccess();

    if (!access.authenticated) {
      return NextResponse.json(
        { error: "No autenticado." },
        { status: 401 }
      );
    }

    if (!access.canView) {
      return unauthorizedResponse();
    }

    if (!access.canEdit) {
      return readOnlyResponse();
    }

    const supabase =
      access.supabase;

    const body =

      (await request.json()) as CreateSweepingRecordBody;

    // Acciones independientes; el flujo de realización existente queda intacto.
    if (body.action === "mark_not_completed" || body.action === "undo_not_completed") {
      const plannedId = body.planned_record_id?.trim() ?? "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(plannedId)) {
        return NextResponse.json({ error: "ID de planificación inválido." }, { status: 400 });
      }
      if (body.action === "mark_not_completed") {
        const observation = body.result_observation?.trim() ?? "";
        if (!observation || observation.length > 500) {
          return NextResponse.json({ error: "Escribí una observación de entre 1 y 500 caracteres." }, { status: 400 });
        }
        if (body.result_date && !parseDate(body.result_date)) {
          return NextResponse.json({ error: "Fecha de resultado inválida." }, { status: 400 });
        }
        const { data, error } = await supabase.rpc("test_mark_sweeping_record_not_completed", {
          p_planned_id: plannedId,
          p_observation: observation,
          p_result_date: body.result_date ?? null,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 409 });
        return NextResponse.json({ success: true, record_id: data });
      }
      const { data, error } = await supabase.rpc("test_undo_sweeping_record_not_completed", {
        p_planned_id: plannedId,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 409 });
      return NextResponse.json({ success: true, record_id: data });
    }

    /*
     * --------------------------------------------------------
     * PLANIFICADO -> REALIZADO
     *
     * Crea un NUEVO registro COMPLETADO relacionado al
     * planificado. El planificado original queda intacto.
     * --------------------------------------------------------
     */

    if (body.action === "mark_completed") {

      const plannedRecordId =
        body.planned_record_id?.trim() ?? "";

      if (!plannedRecordId) {

        return NextResponse.json(
          {
            error:
              "Falta el ID del tramo planificado.",
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
              "La fecha de realización no es válida.",
          },
          {
            status: 400,
          }
        );

      }

      let {
        data: completedRecordId,
        error: markError,
      } = await supabase.rpc(
        "test_mark_sweeping_record_completed",
        {
          p_planned_id:
            plannedRecordId,
          p_work_date:
            body.work_date ??
            null,
        }
      );

      /*
       * Compatibilidad:
       * si en la base quedó solamente la firma de 3 parámetros,
       * repetimos la llamada enviando observación null.
       * Este TestSweeping estable NO usa observación de resultado.
       */
      if (
        markError &&
        (
          markError.code === "PGRST202" ||
          markError.message
            ?.toLowerCase()
            .includes(
              "could not find the function"
            )
        )
      ) {
        const fallback =
          await supabase.rpc(
            "test_mark_sweeping_record_completed",
            {
              p_planned_id:
                plannedRecordId,
              p_work_date:
                body.work_date ??
                null,
              p_result_observation:
                null,
            }
          );

        completedRecordId =
          fallback.data;
        markError =
          fallback.error;
      }

      if (markError) {

        console.error(
          "Error marcando planificado como realizado:",
          markError
        );

        const alreadyCompleted =
          markError.message
            ?.toLowerCase()
            .includes(
              "ya fue registrado como realizado"
            );

        return NextResponse.json(
          {
            error:
              markError.message,
          },
          {
            status:
              alreadyCompleted
                ? 409
                : 500,
          }
        );

      }

      return NextResponse.json(
        {
          success: true,
          record_id:
            completedRecordId,
        },
        {
          status: 201,
        }
      );

    }

    /*
     * --------------------------------------------------------
     * PLANIFICACIÓN POR ZONA -> REALIZAR PENDIENTES DEL GRUPO
     *
     * Solo procesa tramos PLANIFICADOS del batch que todavía
     * no tienen un registro COMPLETADO relacionado.
     * --------------------------------------------------------
     */
    if (body.action === "mark_batch_completed") {
      const batchId =
        body.batch_id?.trim() ?? "";

      if (!batchId) {
        return NextResponse.json(
          {
            error:
              "Falta el ID del grupo de planificación.",
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
              "La fecha de realización no es válida.",
          },
          {
            status: 400,
          }
        );
      }

      /*
       * VERSIÓN ESTABLE:
       * una sola operación SQL para todo el batch.
       * No manda IDs individuales ni hace 38 RPC.
       */
      const {
        data: completedCount,
        error: batchError,
      } = await supabase.rpc(
        "test_mark_sweeping_batch_completed",
        {
          p_batch_id:
            batchId,
          p_work_date:
            body.work_date ??
            null,
        }
      );

      if (batchError) {
        console.error(
          "Error marcando grupo como realizado:",
          batchError
        );

        return NextResponse.json(
          {
            error:
              batchError.message,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json(
        {
          success: true,
          completed_count:
            Number(
              completedCount ?? 0
            ),
          batch_id:
            batchId,
        },
        {
          status: 201,
        }
      );
    }

    const mainStreet =

      body.main_street?.trim() ?? "";

    const fromStreet =

      body.from_street?.trim() ?? "";

    const toStreet =

      body.to_street?.trim() ?? "";

    const geometry =

      body.geometry;

    const status =

      normalizeStatus(

        body.status

      );

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

      !isValidGeometry(

        geometry

      )

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

    if (!status) {

      return NextResponse.json(

        {

          error:

            "El estado debe ser PLANIFICADO o COMPLETADO.",

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

            "La fecha de trabajo no es válida.",

        },

        {

          status: 400,

        }

      );

    }

    const plannedFrom =
      status === "PLANIFICADO"
        ? body.planned_from ??
          body.work_date ??
          null
        : null;

    const plannedTo =
      status === "PLANIFICADO"
        ? body.planned_to ??
          body.work_date ??
          null
        : null;

    if (status === "PLANIFICADO") {
      const fromDate = parseDate(
        plannedFrom
      );
      const toDate = parseDate(
        plannedTo
      );

      if (!fromDate || !toDate) {
        return NextResponse.json(
          {
            error:
              "El período de planificación no es válido.",
          },
          { status: 400 }
        );
      }

      if (
        toDate.getTime() <
        fromDate.getTime()
      ) {
        return NextResponse.json(
          {
            error:
              "La fecha Hasta no puede ser anterior a la fecha Desde.",
          },
          { status: 400 }
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
              "El período máximo de planificación es de 180 días.",
          },
          { status: 400 }
        );
      }
    }

    const batchId =
      body.batch_id?.trim() || null;

    const rpcName =
      batchId
        ? "test_create_sweeping_record_grouped"
        : "test_create_sweeping_record";

    const rpcParams =
      batchId
        ? {
            p_main_street:
              mainStreet,
            p_from_street:
              fromStreet,
            p_to_street:
              toStreet,
            p_geometry_geojson:
              JSON.stringify(
                geometry
              ),
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
              status,
            p_batch_id:
              batchId,
          }
        : {
            p_main_street:
              mainStreet,
            p_from_street:
              fromStreet,
            p_to_street:
              toStreet,
            p_geometry_geojson:
              JSON.stringify(
                geometry
              ),
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
              status,
          };

    const {
      data,
      error,
    } = await supabase.rpc(
      rpcName,
      rpcParams
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

    if (
      status === "PLANIFICADO" &&
      plannedFrom &&
      plannedTo
    ) {
      const createdId =
        typeof data === "string"
          ? data
          : String(
              (data as any)?.id ??
                ""
            ).trim();

      if (createdId) {
        const { error: periodError } =
          await supabase.rpc(
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
            "Error guardando período de planificación:",
            periodError
          );

          return NextResponse.json(
            {
              error:
                periodError.message,
            },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json(

      {

        success: true,

        record: data,

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

/* ============================================================

 * PATCH

 * Editar un tramo existente.

 *

 * El frontend enviará el registro completo cuando se edite.

 * La actualización se hace por RPC para mantener el mismo

 * criterio que GET/POST y no depender de RLS directo.

 * ============================================================ */

export async function PATCH(

  request: Request

) {

  try {

    const access =
      await getSweepingAccess();

    if (!access.authenticated) {
      return NextResponse.json(
        { error: "No autenticado." },
        { status: 401 }
      );
    }

    if (!access.canView) {
      return unauthorizedResponse();
    }

    if (!access.canEdit) {
      return readOnlyResponse();
    }

    const supabase =
      access.supabase;

    const body =

      (await request.json()) as UpdateSweepingRecordBody;

    const id =

      body.id?.trim() ?? "";

    const mainStreet =

      body.main_street?.trim() ?? "";

    const fromStreet =

      body.from_street?.trim() ?? "";

    const toStreet =

      body.to_street?.trim() ?? "";

    const status =

      normalizeStatus(

        body.status

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

    if (!status) {

      return NextResponse.json(

        {

          error:

            "El estado debe ser PLANIFICADO o COMPLETADO.",

        },

        {

          status: 400,

        }

      );

    }

    if (

      body.geometry !==

        undefined &&

      !isValidGeometry(

        body.geometry

      )

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

    if (

      body.work_date &&

      !parseDate(

        body.work_date

      )

    ) {

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

          body.geometry

            ? JSON.stringify(

                body.geometry

              )

            : null,

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

          status,

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

    const record =

      Array.isArray(data)

        ? data[0] ?? null

        : data;

    return NextResponse.json({

      success: true,

      record,

    });

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

/* ============================================================

 * DELETE

 * Eliminar un tramo mediante RPC.

 *

 * Ejemplo:

 * /api/test-sweeping/records?id=UUID

 * ============================================================ */

export async function DELETE(

  request: Request

) {

  try {

    const access =
      await getSweepingAccess();

    if (!access.authenticated) {
      return NextResponse.json(
        { error: "No autenticado." },
        { status: 401 }
      );
    }

    if (!access.canView) {
      return unauthorizedResponse();
    }

    if (!access.canEdit) {
      return readOnlyResponse();
    }

    const supabase =
      access.supabase;

    const url =

      new URL(

        request.url

      );

    const batchId =
      url.searchParams
        .get("batch_id")
        ?.trim() ?? "";

    /*
     * Eliminación agrupada:
     * borra únicamente PLANIFICADOS pendientes del grupo.
     * Los que ya tienen un COMPLETADO relacionado se conservan.
     */
    if (batchId) {
      const {
        data: deletedCount,
        error: batchDeleteError,
      } = await supabase.rpc(
        "test_delete_sweeping_batch_pending",
        {
          p_batch_id:
            batchId,
        }
      );

      if (batchDeleteError) {
        console.error(
          "Error eliminando grupo de planificación:",
          batchDeleteError
        );

        return NextResponse.json(
          {
            error:
              batchDeleteError.message,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        success: true,
        deleted_count:
          Number(deletedCount ?? 0),
        batch_id:
          batchId,
      });
    }

    const id =
      url.searchParams
        .get("id")
        ?.trim() ?? "";

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

    if (

      data !== true

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

    return NextResponse.json({

      success: true,

    });

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
