import { createClient } from "@/lib/supabase/server";
import {
  NextRequest,
  NextResponse,
} from "next/server";

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizePlate = (
  value: unknown,
) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "");


const canAccess = (profile: {
  role: string;
  modules: string[] | null;
}) => {
  const role = normalizeText(
    profile.role,
  );

  return (
    role === "admin" ||
    role === "adminlectura" ||
    role === "taller" ||
    profile.modules?.includes(
      "work_orders",
    )
  );
};

type AlltrackResponse<T> = {
  status?: string;
  token?: string;
  data?: T;
  error_code?: string;
  error?: string;
};

class AlltrackApiError extends Error {
  errorCode?: string;
  httpStatus?: number;

  constructor(
    message: string,
    options?: {
      errorCode?: string;
      httpStatus?: number;
    },
  ) {
    super(message);
    this.name = "AlltrackApiError";
    this.errorCode =
      options?.errorCode;
    this.httpStatus =
      options?.httpStatus;
  }
}

type AlltrackTokenCache = {
  token: string | null;
  expiresAt: number;
  loginPromise:
    | Promise<string>
    | null;
};

const ALLTRACK_TOKEN_TTL_MS =
  55 * 60 * 1000;

const alltrackTokenCache: AlltrackTokenCache = {
  token: null,
  expiresAt: 0,
  loginPromise: null,
};

const clearAlltrackTokenCache = () => {
  alltrackTokenCache.token =
    null;
  alltrackTokenCache.expiresAt =
    0;
};

const saveAlltrackToken = (
  token: string,
) => {
  alltrackTokenCache.token =
    token;

  alltrackTokenCache.expiresAt =
    Date.now() +
    ALLTRACK_TOKEN_TTL_MS;
};

const hasValidCachedToken = () =>
  Boolean(
    alltrackTokenCache.token &&
      Date.now() <
        alltrackTokenCache.expiresAt,
  );

const isSessionExpiredError = (
  error: unknown,
) =>
  error instanceof AlltrackApiError &&
  (
    error.errorCode === "1003" ||
    normalizeText(
      error.message,
    ).includes(
      "sesion caducada",
    )
  );


type AlltrackPosition = {
  hora?: string | null;
  fecha?: string | null;

  vehiculo_id?: string | number | null;

  patente?: string | null;

  conductor?: string | null;

  lat?: number | null;
  lon?: number | null;

  estado?: string | null;
  velocidad?: number | null;

  odometro?: string | number | null;
  horometro?: string | number | null;

  sentido?: number | null;

  direccion?: string | null;

  timeout?: number | null;

  viaje?: unknown;
};

type AlltrackFleetVehicle = {
  id: string | number;
  patente?: string | null;
  alias_cliente?: string | null;
  marca?: string | null;
  modelo?: string | null;
  vehiculo_tipo?: string | null;
};

type AlltrackFleet = {
  nivel?: string | null;
  id?: string | number | null;
  title?: string | null;
  children?: AlltrackFleetVehicle[];
};

const normalizeVehicleCode = (
  value: unknown,
) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s._-]/g, "");

const getAlltrackConfig = () => {
  const username =
    process.env.ALLTRACK_USERNAME;

  const password =
    process.env.ALLTRACK_PASSWORD;

  const baseUrl =
    process.env.ALLTRACK_BASE_URL ||
    "https://sistema1.alltrack.com.ar/apiV3";

  if (!username || !password) {
    throw new Error(
      "Faltan ALLTRACK_USERNAME o ALLTRACK_PASSWORD",
    );
  }

  return {
    username,
    password,
    baseUrl: baseUrl.replace(
      /\/+$/,
      "",
    ),
  };
};

const alltrackPost = async <T>({
  url,
  token,
  formData,
}: {
  url: string;
  token?: string;
  formData?: FormData;
}): Promise<AlltrackResponse<T>> => {
  /*
   * La documentación de Alltrack permite autenticar:
   * - por Bearer token, o
   * - enviando "token" directamente en el form-data.
   *
   * Como el servidor estaba respondiendo "Sesion Caducada"
   * al usar Authorization: Bearer, usamos el mecanismo
   * alternativo documentado: token dentro del body.
   */
  const payload =
    formData ?? new FormData();

  if (token) {
    payload.set(
      "token",
      token,
    );
  }

  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    body: payload,
  });

  const rawText =
    await response.text();

  let result: AlltrackResponse<T>;

  try {
    result =
      JSON.parse(
        rawText,
      ) as AlltrackResponse<T>;
  } catch {
    console.error(
      "Respuesta NO JSON de Alltrack:",
      {
        url,
        status: response.status,
        body: rawText,
      },
    );

    throw new Error(
      `Alltrack respondió HTTP ${response.status}: ${
        rawText
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 300) ||
        "respuesta vacía"
      }`,
    );
  }

  if (
    !response.ok ||
    result.status !== "ok"
  ) {
    console.error(
      "Error devuelto por Alltrack:",
      {
        url,
        status: response.status,
        result,
      },
    );

    throw new AlltrackApiError(
      result.error ||
        `Error Alltrack HTTP ${response.status}`,
      {
        errorCode:
          result.error_code,
        httpStatus:
          response.status,
      },
    );
  }

  return result;
};

const loginAlltrack = async () => {
  const {
    username,
    password,
    baseUrl,
  } = getAlltrackConfig();

  const formData =
    new FormData();

  formData.append(
    "username",
    username,
  );

  formData.append(
    "password",
    password,
  );

  formData.append(
    "sessionTime",
    "3600",
  );

  const result =
    await alltrackPost<unknown>({
      url: `${baseUrl}/JSON__login/`,
      formData,
    });

  if (!result.token) {
    throw new Error(
      "Alltrack no devolvió token",
    );
  }

  saveAlltrackToken(
    result.token,
  );

  console.log(
    "Login Alltrack OK:",
    {
      status: result.status,
      token_prefix:
        `${result.token.slice(0, 6)}...`,
      error_code:
        result.error_code || "",
    },
  );

  return {
    token: result.token,
    baseUrl,
  };
};

const getAlltrackToken = async (
  forceRefresh = false,
) => {
  const { baseUrl } =
    getAlltrackConfig();

  if (
    !forceRefresh &&
    hasValidCachedToken()
  ) {
    return {
      token:
        alltrackTokenCache.token as string,
      baseUrl,
      fromCache: true,
    };
  }

  if (
    !forceRefresh &&
    alltrackTokenCache.loginPromise
  ) {
    const token =
      await alltrackTokenCache.loginPromise;

    return {
      token,
      baseUrl,
      fromCache: true,
    };
  }

  clearAlltrackTokenCache();

  const loginPromise =
    loginAlltrack().then(
      (result) =>
        result.token,
    );

  alltrackTokenCache.loginPromise =
    loginPromise;

  try {
    const token =
      await loginPromise;

    return {
      token,
      baseUrl,
      fromCache: false,
    };
  } finally {
    alltrackTokenCache.loginPromise =
      null;
  }
};

const authenticatedAlltrackPost =
  async <T>({
    pathname,
    formDataFactory,
  }: {
    pathname: string;
    formDataFactory?: () => FormData;
  }): Promise<{
    result: AlltrackResponse<T>;
    token: string;
  }> => {
    const execute =
      async (
        forceRefresh = false,
      ) => {
        const {
          token,
          baseUrl,
        } =
          await getAlltrackToken(
            forceRefresh,
          );

        const result =
          await alltrackPost<T>({
            url:
              `${baseUrl}${pathname}`,
            token,
            formData:
              formDataFactory
                ? formDataFactory()
                : new FormData(),
          });

        if (
          result.token
        ) {
          saveAlltrackToken(
            result.token,
          );
        }

        return {
          result,
          token:
            result.token ||
            token,
        };
      };

    try {
      return await execute();
    } catch (error) {
      if (
        !isSessionExpiredError(
          error,
        )
      ) {
        throw error;
      }

      console.warn(
        "Token Alltrack vencido. Renovando sesión y reintentando una vez.",
      );

      clearAlltrackTokenCache();

      return execute(true);
    }
  };


type AlltrackTotaledSession = {
  vehiculo_id?: string | number | null;
  tiempo_sesion?: string | number | null;
  tiempo_motor_ocioso?: string | number | null;
  tiempo_movimiento?: string | number | null;
  distancia_recorrida?: string | number | null;
};

type AlltrackVehicleSession = {
  hora?: string | null;
  fecha?: string | null;
  tiempo_sesion?: string | number | null;
  tiempo_motor_ocioso?: string | number | null;
  tiempo_movimiento?: string | number | null;
  distancia_recorrida?: string | number | null;
};

type AlltrackTravelPoint = {
  id?: string | number | null;
  lat?: number | null;
  lon?: number | null;
  fecha?: string | null;
  hora?: string | null;
  ts?: string | null;
  velocidad?: number | null;
  odometro?: string | number | null;
  conductor?: string | null;
  alias_cliente?: string | null;
  sentido?: number | null;
};

type AlltrackTravelSegment = {
  puntos?: AlltrackTravelPoint[];
  subPuntos?: AlltrackTravelPoint[];
  km_recorridos?: number | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
};

type AlltrackTravelHistoryData = {
  tramos?: AlltrackTravelSegment[];
};

const toNumber = (
  value: unknown,
) => {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
};

const formatSeconds = (
  totalSeconds: number,
) => {
  const safeSeconds =
    Math.max(
      0,
      Math.round(
        totalSeconds,
      ),
    );

  const hours =
    Math.floor(
      safeSeconds / 3600,
    );

  const minutes =
    Math.floor(
      (safeSeconds % 3600) /
        60,
    );

  const seconds =
    safeSeconds % 60;

  return [
    String(hours).padStart(
      2,
      "0",
    ),
    String(minutes).padStart(
      2,
      "0",
    ),
    String(seconds).padStart(
      2,
      "0",
    ),
  ].join(":");
};

const isValidIsoDate = (
  value: string,
) =>
  /^\d{4}-\d{2}-\d{2}$/.test(
    value,
  ) &&
  !Number.isNaN(
    new Date(
      `${value}T00:00:00`,
    ).getTime(),
  );

const daysBetweenInclusive = (
  from: string,
  to: string,
) => {
  const fromDate =
    new Date(
      `${from}T00:00:00Z`,
    );

  const toDate =
    new Date(
      `${to}T00:00:00Z`,
    );

  const milliseconds =
    toDate.getTime() -
    fromDate.getTime();

  return (
    Math.floor(
      milliseconds /
        86_400_000,
    ) + 1
  );
};

const normalizeAlltrackDate = (
  value: unknown,
) => {
  const text =
    String(
      value || "",
    ).trim();

  if (
    /^\d{2}-\d{2}-\d{4}$/.test(
      text,
    )
  ) {
    const [
      day,
      month,
      year,
    ] =
      text.split("-");

    return `${year}-${month}-${day}`;
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      text,
    )
  ) {
    return text;
  }

  return text;
};

const resolveAlltrackVehicleId =
  async ({
    supabase,
    vehicle,
  }: {
    supabase: Awaited<
      ReturnType<
        typeof createClient
      >
    >;
    vehicle: {
      id: string;
      code: string;
      vehicle: string;
      license_plate:
        | string
        | null;
      alltrack_vehicle_id:
        | string
        | null;
    };
  }) => {
    if (
      vehicle.alltrack_vehicle_id
    ) {
      return String(
        vehicle.alltrack_vehicle_id,
      );
    }

    const vehiclePlate =
      normalizePlate(
        vehicle.license_plate,
      );

    /*
     * Primer fallback:
     * última posición válida, porque incluye vehículos
     * accesibles que pueden no figurar en vehiclesByFleets.
     */
    if (vehiclePlate) {
      const {
        result:
          positionsResult,
      } =
        await authenticatedAlltrackPost<
          AlltrackPosition[]
        >({
          pathname:
            "/JSON__GET_lastValidPosition/",
        });

      const positions =
        Array.isArray(
          positionsResult.data,
        )
          ? positionsResult.data
          : [];

      const position =
        positions.find(
          (item) =>
            normalizePlate(
              item.patente,
            ) ===
            vehiclePlate,
        );

      if (
        position?.vehiculo_id !==
          null &&
        position?.vehiculo_id !==
          undefined &&
        String(
          position.vehiculo_id,
        ).trim()
      ) {
        const resolvedId =
          String(
            position.vehiculo_id,
          );

        await supabase
          .from("vehicles")
          .update({
            alltrack_vehicle_id:
              resolvedId,
          })
          .eq(
            "id",
            vehicle.id,
          );

        return resolvedId;
      }
    }

    /*
     * Segundo fallback:
     * alias/código municipal dentro de las flotas.
     */
    const {
      result:
        fleetsResult,
    } =
      await authenticatedAlltrackPost<
        AlltrackFleet[]
      >({
        pathname:
          "/JSON__GET_vehiclesByFleets/",
      });

    const fleets =
      Array.isArray(
        fleetsResult.data,
      )
        ? fleetsResult.data
        : [];

    const normalizedCode =
      normalizeVehicleCode(
        vehicle.code,
      );

    const fleetVehicle =
      fleets
        .flatMap(
          (fleet) =>
            Array.isArray(
              fleet.children,
            )
              ? fleet.children
              : [],
        )
        .find(
          (item) =>
            normalizeVehicleCode(
              item.alias_cliente,
            ) ===
            normalizedCode,
        );

    if (
      fleetVehicle?.id !==
        null &&
      fleetVehicle?.id !==
        undefined
    ) {
      const resolvedId =
        String(
          fleetVehicle.id,
        );

      await supabase
        .from("vehicles")
        .update({
          alltrack_vehicle_id:
            resolvedId,
        })
        .eq(
          "id",
          vehicle.id,
        );

      return resolvedId;
    }

    return null;
  };


export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      vehicleCode: string;
    }>;
  },
) {
  try {
    const {
      vehicleCode,
    } = await params;

    const decodedVehicleCode =
      decodeURIComponent(
        vehicleCode,
      ).trim();

    const {
      searchParams,
    } =
      new URL(
        request.url,
      );

    const from =
      String(
        searchParams.get(
          "from",
        ) || "",
      ).trim();

    const to =
      String(
        searchParams.get(
          "to",
        ) || from,
      ).trim();

    const includeRoute =
      searchParams.get(
        "includeRoute",
      ) !== "0";

    if (
      !isValidIsoDate(from) ||
      !isValidIsoDate(to)
    ) {
      return NextResponse.json(
        {
          error:
            "Debés indicar from y to con formato YYYY-MM-DD",
          example:
            "?from=2026-08-31&to=2026-08-31",
        },
        {
          status: 400,
        },
      );
    }

    const rangeDays =
      daysBetweenInclusive(
        from,
        to,
      );

    if (
      rangeDays <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "La fecha hasta no puede ser anterior a la fecha desde",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Para esta primera versión limitamos a 31 días.
     * El recorrido GPS puede ser muy pesado en períodos largos.
     */
    if (
      rangeDays > 31
    ) {
      return NextResponse.json(
        {
          error:
            "Por ahora el informe admite un máximo de 31 días por consulta",
        },
        {
          status: 400,
        },
      );
    }

    const supabase =
      await createClient();

    /*
     * =========================================
     * AUTENTICACIÓN DEL SISTEMA
     * =========================================
     */

    const {
      data: { user },
      error: authError,
    } =
      await supabase.auth.getUser();

    if (
      authError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "No autenticado",
        },
        {
          status: 401,
        },
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("users")
      .select(
        "role, modules",
      )
      .eq(
        "id",
        user.id,
      )
      .single();

    if (
      profileError ||
      !profile ||
      !canAccess(
        profile,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "No autorizado para generar informes Alltrack",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * =========================================
     * VEHÍCULO
     * =========================================
     */

    const {
      data: vehicle,
      error: vehicleError,
    } = await supabase
      .from("vehicles")
      .select(
        `
        id,
        code,
        vehicle,
        license_plate,
        department,
        primary_driver_1,
        primary_driver_2,
        backup_driver,
        has_alltrack,
        alltrack_vehicle_id,
        active
      `,
      )
      .eq(
        "code",
        decodedVehicleCode,
      )
      .single();

    if (
      vehicleError ||
      !vehicle
    ) {
      return NextResponse.json(
        {
          error:
            "Vehículo no encontrado en Planta Vehicular",
        },
        {
          status: 404,
        },
      );
    }

    if (
      !vehicle.has_alltrack
    ) {
      return NextResponse.json(
        {
          error:
            "Este vehículo no está marcado como equipado con Alltrack",
        },
        {
          status: 400,
        },
      );
    }

    const alltrackVehicleId =
      await resolveAlltrackVehicleId(
        {
          supabase,
          vehicle,
        },
      );

    if (
      !alltrackVehicleId
    ) {
      return NextResponse.json(
        {
          error:
            "No se pudo vincular el vehículo con Alltrack",
          vehicle: {
            code:
              vehicle.code,
            license_plate:
              vehicle.license_plate,
          },
        },
        {
          status: 404,
        },
      );
    }

    /*
     * =========================================
     * TOTALIZADO DEL PERÍODO
     * =========================================
     */

    const totalFormData =
      new FormData();

    totalFormData.set(
      "fecha_desde",
      from,
    );

    totalFormData.set(
      "fecha_hasta",
      to,
    );

    totalFormData.set(
      "vehiculo_id",
      alltrackVehicleId,
    );

    const {
      result:
        totalsResult,
    } =
      await authenticatedAlltrackPost<
        AlltrackTotaledSession[]
      >({
        pathname:
          "/JSON__GET_totaledVehicleSessions/",
        formDataFactory:
          () =>
            totalFormData,
      });

    const totals =
      Array.isArray(
        totalsResult.data,
      )
        ? totalsResult.data
        : [];

    const totalRow =
      totals.find(
        (item) =>
          String(
            item.vehiculo_id ||
              "",
          ) ===
          alltrackVehicleId,
      ) ||
      totals[0] ||
      null;

    const sessionSeconds =
      toNumber(
        totalRow
          ?.tiempo_sesion,
      );

    const idleSeconds =
      toNumber(
        totalRow
          ?.tiempo_motor_ocioso,
      );

    const movementSeconds =
      toNumber(
        totalRow
          ?.tiempo_movimiento,
      );

    const distanceMeters =
      toNumber(
        totalRow
          ?.distancia_recorrida,
      );

    const activitySeconds =
      idleSeconds +
      movementSeconds;

    const movementPercent =
      activitySeconds > 0
        ? Number(
            (
              (movementSeconds /
                activitySeconds) *
              100
            ).toFixed(2),
          )
        : 0;

    const idlePercent =
      activitySeconds > 0
        ? Number(
            (
              (idleSeconds /
                activitySeconds) *
              100
            ).toFixed(2),
          )
        : 0;

    /*
     * =========================================
     * SESIONES DEL VEHÍCULO
     * =========================================
     */

    const sessionsFormData =
      new FormData();

    sessionsFormData.set(
      "fecha_desde",
      from,
    );

    sessionsFormData.set(
      "fecha_hasta",
      to,
    );

    sessionsFormData.set(
      "hora_desde",
      "00:00:00",
    );

    sessionsFormData.set(
      "hora_hasta",
      "23:59:59",
    );

    sessionsFormData.set(
      "vehiculo_id",
      alltrackVehicleId,
    );

    const {
      result:
        sessionsResult,
    } =
      await authenticatedAlltrackPost<
        AlltrackVehicleSession[]
      >({
        pathname:
          "/JSON__GET_vehicleSessionsByVehicleId/",
        formDataFactory:
          () =>
            sessionsFormData,
      });

    const sessions =
      Array.isArray(
        sessionsResult.data,
      )
        ? sessionsResult.data
        : [];

    /*
     * Agrupamos sesiones por fecha para obtener
     * la tabla "Actividad por día" del informe.
     */
    const dailyMap =
      new Map<
        string,
        {
          date: string;
          session_seconds: number;
          idle_seconds: number;
          movement_seconds: number;
          distance_meters: number;
          sessions_count: number;
        }
      >();

    sessions.forEach(
      (session) => {
        const date =
          normalizeAlltrackDate(
            session.fecha,
          );

        if (!date) return;

        const current =
          dailyMap.get(
            date,
          ) || {
            date,
            session_seconds: 0,
            idle_seconds: 0,
            movement_seconds: 0,
            distance_meters: 0,
            sessions_count: 0,
          };

        current.session_seconds +=
          toNumber(
            session.tiempo_sesion,
          );

        current.idle_seconds +=
          toNumber(
            session.tiempo_motor_ocioso,
          );

        current.movement_seconds +=
          toNumber(
            session.tiempo_movimiento,
          );

        current.distance_meters +=
          toNumber(
            session.distancia_recorrida,
          );

        current.sessions_count +=
          1;

        dailyMap.set(
          date,
          current,
        );
      },
    );

    const dailyActivity =
      Array.from(
        dailyMap.values(),
      )
        .sort(
          (
            a,
            b,
          ) =>
            a.date.localeCompare(
              b.date,
            ),
        )
        .map(
          (day) => ({
            date:
              day.date,
            sessions_count:
              day.sessions_count,
            session_seconds:
              day.session_seconds,
            session_time:
              formatSeconds(
                day.session_seconds,
              ),
            idle_seconds:
              day.idle_seconds,
            idle_time:
              formatSeconds(
                day.idle_seconds,
              ),
            movement_seconds:
              day.movement_seconds,
            movement_time:
              formatSeconds(
                day.movement_seconds,
              ),
            distance_meters:
              Number(
                day.distance_meters.toFixed(
                  2,
                ),
              ),
            distance_km:
              Number(
                (
                  day.distance_meters /
                  1000
                ).toFixed(
                  2,
                ),
              ),
          }),
        );

    /*
     * =========================================
     * HISTORIAL GPS
     * =========================================
     *
     * Para no devolver miles de puntos sin necesidad:
     * - por defecto sólo incluimos ruta cuando el período
     *   es de 1 día;
     * - para más de 1 día se puede llamar con includeRoute=0
     *   y después pedir recorridos por tramos/semana.
     */

    let route:
      {
        segments: number;
        points: Array<{
          lat: number;
          lon: number;
          date:
            | string
            | null;
          time:
            | string
            | null;
          timestamp:
            | string
            | null;
          speed:
            | number
            | null;
          odometer:
            | string
            | number
            | null;
          driver:
            | string
            | null;
        }>;
      } | null =
      null;

    if (
      includeRoute &&
      rangeDays === 1
    ) {
      const travelFormData =
        new FormData();

      travelFormData.set(
        "fecha_desde",
        from,
      );

      travelFormData.set(
        "fecha_hasta",
        to,
      );

      travelFormData.set(
        "hora_desde",
        "00:00:00",
      );

      travelFormData.set(
        "hora_hasta",
        "23:59:59",
      );

      travelFormData.set(
        "vehiculo_id",
        alltrackVehicleId,
      );

      travelFormData.set(
        "isAgrupamiento",
        "0",
      );

      travelFormData.set(
        "order",
        "ASC",
      );

      const {
        result:
          travelResult,
      } =
        await authenticatedAlltrackPost<
          AlltrackTravelHistoryData
        >({
          pathname:
            "/JSON__GET_travelHistory/",
          formDataFactory:
            () =>
              travelFormData,
        });

      const tramos =
        Array.isArray(
          travelResult.data
            ?.tramos,
        )
          ? travelResult.data
              ?.tramos || []
          : [];

      const points =
        tramos.flatMap(
          (segment) => {
            const sourcePoints =
              Array.isArray(
                segment.subPuntos,
              ) &&
              segment.subPuntos
                .length > 0
                ? segment.subPuntos
                : Array.isArray(
                    segment.puntos,
                  )
                  ? segment.puntos
                  : [];

            return sourcePoints
              .filter(
                (point) =>
                  typeof point.lat ===
                    "number" &&
                  typeof point.lon ===
                    "number",
              )
              .map(
                (point) => ({
                  lat:
                    point.lat as number,
                  lon:
                    point.lon as number,
                  date:
                    point.fecha ||
                    null,
                  time:
                    point.hora ||
                    null,
                  timestamp:
                    point.ts ||
                    null,
                  speed:
                    typeof point.velocidad ===
                    "number"
                      ? point.velocidad
                      : null,
                  odometer:
                    point.odometro ??
                    null,
                  driver:
                    point.conductor ||
                    null,
                }),
              );
          },
        );

      route = {
        segments:
          tramos.length,
        points,
      };
    }

    return NextResponse.json({
      meta: {
        alltrack_token_cache:
          hasValidCachedToken(),
        route_included:
          Boolean(route),
        range_days:
          rangeDays,
      },

      data: {
        vehicle: {
          id:
            vehicle.id,
          code:
            vehicle.code,
          name:
            vehicle.vehicle,
          license_plate:
            vehicle.license_plate,
          department:
            vehicle.department,
          primary_driver_1:
            vehicle.primary_driver_1,
          primary_driver_2:
            vehicle.primary_driver_2,
          backup_driver:
            vehicle.backup_driver,
          alltrack_vehicle_id:
            alltrackVehicleId,
        },

        period: {
          from,
          to,
        },

        summary: {
          session_seconds:
            sessionSeconds,
          session_time:
            formatSeconds(
              sessionSeconds,
            ),

          idle_seconds:
            idleSeconds,
          idle_time:
            formatSeconds(
              idleSeconds,
            ),

          movement_seconds:
            movementSeconds,
          movement_time:
            formatSeconds(
              movementSeconds,
            ),

          distance_meters:
            Number(
              distanceMeters.toFixed(
                2,
              ),
            ),

          distance_km:
            Number(
              (
                distanceMeters /
                1000
              ).toFixed(
                2,
              ),
            ),

          movement_percent:
            movementPercent,

          idle_percent:
            idlePercent,
        },

        daily_activity:
          dailyActivity,

        sessions:
          sessions.map(
            (session) => ({
              date:
                normalizeAlltrackDate(
                  session.fecha,
                ),
              time:
                session.hora ||
                null,

              session_seconds:
                toNumber(
                  session.tiempo_sesion,
                ),

              session_time:
                formatSeconds(
                  toNumber(
                    session.tiempo_sesion,
                  ),
                ),

              idle_seconds:
                toNumber(
                  session.tiempo_motor_ocioso,
                ),

              idle_time:
                formatSeconds(
                  toNumber(
                    session.tiempo_motor_ocioso,
                  ),
                ),

              movement_seconds:
                toNumber(
                  session.tiempo_movimiento,
                ),

              movement_time:
                formatSeconds(
                  toNumber(
                    session.tiempo_movimiento,
                  ),
                ),

              distance_meters:
                toNumber(
                  session.distancia_recorrida,
                ),

              distance_km:
                Number(
                  (
                    toNumber(
                      session.distancia_recorrida,
                    ) /
                    1000
                  ).toFixed(
                    3,
                  ),
                ),
            }),
          ),

        route,
      },
    });
  } catch (error) {
    console.error(
      "Error GET /api/alltrack/report/[vehicleCode]:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo generar el informe Alltrack",
      },
      {
        status: 500,
      },
    );
  }
}
