"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  List,
  BarChart3,
} from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";
import { toast } from "sonner";
import { useComplaintsRealtime } from "@/hooks/useComplaintsRealtime";
import { useUser } from "@/hooks/useUser";

type RecentComplaint = {
  id: number;
  complaint_number: string | null;
  arbolado_number?: number | null;
  complaint_date: string;
  complainant_name: string | null;
  status: "En proceso" | "Resuelto" | "No resuelto";
  service: { id: number; name: string } | null;
  cause: { id: number; name: string } | null;
  details?: string | null;
  form_variant?: string | null;
  extra_data?: Record<string, unknown> | null;
};

interface DashboardStats {
  total: number;
  inProgress: number;
  resolved: number;
  unresolved: number;
  recentComplaints: RecentComplaint[];
}

const SERVICIOS_PUBLICOS_EMAIL = "adm.serviciospublicos.mgp@gmail.com";
const GIRSU_EMAIL = "direccióngirsupico@gmail.com";

const normalizeName = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const formatDate = (dateString: string) => {
  if (!dateString) return "-";

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "En proceso":
      return "border-[#F4D9A6] bg-[#FFF7E8] text-[#C48814] dark:border-yellow-500/50 dark:bg-yellow-500/10 dark:text-yellow-300";
    case "Resuelto":
      return "border-[#B7E7D9] bg-[#ECFDF7] text-[#00A27F] dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-300";
    case "No resuelto":
      return "border-[#F2C6D1] bg-[#FFF0F3] text-[#D85C76] dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-300";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
};

const getExtraValue = (
  extra: Record<string, unknown> | null,
  keys: string[],
) => {
  if (!extra) return null;

  for (const key of keys) {
    const value = extra[key];

    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return null;
};

const getComplaintSubtitle = (complaint: RecentComplaint) => {
  const extra =
    complaint.extra_data &&
    typeof complaint.extra_data === "object" &&
    !Array.isArray(complaint.extra_data)
      ? complaint.extra_data
      : null;

  if (complaint.form_variant === "arbolado") {
    const depto =
      getExtraValue(extra, ["depto", "department"]) ||
      complaint.service?.name ||
      "Arbolado";

    const descripcion =
      getExtraValue(extra, ["descripcion", "description_type"]) ||
      complaint.cause?.name ||
      complaint.details ||
      null;

    return descripcion ? `${depto} - ${descripcion}` : depto;
  }

  const serviceName = complaint.service?.name || null;
  const causeName = complaint.cause?.name || null;

  if (serviceName && causeName) return `${serviceName} - ${causeName}`;
  if (serviceName) return serviceName;
  if (causeName) return causeName;

  return complaint.details || "Sin detalle";
};

const getDisplayComplaintNumber = (complaint: RecentComplaint) => {
  if (complaint.form_variant === "arbolado") {
    return complaint.arbolado_number ?? complaint.complaint_number ?? "-";
  }

  return complaint.complaint_number ?? "-";
};

const getDateTime = (dateString: string) => {
  if (!dateString) return 0;

  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
};

export default function DashboardPage() {
  const router = useRouter();
  const { profile } = useUser();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const normalizedProfileEmail = normalizeName(profile?.email);

  const isServiciosPublicosUser =
    normalizedProfileEmail === normalizeName(SERVICIOS_PUBLICOS_EMAIL);

  const isGirsuUser = normalizedProfileEmail === normalizeName(GIRSU_EMAIL);

  const fetchStats = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setLoading(true);
      }

      try {
        const url = isServiciosPublicosUser
          ? "/api/dashboard/stats?scope=servicios-publicos"
          : isGirsuUser
            ? "/api/dashboard/stats?scope=girsu"
            : "/api/dashboard/stats";

        const response = await fetch(url, {
          cache: "no-store",
        });

        const data = await response.json();

        if (response.ok && data.data) {
          setStats(data.data);
        } else {
          toast.error(data.error || "Error al cargar estadísticas");
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
        toast.error("Error al cargar estadísticas");
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [isServiciosPublicosUser, isGirsuUser],
  );

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useComplaintsRealtime({
    onChange: () => {
      void fetchStats(false);
    },
  });

  const recentComplaintsOrdered = useMemo(() => {
    return [...(stats?.recentComplaints || [])].sort((a, b) => {
      const dateDiff =
        getDateTime(b.complaint_date) - getDateTime(a.complaint_date);

      if (dateDiff !== 0) return dateDiff;

      const numberA =
        a.form_variant === "arbolado"
          ? Number(a.arbolado_number || 0)
          : Number(a.complaint_number || 0);

      const numberB =
        b.form_variant === "arbolado"
          ? Number(b.arbolado_number || 0)
          : Number(b.complaint_number || 0);

      return numberB - numberA;
    });
  }, [stats?.recentComplaints]);

  const navigateWithLoading = (url: string) => {
    startTransition(() => {
      router.push(url);
    });
  };

  const goToFilteredComplaints = (status?: string) => {
    const baseUrl = "/dashboard/complaints";

    if (!status) {
      navigateWithLoading(baseUrl);
      return;
    }

    navigateWithLoading(`${baseUrl}?status=${encodeURIComponent(status)}`);
  };

  if (loading) {
    return <PageLoader show={true} />;
  }

  return (
    <div className="relative space-y-8">
      {isPending && <PageLoader show={true} />}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>

          <p className="mt-2 text-base text-muted-foreground">
            {isServiciosPublicosUser
              ? "Seguimiento de reclamos de Servicios Públicos"
              : isGirsuUser
                ? "Seguimiento de reclamos GIRSU"
                : "Resumen general del sistema de reclamos"}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {!isServiciosPublicosUser && !isGirsuUser && (
            <Button
              onClick={() => navigateWithLoading("/dashboard/complaints/new")}
              className="h-12 rounded-xl bg-[#00A27F] px-6 font-semibold text-white shadow-md transition-all hover:scale-[1.02] hover:bg-[#008568] hover:shadow-lg active:scale-[0.98]"
              disabled={isPending}
            >
              <Plus className="mr-2 h-5 w-5" />
              Nuevo Reclamo
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => navigateWithLoading("/dashboard/complaints")}
            className="h-11 rounded-xl border-border bg-card px-5 text-card-foreground hover:bg-muted"
            disabled={isPending}
          >
            <List className="mr-2 h-4 w-4" />
            Ver Todos
          </Button>

          <Button
            variant="outline"
            onClick={() => navigateWithLoading("/dashboard/complaints/stats")}
            className="h-11 rounded-xl border-border bg-card px-5 text-card-foreground hover:bg-muted"
            disabled={isPending}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Estadísticas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card
          className="cursor-pointer rounded-2xl border-border bg-card text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-muted/50 hover:shadow-md"
          onClick={() => goToFilteredComplaints()}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Total de Reclamos
            </CardTitle>

            <div className="rounded-full bg-[#00A27F]/10 p-2">
              <FileText className="h-4 w-4 text-[#00A27F]" />
            </div>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold text-card-foreground">
              {stats?.total || 0}
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              {isServiciosPublicosUser
                ? "Reclamos de servicios públicos"
                : isGirsuUser
                  ? "Reclamos GIRSU"
                  : "Reclamos registrados"}
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer rounded-2xl border-border bg-card text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-muted/50 hover:shadow-md"
          onClick={() => goToFilteredComplaints("En proceso")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground">
              En Proceso
            </CardTitle>

            <div className="rounded-full bg-[#FFF7E8] p-2 dark:bg-yellow-500/10">
              <Clock className="h-4 w-4 text-[#C48814] dark:text-yellow-300" />
            </div>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold text-[#C48814] dark:text-yellow-300">
              {stats?.inProgress || 0}
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Pendientes de resolución
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer rounded-2xl border-border bg-card text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-muted/50 hover:shadow-md"
          onClick={() => goToFilteredComplaints("Resuelto")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Resueltos
            </CardTitle>

            <div className="rounded-full bg-[#ECFDF7] p-2 dark:bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-[#00A27F] dark:text-emerald-300" />
            </div>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold text-[#00A27F] dark:text-emerald-300">
              {stats?.resolved || 0}
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Casos completados
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer rounded-2xl border-border bg-card text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-muted/50 hover:shadow-md"
          onClick={() => goToFilteredComplaints("No resuelto")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground">
              No Resueltos
            </CardTitle>

            <div className="rounded-full bg-[#FFF0F3] p-2 dark:bg-rose-500/10">
              <XCircle className="h-4 w-4 text-[#D85C76] dark:text-rose-300" />
            </div>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold text-[#D85C76] dark:text-rose-300">
              {stats?.unresolved || 0}
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Casos sin resolución
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl text-card-foreground">
            Reclamos Recientes
          </CardTitle>
        </CardHeader>

        <CardContent>
          {recentComplaintsOrdered.length > 0 ? (
            <div className="space-y-4">
              {recentComplaintsOrdered.map((complaint) => (
                <div
                  key={complaint.id}
                  className="flex cursor-pointer flex-col gap-4 rounded-2xl border border-border bg-background p-5 transition-all hover:-translate-y-0.5 hover:bg-muted/60 hover:shadow-md md:flex-row md:items-center md:justify-between"
                  onClick={() =>
                    navigateWithLoading(
                      `/dashboard/complaints/${complaint.id}/view`,
                    )
                  }
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {getDisplayComplaintNumber(complaint)}
                      </span>
                      <span>•</span>
                      <span>{formatDate(complaint.complaint_date)}</span>
                    </div>

                    <div className="mt-2 text-base font-medium text-foreground">
                      {complaint.complainant_name || "Sin nombre"}
                    </div>

                    <div className="mt-1 text-sm text-muted-foreground">
                      {getComplaintSubtitle(complaint)}
                    </div>
                  </div>

                  <div
                    className={`inline-flex w-fit rounded-full border px-3 py-1 text-sm font-semibold ${getStatusBadge(
                      complaint.status,
                    )}`}
                  >
                    {complaint.status}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              No hay reclamos registrados
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}