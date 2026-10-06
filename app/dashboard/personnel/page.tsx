import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PersonnelClient } from "./PersonnelClient";

export default async function PersonnelPage() {
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, modules, is_readonly")
    .eq("id", authUser.id)
    .single();

  if (profileError || !profile) {
    redirect("/dashboard");
  }

  const normalizedRole = String(profile.role ?? "")
    .trim()
    .toLowerCase();

  const canAccessPersonnel =
    normalizedRole === "admin" ||
    normalizedRole === "adminlectura" ||
    normalizedRole === "secretariaprivada";

  if (!canAccessPersonnel) {
    redirect("/dashboard");
  }

  const isReadOnly =
    normalizedRole === "adminlectura" ||
    profile.is_readonly === true;

  return <PersonnelClient isReadOnly={isReadOnly} />;
}
