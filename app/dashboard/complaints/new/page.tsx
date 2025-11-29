"use client";

import { useRouter } from "next/navigation";
import {
  ComplaintForm,
  type ComplaintFormData,
} from "@/components/forms/ComplaintForm";
import { toast } from "sonner";

export default function NewComplaintPage() {
  const router = useRouter();

  const handleSubmit = async (formData: ComplaintFormData) => {
    try {
      const response = await fetch("/api/complaints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
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

  const handleCancel = () => {
    router.push("/dashboard/complaints");
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Nuevo Reclamo</h1>
        <p className="text-muted-foreground mt-2">
          Complete el formulario para registrar un nuevo reclamo
        </p>
      </div>

      <ComplaintForm onSubmit={handleSubmit} onCancel={handleCancel} />
    </div>
  );
}
