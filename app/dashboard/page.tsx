"use client";

import { useEffect, useState } from "react";
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "En proceso":
        return "text-yellow-600";
      case "Resuelto":
        return "text-green-600";
      case "No resuelto":
        return "text-red-600";
      default:
        return "text-gray-600";
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Cargando estadísticas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Resumen general del sistema de reclamos
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push("/dashboard/complaints/new")}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Reclamo
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/complaints")}
          >
            <List className="w-4 h-4 mr-2" />
            Ver Todos
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Complaints */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Reclamos
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Reclamos registrados
            </p>
          </CardContent>
        </Card>

        {/* In Progress */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats?.inProgress || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pendientes de resolución
            </p>
          </CardContent>
        </Card>

        {/* Resolved */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resueltos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.resolved || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Casos completados
            </p>
          </CardContent>
        </Card>

        {/* Unresolved */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No Resueltos</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.unresolved || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Casos sin resolución
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Complaints */}
      <Card>
        <CardHeader>
          <CardTitle>Reclamos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentComplaints && stats.recentComplaints.length > 0 ? (
            <div className="space-y-4">
              {stats.recentComplaints.map((complaint) => (
                <div
                  key={complaint.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() =>
                    router.push(`/dashboard/complaints/${complaint.id}`)
                  }
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {complaint.complaint_number}
                      </span>
                      <span className="text-sm text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(complaint.complaint_date)}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {complaint.complainant_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {complaint.service.name} - {complaint.cause.name}
                    </div>
                  </div>
                  <div className={`font-medium ${getStatusColor(complaint.status)}`}>
                    {complaint.status}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hay reclamos registrados
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
