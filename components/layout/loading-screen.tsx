"use client";

import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Cargando..." }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F5F6F8]">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#0E3F75] font-bold text-white text-2xl shadow-lg">
          SGR
        </div>
        <span className="mt-3 text-lg font-semibold text-[#0E3F75]">
          Sistema de Gestión de Reclamos
        </span>
      </div>

      {/* Spinner */}
      <div className="flex flex-col items-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#5CADEB]" />
        <p className="mt-4 text-sm font-medium text-gray-600">{message}</p>
      </div>
    </div>
  );
}
