import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Layout from "./layout";

// Mock the DashboardLayout component
vi.mock("@/components/layout/dashboard-layout", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

describe("Dashboard Layout", () => {
  afterEach(() => {
    cleanup();
  });
  it("should render children within DashboardLayout", () => {
    render(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );

    expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("should wrap all dashboard pages with DashboardLayout", () => {
    const { container } = render(
      <Layout>
        <div>Dashboard Page</div>
      </Layout>
    );

    expect(container.querySelector('[data-testid="dashboard-layout"]')).toBeInTheDocument();
  });
});
