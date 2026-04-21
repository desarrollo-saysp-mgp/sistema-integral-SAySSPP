"use client";

import { useRouter } from "next/navigation";
import {
  ComplaintForm,
  type ComplaintFormData,
} from "@/components/forms/ComplaintForm";
import {
  ArboladoComplaintForm,
  type ArboladoComplaintFormData,
} from "../../../../components/forms/ArboladoComplaintForm";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";

export default function NewComplaintPage() {
  const router = useRouter();
  const { profile } = useUser();

  const isArboladoUser = profile?.role === "ReclamosArbolado";

  const handleGeneralSubmit = async (formData: ComplaintFormData) => {
    try {
      const response = await fetch("/api/complaints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          form_variant: "general",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Error al crear el reclamo");
        return { success: false, error: data.error };
      }

      toast.success("Reclamo creado exitosamente");
      router.push("/dashboard/complaints");
      return { success: true };
    } catch (error) {
      console.error("Error submitting complaint:", error);
      toast.error("Error al crear el reclamo");
      return { success: false, error: "Error de conexión" };
    }
  };

  const handleArboladoSubmit = async (formData: ArboladoComplaintFormData) => {
    try {
      const response = await fetch("/api/complaints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          form_variant: "arbolado",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Error al crear el reclamo de Arbolado");
        return { success: false, error: data.error };
      }

      toast.success("Reclamo de Arbolado creado exitosamente");
      router.push("/dashboard/complaints");
      return { success: true };
    } catch (error) {
      console.error("Error submitting arbolado complaint:", error);
      toast.error("Error al crear el reclamo de Arbolado");
      return { success: false, error: "Error de conexión" };
    }
  };

  const handleCancel = () => {
    router.push("/dashboard/complaints");
  };

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          {isArboladoUser ? "Nuevo Reclamo de Arbolado" : "Nuevo Reclamo"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {isArboladoUser
            ? "Complete el formulario para registrar un nuevo reclamo de Arbolado"
            : "Complete el formulario para registrar un nuevo reclamo"}
        </p>
      </div>

      {isArboladoUser ? (
        <ArboladoComplaintForm
          onSubmit={handleArboladoSubmit}
          onCancel={handleCancel}
        />
      ) : (
        <ComplaintForm
          onSubmit={handleGeneralSubmit}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}