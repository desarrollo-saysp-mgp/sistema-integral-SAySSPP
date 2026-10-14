import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ModuleKey =
  | "complaints"
  | "purchase_requests"
  | "general_dashboard"
  | "work_orders"
  | "vehicle_fleet"
  | "stock_inventory"
  | "rnu"
  | "personnel"
  | "sweeping_map";

type AccessItem = {
  key: ModuleKey;
  title: string;
  description: string;
  href: string;
  available: boolean;
};

const MODULE_CONFIG: Record<ModuleKey, AccessItem> = {
  complaints: {
    key: "complaints",
    title: "Reclamos",
    description: "Gestión y seguimiento de reclamos ciudadanos.",
    href: "/dashboard/complaints/home",
    available: true,
  },
  purchase_requests: {
    key: "purchase_requests",
    title: "Formularios de Compra",
    description: "Gestión de formularios de compra por sector.",
    href: "/dashboard/solicitud-compra",
    available: true,
  },
  general_dashboard: {
    key: "general_dashboard",
    title: "Tablero General",
    description: "Visualización tablero Power BI.",
    href: "/dashboard/tablero-general",
    available: true,
  },
  work_orders: {
    key: "work_orders",
    title: "Órdenes de Trabajo",
    description: "Carga y seguimiento de órdenes de trabajo del taller.",
    href: "/dashboard/taller/ordenes-trabajo",
    available: true,
  },
  vehicle_fleet: {
    key: "vehicle_fleet",
    title: "Planta Vehicular",
    description:
      "Administración, consulta y seguimiento de la flota vehicular.",
    href: "/dashboard/planta-vehicular",
    available: true,
  },
  stock_inventory: {
    key: "stock_inventory",
    title: "Stock, Inventario y Compras",
    description:
      "Administración de stock, inventario, compras y entrega de productos.",
    href: "/dashboard/suministros",
    available: true,
  },
  rnu: {
    key: "rnu",
    title: "Registro de Ingresos RNU",
    description:
      "Registro de visitantes e instituciones de la Reserva Natural Urbana.",
    href: "/dashboard/rnu",
    available: true,
  },
  personnel: {
    key: "personnel",
    title: "Personal",
    description:
      "Carga, edición, consulta y baja del personal de la Secretaría.",
    href: "/dashboard/personnel",
    available: true,
  },
  sweeping_map: {
    key: "sweeping_map",
    title: "Mapa de Barrido",
    description:
      "Planificación, registro y seguimiento de los recorridos de barrido.",
    href: "/dashboard/test-sweeping-map",
    available: true,
  },
};

const GIRSU_EMAILS = [
  "direcciongirsupico@gmail.com",
  "direccióngirsupico@gmail.com",
];

const ARBOLADO_EMAILS = ["arqbelliardolucas@gmail.com"];

const LUCAS_BELLIARDO_EMAIL = "arqbelliardolucas@gmail.com";

const SERVICIOS_PUBLICOS_EMAILS = [
  "adm.serviciospublicos.mgp@gmail.com",
  "waldaquin84@gmail.com",
];

const DIRECTOR_GIRSU_EMAIL = "direcciongirsupico@gmail.com";
const DIRECTOR_SERVICIOS_PUBLICOS_EMAIL = "waldaquin84@gmail.com";

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

const normalizeModule = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

export default async function AccesosPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("full_name, email, role, modules, is_readonly")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/login");
  }

  const allowedRoles = ["admin", "adminlectura"];

  const userRole = normalizeText(profile.role);
  const userEmail = normalizeText(profile.email || user.email);

  const isGirsuUser = GIRSU_EMAILS
    .map(normalizeText)
    .includes(userEmail);

  const isArboladoUser = ARBOLADO_EMAILS
    .map(normalizeText)
    .includes(userEmail);

  const isLucasBelliardo =
    userEmail === normalizeText(LUCAS_BELLIARDO_EMAIL);

  const isServiciosPublicosUser =
    SERVICIOS_PUBLICOS_EMAILS
      .map(normalizeText)
      .includes(userEmail);

  const isDirectorGirsu =
    userEmail === normalizeText(DIRECTOR_GIRSU_EMAIL);

  const isDirectorServiciosPublicos =
    userEmail === normalizeText(DIRECTOR_SERVICIOS_PUBLICOS_EMAIL);

  const displayRole = isDirectorGirsu
    ? "DirectorGIRSU"
    : isDirectorServiciosPublicos
      ? "DirectorServiciosPublicos"
      : isLucasBelliardo
        ? "DirectorArbolado"
        : profile.role;

  const isTallerUser = userRole === "taller";
  const isSuministrosUser = userRole === "suministros";
  const isRnuUser = userRole === "rnu";
  const isSecretariaPrivadaUser =
    userRole === "secretariaprivada";

  const hasAllowedRole =
    allowedRoles.includes(userRole);

  const rawModules: string[] =
    Array.isArray(profile.modules)
      ? profile.modules.filter(
          (module): module is string =>
            typeof module === "string",
        )
      : [];

  const modules = rawModules.map(
    (module) => normalizeModule(module),
  );

  const baseAccesses = modules
    .map(
      (moduleKey) =>
        MODULE_CONFIG[moduleKey as ModuleKey],
    )
    .filter(
      (item): item is AccessItem =>
        Boolean(item) && item.available,
    );

  const accesses = [...baseAccesses];

  const alreadyHasDashboard = accesses.some(
    (item) => item.key === "general_dashboard",
  );

  const alreadyHasStockInventory = accesses.some(
    (item) => item.key === "stock_inventory",
  );

  const alreadyHasRnu = accesses.some(
    (item) => item.key === "rnu",
  );

  const alreadyHasPersonnel = accesses.some(
    (item) => item.key === "personnel",
  );

  const alreadyHasVehicleFleet = accesses.some(
    (item) => item.key === "vehicle_fleet",
  );

  const alreadyHasSweepingMap = accesses.some(
    (item) => item.key === "sweeping_map",
  );

  /*
   * Admin/AdminLectura: ven Tablero General.
   * GIRSU: ve Tablero GIRSU.
   * Arbolado: ve Tablero Arbolado.
   */
  if (
    (hasAllowedRole ||
      isGirsuUser ||
      isArboladoUser) &&
    !alreadyHasDashboard
  ) {
    accesses.push(
      MODULE_CONFIG.general_dashboard,
    );
  }

  /*
   * Stock disponible para Admin,
   * AdminLectura y Suministros.
   */
  if (
    (hasAllowedRole ||
      isSuministrosUser) &&
    !alreadyHasStockInventory
  ) {
    accesses.push(
      MODULE_CONFIG.stock_inventory,
    );
  }

  /*
   * RNU disponible para Admin,
   * AdminLectura y RNU.
   */
  if (
    (hasAllowedRole ||
      isRnuUser ||
      isLucasBelliardo) &&
    !alreadyHasRnu
  ) {
    accesses.push(
      MODULE_CONFIG.rnu,
    );
  }

  /*
   * Personal disponible para Admin,
   * AdminLectura y Secretaría Privada.
   */
  if (
    (hasAllowedRole ||
      isSecretariaPrivadaUser) &&
    !alreadyHasPersonnel
  ) {
    accesses.push(
      MODULE_CONFIG.personnel,
    );
  }

  /*
   * Planta Vehicular disponible para:
   * - Admin
   * - AdminLectura
   * - Taller
   * - Director Arbolado
   * - Director GIRSU
   * - Director Servicios Públicos
   */
  if (
    (
      hasAllowedRole ||
      isTallerUser ||
      isLucasBelliardo ||
      isDirectorGirsu ||
      isDirectorServiciosPublicos
    ) &&
    !alreadyHasVehicleFleet
  ) {
    accesses.push(
      MODULE_CONFIG.vehicle_fleet,
    );
  }

  /*
   * Mapa de Barrido disponible para:
   * - Admin
   * - AdminLectura (solo lectura se controla dentro del módulo/API)
   * - adm.serviciospublicos.mgp@gmail.com
   * - waldaquin84@gmail.com
   */
  if (
    (
      hasAllowedRole ||
      isServiciosPublicosUser
    ) &&
    !alreadyHasSweepingMap
  ) {
    accesses.push(
      MODULE_CONFIG.sweeping_map,
    );
  }

  const filteredAccesses =
    accesses.filter((item) => {
      /*
       * Ocultamos Formularios de Compra
       * únicamente del frontend.
       */
      if (
        item.key ===
        "purchase_requests"
      ) {
        return false;
      }

      /*
       * Taller solamente:
       * - Órdenes de Trabajo
       * - Planta Vehicular
       */
      if (isTallerUser) {
        return (
          item.key ===
            "work_orders" ||
          item.key ===
            "vehicle_fleet"
        );
      }

      /*
       * Suministros solamente ve su módulo.
       */
      if (isSuministrosUser) {
        return (
          item.key ===
          "stock_inventory"
        );
      }

      /*
       * RNU solamente ve su módulo.
       */
      if (isRnuUser) {
        return item.key === "rnu";
      }

      /*
       * Secretaría Privada solamente ve Personal.
       */
      if (
        isSecretariaPrivadaUser
      ) {
        return (
          item.key ===
          "personnel"
        );
      }

      /*
       * Director Arbolado.
       */
      if (
        isLucasBelliardo
      ) {
        return (
          item.key ===
            "complaints" ||
          item.key ===
            "general_dashboard" ||
          item.key ===
            "rnu" ||
          item.key ===
            "vehicle_fleet"
        );
      }

      /*
       * Director Servicios Públicos:
       * waldaquin84@gmail.com
       */
      if (
        isDirectorServiciosPublicos
      ) {
        return (
          item.key ===
            "complaints" ||
          item.key ===
            "vehicle_fleet" ||
          item.key ===
            "sweeping_map"
        );
      }

      /*
       * Director GIRSU.
       */
      if (isDirectorGirsu) {
        return (
          item.key ===
            "complaints" ||
          item.key ===
            "general_dashboard" ||
          item.key ===
            "vehicle_fleet"
        );
      }

      /*
       * GIRSU / Arbolado.
       */
      if (
        isGirsuUser ||
        isArboladoUser
      ) {
        return (
          item.key ===
            "complaints" ||
          item.key ===
            "general_dashboard"
        );
      }

      /*
       * Tablero General:
       * solamente Admin y AdminLectura
       * en esta rama.
       */
      if (
        item.key ===
        "general_dashboard"
      ) {
        return hasAllowedRole;
      }

      /*
       * Stock:
       * solamente Admin y AdminLectura
       * en esta rama.
       */
      if (
        item.key ===
        "stock_inventory"
      ) {
        return hasAllowedRole;
      }

      /*
       * RNU:
       * solamente Admin y AdminLectura
       * en esta rama.
       */
      if (
        item.key ===
        "rnu"
      ) {
        return hasAllowedRole;
      }

      /*
       * Personal:
       * solamente Admin y AdminLectura
       * en esta rama.
       */
      if (
        item.key ===
        "personnel"
      ) {
        return hasAllowedRole;
      }

      /*
       * Planta Vehicular:
       * solamente Admin y AdminLectura
       * en esta rama.
       */
      if (
        item.key ===
        "vehicle_fleet"
      ) {
        return hasAllowedRole;
      }

      /*
       * Mapa de Barrido:
       * - Admin
       * - AdminLectura
       * - las dos cuentas de Servicios Públicos
       */
      if (
        item.key ===
        "sweeping_map"
      ) {
        return (
          hasAllowedRole ||
          isServiciosPublicosUser
        );
      }

      return true;
    });

  return (
    <div className="container mx-auto space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">
          Accesos del sistema
        </h1>

        <p className="text-muted-foreground">
          Seleccioná el módulo al que querés ingresar.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-1 py-5">
          <span className="text-lg font-semibold">
            {profile.full_name}
          </span>

          <span className="text-sm text-muted-foreground">
            {profile.email}
          </span>

          <span className="text-sm text-muted-foreground">
            Rol actual: {displayRole}
          </span>

          <span className="text-sm text-muted-foreground">
            Modo:{" "}
            {profile.is_readonly
              ? "Solo lectura"
              : "Edición habilitada"}
          </span>
        </CardContent>
      </Card>

      {filteredAccesses.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No tenés módulos asignados para ingresar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredAccesses.map((item) => {
            const displayItem =
              isGirsuUser &&
              item.key === "complaints"
                ? {
                    ...item,
                    title:
                      "Reclamos GIRSU",
                    description:
                      "Seguimiento de reclamos del área GIRSU.",
                  }
                : isServiciosPublicosUser &&
                    item.key ===
                      "complaints"
                  ? {
                      ...item,
                      title:
                        "Reclamos Servicios Públicos",
                      description:
                        "Seguimiento de reclamos correspondientes al área de Servicios Públicos.",
                    }
                  : isArboladoUser &&
                      item.key ===
                        "complaints"
                    ? {
                        ...item,
                        title:
                          "Reclamos Arbolado",
                        description:
                          "Seguimiento de reclamos correspondientes al área de Arbolado.",
                      }
                    : isGirsuUser &&
                        item.key ===
                          "general_dashboard"
                      ? {
                          ...item,
                          title:
                            "Tablero GIRSU",
                          description:
                            "Visualización tablero Power BI de GIRSU.",
                        }
                      : isArboladoUser &&
                          item.key ===
                            "general_dashboard"
                        ? {
                            ...item,
                            title:
                              "Tablero Arbolado",
                            description:
                              "Visualización tablero Power BI de Arbolado.",
                          }
                        : item;

            return (
              <Card
                key={
                  displayItem.key
                }
                className="flex h-full flex-col rounded-2xl"
              >
                <CardHeader>
                  <CardTitle>
                    {
                      displayItem.title
                    }
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col">
                  <p className="min-h-[48px] text-sm leading-6 text-muted-foreground">
                    {
                      displayItem.description
                    }
                  </p>

                  <Button
                    asChild
                    className="mt-auto w-full"
                  >
                    <Link
                      href={
                        displayItem.href
                      }
                    >
                      Ingresar
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
