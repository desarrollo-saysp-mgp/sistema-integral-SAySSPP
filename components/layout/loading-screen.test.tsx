import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LoadingScreen } from "./loading-screen";

describe("LoadingScreen", () => {
  beforeEach(() => {
    cleanup();
  });

  it("should render with default message", () => {
    render(<LoadingScreen />);

    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });

  it("should render with custom message", () => {
    render(<LoadingScreen message="Verificando sesión..." />);

    expect(screen.getByText("Verificando sesión...")).toBeInTheDocument();
  });

  it("should display SGR logo", () => {
    render(<LoadingScreen />);

    expect(screen.getByText("SGR")).toBeInTheDocument();
  });

  it("should display system name", () => {
    render(<LoadingScreen />);

    expect(screen.getByText("Sistema de Gestión de Reclamos")).toBeInTheDocument();
  });

  it("should have spinner animation", () => {
    const { container } = render(<LoadingScreen />);

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });
});
