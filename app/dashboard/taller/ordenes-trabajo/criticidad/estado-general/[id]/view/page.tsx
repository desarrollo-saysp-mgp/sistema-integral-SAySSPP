import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VehicleSecurityViewClient } from "@/components/taller/VehicleSecurityViewClient";

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

export default async function VerChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const { data: inspection, error: inspectionError } = await supabase
    .from("vehicle_security_inspections")
    .select("*")
    .eq("id", id)
    .single();

  if (inspectionError || !inspection) {
    redirect("/dashboard/taller/ordenes-trabajo/criticidad/estado-general");
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <VehicleSecurityViewClient inspection={inspection} />
    </div>
  );
}