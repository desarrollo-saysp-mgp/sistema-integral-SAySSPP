import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DashboardLayout } from "./dashboard-layout";

// Mock Navbar component
vi.mock("./navbar", () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}));

// Mock LoadingScreen component
vi.mock("./loading-screen", () => ({
  LoadingScreen: ({ message }: { message: string }) => (
    <div data-testid="loading-screen">{message}</div>
  ),
}));

// Mock useUser hook
const mockUseUser = vi.fn();
vi.mock("@/hooks/useUser", () => ({
  useUser: () => mockUseUser(),
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    cleanup();
    // Default to loaded state with profile
    mockUseUser.mockReturnValue({
      loading: false,
      profile: {
        id: "user-123",
        full_name: "Test User",
        email: "test@example.com",
        role: "Admin",
      },
      user: { id: "user-123" },
      isAdmin: true,
      isAdministrative: false,
      isAuthenticated: true,
    });
  });

  it("should render children content", () => {
    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>,
    );

    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("should render Navbar component", () => {
    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>,
    );

    expect(screen.getByTestId("navbar")).toBeInTheDocument();
  });

  it("should wrap content in main tag", () => {
    const { container } = render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>,
    );

    const mainElement = container.querySelector("main");
    expect(mainElement).toBeInTheDocument();
    expect(mainElement).toHaveTextContent("Content");
  });

  it("should apply correct layout structure", () => {
    const { container } = render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>,
    );

    // Should have flex column layout
    const layoutDiv = container.firstChild as HTMLElement;
    expect(layoutDiv).toHaveClass("flex");
    expect(layoutDiv).toHaveClass("min-h-screen");
    expect(layoutDiv).toHaveClass("flex-col");
  });

  it("should show loading screen when loading", () => {
    mockUseUser.mockReturnValue({
      loading: true,
      profile: null,
      user: null,
      isAdmin: false,
      isAdministrative: false,
      isAuthenticated: false,
    });

    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>,
    );

    expect(screen.getByTestId("loading-screen")).toBeInTheDocument();
    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });

  it("should show verifying session when no profile", () => {
    mockUseUser.mockReturnValue({
      loading: false,
      profile: null,
      user: { id: "user-123" },
      isAdmin: false,
      isAdministrative: false,
      isAuthenticated: true,
    });

    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>,
    );

    expect(screen.getByTestId("loading-screen")).toBeInTheDocument();
    expect(screen.getByText("Verificando sesión...")).toBeInTheDocument();
  });
});
