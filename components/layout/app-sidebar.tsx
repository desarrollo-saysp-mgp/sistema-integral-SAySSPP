"use client";

import { useUser } from "@/hooks/useUser";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  FileText,
  PlusCircle,
  Settings,
  Users,
  FolderKanban,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Inicio",
    href: "/dashboard",
    icon: Home,
    roles: ["Admin", "Administrative"],
  },
  {
    title: "Nuevo Reclamo",
    href: "/dashboard/complaints/new",
    icon: PlusCircle,
    roles: ["Admin", "Administrative"],
  },
  {
    title: "Ver Reclamos",
    href: "/dashboard/complaints",
    icon: FileText,
    roles: ["Admin", "Administrative"],
  },
];

const adminItems = [
  {
    title: "Usuarios",
    href: "/admin/users",
    icon: Users,
    roles: ["Admin"],
  },
  {
    title: "Servicios",
    href: "/admin/services",
    icon: FolderKanban,
    roles: ["Admin"],
  },
];

export function AppSidebar() {
  const { profile } = useUser();
  const pathname = usePathname();

  const canAccess = (allowedRoles: string[]) => {
    return profile && allowedRoles.includes(profile.role);
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  return (
    <Sidebar>
      <SidebarContent className="bg-white border-r border-[#D9DDE3]">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[#0E3F75] font-semibold">
            Navegación Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                if (!canAccess(item.roles)) return null;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      className="data-[active=true]:bg-[#5CADEB] data-[active=true]:text-white hover:bg-[#88C1ED]/20"
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Section - Only visible to Admin users */}
        {profile?.role === "Admin" && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[#0E3F75] font-semibold">
              Administración
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      className="data-[active=true]:bg-[#5CADEB] data-[active=true]:text-white hover:bg-[#88C1ED]/20"
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
