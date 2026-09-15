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


const isAlltrackAsciiCodecError = (
  error: unknown,
) => {
  const message =
    error instanceof Error
      ? error.message
      : String(error || "");

  const normalized =
    message.toLowerCase();

  return (
    normalized.includes("ascii") &&
    normalized.includes("codec") &&
    normalized.includes("can't encode character")
  );
};


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
  tipo_tramo?: string | null;
  km_recorridos?: number | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
};

type AlltrackTravelHistoryData = {
  tramos?: AlltrackTravelSegment[];
  puntos?: AlltrackTravelPoint[];
  cant_puntos?: number | null;
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

const parseAlltrackTimestamp = (
  value: unknown,
) => {
  const text =
    String(
      value || "",
    ).trim();

  if (!text) {
    return null;
  }

  /*
   * Formatos que devuelve Alltrack:
   * - 26-12-2024 07:23:40
   * - 2024-12-26 07:23:40
   */
  const dmy =
    text.match(
      /^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/,
    );

  if (dmy) {
    const [
      ,
      day,
      month,
      year,
      hour,
      minute,
      second,
    ] = dmy;

    const timestamp =
      new Date(
        `${year}-${month}-${day}T${hour}:${minute}:${second}`,
      ).getTime();

    return Number.isFinite(
      timestamp,
    )
      ? timestamp
      : null;
  }

  const ymd =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/,
    );

  if (ymd) {
    const timestamp =
      new Date(
        text.replace(
          " ",
          "T",
        ),
      ).getTime();

    return Number.isFinite(
      timestamp,
    )
      ? timestamp
      : null;
  }

  return null;
};

const getAlltrackDateTimeValue = (
  dateValue: unknown,
  timeValue: unknown,
  timestampValue?: unknown,
) => {
  /*
   * MUY IMPORTANTE:
   * para ordenar puntos GPS priorizamos "ts".
   *
   * En travelHistory, Alltrack puede devolver "hora" que no refleja
   * exactamente el orden real de adquisición. Si ordenamos sólo por
   * fecha + hora aparecen líneas cruzadas/oblicuas falsas.
   */
  const timestamp =
    parseAlltrackTimestamp(
      timestampValue,
    );

  if (timestamp !== null) {
    return timestamp;
  }

  const normalizedDate =
    normalizeAlltrackDate(
      dateValue,
    );

  const normalizedTime =
    String(
      timeValue || "00:00:00",
    ).trim() ||
    "00:00:00";

  const value =
    new Date(
      `${normalizedDate}T${normalizedTime}`,
    ).getTime();

  return Number.isFinite(value)
    ? value
    : 0;
};

const sortTravelPointsChronologically = <
  T extends {
    date?: string | null;
    time?: string | null;
    timestamp?: string | null;
  },
>(
  points: T[],
) =>
  [...points].sort(
    (a, b) =>
      getAlltrackDateTimeValue(
        a.date,
        a.time,
        a.timestamp,
      ) -
      getAlltrackDateTimeValue(
        b.date,
        b.time,
        b.timestamp,
      ),
  );


const getDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const earthRadius =
    6_371_000;

  const toRad = (
    value: number,
  ) =>
    (value * Math.PI) /
    180;

  const dLat =
    toRad(
      lat2 - lat1,
    );

  const dLon =
    toRad(
      lon2 - lon1,
    );

  const a =
    Math.sin(
      dLat / 2,
    ) ** 2 +
    Math.cos(
      toRad(lat1),
    ) *
      Math.cos(
        toRad(lat2),
      ) *
      Math.sin(
        dLon / 2,
      ) ** 2;

  return (
    earthRadius *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(
        1 - a,
      ),
    )
  );
};

/*
 * Alltrack, en su mapa histórico, NO une necesariamente todos
 * los puntos de una semana en una única polilínea.
 *
 * Si entre dos posiciones hay una detención larga / cambio de sesión,
 * unirlas produce una diagonal "volando" sobre casas.
 *
 * Separamos el historial crudo en recorridos continuos usando el mismo
 * criterio conceptual que documenta Alltrack para agrupamiento:
 * 10 minutos de detención.
 *
 * También cortamos saltos GPS físicamente imposibles para evitar líneas
 * falsas por datos aislados.
 */
const splitContinuousTravelPaths = <
  T extends {
    lat: number;
    lon: number;
    date?: string | null;
    time?: string | null;
    timestamp?: string | null;
  },
>(
  input: T[],
) => {
  /*
   * IMPORTANTE:
   * JSON__GET_travelHistory ya se pide con order=ASC.
   * Por lo tanto, respetamos EXACTAMENTE el orden en el que Alltrack
   * devuelve los puntos.
   *
   * Reordenarlos nosotros por fecha/hora/ts puede mezclar puntos que
   * tienen timestamps repetidos o incompletos y generar "rayos" y
   * diagonales que no existen en el mapa oficial.
   */
  const points = [...input];

  if (points.length === 0) {
    return [] as T[][];
  }

  const MAX_GAP_MS =
    10 * 60 * 1000;

  const MAX_REASONABLE_SPEED_KMH =
    160;

  const paths: T[][] = [];
  let current: T[] = [
    points[0],
  ];

  for (
    let index = 1;
    index < points.length;
    index += 1
  ) {
    const previous =
      points[index - 1];

    const point =
      points[index];

    const previousTime =
      getAlltrackDateTimeValue(
        previous.date,
        previous.time,
        previous.timestamp,
      );

    const pointTime =
      getAlltrackDateTimeValue(
        point.date,
        point.time,
        point.timestamp,
      );

    const deltaMs =
      pointTime -
      previousTime;

    const distanceMeters =
      getDistanceMeters(
        previous.lat,
        previous.lon,
        point.lat,
        point.lon,
      );

    const deltaHours =
      deltaMs > 0
        ? deltaMs /
          3_600_000
        : 0;

    const impliedSpeedKmh =
      deltaHours > 0
        ? distanceMeters /
          1000 /
          deltaHours
        : 0;

    /*
     * Sólo cortamos cuando existe evidencia clara de que empezó
     * otro recorrido. Si los timestamps vienen repetidos, NO usamos
     * eso como motivo para reordenar ni cortar.
     */
    const hasLongGap =
      deltaMs >
      MAX_GAP_MS;

    const hasImpossibleJump =
      deltaHours > 0 &&
      distanceMeters >
        250 &&
      impliedSpeedKmh >
        MAX_REASONABLE_SPEED_KMH;

    if (
      hasLongGap ||
      hasImpossibleJump
    ) {
      if (
        current.length >
        1
      ) {
        paths.push(
          current,
        );
      }

      current = [
        point,
      ];

      continue;
    }

    current.push(
      point,
    );
  }

  if (
    current.length >
    1
  ) {
    paths.push(
      current,
    );
  }

  return paths;
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
     * TOTALIZADO + SESIONES EN PARALELO
     * =========================================
     *
     * Antes estas dos consultas se hacían una detrás de otra.
     * En rangos mensuales Alltrack puede tardar bastante, por lo
     * que el tiempo total terminaba siendo la suma de ambas.
     *
     * Son consultas independientes, así que ahora se ejecutan
     * simultáneamente. El token Alltrack ya está cacheado y el
     * helper evita logins duplicados.
     */

    const buildTotalsFormData =
      () => {
        const formData =
          new FormData();

        formData.set(
          "fecha_desde",
          from,
        );
        formData.set(
          "fecha_hasta",
          to,
        );
        formData.set(
          "vehiculo_id",
          alltrackVehicleId,
        );

        return formData;
      };

    const buildSessionsFormData =
      () => {
        const formData =
          new FormData();

        formData.set(
          "fecha_desde",
          from,
        );
        formData.set(
          "fecha_hasta",
          to,
        );
        formData.set(
          "hora_desde",
          "00:00:00",
        );
        formData.set(
          "hora_hasta",
          "23:59:59",
        );
        formData.set(
          "vehiculo_id",
          alltrackVehicleId,
        );

        return formData;
      };

    const [
      totalsResponse,
      sessionsResponse,
    ] =
      await Promise.all([
        authenticatedAlltrackPost<
          AlltrackTotaledSession[]
        >({
          pathname:
            "/JSON__GET_totaledVehicleSessions/",
          formDataFactory:
            buildTotalsFormData,
        }),
        authenticatedAlltrackPost<
          AlltrackVehicleSession[]
        >({
          pathname:
            "/JSON__GET_vehicleSessionsByVehicleId/",
          formDataFactory:
            buildSessionsFormData,
        }),
      ]);

    const totalsResult =
      totalsResponse.result;

    const sessionsResult =
      sessionsResponse.result;

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

    /*
     * En esta cuenta distancia_recorrida coincide con kilómetros.
     */
    const distanceKm =
      toNumber(
        totalRow
          ?.distancia_recorrida,
      );

    /*
     * Réplica del porcentaje que muestra Alltrack:
     * ocioso / sesión y movimiento como complemento.
     */
    const idlePercent =
      sessionSeconds > 0
        ? Number(
            (
              (idleSeconds /
                sessionSeconds) *
              100
            ).toFixed(2),
          )
        : 0;

    const movementPercent =
      sessionSeconds > 0
        ? Number(
            (
              100 -
              idlePercent
            ).toFixed(2),
          )
        : 0;

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
          distance_km: number;
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
            distance_km: 0,
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

        current.distance_km +=
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

    /*
     * Completamos TODOS los días solicitados, incluso aquellos
     * para los que Alltrack no devolvió ninguna sesión.
     *
     * De esta forma, que una fecha no tenga actividad queda
     * explícito y no parece un error de carga del informe.
     */
    const dailyActivity: Array<{
      date: string;
      has_activity: boolean;
      sessions_count: number;
      session_seconds: number;
      session_time: string;
      idle_seconds: number;
      idle_time: string;
      movement_seconds: number;
      movement_time: string;
      distance_km: number;
      distance_meters: number;
    }> = [];

    const currentDate =
      new Date(`${from}T00:00:00Z`);

    const finalDate =
      new Date(`${to}T00:00:00Z`);

    while (
      currentDate.getTime() <=
      finalDate.getTime()
    ) {
      const date =
        currentDate
          .toISOString()
          .slice(0, 10);

      const day =
        dailyMap.get(date);

      if (day) {
        dailyActivity.push({
          date,
          has_activity: true,
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
          distance_km:
            Number(
              day.distance_km.toFixed(
                2,
              ),
            ),
          distance_meters:
            Number(
              (
                day.distance_km *
                1000
              ).toFixed(2),
            ),
        });
      } else {
        dailyActivity.push({
          date,
          has_activity: false,
          sessions_count: 0,
          session_seconds: 0,
          session_time: "-",
          idle_seconds: 0,
          idle_time: "-",
          movement_seconds: 0,
          movement_time: "-",
          distance_km: 0,
          distance_meters: 0,
        });
      }

      currentDate.setUTCDate(
        currentDate.getUTCDate() + 1,
      );
    }

    /*
     * =========================================
     * HISTORIAL GPS
     * =========================================
     *
     * Para evitar respuestas gigantes no devolvemos recorrido
     * GPS para períodos mayores a 10 días. Esto permite pedir
     * bloques semanales (y el último bloque de hasta 10 días)
     * desde la ficha sin descargar un mes entero de puntos.
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
        paths: Array<
          Array<{
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
          }>
        >;
      } | null =
      null;

    if (
      includeRoute &&
      rangeDays <= 10
    ) {
      const buildTravelFormData =
        (
          grouped: boolean,
        ) => {
          const formData =
            new FormData();

          formData.set(
            "fecha_desde",
            from,
          );

          formData.set(
            "fecha_hasta",
            to,
          );

          formData.set(
            "hora_desde",
            "00:00:00",
          );

          formData.set(
            "hora_hasta",
            "23:59:59",
          );

          formData.set(
            "vehiculo_id",
            alltrackVehicleId,
          );

          formData.set(
            "isAgrupamiento",
            grouped
              ? "1"
              : "0",
          );

          if (grouped) {
            formData.set(
              "intervalo_detencion",
              "10",
            );
          }

          formData.set(
            "order",
            "ASC",
          );

          return formData;
        };

      let travelResult:
        AlltrackResponse<AlltrackTravelHistoryData>;

      /*
       * Para dibujar el mapa usamos SIEMPRE el modo agrupado.
       *
       * Alltrack documenta isAgrupamiento=1 justamente para separar
       * el historial en tramos de "movimiento" y "detenido".
       * Ese es el formato más parecido al que utiliza su mapa histórico.
       *
       * Con isAgrupamiento=0 recibimos una nube continua de puntos y
       * después tenemos que adivinar dónde empieza/termina cada sesión,
       * lo que puede generar diagonales falsas.
       */
      try {
        const groupedResponse =
          await authenticatedAlltrackPost<
            AlltrackTravelHistoryData
          >({
            pathname:
              "/JSON__GET_travelHistory/",
            formDataFactory:
              () =>
                buildTravelFormData(
                  true,
                ),
          });

        travelResult =
          groupedResponse.result;
      } catch (groupedError) {
        /*
         * Fallback sólo por compatibilidad:
         * si el endpoint agrupado falla por una causa distinta, intentamos
         * puntos planos y luego los partimos por continuidad temporal.
         */
        console.warn(
          "Alltrack travelHistory agrupado falló; intentando modo no agrupado.",
          {
            vehicleCode:
              vehicle.code,
            alltrackVehicleId,
            from,
            to,
            error:
              groupedError instanceof Error
                ? groupedError.message
                : String(
                    groupedError,
                  ),
          },
        );

        const plainResponse =
          await authenticatedAlltrackPost<
            AlltrackTravelHistoryData
          >({
            pathname:
              "/JSON__GET_travelHistory/",
            formDataFactory:
              () =>
                buildTravelFormData(
                  false,
                ),
          });

        travelResult =
          plainResponse.result;
      }

      const directPoints =
        Array.isArray(
          travelResult.data
            ?.puntos,
        )
          ? travelResult.data
              ?.puntos || []
          : [];

      const tramos =
        Array.isArray(
          travelResult.data
            ?.tramos,
        )
          ? travelResult.data
              ?.tramos || []
          : [];

      const mapTravelPoint = (
        point: AlltrackTravelPoint,
      ) => ({
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
      });

      const isValidTravelPoint = (
        point: AlltrackTravelPoint,
      ) =>
        typeof point.lat ===
          "number" &&
        typeof point.lon ===
          "number";

      /*
       * Alltrack agrupado devuelve "tramos".
       * Cada tramo de movimiento debe dibujarse por separado.
       * Si los aplanamos en una sola polilínea, se crean diagonales
       * falsas entre el final de un tramo y el inicio del siguiente.
       */
      let paths: Array<
        Array<ReturnType<typeof mapTravelPoint>>
      > = [];

      if (
        tramos.length > 0
      ) {
        /*
         * MAPA HISTÓRICO
         *
         * Alltrack puede representar también posiciones de tramos
         * "detenido"/"ocioso". En vehículos muy lentos (barredoras,
         * regadores, etc.) esos puntos son importantes porque una parte
         * real del desplazamiento puede quedar clasificada así.
         *
         * Estrategia:
         *
         * 1. Siempre usamos `segment.puntos` cuando contiene una línea
         *    válida (2 o más posiciones).
         *
         * 2. Si el tramo es detenido/ocioso y `puntos` no alcanza para
         *    dibujar, usamos `subPuntos` como respaldo.
         *
         * 3. Los subPuntos NO se aplanan ni se conectan a otros tramos.
         *    Se dividen por continuidad para evitar los "rayos" y líneas
         *    falsas que tuvimos anteriormente.
         *
         * 4. Cada tramo/chunk queda como una polilínea independiente.
         *
         * Los cálculos de sesión, movimiento, ocioso y kilómetros siguen
         * siendo exactamente los informados por Alltrack.
         */
        const groupedPaths:
          Array<
            Array<
              ReturnType<
                typeof mapTravelPoint
              >
            >
          > = [];

        tramos.forEach(
          (segment) => {
            const type =
              normalizeText(
                segment.tipo_tramo,
              );

            const segmentPoints =
              Array.isArray(
                segment.puntos,
              )
                ? segment.puntos
                    .filter(
                      isValidTravelPoint,
                    )
                    .map(
                      mapTravelPoint,
                    )
                : [];

            /*
             * Si Alltrack ya entregó 2+ puntos principales,
             * ésa es la geometría preferida para ese tramo.
             */
            if (
              segmentPoints.length >
              1
            ) {
              groupedPaths.push(
                segmentPoints,
              );

              return;
            }

            const isStoppedLike =
              type.includes(
                "deten",
              ) ||
              type.includes(
                "ocioso",
              ) ||
              type.includes(
                "parado",
              ) ||
              type.includes(
                "stop",
              );

            if (
              !isStoppedLike
            ) {
              return;
            }

            const subPoints =
              Array.isArray(
                segment.subPuntos,
              )
                ? segment.subPuntos
                    .filter(
                      isValidTravelPoint,
                    )
                    .map(
                      mapTravelPoint,
                    )
                : [];

            if (
              subPoints.length <
              2
            ) {
              return;
            }

            /*
             * Esto es clave:
             * NO hacemos groupedPaths.push(subPoints).
             *
             * Los partimos en recorridos continuos para que una parada
             * larga o un salto GPS no genere una diagonal atravesando
             * media ciudad.
             */
            const stoppedPaths =
              splitContinuousTravelPaths(
                subPoints,
              );

            stoppedPaths.forEach(
              (path) => {
                if (
                  path.length >
                  1
                ) {
                  groupedPaths.push(
                    path,
                  );
                }
              },
            );
          },
        );

        paths =
          groupedPaths;
      } else if (
        directPoints.length > 0
      ) {
        /*
         * FALLBACK:
         * sólo si Alltrack no devolvió tramos agrupados.
         */
        const mapped =
          directPoints
            .filter(
              isValidTravelPoint,
            )
            .map(
              mapTravelPoint,
            );

        paths =
          splitContinuousTravelPaths(
            mapped,
          );
      }

      const points =
        paths.flat();

      route = {
        segments:
          tramos.length,
        points,
        paths,
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
        distance_unit:
          "km",
        route_points_sorted:
          Boolean(route),
        route_points_count:
          route?.points.length || 0,
        route_paths_count:
          route?.paths.length || 0,
        route_strategy:
          "grouped-points+stopped-subpoints-v2",
        route_first_point:
          route?.points[0]
            ? {
                date:
                  route.points[0].date,
                time:
                  route.points[0].time,
              }
            : null,
        route_last_point:
          route?.points.length
            ? {
                date:
                  route.points[
                    route.points.length - 1
                  ].date,
                time:
                  route.points[
                    route.points.length - 1
                  ].time,
              }
            : null,
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

          distance_km:
            Number(
              distanceKm.toFixed(
                2,
              ),
            ),

          distance_meters:
            Number(
              (
                distanceKm *
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

              distance_km:
                Number(
                  toNumber(
                    session.distancia_recorrida,
                  ).toFixed(
                    3,
                  ),
                ),

              distance_meters:
                Number(
                  (
                    toNumber(
                      session.distancia_recorrida,
                    ) *
                    1000
                  ).toFixed(
                    2,
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
