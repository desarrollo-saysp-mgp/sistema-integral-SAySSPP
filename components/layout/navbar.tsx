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
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
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
        <div className="hidden md:flex items-center gap-6">
          <NavigationMenu>
            <NavigationMenuList>
              {/* Dashboard */}
              <NavigationMenuItem>
                <Link href="/dashboard" legacyBehavior passHref>
                  <NavigationMenuLink
                    className={cn(
                      navigationMenuTriggerStyle(),
                      "bg-transparent text-white hover:bg-[#5CADEB]/20 hover:text-white flex items-center",
                      isActive("/dashboard") && !pathname?.includes("complaints") && "bg-[#5CADEB] font-semibold"
                    )}
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Dashboard
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>

              {/* Reclamos Dropdown */}
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={cn(
                    "bg-transparent text-white hover:bg-[#5CADEB]/20 hover:text-white data-[state=open]:bg-[#5CADEB]/30",
                    pathname?.includes("complaints") && "bg-[#5CADEB]/20"
                  )}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Reclamos
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[240px] gap-1 p-2">
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/dashboard/complaints/new"
                          className={cn(
                            "block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-[#5CADEB]/10",
                            isActive("/dashboard/complaints/new") && "bg-[#5CADEB]/20"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <PlusCircle className="h-4 w-4 text-[#5CADEB]" />
                            <div className="text-sm font-medium">Nuevo Reclamo</div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Crear un nuevo reclamo ciudadano
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/dashboard/complaints"
                          className={cn(
                            "block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-[#5CADEB]/10",
                            pathname === "/dashboard/complaints" && "bg-[#5CADEB]/20"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-[#5CADEB]" />
                            <div className="text-sm font-medium">Ver Todos</div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Lista completa de reclamos
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              {/* Admin Dropdown - Only for Admins */}
              {isAdmin && (
                <NavigationMenuItem>
                  <NavigationMenuTrigger
                    className={cn(
                      "bg-transparent text-white hover:bg-[#5CADEB]/20 hover:text-white data-[state=open]:bg-[#5CADEB]/30",
                      pathname?.includes("admin") && "bg-[#5CADEB]/20"
                    )}
                  >
                    <FolderKanban className="h-4 w-4 mr-2" />
                    Administración
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[240px] gap-1 p-2">
                      <li>
                        <NavigationMenuLink asChild>
                          <Link
                            href="/admin/users"
                            className={cn(
                              "block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-[#5CADEB]/10",
                              isActive("/admin/users") && "bg-[#5CADEB]/20"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-[#5CADEB]" />
                              <div className="text-sm font-medium">Usuarios</div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Gestionar usuarios del sistema
                            </p>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <Link
                            href="/admin/services"
                            className={cn(
                              "block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-[#5CADEB]/10",
                              isActive("/admin/services") && "bg-[#5CADEB]/20"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <FolderKanban className="h-4 w-4 text-[#5CADEB]" />
                              <div className="text-sm font-medium">Servicios</div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Configurar servicios y causas
                            </p>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              )}
            </NavigationMenuList>
          </NavigationMenu>
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
