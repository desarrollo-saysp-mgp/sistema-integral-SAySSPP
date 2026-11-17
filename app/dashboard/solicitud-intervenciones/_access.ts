import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const INTERVENTIONS_BASE = "/dashboard/solicitud-intervenciones";
const normalize = (s: unknown) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");

export async function getInterventionAccess(requireWrite = false) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: profile, error: profileError } = await supabase.from("users")
    .select("role,email,is_readonly").eq("id", user.id).single();
  if (profileError || !profile) redirect("/dashboard/accesos");
  const role = normalize(profile.role);
  const email = normalize(profile.email || user.email);
  const canRead = ["admin", "adminlectura", "reclamosarbolado"].includes(role) || email === "arqbelliardolucas@gmail.com";
  const canWrite = canRead && role !== "adminlectura" && !profile.is_readonly;
  if (!canRead) redirect("/dashboard/accesos");
  if (requireWrite && !canWrite) redirect(INTERVENTIONS_BASE);
  return { supabase, user, canWrite };
}
