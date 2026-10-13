import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const GIRSU_EMAILS = [
  "direcciongirsupico@gmail.com",
  "direccióngirsupico@gmail.com",
];

const ARBOLADO_EMAILS = [
  "arqbelliardolucas@gmail.com",
];

const DIRECTOR_SERVICIOS_PUBLICOS_EMAILS = [
  "waldaquin84@gmail.com",
];

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

function getModuleRoute(moduleKey: string) {
  switch (moduleKey) {
    case "complaints":
      return "/dashboard/complaints/home";

    case "purchase_requests":
      return "/dashboard/solicitud-compra";

    case "rrhh":
      return "/dashboard/rrhh";

    case "general_dashboard":
      return "/dashboard/tablero-general";

    case "work_orders":
      return "/dashboard/taller/ordenes-trabajo";

    case "vehicle_fleet":
      return "/dashboard/planta-vehicular";

    case "stock_inventory":
      return "/dashboard/suministros";

    case "rnu":
      return "/dashboard/rnu";

    case "personnel":
      return "/dashboard/personnel";

    default:
      return "/dashboard/accesos";
  }
}

export default async function DashboardRouter() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, email, modules, default_module")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  const modules: string[] = Array.isArray(profile.modules)
    ? profile.modules.filter(
        (module): module is string => typeof module === "string",
      )
    : [];

  const defaultModule =
    typeof profile.default_module === "string"
      ? profile.default_module
      : null;

  const userEmail = normalizeText(
    profile.email || user.email,
  );

  const isGirsuUser =
    GIRSU_EMAILS
      .map(normalizeText)
      .includes(userEmail);

  const isArboladoUser =
    ARBOLADO_EMAILS
      .map(normalizeText)
      .includes(userEmail);

  const isDirectorServiciosPublicos =
    DIRECTOR_SERVICIOS_PUBLICOS_EMAILS
      .map(normalizeText)
      .includes(userEmail);

  /*
   * Perfiles especiales que tienen más de un acceso
   * deben entrar siempre a /dashboard/accesos.
   *
   * GIRSU:
   * - Reclamos
   * - Tablero GIRSU
   *
   * Director Arbolado:
   * - Reclamos Arbolado
   * - Tablero Arbolado
   * - Planta Vehicular
   * - RNU
   *
   * Director Servicios Públicos:
   * - Reclamos Servicios Públicos
   * - Planta Vehicular
   */
  if (
    isGirsuUser ||
    isArboladoUser ||
    isDirectorServiciosPublicos
  ) {
    redirect("/dashboard/accesos");
  }

  /*
   * Los administradores siempre entran
   * a la pantalla de accesos.
   */
  if (
    profile.role === "Admin" ||
    profile.role === "AdminLectura"
  ) {
    redirect("/dashboard/accesos");
  }

  /*
   * Taller tiene:
   *
   * - Órdenes de Trabajo
   * - Planta Vehicular
   *
   * Por eso entra siempre a Accesos.
   */
  if (profile.role === "Taller") {
    redirect("/dashboard/accesos");
  }

  /*
   * Secretaría Privada entra directamente
   * al módulo Personal.
   */
  if (profile.role === "SecretariaPrivada") {
    redirect("/dashboard/personnel");
  }

  /*
   * Si tiene un módulo predeterminado,
   * entra directamente.
   *
   * Los perfiles especiales ya fueron
   * tratados arriba.
   */
  if (defaultModule) {
    redirect(
      getModuleRoute(defaultModule),
    );
  }

  /*
   * Si tiene un solo módulo,
   * entra directamente.
   */
  if (modules.length === 1) {
    redirect(
      getModuleRoute(modules[0]),
    );
  }

  /*
   * Si tiene varios módulos,
   * entra a Accesos.
   */
  if (modules.length > 1) {
    redirect("/dashboard/accesos");
  }

  /*
   * Fallback temporal según rol.
   *
   * IMPORTANTE:
   * waldaquin84@gmail.com nunca debería
   * llegar hasta acá porque ya fue tratado
   * arriba como Director Servicios Públicos.
   */
  if (
    profile.role === "Reclamos" ||
    profile.role === "ReclamosArbolado" ||
    profile.role === "ReclamosZyV"
  ) {
    redirect(
      "/dashboard/complaints/home",
    );
  }

  if (profile.role === "Suministros") {
    redirect(
      "/dashboard/suministros",
    );
  }

  if (profile.role === "RNU") {
    redirect(
      "/dashboard/rnu",
    );
  }

  /*
   * Último fallback.
   */
  redirect("/dashboard/accesos");
}