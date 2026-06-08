import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkOrdersClient } from "@/components/taller/WorkOrdersClient";

export default async function OrdenesTrabajoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("full_name, email, role, modules")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/login");
  }

  const isAllowed =
    profile.role === "Admin" ||
    profile.role === "AdminLectura" ||
    profile.role === "Taller" ||
    (Array.isArray(profile.modules) && profile.modules.includes("work_orders"));

  if (!isAllowed) {
    redirect("/dashboard/accesos");
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Órdenes de Trabajo
        </h1>
        <p className="mt-2 text-muted-foreground">
          Registro histórico de órdenes de trabajo cargadas.
        </p>
      </div>

      <WorkOrdersClient />
    </div>
  );
}