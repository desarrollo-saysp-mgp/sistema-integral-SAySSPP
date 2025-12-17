"use client";

import { useUser } from "@/hooks/useUser";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  FileText,
  PlusCircle,
  Users,
  FolderKanban,
  LogOut,
  User,
  Menu,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { profile, loading } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  const isAdmin = profile?.role === "Admin";

  if (loading) {
    return (
      <nav className="sticky top-0 z-50 w-full border-b bg-[#0E3F75] text-white">
        <div className="flex h-16 items-center px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-[#5CADEB]" />
            <span className="text-lg font-semibold">Cargando...</span>
          </div>
        </div>
      </nav>
    );
  }

  // If not loading but no profile, show error state
  if (!loading && !profile) {
    return (
      <nav className="sticky top-0 z-50 w-full border-b bg-[#0E3F75] text-white">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5CADEB] font-bold text-white shadow-sm">
              SGR
            </div>
            <span className="text-base font-semibold">Sistema de Gestión de Reclamos</span>
          </Link>
          <Button
            variant="ghost"
            className="text-white hover:bg-[#5CADEB]/20"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-[#88C1ED]/20 bg-[#0E3F75] text-white shadow-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5CADEB] font-bold text-white shadow-sm">
            SGR
          </div>
          <div className="hidden lg:flex flex-col">
            <span className="text-base font-semibold leading-tight">
              Sistema de Gestión de Reclamos
            </span>
            <span className="text-xs text-[#88C1ED]">Secretaría Municipal</span>
          </div>
          <span className="lg:hidden text-base font-semibold">SGR</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-2">
          {/* Dashboard Link */}
          <Link href="/dashboard">
            <Button
              variant="ghost"
              className={cn(
                "text-white hover:bg-[#5CADEB]/20 hover:text-white",
                isActive("/dashboard") && !pathname?.includes("complaints") && "bg-[#5CADEB] font-semibold"
              )}
            >
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>

          {/* Reclamos Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "text-white hover:bg-[#5CADEB]/20 hover:text-white",
                  pathname?.includes("complaints") && "bg-[#5CADEB]/20"
                )}
              >
                <FileText className="h-4 w-4 mr-2" />
                Reclamos
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[280px]">
              <DropdownMenuItem asChild>
                <Link href="/dashboard/complaints/new" className="cursor-pointer">
                  <div className="flex flex-col gap-1 py-1">
                    <div className="flex items-center gap-2">
                      <PlusCircle className="h-4 w-4 text-[#5CADEB]" />
                      <span className="font-medium">Nuevo Reclamo</span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      Crear un nuevo reclamo ciudadano
                    </p>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/complaints" className="cursor-pointer">
                  <div className="flex flex-col gap-1 py-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#5CADEB]" />
                      <span className="font-medium">Ver Todos</span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      Lista completa de reclamos
                    </p>
                  </div>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Admin Dropdown - Only for Admins */}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "text-white hover:bg-[#5CADEB]/20 hover:text-white",
                    pathname?.includes("admin") && "bg-[#5CADEB]/20"
                  )}
                >
                  <FolderKanban className="h-4 w-4 mr-2" />
                  Administración
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[280px]">
                <DropdownMenuItem asChild>
                  <Link href="/admin/users" className="cursor-pointer">
                    <div className="flex flex-col gap-1 py-1">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-[#5CADEB]" />
                        <span className="font-medium">Usuarios</span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-6">
                        Gestionar usuarios del sistema
                      </p>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/services" className="cursor-pointer">
                    <div className="flex flex-col gap-1 py-1">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-[#5CADEB]" />
                        <span className="font-medium">Servicios</span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-6">
                        Configurar servicios y causas
                      </p>
                    </div>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-2">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-white hover:bg-[#5CADEB]/20 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {/* User Dropdown */}
          {profile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 text-white hover:bg-[#5CADEB]/20 hover:text-white"
                >
                  <User className="h-5 w-5" />
                  <div className="hidden lg:flex flex-col items-start">
                    <span className="text-sm font-medium">
                      {profile.full_name}
                    </span>
                    <span className="text-xs text-[#88C1ED]">{profile.role}</span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{profile.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {profile.email}
                    </p>
                    <p className="text-xs font-semibold text-[#5CADEB]">
                      {profile.role}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-red-600 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#88C1ED]/20 bg-[#0E3F75]">
          <div className="px-4 py-4 space-y-2">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isActive("/dashboard") && !pathname?.includes("complaints")
                  ? "bg-[#5CADEB] text-white"
                  : "text-white hover:bg-[#5CADEB]/20"
              )}
            >
              <Home className="h-5 w-5" />
              <span className="font-medium">Dashboard</span>
            </Link>

            <div className="space-y-1">
              <div className="px-4 py-2 text-xs font-semibold text-[#88C1ED] uppercase">
                Reclamos
              </div>
              <Link
                href="/dashboard/complaints/new"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  isActive("/dashboard/complaints/new")
                    ? "bg-[#5CADEB] text-white"
                    : "text-white hover:bg-[#5CADEB]/20"
                )}
              >
                <PlusCircle className="h-5 w-5" />
                <span>Nuevo Reclamo</span>
              </Link>
              <Link
                href="/dashboard/complaints"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  pathname === "/dashboard/complaints"
                    ? "bg-[#5CADEB] text-white"
                    : "text-white hover:bg-[#5CADEB]/20"
                )}
              >
                <FileText className="h-5 w-5" />
                <span>Ver Todos</span>
              </Link>
            </div>

            {isAdmin && (
              <div className="space-y-1 pt-2 mt-2 border-t border-[#88C1ED]/20">
                <div className="px-4 py-2 text-xs font-semibold text-[#88C1ED] uppercase">
                  Administración
                </div>
                <Link
                  href="/admin/users"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive("/admin/users")
                      ? "bg-[#5CADEB] text-white"
                      : "text-white hover:bg-[#5CADEB]/20"
                  )}
                >
                  <Users className="h-5 w-5" />
                  <span>Usuarios</span>
                </Link>
                <Link
                  href="/admin/services"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive("/admin/services")
                      ? "bg-[#5CADEB] text-white"
                      : "text-white hover:bg-[#5CADEB]/20"
                  )}
                >
                  <FolderKanban className="h-5 w-5" />
                  <span>Servicios</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
