import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DashboardLayout } from "./dashboard-layout";

// Mock Navbar component
vi.mock("./navbar", () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    cleanup();
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
});
