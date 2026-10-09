import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkOrderDetailClient } from "@/components/taller/WorkOrderDetailClient";

const LUCAS_BELLIARDO_EMAIL = "arqbelliardolucas@gmail.com";

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const canAccessWorkOrders = (profile: {
  role: string;
  modules: string[] | null;
  email: string | null;
}) => {
  const role = normalizeText(profile.role);
  const email = normalizeText(profile.email);

  const isLucasBelliardo =
    email === normalizeText(LUCAS_BELLIARDO_EMAIL);

  return (
    role === "admin" ||
    role === "adminlectura" ||
    role === "taller" ||
    profile.modules?.includes("work_orders") ||
    isLucasBelliardo
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
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, modules, email")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    !canAccessWorkOrders(profile)
  ) {
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
        <h1 className="text-3xl font-bold tracking-tight">
          Detalle de OT
        </h1>

        <p className="mt-2 text-muted-foreground">
          Visualización completa de la orden de trabajo.
        </p>
      </div>

      <WorkOrderDetailClient order={order} />
    </div>
  );
}