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
  | "stock_inventory"
  | "rnu"
  | "personnel";

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
};

const GIRSU_EMAILS = [
  "direcciongirsupico@gmail.com",
  "direccióngirsupico@gmail.com",
];

const ARBOLADO_EMAILS = ["arqbelliardolucas@gmail.com"];

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

  const isGirsuUser = GIRSU_EMAILS.map(normalizeText).includes(userEmail);
  const isArboladoUser = ARBOLADO_EMAILS.map(normalizeText).includes(userEmail);

  const isTallerUser = userRole === "taller";
  const isSuministrosUser = userRole === "suministros";
  const isRnuUser = userRole === "rnu";
  const isSecretariaPrivadaUser = userRole === "secretariaprivada";

  const hasAllowedRole = allowedRoles.includes(userRole);

  const rawModules: string[] = Array.isArray(profile.modules)
    ? profile.modules.filter(
        (module): module is string => typeof module === "string",
      )
    : [];

  const modules = rawModules.map((module) => normalizeModule(module));

  const baseAccesses = modules
    .map((moduleKey) => MODULE_CONFIG[moduleKey as ModuleKey])
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

  /*
   * Admin/AdminLectura: ven Tablero General.
   * GIRSU: ve Tablero GIRSU.
   * Arbolado: ve Tablero Arbolado.
   */
  if (
    (hasAllowedRole || isGirsuUser || isArboladoUser) &&
    !alreadyHasDashboard
  ) {
    accesses.push(MODULE_CONFIG.general_dashboard);
  }

  /*
   * Stock disponible para Admin, AdminLectura y Suministros.
   */
  if (
    (hasAllowedRole || isSuministrosUser) &&
    !alreadyHasStockInventory
  ) {
    accesses.push(MODULE_CONFIG.stock_inventory);
  }

  /*
   * RNU disponible para Admin, AdminLectura y RNU.
   */
  if (
    (hasAllowedRole || isRnuUser) &&
    !alreadyHasRnu
  ) {
    accesses.push(MODULE_CONFIG.rnu);
  }

  /*
   * Personal disponible para Admin y Secretaría Privada.
   * AdminLectura no tiene acceso.
   */
  if (
    (userRole === "admin" || isSecretariaPrivadaUser) &&
    !alreadyHasPersonnel
  ) {
    accesses.push(MODULE_CONFIG.personnel);
  }

  const filteredAccesses = accesses.filter((item) => {
    /*
     * Ocultamos Formularios de Compra únicamente del frontend.
     * El módulo, los permisos y la ruta siguen existiendo.
     */
    if (item.key === "purchase_requests") {
      return false;
    }

    if (isTallerUser) {
      return item.key === "work_orders";
    }

    if (isSuministrosUser) {
      return item.key === "stock_inventory";
    }

    if (isRnuUser) {
      return item.key === "rnu";
    }

    if (isSecretariaPrivadaUser) {
      return item.key === "personnel";
    }

    if (isGirsuUser || isArboladoUser) {
      return (
        item.key === "complaints" ||
        item.key === "general_dashboard"
      );
    }

    if (item.key === "general_dashboard") {
      return hasAllowedRole;
    }

    if (item.key === "stock_inventory") {
      return hasAllowedRole;
    }

    if (item.key === "rnu") {
      return hasAllowedRole;
    }

    if (item.key === "personnel") {
      return userRole === "admin";
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
            Rol actual: {profile.role}
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
              isGirsuUser && item.key === "complaints"
                ? {
                    ...item,
                    title: "Reclamos GIRSU",
                    description:
                      "Seguimiento de reclamos del área GIRSU.",
                  }
                : isArboladoUser && item.key === "complaints"
                  ? {
                      ...item,
                      title: "Reclamos Arbolado",
                      description:
                        "Seguimiento de reclamos correspondientes al área de Arbolado.",
                    }
                  : isGirsuUser &&
                      item.key === "general_dashboard"
                    ? {
                        ...item,
                        title: "Tablero GIRSU",
                        description:
                          "Visualización tablero Power BI de GIRSU.",
                      }
                    : isArboladoUser &&
                        item.key === "general_dashboard"
                      ? {
                          ...item,
                          title: "Tablero Arbolado",
                          description:
                            "Visualización tablero Power BI de Arbolado.",
                        }
                      : item;

            return (
              <Card
                key={displayItem.key}
                className="rounded-2xl"
              >
                <CardHeader>
                  <CardTitle>
                    {displayItem.title}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {displayItem.description}
                  </p>

                  <Button asChild className="w-full">
                    <Link href={displayItem.href}>
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