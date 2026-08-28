import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type WorkOrder = {
  vehicle_code?: string | null;
  vehicle?: string | null;
  license_plate?: string | null;
  entry_date?: string | null;
  failure_type?: string | null;
  repair_type?: string | null;
};

type VehicleCriticalitySetting = {
  id: string;
  vehicle_code: string;
  vehicle: string | null;
  license_plate: string | null;
  service_criticality: number | null;
  replacement_score: number | null;
  security_score: number | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

type VehicleSecurityInspection = {
  id: string;
  vehicle_code: string;
  inspection_date: string | null;
  created_at: string | null;
};

type VehicleMaster = {
  id: string;
  code: string;
  vehicle: string;
  license_plate: string | null;
  operational_status: string | null;
  active: boolean;
  deactivation_date: string | null;
  deactivation_reason: string | null;
};

type VehicleCriticalityStatus =
  | "BUENO"
  | "REGULAR"
  | "MALO"
  | "SIN DATOS"
  | "SIN CHECKLIST"
  | "FUERA DE SERVICIO"
  | "DADO DE BAJA";

type VehicleCriticalitySummaryRow = {
  vehicle_id: string;
  vehicle_code: string;
  vehicle: string;
  license_plate: string;

  operational_status: string | null;
  is_out_of_service: boolean;

  active: boolean;
  is_retired: boolean;
  deactivation_date: string | null;
  deactivation_reason: string | null;

  work_orders_count: number;
  mechanical_reliability_score: number;
  service_criticality: number;
  replacement_score: number;
  security_score: number;

  has_checklist: boolean;
  total_criticality: number | null;

  notes: string;

  status_label: VehicleCriticalityStatus;
  status_display: string;
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const canAccessTaller = (profile: {
  role: string;
  modules: string[] | null;
}) => {
  const role = normalizeText(profile.role);

  return (
    role === "admin" ||
    role === "adminlectura" ||
    role === "taller" ||
    profile.modules?.includes("work_orders")
  );
};

const normalizeVehicleCode = (value: unknown) =>
  normalizeText(value).replace(/[\s.\-]/g, "");

const NON_VEHICLE_CODES = new Set(
  ["Regadores (C)", "Regadores C"].map(
    normalizeVehicleCode,
  ),
);

const isNonVehicleCode = (vehicleCode: unknown) =>
  NON_VEHICLE_CODES.has(
    normalizeVehicleCode(vehicleCode),
  );

const isOutOfServiceStatus = (
  status?: string | null,
) =>
  normalizeText(status).includes(
    "fuera de servicio",
  );

const toNumber = (value: unknown) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return numberValue;
};

const getSixMonthsAgo = () => {
  const date = new Date();

  date.setMonth(date.getMonth() - 6);
  date.setHours(0, 0, 0, 0);

  return date;
};

const getDateValue = (
  dateString?: string | null,
) => {
  if (!dateString) {
    return null;
  }

  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(
    year,
    month - 1,
    day,
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const getMechanicalReliabilityScore = (
  count: number,
) => {
  if (count <= 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  if (count <= 12) return 4;

  return 5;
};

const getCriticalityStatus = (
  criticality: number | null,
  hasChecklist: boolean,
  isRetired: boolean,
): VehicleCriticalityStatus => {
  if (isRetired) {
    return "DADO DE BAJA";
  }

  if (!hasChecklist) {
    return "SIN CHECKLIST";
  }

  if (criticality === null) {
    return "SIN DATOS";
  }

  if (criticality >= 13) {
    return "MALO";
  }

  if (criticality >= 10) {
    return "REGULAR";
  }

  return "BUENO";
};

const getStatusDisplay = (
  status: VehicleCriticalityStatus,
) => {
  switch (status) {
    case "MALO":
      return "CRÍTICO";

    case "BUENO":
      return "BUENO";

    case "REGULAR":
      return "REGULAR";

    case "SIN CHECKLIST":
      return "SIN CHECKLIST";

    case "FUERA DE SERVICIO":
      return "FUERA DE SERVICIO";

    case "DADO DE BAJA":
      return "DADO DE BAJA";

    case "SIN DATOS":
    default:
      return "SIN DATOS";
  }
};

export async function GET(
  request: NextRequest,
) {
  try {
    /*
     * =========================================================
     * FUENTES
     * =========================================================
     *
     * Taller sigue aportando:
     * - Órdenes de trabajo
     * - Configuración de criticidad
     * - Checklists
     *
     * Planta Vehicular pasa a ser la fuente de verdad para:
     * - existencia del vehículo
     * - nombre / dominio actuales
     * - estado operativo
     * - baja / reactivación administrativa
     */
    const supabase = await createClient();

    /*
     * Autenticación y autorización directa.
     * Antes esto quedaba validado indirectamente porque resumen
     * llamaba a otros endpoints internos. Como ahora consultamos
     * Supabase directamente, lo validamos acá.
     */
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role, modules")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      !canAccessTaller(profile)
    ) {
      return NextResponse.json(
        { error: "No autorizado para ver criticidad vehicular" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);

    /*
     * Si llega ?code=A.6 calculamos solamente esa unidad.
     * Sin ?code se mantiene el comportamiento del panel general.
     */
    const requestedVehicleCode =
      searchParams.get("code")?.trim() || "";

    /*
     * IMPORTANTE:
     * No hacemos fetch() hacia /api/work-orders, /api/taller/criticidad
     * ni /api/taller/estado-general. Esas llamadas server -> server
     * eran las que podían fallar detrás del dominio personalizado.
     *
     * Las cuatro fuentes se consultan directamente en Supabase.
     */
    let workOrdersQuery = supabase
      .from("work_orders")
      .select(
        "vehicle_code, vehicle, license_plate, entry_date, failure_type, repair_type",
      );

    let vehiclesQuery = supabase
      .from("vehicles")
      .select(
        `
          id,
          code,
          vehicle,
          license_plate,
          operational_status,
          active,
          deactivation_date,
          deactivation_reason
        `,
      );

    if (requestedVehicleCode) {
      workOrdersQuery = workOrdersQuery.eq(
        "vehicle_code",
        requestedVehicleCode,
      );

      vehiclesQuery = vehiclesQuery.eq(
        "code",
        requestedVehicleCode,
      );
    }

    const [
      workOrdersResult,
      settingsResult,
      inspectionsResult,
      vehiclesResult,
    ] = await Promise.all([
      workOrdersQuery,
      supabase
        .from("vehicle_criticality_settings")
        .select(
          "id, vehicle_code, vehicle, license_plate, service_criticality, replacement_score, security_score, notes, created_at, updated_at",
        ),
      supabase
        .from("vehicle_security_inspections")
        .select(
          "id, vehicle_code, inspection_date, created_at",
        ),
      vehiclesQuery.order("code", {
        ascending: true,
      }),
    ]);

    if (workOrdersResult.error) {
      console.error(
        "Error fetching work orders for criticality summary:",
        workOrdersResult.error,
      );

      throw new Error(
        "No se pudieron cargar las órdenes de trabajo para calcular la criticidad",
      );
    }

    if (settingsResult.error) {
      console.error(
        "Error fetching criticality settings:",
        settingsResult.error,
      );

      throw new Error(
        "No se pudo cargar la configuración de criticidad",
      );
    }

    if (inspectionsResult.error) {
      console.error(
        "Error fetching vehicle inspections for criticality summary:",
        inspectionsResult.error,
      );

      throw new Error(
        "No se pudieron cargar los checklist vehiculares",
      );
    }

    if (vehiclesResult.error) {
      console.error(
        "Error fetching vehicles for criticality summary:",
        vehiclesResult.error,
      );

      throw new Error(
        "No se pudo cargar Planta Vehicular para calcular la criticidad",
      );
    }

    const workOrders =
      (workOrdersResult.data || []) as WorkOrder[];

    const settings =
      (settingsResult.data || []) as VehicleCriticalitySetting[];

    const inspections =
      (inspectionsResult.data || []) as VehicleSecurityInspection[];

    const vehicles =
      (vehiclesResult.data || []) as VehicleMaster[];

    /*
     * =========================================================
     * ÍNDICES NORMALIZADOS
     * =========================================================
     *
     * Usamos código normalizado para evitar diferencias como:
     * A.6 / A 6 / A-6
     */
    const settingsByVehicle =
      new Map<
        string,
        VehicleCriticalitySetting
      >();

    settings.forEach((setting) => {
      const key =
        normalizeVehicleCode(
          setting.vehicle_code,
        );

      if (!key) {
        return;
      }

      settingsByVehicle.set(
        key,
        setting,
      );
    });

    const workOrdersByVehicle =
      new Map<string, WorkOrder[]>();

    workOrders.forEach((order) => {
      const vehicleCode =
        String(
          order.vehicle_code || "",
        ).trim();

      if (
        !vehicleCode ||
        isNonVehicleCode(vehicleCode)
      ) {
        return;
      }

      const key =
        normalizeVehicleCode(
          vehicleCode,
        );

      if (!key) {
        return;
      }

      const currentOrders =
        workOrdersByVehicle.get(key) ||
        [];

      currentOrders.push(order);

      workOrdersByVehicle.set(
        key,
        currentOrders,
      );
    });

    const vehiclesWithChecklist =
      new Set<string>();

    inspections.forEach((inspection) => {
      const key =
        normalizeVehicleCode(
          inspection.vehicle_code,
        );

      if (!key) {
        return;
      }

      vehiclesWithChecklist.add(key);
    });

    /*
     * =========================================================
     * CÁLCULO
     * =========================================================
     *
     * A partir de ahora NO existe una lista manual
     * RETIRED_VEHICLES.
     *
     * Cada fila nace desde public.vehicles.
     */
    const sixMonthsAgo =
      getSixMonthsAgo();

    const data:
      VehicleCriticalitySummaryRow[] =
      vehicles
        .filter(
          (vehicle) =>
            !isNonVehicleCode(
              vehicle.code,
            ),
        )
        .map(
          (
            vehicle,
          ): VehicleCriticalitySummaryRow => {
          const key =
            normalizeVehicleCode(
              vehicle.code,
            );

          const setting =
            settingsByVehicle.get(key);

          const orders =
            workOrdersByVehicle.get(key) ||
            [];

          /*
           * Sólo cuentan OT de los últimos 6 meses
           * y se excluyen las cargadas como mantenimiento.
           */
          const validOtCount =
            orders.filter((order) => {
              const date =
                getDateValue(
                  order.entry_date,
                );

              if (
                !date ||
                date < sixMonthsAgo
              ) {
                return false;
              }

              const failureType =
                normalizeText(
                  order.failure_type,
                );

              const repairType =
                normalizeText(
                  order.repair_type,
                );

              return (
                !failureType.includes(
                  "mantenimiento",
                ) &&
                !repairType.includes(
                  "mantenimiento",
                )
              );
            }).length;

          const isRetired =
            !vehicle.active;

          const isOutOfService =
            isOutOfServiceStatus(
              vehicle.operational_status,
            );

          /*
           * Si está dado de baja:
           * - queda visible para control
           * - se excluye del cálculo activo
           * - no arrastra valores viejos como si siguiera operativo
           */
          if (isRetired) {
            const status =
              getCriticalityStatus(
                null,
                false,
                true,
              );

            return {
              vehicle_id:
                vehicle.id,

              vehicle_code:
                vehicle.code,

              vehicle:
                vehicle.vehicle,

              license_plate:
                vehicle.license_plate ||
                "-",

              operational_status:
                vehicle.operational_status,

              is_out_of_service:
                isOutOfService,

              active: false,

              is_retired: true,

              deactivation_date:
                vehicle.deactivation_date,

              deactivation_reason:
                vehicle.deactivation_reason,

              work_orders_count: 0,

              mechanical_reliability_score:
                0,

              service_criticality: 0,

              replacement_score: 0,

              security_score: 0,

              has_checklist: false,

              total_criticality: null,

              notes:
                vehicle.deactivation_reason
                  ? `Vehículo dado de baja. ${vehicle.deactivation_reason}`
                  : "Vehículo dado de baja. Excluido del cálculo de criticidad.",

              status_label:
                status,

              status_display:
                getStatusDisplay(
                  status,
                ),
            };
          }

          /*
           * Fuera de servicio NO significa dado de baja,
           * pero SÍ queda excluido del cálculo de criticidad.
           *
           * Esto evita que:
           * - sume dentro de "Vehículos analizados";
           * - afecte la cantidad de "Sin checklist";
           * - aparezca como BUENO / REGULAR / CRÍTICO mientras no está operativo.
           *
           * Sigue visible para control con estado FUERA DE SERVICIO.
           */
          if (isOutOfService) {
            return {
              vehicle_id:
                vehicle.id,

              vehicle_code:
                vehicle.code,

              vehicle:
                vehicle.vehicle,

              license_plate:
                vehicle.license_plate ||
                "-",

              operational_status:
                vehicle.operational_status,

              is_out_of_service:
                true,

              active: true,

              is_retired: false,

              deactivation_date:
                null,

              deactivation_reason:
                null,

              work_orders_count:
                0,

              mechanical_reliability_score:
                0,

              service_criticality:
                0,

              replacement_score:
                0,

              security_score:
                0,

              has_checklist:
                false,

              total_criticality:
                null,

              notes:
                "Vehículo fuera de servicio. Excluido temporalmente del cálculo de criticidad.",

              status_label:
                "FUERA DE SERVICIO",

              status_display:
                "FUERA DE SERVICIO",
            };
          }

          const mechanicalScore =
            getMechanicalReliabilityScore(
              validOtCount,
            );

          const serviceCriticality =
            toNumber(
              setting?.service_criticality,
            );

          const replacementScore =
            toNumber(
              setting?.replacement_score,
            );

          const securityScore =
            toNumber(
              setting?.security_score,
            );

          const hasChecklist =
            vehiclesWithChecklist.has(
              key,
            );

          const totalCriticality =
            hasChecklist
              ? mechanicalScore +
                serviceCriticality +
                replacementScore +
                securityScore
              : null;

          const status =
            getCriticalityStatus(
              totalCriticality,
              hasChecklist,
              false,
            );

          return {
            vehicle_id:
              vehicle.id,

            vehicle_code:
              vehicle.code,

            /*
             * Nombre y dominio salen de Planta Vehicular.
             * Así, si se corrigen allí, Taller recibe el dato actual.
             */
            vehicle:
              vehicle.vehicle,

            license_plate:
              vehicle.license_plate ||
              "-",

            operational_status:
              vehicle.operational_status,

            is_out_of_service:
              isOutOfService,

            active: true,

            is_retired: false,

            deactivation_date:
              null,

            deactivation_reason:
              null,

            work_orders_count:
              validOtCount,

            mechanical_reliability_score:
              mechanicalScore,

            service_criticality:
              serviceCriticality,

            replacement_score:
              replacementScore,

            security_score:
              securityScore,

            has_checklist:
              hasChecklist,

            total_criticality:
              totalCriticality,

            notes:
              setting?.notes || "",

            status_label:
              status,

            status_display:
              getStatusDisplay(
                status,
              ),
          };
          },
        )
        .sort((a, b) => {
          /*
           * Activos primero.
           * Dados de baja al final.
           */
          if (
            a.is_retired &&
            !b.is_retired
          ) {
            return 1;
          }

          if (
            !a.is_retired &&
            b.is_retired
          ) {
            return -1;
          }

          /*
           * Entre activos:
           * criticidad más alta primero.
           */
          if (
            a.total_criticality ===
              null &&
            b.total_criticality !==
              null
          ) {
            return 1;
          }

          if (
            a.total_criticality !==
              null &&
            b.total_criticality ===
              null
          ) {
            return -1;
          }

          if (
            a.total_criticality !==
              null &&
            b.total_criticality !==
              null &&
            a.total_criticality !==
              b.total_criticality
          ) {
            return (
              b.total_criticality -
              a.total_criticality
            );
          }

          return a.vehicle_code.localeCompare(
            b.vehicle_code,
            "es",
            {
              numeric: true,
            },
          );
        });

    return NextResponse.json({
      data,
      generated_at:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Unexpected error in GET /api/taller/criticidad/resumen:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al calcular resumen de criticidad vehicular",
      },
      {
        status: 500,
      },
    );
  }
}
