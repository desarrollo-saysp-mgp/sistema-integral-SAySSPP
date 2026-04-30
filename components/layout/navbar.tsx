"use client";

import { useUser } from "@/hooks/useUser";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
  LayoutGrid,
  BarChart3,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  MODULES,
  getCurrentModule,
  getNavbarContext,
  isAccessesPage,
  isAdminPage,
} from "@/lib/navigation";

export function Navbar() {
  const { profile } = useUser();
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
    if (href === "/dashboard") return pathname === href;
    return pathname?.startsWith(href);
  };

  const isAdmin =
    profile?.role === "Admin" || profile?.role === "AdminLectura";

  const modules = Array.isArray(profile?.modules) ? profile.modules : [];
  const hasMultipleModules = modules.length > 1;
  const showAccesses = isAdmin || hasMultipleModules;

  const currentModule = getCurrentModule(pathname);
  const navbarContext = getNavbarContext(pathname);

  const showCurrentModuleNav =
    !!currentModule &&
    modules.includes(currentModule) &&
    !isAccessesPage(pathname) &&
    !isAdminPage(pathname);

  const currentModuleConfig = currentModule ? MODULES[currentModule] : null;

  const logoHref = isAdmin ? "/dashboard/accesos" : "/dashboard";

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-[#D8E3DE] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href={logoHref}
          className="flex items-center gap-2 transition-opacity hover:opacity-90"
        >
          <div className="relative h-11 w-[110px] shrink-0 sm:w-[125px]">
            <Image
              src="/logo-general-pico-horizontal.png"
              alt="General Pico"
              fill
              priority
              className="object-contain object-left"
            />
          </div>

          <div className="hidden xl:flex flex-col border-l border-[#D8E3DE] pl-3">
            <span className="text-sm font-semibold leading-tight text-[#373737]">
              {navbarContext.title}
            </span>
            <span className="text-xs leading-tight text-[#6B7280]">
              {navbarContext.subtitle}
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-2">
          {!isAdmin && (
            <Link href="/dashboard">
              <Button
                variant="ghost"
                className={cn(
                  "rounded-xl px-4 text-[#373737] hover:bg-[#00A27F]/10 hover:text-[#00A27F]",
                  isActive("/dashboard") &&
                  !pathname?.includes("/dashboard/complaints") &&
                  !pathname?.includes("/dashboard/accesos") &&
                  "bg-[#00A27F]/12 font-semibold text-[#00A27F]",
                )}
              >
                <Home className="mr-2 h-4 w-4" />
                Inicio
              </Button>
            </Link>
          )}

          {showAccesses && (
            <Link href="/dashboard/accesos">
              <Button
                variant="ghost"
                className={cn(
                  "rounded-xl px-4 text-[#373737] hover:bg-[#00A27F]/10 hover:text-[#00A27F]",
                  isActive("/dashboard/accesos") &&
                  "bg-[#00A27F]/12 font-semibold text-[#00A27F]",
                )}
              >
                <LayoutGrid className="mr-2 h-4 w-4" />
                Accesos
              </Button>
            </Link>
          )}

          {showCurrentModuleNav && currentModuleConfig?.key === "complaints" && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "rounded-xl px-4 text-[#373737] hover:bg-[#00A27F]/10 hover:text-[#00A27F]",
                    pathname?.includes(currentModuleConfig.basePath) &&
                    "bg-[#00A27F]/12 font-semibold text-[#00A27F]",
                  )}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {currentModuleConfig.shortLabel}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="center"
                side="bottom"
                className="w-[280px] rounded-2xl border-[#D8E3DE]"
              >
                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard/complaints/home"
                    className="cursor-pointer rounded-xl"
                  >
                    <div className="flex flex-col gap-1 py-1">
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4 text-[#00A27F]" />
                        <span className="font-medium">Inicio</span>
                      </div>
                      <p className="ml-6 text-xs text-muted-foreground">
                        Panel principal del módulo de reclamos
                      </p>
                    </div>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard/complaints/new"
                    className="cursor-pointer rounded-xl"
                  >
                    <div className="flex flex-col gap-1 py-1">
                      <div className="flex items-center gap-2">
                        <PlusCircle className="h-4 w-4 text-[#00A27F]" />
                        <span className="font-medium">Nuevo Reclamo</span>
                      </div>
                      <p className="ml-6 text-xs text-muted-foreground">
                        Crear un nuevo reclamo ciudadano
                      </p>
                    </div>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard/complaints"
                    className="cursor-pointer rounded-xl"
                  >
                    <div className="flex flex-col gap-1 py-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#00A27F]" />
                        <span className="font-medium">Ver Todos</span>
                      </div>
                      <p className="ml-6 text-xs text-muted-foreground">
                        Lista completa de reclamos
                      </p>
                    </div>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard/complaints/stats"
                    className="cursor-pointer rounded-xl"
                  >
                    <div className="flex flex-col gap-1 py-1">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-[#00A27F]" />
                        <span className="font-medium">Estadísticas</span>
                      </div>
                      <p className="ml-6 text-xs text-muted-foreground">
                        Análisis y gráficos de reclamos
                      </p>
                    </div>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {isAdmin && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "rounded-xl px-4 text-[#373737] hover:bg-[#00A27F]/10 hover:text-[#00A27F]",
                    pathname?.includes("admin") &&
                    "bg-[#00A27F]/12 font-semibold text-[#00A27F]",
                  )}
                >
                  <FolderKanban className="mr-2 h-4 w-4" />
                  Administración
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="center"
                side="bottom"
                className="w-[280px] rounded-2xl border-[#D8E3DE]"
              >
                <DropdownMenuItem asChild>
                  <Link
                    href="/admin/users"
                    className="cursor-pointer rounded-xl"
                  >
                    <div className="flex flex-col gap-1 py-1">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-[#00A27F]" />
                        <span className="font-medium">Usuarios</span>
                      </div>
                      <p className="ml-6 text-xs text-muted-foreground">
                        Gestionar usuarios del sistema
                      </p>
                    </div>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link
                    href="/admin/services"
                    className="cursor-pointer rounded-xl"
                  >
                    <div className="flex flex-col gap-1 py-1">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-[#00A27F]" />
                        <span className="font-medium">Servicios</span>
                      </div>
                      <p className="ml-6 text-xs text-muted-foreground">
                        Configurar servicios y causas
                      </p>
                    </div>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-[#373737] hover:bg-[#00A27F]/10 hover:text-[#00A27F] md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>

          {profile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 rounded-xl text-[#373737] hover:bg-[#00A27F]/10 hover:text-[#00A27F]"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00A27F]/12">
                    <User className="h-4 w-4 text-[#00A27F]" />
                  </div>

                  <div className="hidden lg:flex flex-col items-start">
                    <span className="text-sm font-medium">
                      {profile.full_name}
                    </span>
                    <span className="text-xs text-[#6B7280]">
                      {profile.role}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-56 rounded-2xl border-[#D8E3DE]"
              >
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{profile.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {profile.email}
                    </p>
                    <p className="text-xs font-semibold text-[#00A27F]">
                      {profile.role}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {profile.is_readonly
                        ? "Modo: solo lectura"
                        : "Modo: edición habilitada"}
                    </p>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-[#D85C76] focus:text-[#D85C76]"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-[#D8E3DE] bg-white md:hidden">
          <div className="space-y-2 px-4 py-4">
            {!isAdmin && (
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                  isActive("/dashboard") &&
                    !pathname?.includes("/dashboard/complaints") &&
                    !pathname?.includes("/dashboard/accesos")
                    ? "bg-[#00A27F]/12 text-[#00A27F]"
                    : "text-[#373737] hover:bg-[#00A27F]/8",
                )}
              >
                <Home className="h-5 w-5" />
                <span className="font-medium">Inicio</span>
              </Link>
            )}

            {showAccesses && (
              <Link
                href="/dashboard/accesos"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                  isActive("/dashboard/accesos")
                    ? "bg-[#00A27F]/12 text-[#00A27F]"
                    : "text-[#373737] hover:bg-[#00A27F]/8",
                )}
              >
                <LayoutGrid className="h-5 w-5" />
                <span className="font-medium">Accesos</span>
              </Link>
            )}

            {showCurrentModuleNav && currentModuleConfig?.key === "complaints" && (
              <div className="space-y-1">
                <div className="px-4 py-2 text-xs font-semibold uppercase text-[#6B7280]">
                  {currentModuleConfig.label}
                </div>

                <Link
                  href="/dashboard/complaints/home"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                    pathname === "/dashboard/complaints/home"
                      ? "bg-[#00A27F]/12 text-[#00A27F]"
                      : "text-[#373737] hover:bg-[#00A27F]/8",
                  )}
                >
                  <Home className="h-5 w-5" />
                  <span>Inicio</span>
                </Link>

                <Link
                  href="/dashboard/complaints/new"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                    isActive("/dashboard/complaints/new")
                      ? "bg-[#00A27F]/12 text-[#00A27F]"
                      : "text-[#373737] hover:bg-[#00A27F]/8",
                  )}
                >
                  <PlusCircle className="h-5 w-5" />
                  <span>Nuevo Reclamo</span>
                </Link>

                <Link
                  href="/dashboard/complaints"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                    pathname === "/dashboard/complaints"
                      ? "bg-[#00A27F]/12 text-[#00A27F]"
                      : "text-[#373737] hover:bg-[#00A27F]/8",
                  )}
                >
                  <FileText className="h-5 w-5" />
                  <span>Ver Todos</span>
                </Link>

                <Link
                  href="/dashboard/complaints/stats"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                    pathname === "/dashboard/complaints/stats"
                      ? "bg-[#00A27F]/12 text-[#00A27F]"
                      : "text-[#373737] hover:bg-[#00A27F]/8",
                  )}
                >
                  <BarChart3 className="h-5 w-5" />
                  <span>Estadísticas</span>
                </Link>
              </div>
            )}

            {isAdmin && (
              <div className="mt-2 space-y-1 border-t border-[#D8E3DE] pt-2">
                <div className="px-4 py-2 text-xs font-semibold uppercase text-[#6B7280]">
                  Administración
                </div>

                <Link
                  href="/admin/users"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                    isActive("/admin/users")
                      ? "bg-[#00A27F]/12 text-[#00A27F]"
                      : "text-[#373737] hover:bg-[#00A27F]/8",
                  )}
                >
                  <Users className="h-5 w-5" />
                  <span>Usuarios</span>
                </Link>

                <Link
                  href="/admin/services"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                    isActive("/admin/services")
                      ? "bg-[#00A27F]/12 text-[#00A27F]"
                      : "text-[#373737] hover:bg-[#00A27F]/8",
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