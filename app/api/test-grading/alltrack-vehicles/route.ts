import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/*
 * ============================================================
 * MAPA DE BARRIDO - UBICACIÓN ACTUAL ALLTRACK
 * ============================================================
 *
 * Devuelve únicamente los vehículos que hoy consideramos de
 * Motonivelación. La lista se puede ampliar o reducir más adelante.
 *
 * IMPORTANTE:
 * - Hace UNA sola llamada a JSON__GET_lastValidPosition.
 * - Cruza las posiciones con public.vehicles por
 *   alltrack_vehicle_id y, como respaldo, por patente.
 * - No expone usuario, contraseña ni token de Alltrack.
 */

const GRADING_VEHICLE_CODES = ["M.C.1", "M.C.2", "M.C.3", "M.C.4", "M.C.5", "M.C.6"] as const;

const FULL_ACCESS_EMAILS = new Set([
  "waldaquin84@gmail.com",
  "adm.serviciospublicos.mgp@gmail.com",
  "martincornejo.gp@gmail.com",
]);

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizePlate = (value: unknown) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "");

type AlltrackResponse<T> = {
  status?: string;
  token?: string;
  data?: T;
  error_code?: string;
  error?: string;
};

type AlltrackPosition = {
  hora?: string | null;
  fecha?: string | null;
  vehiculo_id?: string | number | null;
  patente?: string | null;
  conductor?: string | null;
  lat?: number | string | null;
  lon?: number | string | null;
  estado?: string | null;
  velocidad?: number | string | null;
  odometro?: string | number | null;
  horometro?: string | number | null;
  sentido?: number | string | null;
  direccion?: string | null;
  timeout?: number | string | null;
};

class AlltrackApiError extends Error {
  errorCode?: string;
  httpStatus?: number;

  constructor(
    message: string,
    options?: {
      errorCode?: string;
      httpStatus?: number;
    }
  ) {
    super(message);
    this.name = "AlltrackApiError";
    this.errorCode = options?.errorCode;
    this.httpStatus = options?.httpStatus;
  }
}

/*
 * ============================================================
 * TOKEN CACHE
 * ============================================================
 */

type AlltrackTokenCache = {
  token: string | null;
  expiresAt: number;
  loginPromise: Promise<string> | null;
};

const ALLTRACK_TOKEN_TTL_MS =
  55 * 60 * 1000;

const alltrackTokenCache: AlltrackTokenCache = {
  token: null,
  expiresAt: 0,
  loginPromise: null,
};

function clearAlltrackTokenCache() {
  alltrackTokenCache.token = null;
  alltrackTokenCache.expiresAt = 0;
}

function saveAlltrackToken(
  token: string
) {
  alltrackTokenCache.token = token;
  alltrackTokenCache.expiresAt =
    Date.now() +
    ALLTRACK_TOKEN_TTL_MS;
}

function hasValidCachedToken() {
  return Boolean(
    alltrackTokenCache.token &&
      Date.now() <
        alltrackTokenCache.expiresAt
  );
}

function isSessionExpiredError(
  error: unknown
) {
  return (
    error instanceof AlltrackApiError &&
    (
      error.errorCode === "1003" ||
      normalizeText(
        error.message
      ).includes(
        "sesion caducada"
      )
    )
  );
}

/*
 * ============================================================
 * CONFIG / LLAMADAS ALLTRACK
 * ============================================================
 */

function getAlltrackConfig() {
  const username =
    process.env.ALLTRACK_USERNAME;

  const password =
    process.env.ALLTRACK_PASSWORD;

  const baseUrl =
    process.env.ALLTRACK_BASE_URL ||
    "https://sistema1.alltrack.com.ar/apiV3";

  if (!username || !password) {
    throw new Error(
      "Faltan ALLTRACK_USERNAME o ALLTRACK_PASSWORD"
    );
  }

  return {
    username,
    password,
    baseUrl:
      baseUrl.replace(/\/+$/, ""),
  };
}

async function alltrackPost<T>({
  url,
  token,
  formData,
}: {
  url: string;
  token?: string;
  formData?: FormData;
}): Promise<AlltrackResponse<T>> {
  const payload =
    formData ??
    new FormData();

  /*
   * En tu integración actual el token funciona correctamente
   * enviado dentro del form-data.
   */
  if (token) {
    payload.set(
      "token",
      token
    );
  }

  const response =
    await fetch(url, {
      method: "POST",
      cache: "no-store",
      body: payload,
    });

  const rawText =
    await response.text();

  let result:
    AlltrackResponse<T>;

  try {
    result =
      JSON.parse(
        rawText
      ) as AlltrackResponse<T>;
  } catch {
    throw new Error(
      `Alltrack respondió HTTP ${response.status}: ${
        rawText
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 300) ||
        "respuesta vacía"
      }`
    );
  }

  if (
    !response.ok ||
    result.status !== "ok"
  ) {
    throw new AlltrackApiError(
      result.error ||
        `Error Alltrack HTTP ${response.status}`,
      {
        errorCode:
          result.error_code,
        httpStatus:
          response.status,
      }
    );
  }

  return result;
}

async function loginAlltrack() {
  const {
    username,
    password,
    baseUrl,
  } = getAlltrackConfig();

  const formData =
    new FormData();

  formData.append(
    "username",
    username
  );

  formData.append(
    "password",
    password
  );

  formData.append(
    "sessionTime",
    "3600"
  );

  const result =
    await alltrackPost<unknown>({
      url:
        `${baseUrl}/JSON__login/`,
      formData,
    });

  if (!result.token) {
    throw new Error(
      "Alltrack no devolvió token"
    );
  }

  saveAlltrackToken(
    result.token
  );

  return {
    token:
      result.token,
    baseUrl,
  };
}

async function getAlltrackToken(
  forceRefresh = false
) {
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
    };
  }

  clearAlltrackTokenCache();

  const loginPromise =
    loginAlltrack().then(
      (result) =>
        result.token
    );

  alltrackTokenCache.loginPromise =
    loginPromise;

  try {
    const token =
      await loginPromise;

    return {
      token,
      baseUrl,
    };
  } finally {
    alltrackTokenCache.loginPromise =
      null;
  }
}

async function authenticatedAlltrackPost<T>({
  pathname,
}: {
  pathname: string;
}): Promise<
  AlltrackResponse<T>
> {
  const execute =
    async (
      forceRefresh = false
    ) => {
      const {
        token,
        baseUrl,
      } =
        await getAlltrackToken(
          forceRefresh
        );

      const result =
        await alltrackPost<T>({
          url:
            `${baseUrl}${pathname}`,
          token,
        });

      if (result.token) {
        saveAlltrackToken(
          result.token
        );
      }

      return result;
    };

  try {
    return await execute();
  } catch (error) {
    if (
      !isSessionExpiredError(
        error
      )
    ) {
      throw error;
    }

    clearAlltrackTokenCache();

    return execute(true);
  }
}

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function toFiniteNumber(
  value: unknown
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

/*
 * ============================================================
 * GET
 * ============================================================
 */

export async function GET() {
  try {
    const supabase =
      await createClient();

    /*
     * --------------------------------------------------------
     * AUTENTICACIÓN DEL SISTEMA
     * --------------------------------------------------------
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
        }
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("users")
      .select(
        "role, email"
      )
      .eq(
        "id",
        user.id
      )
      .single();

    if (
      profileError ||
      !profile
    ) {
      return NextResponse.json(
        {
          error:
            "No se pudo validar el usuario",
        },
        {
          status: 500,
        }
      );
    }

    const email =
      String(
        profile.email ||
          user.email ||
          ""
      ).toLowerCase();

    const allowed =
      profile.role ===
        "Admin" ||
      profile.role ===
        "AdminLectura" ||
      FULL_ACCESS_EMAILS.has(
        email
      );

    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "No autorizado para consultar vehículos de motonivelación",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * VEHÍCULOS DE BARRIDO EN NUESTRA BASE
     * --------------------------------------------------------
     */

    const {
      data: vehicles,
      error: vehiclesError,
    } = await supabase
      .from("vehicles")
      .select(
        `
          id,
          code,
          vehicle,
          license_plate,
          department,
          operational_status,
          utilization,
          primary_driver_1,
          primary_driver_2,
          backup_driver,
          has_alltrack,
          alltrack_vehicle_id,
          active
        `
      )
      .in(
        "code",
        [
          ...GRADING_VEHICLE_CODES,
        ]
      )
      .eq(
        "active",
        true
      );

    if (vehiclesError) {
      console.error(
        "Error consultando vehículos de motonivelación:",
        vehiclesError
      );

      return NextResponse.json(
        {
          error:
            "No se pudieron cargar los vehículos de motonivelación.",
        },
        {
          status: 500,
        }
      );
    }

    const vehicleRows =
      Array.isArray(vehicles)
        ? vehicles
        : [];

    /*
     * --------------------------------------------------------
     * ÚLTIMAS POSICIONES
     *
     * UNA SOLA llamada a Alltrack.
     * --------------------------------------------------------
     */

    const positionsResult =
      await authenticatedAlltrackPost<
        AlltrackPosition[]
      >({
        pathname:
          "/JSON__GET_lastValidPosition/",
      });

    const positions =
      Array.isArray(
        positionsResult.data
      )
        ? positionsResult.data
        : [];

    /*
     * --------------------------------------------------------
     * CRUCE
     * Primero ID Alltrack y luego patente como respaldo.
     * --------------------------------------------------------
     */

    const result =
      GRADING_VEHICLE_CODES.map(
        (code) => {
          const vehicle =
            vehicleRows.find(
              (item) =>
                item.code ===
                code
            );

          if (!vehicle) {
            return {
              code,
              found_in_database:
                false,
              has_alltrack:
                false,
              available_position:
                false,
              reason:
                "VEHICLE_NOT_FOUND",
              vehicle: null,
              position: null,
            };
          }

          const alltrackId =
            vehicle.alltrack_vehicle_id
              ? String(
                  vehicle.alltrack_vehicle_id
                )
              : null;

          const plate =
            normalizePlate(
              vehicle.license_plate
            );

          let position =
            alltrackId
              ? positions.find(
                  (item) =>
                    String(
                      item.vehiculo_id ??
                        ""
                    ) ===
                    alltrackId
                ) ?? null
              : null;

          if (
            !position &&
            plate
          ) {
            position =
              positions.find(
                (item) =>
                  normalizePlate(
                    item.patente
                  ) ===
                  plate
              ) ?? null;
          }

          const lat =
            toFiniteNumber(
              position?.lat
            );

          const lng =
            toFiniteNumber(
              position?.lon
            );

          const hasValidPosition =
            position !== null &&
            lat !== null &&
            lng !== null;

          return {
            code:
              vehicle.code,
            found_in_database:
              true,
            has_alltrack:
              Boolean(
                vehicle.has_alltrack
              ),
            available_position:
              hasValidPosition,
            reason:
              !vehicle.has_alltrack
                ? "ALLTRACK_DISABLED"
                : !alltrackId &&
                    !plate
                  ? "NO_ALLTRACK_ID_OR_PLATE"
                  : !position
                    ? "NO_VALID_POSITION"
                    : !hasValidPosition
                      ? "INVALID_COORDINATES"
                      : null,
            vehicle: {
              id:
                vehicle.id,
              name:
                vehicle.vehicle,
              license_plate:
                vehicle.license_plate,
              department:
                vehicle.department,
              operational_status:
                vehicle.operational_status,
              utilization:
                vehicle.utilization,
              primary_driver_1:
                vehicle.primary_driver_1,
              primary_driver_2:
                vehicle.primary_driver_2,
              backup_driver:
                vehicle.backup_driver,
              alltrack_vehicle_id:
                alltrackId,
            },
            position:
              hasValidPosition
                ? {
                    lat,
                    lng,
                    status:
                      position?.estado ??
                      null,
                    speed:
                      toFiniteNumber(
                        position?.velocidad
                      ),
                    driver:
                      position?.conductor ??
                      null,
                    date:
                      position?.fecha ??
                      null,
                    time:
                      position?.hora ??
                      null,
                    address:
                      position?.direccion ??
                      null,
                    odometer:
                      position?.odometro ??
                      null,
                    hourmeter:
                      position?.horometro ??
                      null,
                    heading:
                      toFiniteNumber(
                        position?.sentido
                      ),
                    timeout:
                      toFiniteNumber(
                        position?.timeout
                      ),
                    alltrack_vehicle_id:
                      position?.vehiculo_id !==
                        null &&
                      position?.vehiculo_id !==
                        undefined
                        ? String(
                            position.vehiculo_id
                          )
                        : alltrackId,
                    alltrack_plate:
                      position?.patente ??
                      null,
                  }
                : null,
          };
        }
      );

    const located =
      result.filter(
        (item) =>
          item.available_position
      ).length;

    return NextResponse.json({
      updated_at:
        new Date().toISOString(),
      requested_codes: [
        ...GRADING_VEHICLE_CODES,
      ],
      total:
        result.length,
      located,
      without_position:
        result.length -
        located,
      data:
        result,
    });
  } catch (error) {
    console.error(
      "Error GET /api/test-grading/alltrack-vehicles:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error interno al consultar Alltrack",
      },
      {
        status: 500,
      }
    );
  }
}
