import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

const POWERBI_GENERAL_DASHBOARD_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiOGU4ZTg5ZDEtZjZhNC00NmY4LThhZGItNmI2ZTBlMDQyZTg3IiwidCI6IjE3OGFiOTM5LWUyZTQtNGVhYy1iMGNlLWVhOTdlNWM0MjlmYSJ9";

const ALLOWED_ROLES = ["admin", "adminlectura"];

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

export default async function TableroGeneralPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, modules")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const userRole = normalizeText(profile.role);

  const modules: string[] = Array.isArray(profile.modules)
    ? profile.modules
    : [];

  const hasAllowedRole = ALLOWED_ROLES.includes(userRole);
  const hasDashboardModule = modules.includes("general_dashboard");

  if (!hasAllowedRole || !hasDashboardModule) {
    redirect("/dashboard/accesos");
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Tablero General</h1>
        <p className="text-muted-foreground">
          Visualización tablero Power BI.
        </p>
      </div>

      <Card className="overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          <iframe
            title="Tablero General"
            src={POWERBI_GENERAL_DASHBOARD_URL}
            className="h-[78vh] w-full border-0"
            frameBorder="0"
            allowFullScreen
          />
        </CardContent>
      </Card>
    </div>
  );
}