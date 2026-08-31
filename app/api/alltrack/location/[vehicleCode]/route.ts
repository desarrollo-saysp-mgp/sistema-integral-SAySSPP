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


export async function GET(
  _request: NextRequest,
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

    if (authError || !user) {
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
      !canAccess(profile)
    ) {
      return NextResponse.json(
        {
          error:
            "No autorizado para rastrear vehículos",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * =========================================
     * VEHÍCULO DE PLANTA VEHICULAR
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

    const vehiclePlate =
      vehicle.license_plate
        ? normalizePlate(
            vehicle.license_plate,
          )
        : "";

    const normalizedVehicleCode =
      normalizeVehicleCode(
        vehicle.code,
      );

    /*
     * =========================================
     * LOGIN ALLTRACK
     * =========================================
     */

    let {
      token,
    } = await getAlltrackToken();

    /*
     * token se reutiliza mientras siga vigente.
     * Si Alltrack informa "Sesion Caducada",
     * authenticatedAlltrackPost renueva la sesión
     * automáticamente y reintenta una vez.
     */

    /*
     * =========================================
     * ÚLTIMA POSICIÓN ALLTRACK
     * =========================================
     *
     * IMPORTANTE:
     *
     * Antes intentábamos resolver el vehículo primero con
     * JSON__GET_vehiclesByFleets. Eso funciona para muchas
     * unidades, pero puede omitir vehículos "cedidos" o que
     * están disponibles para el usuario por otra relación.
     *
     * JSON__GET_lastValidPosition, en cambio, está documentado
     * para devolver la última posición válida de los vehículos
     * del usuario autenticado y además incluye vehiculo_id y
     * patente.
     *
     * Por eso ahora hacemos:
     *
     * 1. Consultar posiciones directamente.
     * 2. Si ya tenemos alltrack_vehicle_id, buscar por ID.
     * 3. Si todavía no tenemos ID, buscar por patente.
     * 4. Si encontramos por patente, guardar vehiculo_id en
     *    public.vehicles para las siguientes consultas.
     */

    const {
      result:
        positionsResult,
      token:
        refreshedPositionToken,
    } =
      await authenticatedAlltrackPost<
        AlltrackPosition[]
      >({
        pathname:
          "/JSON__GET_lastValidPosition/",
      });

    token =
      refreshedPositionToken;

    const positions =
      Array.isArray(
        positionsResult.data,
      )
        ? positionsResult.data
        : [];

    const storedAlltrackVehicleId =
      vehicle.alltrack_vehicle_id
        ? String(
            vehicle.alltrack_vehicle_id,
          )
        : null;

    /*
     * 1) Intento directo por ID ya guardado.
     */
    let position =
      storedAlltrackVehicleId
        ? positions.find(
            (item) =>
              String(
                item.vehiculo_id ||
                  "",
              ) ===
              storedAlltrackVehicleId,
          ) ?? null
        : null;

    /*
     * 2) Si no tenemos posición por ID y existe patente,
     * intentamos por patente.
     */
    if (
      !position &&
      vehiclePlate
    ) {
      position =
        positions.find(
          (item) =>
            normalizePlate(
              item.patente,
            ) ===
            vehiclePlate,
        ) ?? null;
    }

    /*
     * 3) Si todavía no resolvimos el vehículo (caso sin patente,
     * patente "A definir", patente vieja, etc.), buscamos el ID
     * en las flotas usando el código/alias municipal.
     *
     * Esto NO reemplaza la búsqueda directa por posición.
     * Es solamente un fallback para obtener vehiculo_id.
     */
    let fallbackVehicle:
      AlltrackFleetVehicle | null =
      null;

    let resolvedAlltrackVehicleId =
      position?.vehiculo_id !==
        null &&
      position?.vehiculo_id !==
        undefined &&
      String(
        position.vehiculo_id,
      ).trim()
        ? String(
            position.vehiculo_id,
          )
        : storedAlltrackVehicleId;

    if (
      !position &&
      !resolvedAlltrackVehicleId
    ) {
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

      const fleetVehicles =
        fleets.flatMap(
          (fleet) =>
            Array.isArray(
              fleet.children,
            )
              ? fleet.children
              : [],
        );

      fallbackVehicle =
        fleetVehicles.find(
          (item) =>
            normalizeVehicleCode(
              item.alias_cliente,
            ) ===
            normalizedVehicleCode,
        ) ?? null;

      if (
        fallbackVehicle?.id !==
          null &&
        fallbackVehicle?.id !==
          undefined
      ) {
        resolvedAlltrackVehicleId =
          String(
            fallbackVehicle.id,
          );

        position =
          positions.find(
            (item) =>
              String(
                item.vehiculo_id ||
                  "",
              ) ===
              resolvedAlltrackVehicleId,
          ) ?? null;
      }
    }

    /*
     * El vehículo puede existir en Alltrack pero no tener una
     * posición válida disponible. Esto es distinto de "vehículo
     * no encontrado".
     */
    if (
      !position &&
      resolvedAlltrackVehicleId
    ) {
      if (
        !storedAlltrackVehicleId
      ) {
        const {
          error:
            updateAlltrackIdError,
        } = await supabase
          .from("vehicles")
          .update({
            alltrack_vehicle_id:
              resolvedAlltrackVehicleId,
          })
          .eq(
            "id",
            vehicle.id,
          );

        if (
          updateAlltrackIdError
        ) {
          console.error(
            "No se pudo guardar alltrack_vehicle_id:",
            {
              code:
                vehicle.code,
              alltrack_vehicle_id:
                resolvedAlltrackVehicleId,
              error:
                updateAlltrackIdError,
            },
          );
        }
      }

      return NextResponse.json(
        {
          error:
            "El vehículo está vinculado con Alltrack, pero no tiene una posición válida disponible en este momento.",
          reason:
            "NO_VALID_POSITION",
          vehicle: {
            code:
              vehicle.code,
            vehicle:
              vehicle.vehicle,
            license_plate:
              vehicle.license_plate,
            alltrack_vehicle_id:
              resolvedAlltrackVehicleId,
          },
        },
        {
          status: 404,
        },
      );
    }

    if (!position) {
      console.warn(
        "Vehículo no encontrado en Alltrack:",
        {
          code:
            vehicle.code,
          plate:
            vehicle.license_plate,
          alltrack_vehicle_id:
            vehicle.alltrack_vehicle_id,
          positionsReturned:
            positions.length,
        },
      );

      return NextResponse.json(
        {
          error:
            "El vehículo no pudo ser vinculado con Alltrack por ID, patente ni código.",
          reason:
            "VEHICLE_NOT_LINKED",
          vehicle: {
            code:
              vehicle.code,
            vehicle:
              vehicle.vehicle,
            license_plate:
              vehicle.license_plate,
          },
        },
        {
          status: 404,
        },
      );
    }

    resolvedAlltrackVehicleId =
      position.vehiculo_id !==
        null &&
      position.vehiculo_id !==
        undefined &&
      String(
        position.vehiculo_id,
      ).trim()
        ? String(
            position.vehiculo_id,
          )
        : resolvedAlltrackVehicleId;

    /*
     * Si todavía no estaba vinculado en Planta Vehicular y
     * encontramos la posición por patente, guardamos el ID
     * automáticamente.
     *
     * No modificamos la patente ni ningún otro dato.
     */
    if (
      !storedAlltrackVehicleId &&
      resolvedAlltrackVehicleId
    ) {
      const {
        error:
          updateAlltrackIdError,
      } = await supabase
        .from("vehicles")
        .update({
          alltrack_vehicle_id:
            resolvedAlltrackVehicleId,
        })
        .eq(
          "id",
          vehicle.id,
        );

      if (
        updateAlltrackIdError
      ) {
        console.error(
          "No se pudo guardar alltrack_vehicle_id:",
          {
            vehicleId:
              vehicle.id,
            code:
              vehicle.code,
            alltrackVehicleId:
              resolvedAlltrackVehicleId,
            error:
              updateAlltrackIdError,
          },
        );
      } else {
        console.log(
          "Vehículo vinculado automáticamente con Alltrack:",
          {
            code:
              vehicle.code,
            plate:
              vehicle.license_plate,
            alltrack_vehicle_id:
              resolvedAlltrackVehicleId,
          },
        );
      }
    }

    /*
     * =========================================
     * RESPUESTA LIMPIA PARA NUESTRA APP
     * =========================================
     */

    return NextResponse.json({
      meta: {
        alltrack_token_cache:
          hasValidCachedToken(),
      },

      data: {
        vehicle: {
          id: vehicle.id,
          code:
            vehicle.code,
          name:
            vehicle.vehicle,
          license_plate:
            vehicle.license_plate,

          alltrack_vehicle_id:
            resolvedAlltrackVehicleId,

          alltrack: {
            alias:
              fallbackVehicle
                ?.alias_cliente ??
              null,
            license_plate:
              position.patente ??
              fallbackVehicle
                ?.patente ??
              null,
            brand:
              fallbackVehicle
                ?.marca ??
              null,
            model:
              fallbackVehicle
                ?.modelo ??
              null,
            type:
              fallbackVehicle
                ?.vehiculo_tipo ??
              null,
          },
        },

        position: {
          latitude:
            position.lat ??
            null,

          longitude:
            position.lon ??
            null,

          status:
            position.estado ??
            null,

          speed:
            position.velocidad ??
            null,

          driver:
            position.conductor ??
            null,

          date:
            position.fecha ??
            null,

          time:
            position.hora ??
            null,

          address:
            position.direccion ??
            null,

          odometer:
            position.odometro ??
            null,

          hourmeter:
            position.horometro ??
            null,

          heading:
            position.sentido ??
            null,

          timeout:
            position.timeout ??
            null,
        },
      },
    });
  } catch (error) {
    console.error(
      "Error GET /api/alltrack/location/[vehicleCode]:",
      error,
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
      },
    );
  }
}