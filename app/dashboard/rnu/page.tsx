import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import RnuClient from "./rnu-client";

const LUCAS_BELLIARDO_EMAIL = "arqbelliardolucas@gmail.com";

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

export default async function RnuPage() {
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
    .select("role, email")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  const userRole = normalizeText(profile.role);
  const userEmail = normalizeText(profile.email || user.email);

  const isLucasBelliardo =
    userEmail === normalizeText(LUCAS_BELLIARDO_EMAIL);

  const canAccess =
    userRole === "admin" ||
    userRole === "adminlectura" ||
    userRole === "rnu" ||
    isLucasBelliardo;

  if (!canAccess) {
    redirect("/dashboard/accesos");
  }

  const canEdit =
    userRole === "admin" ||
    userRole === "rnu";

  return <RnuClient canEdit={canEdit} />;
}
