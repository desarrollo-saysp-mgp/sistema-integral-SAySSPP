import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkOrdersClient } from "@/components/taller/WorkOrdersClient";

const DIRECTORES_READONLY_EMAILS = [
  "arqbelliardolucas@gmail.com",
  "waldaquin84@gmail.com",
];

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export default async function WorkOrdersPage() {
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
    .select("role, modules, email, is_readonly")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/dashboard/accesos");
  }

  const userRole = normalizeText(profile.role);
  const userEmail = normalizeText(profile.email || user.email);

  const isDirectorReadonly = DIRECTORES_READONLY_EMAILS
    .map(normalizeText)
    .includes(userEmail);

  const canAccess =
    userRole === "admin" ||
    userRole === "adminlectura" ||
    userRole === "taller" ||
    profile.modules?.includes("work_orders") ||
    isDirectorReadonly;

  if (!canAccess) {
    redirect("/dashboard/accesos");
  }

  const isReadonly =
    userRole === "adminlectura" ||
    profile.is_readonly === true ||
    isDirectorReadonly;

  return <WorkOrdersClient isReadonly={isReadonly} />;
}