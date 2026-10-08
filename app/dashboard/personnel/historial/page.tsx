import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PersonnelHistoryClient } from "./PersonnelHistoryClient";

export default async function PersonnelHistoryPage() {
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
    .select("role")
    .eq("id", authUser.id)
    .single();

  if (profileError || !profile) {
    redirect("/dashboard");
  }

  const normalizedRole = String(profile.role ?? "")
    .trim()
    .toLowerCase();

  const canViewHistory =
    normalizedRole === "admin" ||
    normalizedRole === "adminlectura";

  if (!canViewHistory) {
    redirect("/dashboard/personnel");
  }

  return <PersonnelHistoryClient />;
}
