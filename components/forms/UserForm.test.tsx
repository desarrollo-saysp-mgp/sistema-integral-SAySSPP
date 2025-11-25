import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { UserForm } from "./UserForm";
import type { User } from "@/types";

describe("UserForm", () => {
  const mockUser: User = {
    id: "1",
    full_name: "Juan Pérez",
    email: "juan@example.com",
    role: "Admin",
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

  it("should render create user form when no user is provided", () => {
    render(
      <UserForm
        user={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText("Crear nuevo usuario")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Completa los datos para crear un nuevo usuario en el sistema.",
      ),
    ).toBeInTheDocument();
  });

  it("should render edit user form when user is provided", () => {
    render(
      <UserForm
        user={mockUser}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText("Editar usuario")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByDisplayValue("juan@example.com")).toBeInTheDocument();
  });

  it("should validate required fields on create", async () => {
    const user = userEvent.setup();
    render(
      <UserForm
        user={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    expect(
      await screen.findByText("El nombre completo es requerido"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("El email es requerido"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("La contraseña es requerida"),
    ).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("should validate email format", async () => {
    const user = userEvent.setup();
    render(
      <UserForm
        user={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    // Fill required fields with email missing domain
    await user.type(screen.getByLabelText(/Nombre completo/i), "Test User");
    const emailInput = screen.getByLabelText(/Email/i);
    await user.type(emailInput, "test@test");
    await user.type(screen.getByLabelText(/Contraseña/i), "password123");

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    await waitFor(
      () => {
        expect(screen.getByText("El email no es válido")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("should validate password length", async () => {
    const user = userEvent.setup();
    render(
      <UserForm
        user={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    const passwordInput = screen.getByLabelText(/Contraseña/i);
    await user.type(passwordInput, "123");

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    expect(
      await screen.findByText("La contraseña debe tener al menos 6 caracteres"),
    ).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("should submit form with valid data for creating user", async () => {
    const user = userEvent.setup();
    render(
      <UserForm
        user={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/Nombre completo/i), "Test User");
    await user.type(screen.getByLabelText(/Email/i), "test@example.com");
    await user.type(screen.getByLabelText(/Contraseña/i), "password123");

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: "Test User",
          email: "test@example.com",
          password: "password123",
          role: "Administrative",
        }),
      );
    });
  });

  it("should submit form with valid data for updating user", async () => {
    const user = userEvent.setup();
    render(
      <UserForm
        user={mockUser}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    const nameInput = screen.getByDisplayValue("Juan Pérez");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Name");

    const submitButton = screen.getByRole("button", { name: "Actualizar" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: "Updated Name",
          email: "juan@example.com",
          role: "Admin",
        }),
      );
    });
  });

  it("should close form on successful submission", async () => {
    const user = userEvent.setup();
    render(
      <UserForm
        user={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/Nombre completo/i), "Test User");
    await user.type(screen.getByLabelText(/Email/i), "test@example.com");
    await user.type(screen.getByLabelText(/Contraseña/i), "password123");

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("should display error message on failed submission", async () => {
    mockOnSubmit.mockResolvedValue({
      success: false,
      error: "Email ya existe",
    });
    const user = userEvent.setup();
    render(
      <UserForm
        user={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/Nombre completo/i), "Test User");
    await user.type(screen.getByLabelText(/Email/i), "test@example.com");
    await user.type(screen.getByLabelText(/Contraseña/i), "password123");

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Email ya existe")).toBeInTheDocument();
    });
    expect(mockOnOpenChange).not.toHaveBeenCalled();
  });

  it("should allow canceling the form", async () => {
    const user = userEvent.setup();
    render(
      <UserForm
        user={null}
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
