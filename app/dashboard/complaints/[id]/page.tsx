"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ComplaintForm,
  ComplaintFormData,
} from "@/components/forms/ComplaintForm";
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

  const handleSubmit = async (
    formData: ComplaintFormData,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/complaints/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.status === 403) {
        const message = data.error || "No tenés permisos para guardar cambios";
        toast.error(message);
        return { success: false, error: message };
      }

      if (!response.ok) {
        toast.error(data.error || "Error al actualizar el reclamo");
        return { success: false, error: data.error };
      }

      toast.success("Reclamo actualizado exitosamente");
      router.push("/dashboard/complaints");
      return { success: true };
    } catch (error) {
      console.error("Error updating complaint:", error);
      toast.error("Error al actualizar el reclamo");
      return { success: false, error: "Error interno del servidor" };
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/complaints/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Error al eliminar el reclamo");
        return;
      }

      toast.success("Reclamo eliminado exitosamente");
      router.push("/dashboard/complaints");
    } catch (error) {
      console.error("Error deleting complaint:", error);
      toast.error("Error al eliminar el reclamo");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleCancel = () => {
    router.push("/dashboard/complaints");
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Cargando reclamo...</div>
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Reclamo no encontrado</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard/complaints")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </div>
          <h1 className="text-3xl font-bold">
            Reclamo {complaint.complaint_number}
          </h1>
          <p className="text-muted-foreground">
            {profile?.role === "AdminLectura"
              ? "Puede revisar el formulario, pero no guardar cambios"
              : "Editar información del reclamo"}
          </p>
        </div>

        {(profile?.role === "Admin" || profile?.role === "Reclamos") && (
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Eliminar Reclamo
          </Button>
        )}
      </div>

      <ComplaintForm
        complaint={complaint}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El reclamo{" "}
              <span className="font-semibold">
                {complaint.complaint_number}
              </span>{" "}
              será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}