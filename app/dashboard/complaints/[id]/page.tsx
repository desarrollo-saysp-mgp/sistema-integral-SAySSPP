"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ComplaintForm,
  type ComplaintFormData,
} from "@/components/forms/ComplaintForm";
import {
  ArboladoComplaintForm,
  type ArboladoComplaintFormData,
} from "@/components/forms/ArboladoComplaintForm";
import {
  ZyvComplaintForm,
  type ZyvComplaintFormData,
} from "@/components/forms/ZyvComplaintForm";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { Complaint } from "@/types";
import { PageLoader } from "@/components/ui/page-loader";
import { useUser } from "@/hooks/useUser";

export default function ComplaintDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { profile } = useUser();
  const id = params.id as string;

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchComplaint();
    }
  }, [id]);

  const fetchComplaint = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/complaints/${id}`);
      const data = await response.json();

      if (response.ok && data.data) {
        setComplaint(data.data);
      } else {
        toast.error(data.error || "Error al cargar reclamo");
        router.push("/dashboard/complaints");
      }
    } catch (error) {
      console.error("Error fetching complaint:", error);
      toast.error("Error al cargar reclamo");
      router.push("/dashboard/complaints");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // LOADER (FIX IMPORTANTE)
  // =========================

  if (loading) {
    return <PageLoader show={true} />;
  }

  if (!complaint) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Reclamo no encontrado</p>
      </div>
    );
  }

  // =========================
  // FLAGS
  // =========================

  const serviceName = (complaint as any)?.service?.name;

  const isArbolado = complaint.form_variant === "arbolado";

  const isZyV =
    complaint.form_variant === "zyv" ||
    serviceName === "Zoonosis" ||
    serviceName === "Vectores" ||
    profile?.role === "ReclamosZyV";

  const displayComplaintNumber =
    complaint.form_variant === "arbolado"
      ? complaint.arbolado_number ?? "-"
      : complaint.complaint_number ?? "-";

  // =========================
  // SUBMITS
  // =========================

  const handleGeneralSubmit = async (formData: ComplaintFormData) => {
    try {
      const response = await fetch(`/api/complaints/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          form_variant: "general",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Error al actualizar");
        return { success: false };
      }

      toast.success("Reclamo actualizado");
      router.push("/dashboard/complaints");
      return { success: true };
    } catch {
      toast.error("Error al actualizar");
      return { success: false };
    }
  };

  const handleArboladoSubmit = async (
    formData: ArboladoComplaintFormData,
  ) => {
    try {
      const response = await fetch(`/api/complaints/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          form_variant: "arbolado",
        }),
      });

      if (!response.ok) {
        toast.error("Error al actualizar");
        return { success: false };
      }

      toast.success("Reclamo actualizado");
      router.push("/dashboard/complaints");
      return { success: true };
    } catch {
      toast.error("Error");
      return { success: false };
    }
  };

  const handleZyVSubmit = async (formData: ZyvComplaintFormData) => {
    try {
      const response = await fetch(`/api/complaints/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          form_variant: "zyv",
        }),
      });

      if (!response.ok) {
        toast.error("Error al actualizar");
        return { success: false };
      }

      toast.success("Reclamo actualizado");
      router.push("/dashboard/complaints");
      return { success: true };
    } catch {
      toast.error("Error");
      return { success: false };
    }
  };

  // =========================
  // DELETE
  // =========================

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/complaints/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        toast.error("Error al eliminar");
        return;
      }

      toast.success("Reclamo eliminado");
      router.push("/dashboard/complaints");
    } catch {
      toast.error("Error");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleCancel = () => {
    router.push("/dashboard/complaints");
  };

  // =========================
  // RENDER
  // =========================

  return (
    <>
      <div className="container mx-auto space-y-6 p-6">
        <div className="flex justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard/complaints")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>

            <h1 className="text-3xl font-bold">
              Reclamo {displayComplaintNumber}
            </h1>
          </div>

          {(profile?.role === "Admin" ||
            profile?.role === "Reclamos" ||
            profile?.role === "ReclamosArbolado" ||
            profile?.role === "ReclamosZyV") && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          )}
        </div>

        {isArbolado ? (
          <ArboladoComplaintForm
            complaint={complaint}
            onSubmit={handleArboladoSubmit}
            onCancel={handleCancel}
          />
        ) : isZyV ? (
          <ZyvComplaintForm
            complaint={complaint}
            onSubmit={handleZyVSubmit}
            onCancel={handleCancel}
          />
        ) : (
          <ComplaintForm
            complaint={complaint}
            onSubmit={handleGeneralSubmit}
            onCancel={handleCancel}
          />
        )}

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar reclamo?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}