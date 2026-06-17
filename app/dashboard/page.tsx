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
    default:
      return "/dashboard/accesos";
  }
}

export default async function DashboardRouter() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, email, modules, default_module")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const modules = Array.isArray(profile.modules) ? profile.modules : [];
  const defaultModule = profile.default_module;

  const userEmail = normalizeText(profile.email || user.email);

  const isGirsuUser = GIRSU_EMAILS.map(normalizeText).includes(userEmail);
  const isArboladoUser = ARBOLADO_EMAILS.map(normalizeText).includes(userEmail);

  // GIRSU y Arbolado deben entrar a Accesos porque tienen:
  // Reclamos propio + Tablero propio.
  if (isGirsuUser || isArboladoUser) {
    redirect("/dashboard/accesos");
  }

  // Admins siempre van a accesos
  if (profile.role === "Admin" || profile.role === "AdminLectura") {
    redirect("/dashboard/accesos");
  }

  // Si tiene módulo por defecto, entra ahí
  if (defaultModule) {
    redirect(getModuleRoute(defaultModule));
  }

  // Si tiene un solo módulo, entra directo
  if (modules.length === 1) {
    redirect(getModuleRoute(modules[0]));
  }

  // Si tiene varios módulos, mostrar accesos
  if (modules.length > 1) {
    redirect("/dashboard/accesos");
  }

  // Fallback temporal por role
  if (
    profile.role === "Reclamos" ||
    profile.role === "ReclamosArbolado" ||
    profile.role === "ReclamosZyV"
  ) {
    redirect("/dashboard/complaints/home");
  }

  // Último fallback
  redirect("/dashboard/accesos");
}