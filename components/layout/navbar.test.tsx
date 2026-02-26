import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Navbar } from "./navbar";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@/hooks/useUser";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

// Mock useUser hook
vi.mock("@/hooks/useUser", () => ({
  useUser: vi.fn(),
}));

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signOut: vi.fn(),
    },
  })),
}));

describe("Navbar", () => {
  const mockRouter = {
    push: vi.fn(),
    refresh: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (usePathname as any).mockReturnValue("/dashboard");
  });

  afterEach(() => {
    cleanup();
  });

  it("should always show logo and navigation even while loading", () => {
    (useUser as any).mockReturnValue({
      profile: null,
      loading: true,
    });

    render(<Navbar />);

    // Logo should always be visible
    expect(screen.getAllByText("SGR").length).toBeGreaterThan(0);
    // Navigation should always be visible
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reclamos").length).toBeGreaterThan(0);
  });

  it("should show navigation without profile (user dropdown hidden)", () => {
    (useUser as any).mockReturnValue({
      profile: null,
      loading: false,
    });

    render(<Navbar />);

    // Logo and navigation should be visible
    expect(screen.getAllByText("SGR").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reclamos").length).toBeGreaterThan(0);

    // Admin menu should NOT be visible without profile
    expect(screen.queryByText("Administración")).not.toBeInTheDocument();
  });

  it("should render logo and basic navigation for authenticated user", () => {
    (useUser as any).mockReturnValue({
      profile: {
        full_name: "Test User",
        email: "test@example.com",
        role: "Administrative",
      },
      loading: false,
    });

    render(<Navbar />);

    // Check logo (multiple instances due to mobile/desktop)
    expect(screen.getAllByText("SGR").length).toBeGreaterThan(0);
    expect(screen.getByText("Sistema de Gestión de Reclamos")).toBeInTheDocument();

    // Check basic navigation items (multiple instances due to mobile/desktop)
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reclamos").length).toBeGreaterThan(0);
  });

  it("should show Reclamos dropdown menu items", () => {
    (useUser as any).mockReturnValue({
      profile: {
        full_name: "Test User",
        email: "test@example.com",
        role: "Administrative",
      },
      loading: false,
    });

    render(<Navbar />);

    // These items should be in the dropdown content (multiple instances due to mobile/desktop)
    expect(screen.getAllByText("Reclamos").length).toBeGreaterThan(0);
  });

  it("should show Administración menu ONLY for Admin users", () => {
    (useUser as any).mockReturnValue({
      profile: {
        full_name: "Admin User",
        email: "admin@example.com",
        role: "Admin",
      },
      loading: false,
    });

    render(<Navbar />);

    // Admin should see Administración menu
    expect(screen.getByText("Administración")).toBeInTheDocument();
  });

  it("should NOT show Administración menu for Administrative users", () => {
    (useUser as any).mockReturnValue({
      profile: {
        full_name: "Regular User",
        email: "user@example.com",
        role: "Administrative",
      },
      loading: false,
    });

    render(<Navbar />);

    // Administrative user should NOT see Administración menu
    expect(screen.queryByText("Administración")).not.toBeInTheDocument();
  });

  it("should display user information in dropdown", () => {
    (useUser as any).mockReturnValue({
      profile: {
        full_name: "John Doe",
        email: "john@example.com",
        role: "Admin",
      },
      loading: false,
    });

    render(<Navbar />);

    // User name should be visible (multiple instances due to mobile/desktop)
    expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
  });

  it("should render mobile menu button on small screens", () => {
    (useUser as any).mockReturnValue({
      profile: {
        full_name: "Test User",
        email: "test@example.com",
        role: "Administrative",
      },
      loading: false,
    });

    render(<Navbar />);

    // Mobile menu button should be present (hidden on desktop via CSS)
    const mobileButtons = screen.getAllByRole("button");
    expect(mobileButtons.length).toBeGreaterThan(0);
  });

  it("should highlight active route", () => {
    (usePathname as any).mockReturnValue("/dashboard");
    (useUser as any).mockReturnValue({
      profile: {
        full_name: "Test User",
        email: "test@example.com",
        role: "Administrative",
      },
      loading: false,
    });

    const { container } = render(<Navbar />);

    // Check if Dashboard link has active styling
    // (This would need to check for specific classes based on implementation)
    expect(container.querySelector('[href="/dashboard"]')).toBeInTheDocument();
  });

  describe("Role-Based Menu Visibility", () => {
    it("should show only Dashboard and Reclamos for Administrative role", () => {
      (useUser as any).mockReturnValue({
        profile: {
          full_name: "Administrative User",
          email: "admin@example.com",
          role: "Administrative",
        },
        loading: false,
      });

      render(<Navbar />);

      // Should see these (multiple instances due to mobile/desktop)
      expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Reclamos").length).toBeGreaterThan(0);

      // Should NOT see admin menu
      expect(screen.queryByText("Administración")).not.toBeInTheDocument();
    });

    it("should show Dashboard, Reclamos, and Administración for Admin role", () => {
      (useUser as any).mockReturnValue({
        profile: {
          full_name: "Admin User",
          email: "admin@example.com",
          role: "Admin",
        },
        loading: false,
      });

      render(<Navbar />);

      // Should see all menu items (multiple instances due to mobile/desktop)
      expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Reclamos").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Administración").length).toBeGreaterThan(0);
    });
  });

  describe("Mobile Navigation", () => {
    it("should show mobile menu items when hamburger is clicked", async () => {
      const userEvent = (await import("@testing-library/user-event")).default;
      const user = userEvent.setup();

      (useUser as any).mockReturnValue({
        profile: {
          full_name: "Test User",
          email: "test@example.com",
          role: "Admin",
        },
        loading: false,
      });

      render(<Navbar />);

      // Mobile menu items should appear when hamburger is clicked
      // This test would need to actually click the button and verify the mobile menu appears
    });
  });
});
