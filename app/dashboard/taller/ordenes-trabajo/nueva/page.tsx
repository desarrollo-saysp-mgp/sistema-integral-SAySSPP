import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkOrderCreateClient } from "@/components/taller/WorkOrderCreateClient";

export default async function NuevaOrdenTrabajoPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Nueva OT</h1>
        <p className="mt-2 text-muted-foreground">
          Cargá una nueva orden de trabajo del taller.
        </p>
      </div>

      <WorkOrderCreateClient />
    </div>
  );
}