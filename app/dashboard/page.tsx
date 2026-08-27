import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const userEmail = normalizeText(profile.email || user.email);

  const isGirsuUser = GIRSU_EMAILS.map(normalizeText).includes(userEmail);
  const isArboladoUser = ARBOLADO_EMAILS.map(normalizeText).includes(userEmail);

  /*
   * GIRSU y Arbolado deben entrar a Accesos porque tienen:
   * Reclamos propio + Tablero propio.
   */
  if (isGirsuUser || isArboladoUser) {
    redirect("/dashboard/accesos");
  }

  /*
   * Los administradores siempre entran a la pantalla de accesos.
   */
  if (
    profile.role === "Admin" ||
    profile.role === "AdminLectura"
  ) {
    redirect("/dashboard/accesos");
  }

  /*
   * Taller ahora tiene dos módulos:
   *
   * - Órdenes de Trabajo
   * - Planta Vehicular
   *
   * Por eso debe entrar siempre a Accesos
   * y elegir el módulo.
   */
  if (profile.role === "Taller") {
    redirect("/dashboard/accesos");
  }

  /*
   * Secretaría Privada entra directamente al módulo Personal.
   */
  if (profile.role === "SecretariaPrivada") {
    redirect("/dashboard/personnel");
  }

  /*
   * Si tiene un módulo predeterminado, entra directamente.
   *
   * Taller ya fue tratado arriba, por lo que su antiguo
   * default_module = work_orders no lo enviará directamente
   * a Órdenes de Trabajo.
   */
  if (defaultModule) {
    redirect(getModuleRoute(defaultModule));
  }

  /*
   * Si tiene un solo módulo, entra directamente.
   */
  if (modules.length === 1) {
    redirect(getModuleRoute(modules[0]));
  }

  /*
   * Si tiene varios módulos, entra a la pantalla de accesos.
   */
  if (modules.length > 1) {
    redirect("/dashboard/accesos");
  }

  /*
   * Fallback temporal según el rol.
   */
  if (
    profile.role === "Reclamos" ||
    profile.role === "ReclamosArbolado" ||
    profile.role === "ReclamosZyV"
  ) {
    redirect("/dashboard/complaints/home");
  }

  if (profile.role === "Suministros") {
    redirect("/dashboard/suministros");
  }

  if (profile.role === "RNU") {
    redirect("/dashboard/rnu");
  }

  /*
   * Último fallback.
   */
  redirect("/dashboard/accesos");
}