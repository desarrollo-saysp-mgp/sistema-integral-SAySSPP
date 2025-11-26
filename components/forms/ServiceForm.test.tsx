import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ServiceForm } from "./ServiceForm";
import type { Service } from "@/types";

describe("ServiceForm", () => {
  const mockService: Service = {
    id: 1,
    name: "Alumbrado Público",
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

  it("should render create service form when no service is provided", () => {
    render(
      <ServiceForm
        service={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText("Crear nuevo servicio")).toBeInTheDocument();
    expect(
      screen.getByText(/Ingresa el nombre para el nuevo servicio/),
    ).toBeInTheDocument();
  });

  it("should render edit service form when service is provided", () => {
    render(
      <ServiceForm
        service={mockService}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText("Editar servicio")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Alumbrado Público"),
    ).toBeInTheDocument();
  });

  it("should validate required name field", async () => {
    const user = userEvent.setup();
    render(
      <ServiceForm
        service={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    expect(
      await screen.findByText("El nombre del servicio es requerido"),
    ).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("should submit form with valid data for creating service", async () => {
    const user = userEvent.setup();
    render(
      <ServiceForm
        service={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.type(
      screen.getByLabelText(/Nombre del servicio/i),
      "New Service",
    );

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Service",
        }),
      );
    });
  });

  it("should submit form with valid data for updating service", async () => {
    const user = userEvent.setup();
    render(
      <ServiceForm
        service={mockService}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    const nameInput = screen.getByDisplayValue("Alumbrado Público");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Service");

    const submitButton = screen.getByRole("button", { name: "Actualizar" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Service",
        }),
      );
    });
  });

  it("should close form on successful submission", async () => {
    const user = userEvent.setup();
    render(
      <ServiceForm
        service={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.type(
      screen.getByLabelText(/Nombre del servicio/i),
      "New Service",
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
      error: "El servicio ya existe",
    });
    const user = userEvent.setup();
    render(
      <ServiceForm
        service={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.type(
      screen.getByLabelText(/Nombre del servicio/i),
      "Duplicate Service",
    );

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("El servicio ya existe")).toBeInTheDocument();
    });
    expect(mockOnOpenChange).not.toHaveBeenCalled();
  });

  it("should allow canceling the form", async () => {
    const user = userEvent.setup();
    render(
      <ServiceForm
        service={null}
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
