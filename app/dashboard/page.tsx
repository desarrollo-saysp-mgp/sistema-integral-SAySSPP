
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const GIRSU_EMAILS = [
  "direcciongirsupico@gmail.com",
  "direccióngirsupico@gmail.com",
];

const DIRECTOR_GIRSU_EMAIL =
  "direcciongirsupico@gmail.com";

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

    case "complaints_map":
      return "/dashboard/mapa-reclamos";

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

  // ==========================================
  // 1. VERIFICAR AUTENTICACIÓN
  // ==========================================

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // ==========================================
  // 2. OBTENER PERFIL DEL USUARIO
  // ==========================================

  const { data: profile, error: profileError } =
    await supabase
      .from("users")
      .select("role, email, modules, default_module")
      .eq("id", user.id)
      .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  const modules: string[] = Array.isArray(
    profile.modules
  )
    ? profile.modules.filter(
        (module): module is string =>
          typeof module === "string"
      )
    : [];

  const defaultModule =
    typeof profile.default_module === "string"
      ? profile.default_module
      : null;

  const userEmail = normalizeText(
    profile.email || user.email
  );

  const userRole = normalizeText(profile.role);

  // ==========================================
  // 3. VERIFICAR PERMISO MAPA DE RECLAMOS
  // ==========================================

  // Este permiso es independiente del rol.
  // Solamente se consideran las cuentas que
  // figuran en complaint_map_access.

  const {
    data: mapAccess,
    error: mapAccessError,
  } = await supabase
    .from("complaint_map_access")
    .select("area")
    .eq("user_id", user.id)
    .maybeSingle();

  const canAccessComplaintsMap =
    !mapAccessError &&
    mapAccess !== null &&
    ["GENERAL", "ZYV", "SP", "GIRSU", "AYPU"].includes(
      mapAccess.area
    );

  // ==========================================
  // 4. IDENTIFICAR PERFILES ESPECIALES
  // ==========================================

  const isGirsuUser = GIRSU_EMAILS
    .map(normalizeText)
    .includes(userEmail);

  const isDirectorGirsu =
    userEmail ===
    normalizeText(DIRECTOR_GIRSU_EMAIL);

  const isArboladoUser = ARBOLADO_EMAILS
    .map(normalizeText)
    .includes(userEmail);

  const isDirectorServiciosPublicos =
    DIRECTOR_SERVICIOS_PUBLICOS_EMAILS
      .map(normalizeText)
      .includes(userEmail);

  // ==========================================
  // 5. NUEVA REGLA - RECLAMOS Y RECLAMOS ZYV
  // ==========================================

  /*
   * Los usuarios Reclamos y ReclamosZyV
   * que tengan permiso de Mapa de Reclamos
   * deben ingresar primero a Accesos.
   *
   * Desde allí pueden elegir:
   *
   * - Reclamos
   * - Mapa de Reclamos
   *
   * Incluye:
   * - Rebeca Rementeria
   * - Ana Giunchi
   * - Usuarios ZyV autorizados
   *
   * Los usuarios sin permiso del mapa
   * mantienen su comportamiento anterior.
   *
   * Esta validación debe ejecutarse ANTES
   * de default_module.
   */

  if (
    canAccessComplaintsMap &&
    (
      userRole === "reclamos" ||
      userRole === "reclamoszyv"
    )
  ) {
    redirect("/dashboard/accesos");
  }

  // ==========================================
  // 6. PERFILES ESPECIALES
  // ==========================================

  /*
   * GIRSU, Director GIRSU, Director Arbolado
   * y Director Servicios Públicos tienen
   * múltiples accesos.
   */

  if (
    isGirsuUser ||
    isDirectorGirsu ||
    isArboladoUser ||
    isDirectorServiciosPublicos
  ) {
    redirect("/dashboard/accesos");
  }

  // ==========================================
  // 7. ADMINISTRADORES Y ARBOLADO
  // ==========================================

  /*
   * Admin y AdminLectura ingresan a Accesos.
   *
   * ReclamosArbolado tiene:
   * - Reclamos Arbolado
   * - Solicitud de Intervenciones
   * - Mapa de Reclamos, cuando está autorizado
   */

  if (
    userRole === "admin" ||
    userRole === "adminlectura" ||
    userRole === "reclamosarbolado"
  ) {
    redirect("/dashboard/accesos");
  }

  // ==========================================
  // 8. TALLER
  // ==========================================

  /*
   * Taller tiene:
   * - Órdenes de Trabajo
   * - Planta Vehicular
   *
   * Los permisos adicionales del mapa
   * se mantienen en la pantalla de Accesos.
   */

  if (userRole === "taller") {
    redirect("/dashboard/accesos");
  }

  // ==========================================
  // 9. SECRETARÍA PRIVADA Y PERSONAL
  // ==========================================

  /*
   * Estos roles siguen ingresando
   * directamente al módulo Personal.
   */

  if (
    userRole === "secretariaprivada" ||
    userRole === "personal"
  ) {
    redirect("/dashboard/personnel");
  }

  // ==========================================
  // 10. MÓDULO PREDETERMINADO
  // ==========================================

  /*
   * Solo llegamos acá si el usuario
   * no está contemplado en las reglas
   * especiales anteriores.
   */

  if (defaultModule) {
    redirect(
      getModuleRoute(defaultModule)
    );
  }

  // ==========================================
  // 11. UN SOLO MÓDULO
  // ==========================================

  if (modules.length === 1) {
    redirect(
      getModuleRoute(modules[0])
    );
  }

  // ==========================================
  // 12. VARIOS MÓDULOS
  // ==========================================

  if (modules.length > 1) {
    redirect("/dashboard/accesos");
  }

  // ==========================================
  // 13. FALLBACK SEGÚN ROL
  // ==========================================

  /*
   * Usuarios Reclamos y ReclamosZyV
   * sin autorización para el mapa:
   * mantienen la redirección tradicional.
   */

  if (
    userRole === "reclamos" ||
    userRole === "reclamoszyv"
  ) {
    redirect("/dashboard/complaints/home");
  }

  if (userRole === "suministros") {
    redirect("/dashboard/suministros");
  }

  if (userRole === "rnu") {
    redirect("/dashboard/rnu");
  }

  // ==========================================
  // 14. ÚLTIMO FALLBACK
  // ==========================================

  redirect("/dashboard/accesos");
}
