import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const FC_SECTOR_LABELS: Record<string, string> = {
  ana: "FC - ANA",
  arbolado: "FC - ARBOLADO",
  secretaria: "FC - SECRETARÍA",
  suministros: "FC - SUMINISTROS",
  zv: "FC - ZOONOSIS Y VECTORES",
  sp: "FC - SERVICIOS PÚBLICOS",
  girsu: "FC - GIRSU",
};

const ALL_FC_SECTORS = [
  "ana",
  "arbolado",
  "secretaria",
  "suministros",
  "zv",
  "sp",
  "girsu",
] as const;

export default async function SolicitudCompraPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email, role, fc_sectors, modules")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const modules = Array.isArray(profile.modules) ? profile.modules : [];
  const rawFcSectors = Array.isArray(profile.fc_sectors) ? profile.fc_sectors : [];

  if (!modules.includes("purchase_requests")) {
    redirect("/dashboard/accesos");
  }

  const allowedSectors = rawFcSectors.includes("all")
    ? [...ALL_FC_SECTORS]
    : rawFcSectors.filter((sector): sector is (typeof ALL_FC_SECTORS)[number] =>
        ALL_FC_SECTORS.includes(sector as (typeof ALL_FC_SECTORS)[number]),
      );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Formularios de Compra
        </h1>
        <p className="mt-2 text-muted-foreground">
          Seleccioná el sector con el que querés trabajar.
        </p>
      </div>

      <Card>
        <CardContent className="py-5">
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold">{profile.full_name}</span>
            <span className="text-sm text-muted-foreground">{profile.email}</span>
            <span className="text-sm text-muted-foreground">
              Rol actual: {profile.role}
            </span>
          </div>
        </CardContent>
      </Card>

      {allowedSectors.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No tenés sectores de FC asignados.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {allowedSectors.map((sector) => (
            <Card key={sector} className="rounded-2xl">
              <CardHeader>
                <CardTitle>{FC_SECTOR_LABELS[sector]}</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Acceso al sector {FC_SECTOR_LABELS[sector].replace("FC - ", "")}.
                </p>

                <Button asChild className="w-full">
                  <Link href={`/dashboard/solicitud-compra/${sector}`}>
                    Ingresar
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}