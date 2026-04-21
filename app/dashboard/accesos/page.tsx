import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ModuleKey = "complaints" | "purchase_requests" | "rrhh";

type AccessItem = {
  key: ModuleKey;
  title: string;
  description: string;
  href: string;
  available: boolean;
};

const MODULE_CONFIG: Record<ModuleKey, AccessItem> = {
  complaints: {
    key: "complaints",
    title: "Reclamos",
    description: "Gestión y seguimiento de reclamos ciudadanos.",
    href: "/dashboard/complaints/home",
    available: true,
  },
  purchase_requests: {
    key: "purchase_requests",
    title: "Formularios de Compra",
    description: "Gestión de formularios de compra por sector.",
    href: "/dashboard/solicitud-compra",
    available: true,
  },
  rrhh: {
    key: "rrhh",
    title: "RRHH",
    description: "Gestión de recursos humanos.",
    href: "/dashboard/rrhh",
    available: false,
  },
};

export default async function AccesosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email, role, modules, is_readonly")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const modules: string[] = Array.isArray(profile.modules) ? profile.modules : [];

  const accesses = modules
    .map((moduleKey) => MODULE_CONFIG[moduleKey as ModuleKey])
    .filter(Boolean);

  return (
    <div className="container mx-auto space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Accesos del sistema</h1>
        <p className="text-muted-foreground">
          Seleccioná el módulo al que querés ingresar.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-1 py-5">
          <span className="text-lg font-semibold">{profile.full_name}</span>
          <span className="text-sm text-muted-foreground">{profile.email}</span>
          <span className="text-sm text-muted-foreground">
            Rol actual: {profile.role}
          </span>
          <span className="text-sm text-muted-foreground">
            Modo: {profile.is_readonly ? "Solo lectura" : "Edición habilitada"}
          </span>
        </CardContent>
      </Card>

      {accesses.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No tenés módulos asignados para ingresar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {accesses.map((item) => (
            <Card key={item.key} className="rounded-2xl">
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>

                {item.available ? (
                  <Button asChild className="w-full">
                    <Link href={item.href}>Ingresar</Link>
                  </Button>
                ) : (
                  <Button disabled className="w-full">
                    Próximamente
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}