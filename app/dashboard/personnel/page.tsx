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
    .select("role, modules")
    .eq("id", authUser.id)
    .single();

  if (profileError || !profile) {
    redirect("/dashboard");
  }

  const canAccessPersonnel =
    profile.role === "Admin" ||
    profile.role === "SecretariaPrivada";

  if (!canAccessPersonnel) {
    redirect("/dashboard");
  }

  return <PersonnelClient />;
}