import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkOrderDetailClient } from "@/components/taller/WorkOrderDetailClient";

const canAccessWorkOrders = (profile: {
  role: string;
  modules: string[] | null;
}) => {
  return (
    profile.role === "Admin" ||
    profile.role === "AdminLectura" ||
    profile.role === "Taller" ||
    profile.modules?.includes("work_orders")
  );
};

export default async function WorkOrderViewPage({
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

  if (profileError || !profile || !canAccessWorkOrders(profile)) {
    redirect("/dashboard/accesos");
  }

  const { data: order, error } = await supabase
    .from("work_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !order) {
    redirect("/dashboard/taller/ordenes-trabajo");
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Detalle de OT</h1>
        <p className="mt-2 text-muted-foreground">
          Visualización completa de la orden de trabajo.
        </p>
      </div>

      <WorkOrderDetailClient order={order} />
    </div>
  );
}