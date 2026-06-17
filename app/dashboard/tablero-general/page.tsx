import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

const POWERBI_GENERAL_DASHBOARD_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiOGU4ZTg5ZDEtZjZhNC00NmY4LThhZGItNmI2ZTBlMDQyZTg3IiwidCI6IjE3OGFiOTM5LWUyZTQtNGVhYy1iMGNlLWVhOTdlNWM0MjlmYSJ9";

const POWERBI_GIRSU_DASHBOARD_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiZDc0NzRlYzItMDdkNy00NzBjLWFhMzQtOWE3YjQ4NDY3MTNmIiwidCI6IjE3OGFiOTM5LWUyZTQtNGVhYy1iMGNlLWVhOTdlNWM0MjlmYSJ9";

const POWERBI_ARBOLADO_DASHBOARD_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiYzk4MDFmMmMtMzU5NC00NmJmLWJlMDktYzJlYTA5NDg1MjRiIiwidCI6IjE3OGFiOTM5LWUyZTQtNGVhYy1iMGNlLWVhOTdlNWM0MjlmYSJ9";

const ALLOWED_ROLES = ["admin", "adminlectura"];

const GIRSU_EMAILS = [
  "direcciongirsupico@gmail.com",
  "direccióngirsupico@gmail.com",
];

const ARBOLADO_EMAILS = ["arqbelliardolucas@gmail.com"];

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

const normalizeModule = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

export default async function TableroGeneralPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("role, email, modules")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/login");
  }

  const userRole = normalizeText(profile.role);
  const userEmail = normalizeText(profile.email || user.email);

  const isGirsuUser = GIRSU_EMAILS.map(normalizeText).includes(userEmail);
  const isArboladoUser = ARBOLADO_EMAILS.map(normalizeText).includes(userEmail);

  const modules: string[] = Array.isArray(profile.modules)
    ? profile.modules.map((module) => normalizeModule(module))
    : [];

  const hasAllowedRole = ALLOWED_ROLES.includes(userRole);

  const hasDashboardModule =
    modules.includes("general_dashboard") ||
    modules.includes("tablero_general") ||
    modules.includes("tablero") ||
    modules.includes("powerbi") ||
    modules.includes("power_bi");

  /*
    Permisos:
    - Admin/AdminLectura: ven Tablero General.
    - Usuarios con módulo de tablero: ven Tablero General.
    - Cuenta GIRSU: ve Tablero GIRSU.
    - Cuenta Arbolado: ve Tablero Arbolado.
  */
  if (!hasAllowedRole && !hasDashboardModule && !isGirsuUser && !isArboladoUser) {
    redirect("/dashboard/accesos");
  }

  const dashboardTitle = isGirsuUser
    ? "Tablero GIRSU"
    : isArboladoUser
      ? "Tablero Arbolado"
      : "Tablero General";

  const dashboardDescription = isGirsuUser
    ? "Visualización tablero Power BI del área GIRSU."
    : isArboladoUser
      ? "Visualización tablero Power BI del área Arbolado."
      : "Visualización tablero Power BI.";

  const dashboardUrl = isGirsuUser
    ? POWERBI_GIRSU_DASHBOARD_URL
    : isArboladoUser
      ? POWERBI_ARBOLADO_DASHBOARD_URL
      : POWERBI_GENERAL_DASHBOARD_URL;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{dashboardTitle}</h1>

        <p className="text-muted-foreground">{dashboardDescription}</p>
      </div>

      <Card className="overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          <iframe
            title={dashboardTitle}
            src={dashboardUrl}
            className="h-[78vh] w-full border-0"
            frameBorder="0"
            allowFullScreen
          />
        </CardContent>
      </Card>
    </div>
  );
}