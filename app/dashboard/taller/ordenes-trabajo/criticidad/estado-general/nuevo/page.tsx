import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VehicleSecurityCreateClient } from "@/components/taller/VehicleSecurityCreateClient";

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const canAccessTaller = (profile: {
  role: string;
  modules: string[] | null;
}) => {
  const role = normalizeText(profile.role);

  return (
    role === "admin" ||
    role === "adminlectura" ||
    role === "taller" ||
    profile.modules?.includes("work_orders")
  );
};

export default async function NuevoChecklistPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, modules")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !canAccessTaller(profile)) {
    redirect("/dashboard/accesos");
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <VehicleSecurityCreateClient />
    </div>
  );
}