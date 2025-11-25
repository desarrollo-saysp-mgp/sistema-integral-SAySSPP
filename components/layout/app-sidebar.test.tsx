import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AppSidebar } from "./app-sidebar";

// Mock dependencies
vi.mock("@/hooks/useUser", () => ({
  useUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
}));

// Mock Sidebar components
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: any) => <div data-testid="sidebar">{children}</div>,
  SidebarContent: ({ children }: any) => <div>{children}</div>,
  SidebarGroup: ({ children }: any) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: any) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: any) => <div>{children}</div>,
  SidebarMenu: ({ children }: any) => <ul>{children}</ul>,
  SidebarMenuButton: ({ children, asChild }: any) => <li>{children}</li>,
  SidebarMenuItem: ({ children }: any) => <div>{children}</div>,
}));

describe("AppSidebar", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("should render navigation items for Administrative user", async () => {
    const { useUser } = await import("@/hooks/useUser");
    vi.mocked(useUser).mockReturnValue({
      user: { id: "123" } as any,
      profile: {
        id: "123",
        email: "user@example.com",
        full_name: "Regular User",
        role: "Administrative",
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
      loading: false,
      isAdmin: false,
      isAuthenticated: true,
      refreshProfile: vi.fn(),
    });

    render(<AppSidebar />);

    // Check main navigation items
    expect(screen.getByText("Inicio")).toBeInTheDocument();
    expect(screen.getByText("Nuevo Reclamo")).toBeInTheDocument();
    expect(screen.getByText("Ver Reclamos")).toBeInTheDocument();

    // Admin items should NOT be visible
    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
    expect(screen.queryByText("Servicios")).not.toBeInTheDocument();
  });

  it("should render admin section for Admin user", async () => {
    const { useUser } = await import("@/hooks/useUser");
    vi.mocked(useUser).mockReturnValue({
      user: { id: "123" } as any,
      profile: {
        id: "123",
        email: "admin@example.com",
        full_name: "Admin User",
        role: "Admin",
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
      loading: false,
      isAdmin: true,
      isAuthenticated: true,
      refreshProfile: vi.fn(),
    });

    render(<AppSidebar />);

    // Check main navigation items
    expect(screen.getByText("Inicio")).toBeInTheDocument();
    expect(screen.getByText("Nuevo Reclamo")).toBeInTheDocument();
    expect(screen.getByText("Ver Reclamos")).toBeInTheDocument();

    // Admin items SHOULD be visible
    expect(screen.getByText("Administración")).toBeInTheDocument();
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Servicios")).toBeInTheDocument();
  });

  it("should render navigation principal label", async () => {
    const { useUser } = await import("@/hooks/useUser");
    vi.mocked(useUser).mockReturnValue({
      user: { id: "123" } as any,
      profile: {
        id: "123",
        email: "user@example.com",
        full_name: "User",
        role: "Administrative",
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
      loading: false,
      isAdmin: false,
      isAuthenticated: true,
      refreshProfile: vi.fn(),
    });

    render(<AppSidebar />);

    expect(screen.getByText("Navegación Principal")).toBeInTheDocument();
  });
});
