import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkOrderEditClient } from "@/components/taller/WorkOrderEditClient";

const WORK_ORDERS_PATH = "/dashboard/taller/ordenes-trabajo";

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

const getSafeReturnTo = (value?: string | string[] | null) => {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue) return WORK_ORDERS_PATH;

  try {
    const decodedValue = decodeURIComponent(rawValue);

    if (!decodedValue.startsWith(WORK_ORDERS_PATH)) {
      return WORK_ORDERS_PATH;
    }

    return decodedValue;
  } catch {
    if (rawValue.startsWith(WORK_ORDERS_PATH)) {
      return rawValue;
    }

    return WORK_ORDERS_PATH;
  }
};

export default async function WorkOrderEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string | string[] }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const returnTo = getSafeReturnTo(resolvedSearchParams.returnTo);

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
    redirect(returnTo);
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Editar OT</h1>
        <p className="mt-2 text-muted-foreground">
          Modificá los datos de la orden de trabajo.
        </p>
      </div>

      <WorkOrderEditClient order={order} returnTo={returnTo} />
    </div>
  );
}