"use client";

import { ReactNode } from "react";
import { Navbar } from "./navbar";
import { LoadingScreen } from "./loading-screen";
import { useUser } from "@/hooks/useUser";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { loading, profile } = useUser();

  // Show loading screen while user data is being fetched
  if (loading) {
    return <LoadingScreen message="Cargando..." />;
  }

  // If not loading but no profile, still show loading briefly
  // This handles the edge case where profile is being fetched
  if (!profile) {
    return <LoadingScreen message="Verificando sesión..." />;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F5F6F8]">
      <Navbar />
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
