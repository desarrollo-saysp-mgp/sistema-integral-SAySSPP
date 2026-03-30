import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getModuleRoute(moduleKey: string) {
  switch (moduleKey) {
    case "complaints":
      return "/dashboard/complaints/home";
    case "purchase_requests":
      return "/dashboard/solicitud-compra";
    case "rrhh":
      return "/dashboard/rrhh";
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
    .select("role, modules, default_module")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const modules = Array.isArray(profile.modules) ? profile.modules : [];
  const defaultModule = profile.default_module;

  // 1. Admins siempre van a accesos
  if (profile.role === "Admin" || profile.role === "AdminLectura") {
    redirect("/dashboard/accesos");
  }

  // 2. Si tiene módulo por defecto, entra ahí
  if (defaultModule) {
    redirect(getModuleRoute(defaultModule));
  }

  // 3. Si tiene un solo módulo, entra directo
  if (modules.length === 1) {
    redirect(getModuleRoute(modules[0]));
  }

  // 4. Si tiene varios módulos, mostrar accesos
  if (modules.length > 1) {
    redirect("/dashboard/accesos");
  }

  // 5. Fallback temporal por role
  if (profile.role === "Reclamos") {
    redirect("/dashboard/complaints/home");
  }

  // 6. Último fallback
  redirect("/dashboard/accesos");
}