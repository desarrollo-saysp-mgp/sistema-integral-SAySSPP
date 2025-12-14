import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Layout from "./layout";

// Mock the DashboardLayout component
vi.mock("@/components/layout/dashboard-layout", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

describe("Admin Layout", () => {
  afterEach(() => {
    cleanup();
  });
  it("should render children within DashboardLayout", () => {
    render(
      <Layout>
        <div>Admin Content</div>
      </Layout>
    );

    expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();
    expect(screen.getByText("Admin Content")).toBeInTheDocument();
  });

  it("should wrap all admin pages with DashboardLayout", () => {
    const { container } = render(
      <Layout>
        <div>Admin Page</div>
      </Layout>
    );

    expect(container.querySelector('[data-testid="dashboard-layout"]')).toBeInTheDocument();
  });

  it("should use the same layout component as dashboard pages", () => {
    const { container } = render(
      <Layout>
        <div>Admin Users Page</div>
      </Layout>
    );

    // Verify it uses DashboardLayout which includes the navbar with role-based menu
    expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();
  });
});
