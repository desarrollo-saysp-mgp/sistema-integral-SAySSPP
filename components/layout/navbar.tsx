"use client";

import { useUser } from "@/hooks/useUser";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";
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
  Moon,
  Sun,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  MODULES,
  getCurrentModule,
  getNavbarContext,
  isAccessesPage,
  isAdminPage,
} from "@/lib/navigation";
import AlertsBell from "@/components/alerts-bell";

const SERVICIOS_PUBLICOS_EMAIL = "adm.serviciospublicos.mgp@gmail.com";
const GIRSU_EMAIL = "direccióngirsupico@gmail.com";

const normalizeEmail = (value?: string | null) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function Navbar() {
  const { profile } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);

  const normalizedProfileEmail = normalizeEmail(profile?.email);

  const isServiciosPublicosUser =
    normalizedProfileEmail === normalizeEmail(SERVICIOS_PUBLICOS_EMAIL);

  const isGirsuUser = normalizedProfileEmail === normalizeEmail(GIRSU_EMAIL);

  const canCreateComplaints = !isServiciosPublicosUser && !isGirsuUser;

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;

    const shouldUseDark = savedTheme ? savedTheme === "dark" : prefersDark;

    setDarkMode(shouldUseDark);
    document.documentElement.classList.toggle("dark", shouldUseDark);
  }, []);

  useEffect(() => {
    setLoadingStats(false);
  }, [pathname]);

  const toggleDarkMode = () => {
    setDarkMode((current) => {
      const next = !current;

      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", next ? "dark" : "light");

      return next;
    });
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const goToStats = () => {
    if (pathname === "/dashboard/complaints/stats") return;

    setLoadingStats(true);
    setMobileMenuOpen(false);
    router.push("/dashboard/complaints/stats");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    return pathname?.startsWith(href);
  };

  const isAdmin =
    profile?.role === "Admin" || profile?.role === "AdminLectura";

  const isAccessProfile = isAdmin || isGirsuUser;

  const modules = Array.isArray(profile?.modules) ? profile.modules : [];
  const hasMultipleModules = modules.length > 1;

  const showAccesses = isAdmin || hasMultipleModules || isGirsuUser;

  const currentModule = getCurrentModule(pathname);
  const navbarContext = getNavbarContext(pathname);

  const showCurrentModuleNav =
    !!currentModule &&
    modules.includes(currentModule) &&
    !isAccessesPage(pathname) &&
    !isAdminPage(pathname);

  const currentModuleConfig = currentModule ? MODULES[currentModule] : null;

  const inicioHref =
    currentModuleConfig?.key === "complaints"
      ? "/dashboard/complaints/home"
      : "/dashboard";

  const logoHref = isAccessProfile ? "/dashboard/accesos" : "/dashboard";

  return (
    <>
      <PageLoader show={loadingStats} />

      <nav className="sticky top-0 z-50 w-full border-b border-[#D8E3DE] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 dark:border-slate-700 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/90">
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

            <div className="hidden flex-col border-l border-[#D8E3DE] pl-3 dark:border-slate-700 xl:flex">
              <span className="text-sm font-semibold leading-tight text-[#373737] dark:text-slate-100">
                {navbarContext.title}
              </span>
              <span className="text-xs leading-tight text-[#6B7280] dark:text-slate-400">
                {navbarContext.subtitle}
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            {!isAccessProfile && !isAccessesPage(pathname) && (
              <Link href={inicioHref}>
                <Button
                  variant="ghost"
                  className={cn(
                    "rounded-xl px-4 text-[#373737] hover:bg-[#00A27F]/10 hover:text-[#00A27F] dark:text-slate-200 dark:hover:bg-[#00A27F]/20 dark:hover:text-[#00D6AA]",
                    pathname === inicioHref &&
                    "bg-[#00A27F]/12 font-semibold text-[#00A27F] dark:bg-[#00A27F]/20 dark:text-[#00D6AA]",
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
                    "rounded-xl px-4 text-[#373737] hover:bg-[#00A27F]/10 hover:text-[#00A27F] dark:text-slate-200 dark:hover:bg-[#00A27F]/20 dark:hover:text-[#00D6AA]",
                    isActive("/dashboard/accesos") &&
                    "bg-[#00A27F]/12 font-semibold text-[#00A27F] dark:bg-[#00A27F]/20 dark:text-[#00D6AA]",
                  )}
                >
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  Accesos
                </Button>
              </Link>
            )}

            {showCurrentModuleNav &&
              currentModuleConfig?.key === "complaints" && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "rounded-xl px-4 text-[#373737] hover:bg-[#00A27F]/10 hover:text-[#00A27F] dark:text-slate-200 dark:hover:bg-[#00A27F]/20 dark:hover:text-[#00D6AA]",
                        pathname?.includes(currentModuleConfig.basePath) &&
                        "bg-[#00A27F]/12 font-semibold text-[#00A27F] dark:bg-[#00A27F]/20 dark:text-[#00D6AA]",
                      )}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      {currentModuleConfig.shortLabel}
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="center"
                    side="bottom"
                    className="w-[280px] rounded-2xl border-[#D8E3DE] dark:border-slate-700 dark:bg-slate-900"
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

                    {canCreateComplaints && (
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
                    )}

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

                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        goToStats();
                      }}
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
                      "rounded-xl px-4 text-[#373737] hover:bg-[#00A27F]/10 hover:text-[#00A27F] dark:text-slate-200 dark:hover:bg-[#00A27F]/20 dark:hover:text-[#00D6AA]",
                      pathname?.includes("admin") &&
                      "bg-[#00A27F]/12 font-semibold text-[#00A27F] dark:bg-[#00A27F]/20 dark:text-[#00D6AA]",
                    )}
                  >
                    <FolderKanban className="mr-2 h-4 w-4" />
                    Administración
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="center"
                  side="bottom"
                  className="w-[280px] rounded-2xl border-[#D8E3DE] dark:border-slate-700 dark:bg-slate-900"
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
            {showCurrentModuleNav &&
              currentModuleConfig?.key === "complaints" && <AlertsBell />}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              title={
                darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
              }
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E3DE] bg-white text-[#373737] shadow-sm transition hover:bg-[#00A27F]/10 hover:text-[#00A27F] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-[#00A27F]/20 dark:hover:text-[#00D6AA]"
            >
              {darkMode ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-[#373737] hover:bg-[#00A27F]/10 hover:text-[#00A27F] dark:text-slate-200 dark:hover:bg-[#00A27F]/20 dark:hover:text-[#00D6AA] md:hidden"
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
                    className="flex items-center gap-2 rounded-xl text-[#373737] hover:bg-[#00A27F]/10 hover:text-[#00A27F] dark:text-slate-200 dark:hover:bg-[#00A27F]/20 dark:hover:text-[#00D6AA]"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00A27F]/12 dark:bg-[#00A27F]/20">
                      <User className="h-4 w-4 text-[#00A27F] dark:text-[#00D6AA]" />
                    </div>

                    <div className="hidden flex-col items-start lg:flex">
                      <span className="text-sm font-medium">
                        {profile.full_name}
                      </span>
                      <span className="text-xs text-[#6B7280] dark:text-slate-400">
                        {profile.role}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="w-56 rounded-2xl border-[#D8E3DE] dark:border-slate-700 dark:bg-slate-900"
                >
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">
                        {profile.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {profile.email}
                      </p>
                      <p className="text-xs font-semibold text-[#00A27F] dark:text-[#00D6AA]">
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
          <div className="border-t border-[#D8E3DE] bg-white dark:border-slate-700 dark:bg-slate-950 md:hidden">
            <div className="space-y-2 px-4 py-4">
              {!isAccessProfile && !isAccessesPage(pathname) && (
                <Link
                  href={inicioHref}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                    pathname === inicioHref
                      ? "bg-[#00A27F]/12 text-[#00A27F] dark:bg-[#00A27F]/20 dark:text-[#00D6AA]"
                      : "text-[#373737] hover:bg-[#00A27F]/8 dark:text-slate-200 dark:hover:bg-[#00A27F]/20",
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
                      ? "bg-[#00A27F]/12 text-[#00A27F] dark:bg-[#00A27F]/20 dark:text-[#00D6AA]"
                      : "text-[#373737] hover:bg-[#00A27F]/8 dark:text-slate-200 dark:hover:bg-[#00A27F]/20",
                  )}
                >
                  <LayoutGrid className="h-5 w-5" />
                  <span className="font-medium">Accesos</span>
                </Link>
              )}

              {showCurrentModuleNav &&
                currentModuleConfig?.key === "complaints" && (
                  <div className="space-y-1">
                    <div className="px-4 py-2 text-xs font-semibold uppercase text-[#6B7280] dark:text-slate-400">
                      {currentModuleConfig.label}
                    </div>

                    <Link
                      href="/dashboard/complaints/home"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                        pathname === "/dashboard/complaints/home"
                          ? "bg-[#00A27F]/12 text-[#00A27F] dark:bg-[#00A27F]/20 dark:text-[#00D6AA]"
                          : "text-[#373737] hover:bg-[#00A27F]/8 dark:text-slate-200 dark:hover:bg-[#00A27F]/20",
                      )}
                    >
                      <Home className="h-5 w-5" />
                      <span>Inicio</span>
                    </Link>

                    {canCreateComplaints && (
                      <Link
                        href="/dashboard/complaints/new"
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                          isActive("/dashboard/complaints/new")
                            ? "bg-[#00A27F]/12 text-[#00A27F] dark:bg-[#00A27F]/20 dark:text-[#00D6AA]"
                            : "text-[#373737] hover:bg-[#00A27F]/8 dark:text-slate-200 dark:hover:bg-[#00A27F]/20",
                        )}
                      >
                        <PlusCircle className="h-5 w-5" />
                        <span>Nuevo Reclamo</span>
                      </Link>
                    )}

                    <Link
                      href="/dashboard/complaints"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                        pathname === "/dashboard/complaints"
                          ? "bg-[#00A27F]/12 text-[#00A27F] dark:bg-[#00A27F]/20 dark:text-[#00D6AA]"
                          : "text-[#373737] hover:bg-[#00A27F]/8 dark:text-slate-200 dark:hover:bg-[#00A27F]/20",
                      )}
                    >
                      <FileText className="h-5 w-5" />
                      <span>Ver Todos</span>
                    </Link>

                    <button
                      type="button"
                      onClick={goToStats}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors",
                        pathname === "/dashboard/complaints/stats"
                          ? "bg-[#00A27F]/12 text-[#00A27F] dark:bg-[#00A27F]/20 dark:text-[#00D6AA]"
                          : "text-[#373737] hover:bg-[#00A27F]/8 dark:text-slate-200 dark:hover:bg-[#00A27F]/20",
                      )}
                    >
                      <BarChart3 className="h-5 w-5" />
                      <span>Estadísticas</span>
                    </button>
                  </div>
                )}

              {isAdmin && (
                <div className="mt-2 space-y-1 border-t border-[#D8E3DE] pt-2 dark:border-slate-700">
                  <div className="px-4 py-2 text-xs font-semibold uppercase text-[#6B7280] dark:text-slate-400">
                    Administración
                  </div>

                  <Link
                    href="/admin/users"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                      isActive("/admin/users")
                        ? "bg-[#00A27F]/12 text-[#00A27F] dark:bg-[#00A27F]/20 dark:text-[#00D6AA]"
                        : "text-[#373737] hover:bg-[#00A27F]/8 dark:text-slate-200 dark:hover:bg-[#00A27F]/20",
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
                        ? "bg-[#00A27F]/12 text-[#00A27F] dark:bg-[#00A27F]/20 dark:text-[#00D6AA]"
                        : "text-[#373737] hover:bg-[#00A27F]/8 dark:text-slate-200 dark:hover:bg-[#00A27F]/20",
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
    </>
  );
}