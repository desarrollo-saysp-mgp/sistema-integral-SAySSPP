import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MapaReclamosClient from "@/components/mapa-reclamos/mapa-reclamos-client";

export default async function MapaReclamosPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: access, error } = await supabase
    .from("complaint_map_access")
    .select("area")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !access) redirect("/dashboard/accesos");
  return <MapaReclamosClient area={access.area} />;
}
