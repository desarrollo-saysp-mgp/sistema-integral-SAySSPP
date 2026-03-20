"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  List,
} from "lucide-react";
import { toast } from "sonner";

interface DashboardStats {
  total: number;
  inProgress: number;
  resolved: number;
  unresolved: number;
  recentComplaints: Array<{
    id: number;
    complaint_number: string;
    complaint_date: string;
    complainant_name: string;
    status: string;
    service: { id: number; name: string };
    cause: { id: number; name: string };
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/stats");
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
      setLoading(false);
    }
  };

  const navigateWithLoading = (url: string) => {
    startTransition(() => {
      router.push(url);
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "En proceso":
        return "bg-[#FFF7E8] text-[#C48814] border-[#F4D9A6]";
      case "Resuelto":
        return "bg-[#ECFDF7] text-[#00A27F] border-[#B7E7D9]";
      case "No resuelto":
        return "bg-[#FFF0F3] text-[#D85C76] border-[#F2C6D1]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const goToFilteredComplaints = (status?: string) => {
    if (!status) {
      navigateWithLoading("/dashboard/complaints");
      return;
    }

    navigateWithLoading(
      `/dashboard/complaints?status=${encodeURIComponent(status)}`,
    );
  };

  if (loading) {
    return (
      <div className="p-2">
        <div className="flex items-center justify-center py-20">
          <div className="text-[#6B7280]">Cargando estadísticas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-8">
      {isPending && (
        <>
          <div className="fixed inset-0 z-40 bg-white/35 backdrop-blur-[1px]" />
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#D8E3DE] bg-white px-6 py-5 shadow-lg">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#D8E3DE] border-t-[#00A27F]" />
              <p className="text-sm font-medium text-[#6B7280]">Cargando...</p>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[#373737]">
            Dashboard
          </h1>
          <p className="mt-2 text-base text-[#6B7280]">
            Resumen general del sistema de reclamos
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => navigateWithLoading("/dashboard/complaints/new")}
            className="h-12 rounded-xl bg-[#00A27F] px-6 text-white font-semibold shadow-md transition-all hover:bg-[#008568] hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            disabled={isPending}
          >
            <Plus className="mr-2 h-5 w-5" />
            Nuevo Reclamo
          </Button>

          <Button
            variant="outline"
            onClick={() => navigateWithLoading("/dashboard/complaints")}
            className="h-11 rounded-xl border-[#D8E3DE] bg-white px-5 text-[#373737] hover:bg-[#F8FAF9]"
            disabled={isPending}
          >
            <List className="mr-2 h-4 w-4" />
            Ver Todos
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card
          className="cursor-pointer rounded-2xl border-[#D8E3DE] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          onClick={() => goToFilteredComplaints()}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-[#373737]">
              Total de Reclamos
            </CardTitle>
            <div className="rounded-full bg-[#00A27F]/10 p-2">
              <FileText className="h-4 w-4 text-[#00A27F]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#373737]">
              {stats?.total || 0}
            </div>
            <p className="mt-2 text-sm text-[#6B7280]">
              Reclamos registrados
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer rounded-2xl border-[#D8E3DE] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          onClick={() => goToFilteredComplaints("En proceso")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-[#373737]">
              En Proceso
            </CardTitle>
            <div className="rounded-full bg-[#FFF7E8] p-2">
              <Clock className="h-4 w-4 text-[#C48814]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#C48814]">
              {stats?.inProgress || 0}
            </div>
            <p className="mt-2 text-sm text-[#6B7280]">
              Pendientes de resolución
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer rounded-2xl border-[#D8E3DE] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          onClick={() => goToFilteredComplaints("Resuelto")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-[#373737]">
              Resueltos
            </CardTitle>
            <div className="rounded-full bg-[#ECFDF7] p-2">
              <CheckCircle className="h-4 w-4 text-[#00A27F]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#00A27F]">
              {stats?.resolved || 0}
            </div>
            <p className="mt-2 text-sm text-[#6B7280]">
              Casos completados
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer rounded-2xl border-[#D8E3DE] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          onClick={() => goToFilteredComplaints("No resuelto")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-[#373737]">
              No Resueltos
            </CardTitle>
            <div className="rounded-full bg-[#FFF0F3] p-2">
              <XCircle className="h-4 w-4 text-[#D85C76]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#D85C76]">
              {stats?.unresolved || 0}
            </div>
            <p className="mt-2 text-sm text-[#6B7280]">
              Casos sin resolución
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-[#D8E3DE] bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl text-[#373737]">
            Reclamos Recientes
          </CardTitle>
        </CardHeader>

        <CardContent>
          {stats?.recentComplaints && stats.recentComplaints.length > 0 ? (
            <div className="space-y-4">
              {stats.recentComplaints.map((complaint) => (
                <div
                  key={complaint.id}
                  className="flex cursor-pointer flex-col gap-4 rounded-2xl border border-[#E3E8E5] bg-[#FCFCFC] p-5 transition-colors hover:bg-[#F8FAF9] md:flex-row md:items-center md:justify-between"
                  onClick={() =>
                    navigateWithLoading(
                      `/dashboard/complaints/${complaint.id}/view`,
                    )
                  }
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-[#6B7280]">
                      <span className="font-semibold text-[#373737]">
                        {complaint.complaint_number}
                      </span>
                      <span>•</span>
                      <span>{formatDate(complaint.complaint_date)}</span>
                    </div>

                    <div className="mt-2 text-base font-medium text-[#373737]">
                      {complaint.complainant_name}
                    </div>

                    <div className="mt-1 text-sm text-[#6B7280]">
                      {complaint.service.name} - {complaint.cause.name}
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
            <div className="py-10 text-center text-[#6B7280]">
              No hay reclamos registrados
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}