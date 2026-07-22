import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SuministrosDashboardClient } from "./suministros-dashboard-client";

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

export default async function SuministrosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, is_readonly")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  const userRole = normalizeText(profile.role);

  const canAccess =
    userRole === "admin" ||
    userRole === "adminlectura" ||
    userRole === "suministros";

  if (!canAccess) {
    redirect("/dashboard/accesos");
  }

  const isReadonly =
    profile.role === "AdminLectura" || profile.is_readonly === true;

  return <SuministrosDashboardClient isReadonly={isReadonly} />;
}