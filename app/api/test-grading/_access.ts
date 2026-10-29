import { createClient } from "@/lib/supabase/server";

const EDITOR_EMAILS = new Set([
  "waldaquin84@gmail.com",
  "adm.serviciospublicos.mgp@gmail.com",
  "martincornejo.gp@gmail.com",
]);

const normalize = (value: unknown) =>
  String(value ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

export async function getGradingAccess() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { supabase, authenticated: false, canView: false, canEdit: false };
  }
  const { data: profile, error: profileError } = await supabase
    .from("users").select("role, email, is_readonly")
    .eq("id", user.id).maybeSingle();
  if (profileError || !profile) {
    return { supabase, authenticated: true, canView: false, canEdit: false };
  }
  const role = normalize(profile.role);
  const email = normalize(profile.email || user.email);
  const editor = EDITOR_EMAILS.has(email);
  return {
    supabase,
    authenticated: true,
    canView: role === "admin" || role === "adminlectura" || editor,
    canEdit: (role === "admin" || editor) && profile.is_readonly !== true,
  };
}
