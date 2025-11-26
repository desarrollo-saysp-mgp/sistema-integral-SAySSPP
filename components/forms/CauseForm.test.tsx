import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { CauseForm } from "./CauseForm";
import type { Cause, Service } from "@/types";

describe("CauseForm", () => {
  const mockService: Service = {
    id: 1,
    name: "Alumbrado Público",
    active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  const mockCause: Cause = {
    id: 1,
    service_id: 1,
    name: "Lámpara fundida",
    active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  const mockOnSubmit = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockOnSubmit.mockResolvedValue({ success: true });
  });

  it("should render create cause form when no cause is provided", () => {
    render(
      <CauseForm
        cause={null}
        service={mockService}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText("Crear nueva causa")).toBeInTheDocument();
    expect(
      screen.getByText(/Ingresa el nombre para la nueva causa de/),
    ).toBeInTheDocument();
    expect(screen.getByText("Alumbrado Público")).toBeInTheDocument();
  });

  it("should render edit cause form when cause is provided", () => {
    render(
      <CauseForm
        cause={mockCause}
        service={mockService}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText("Editar causa")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lámpara fundida")).toBeInTheDocument();
  });

  it("should display service name as read-only", () => {
    render(
      <CauseForm
        cause={null}
        service={mockService}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    const serviceField = screen.getByText("Alumbrado Público");
    expect(serviceField).toBeInTheDocument();
    expect(serviceField.closest("div")).toHaveClass("bg-muted");
  });

  it("should validate required name field", async () => {
    const user = userEvent.setup();
    render(
      <CauseForm
        cause={null}
        service={mockService}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    expect(
      await screen.findByText("El nombre de la causa es requerido"),
    ).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("should submit form with valid data for creating cause", async () => {
    const user = userEvent.setup();
    render(
      <CauseForm
        cause={null}
        service={mockService}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.type(
      screen.getByLabelText(/Nombre de la causa/i),
      "New Cause",
    );

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Cause",
          service_id: 1,
        }),
      );
    });
  });

  it("should submit form with valid data for updating cause", async () => {
    const user = userEvent.setup();
    render(
      <CauseForm
        cause={mockCause}
        service={mockService}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    const nameInput = screen.getByDisplayValue("Lámpara fundida");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Cause");

    const submitButton = screen.getByRole("button", { name: "Actualizar" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Cause",
          service_id: 1,
        }),
      );
    });
  });

  it("should close form on successful submission", async () => {
    const user = userEvent.setup();
    render(
      <CauseForm
        cause={null}
        service={mockService}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.type(
      screen.getByLabelText(/Nombre de la causa/i),
      "New Cause",
    );

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("should display error message on failed submission", async () => {
    mockOnSubmit.mockResolvedValue({
      success: false,
      error: "La causa ya existe",
    });
    const user = userEvent.setup();
    render(
      <CauseForm
        cause={null}
        service={mockService}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.type(
      screen.getByLabelText(/Nombre de la causa/i),
      "Duplicate Cause",
    );

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("La causa ya existe")).toBeInTheDocument();
    });
    expect(mockOnOpenChange).not.toHaveBeenCalled();
  });

  it("should allow canceling the form", async () => {
    const user = userEvent.setup();
    render(
      <CauseForm
        cause={null}
        service={mockService}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
