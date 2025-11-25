import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import ResetPasswordConfirmPage from "./page";

// Mock dependencies
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
      updateUser: vi.fn(),
    },
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

describe("ResetPasswordConfirmPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("should show loading state while checking session", async () => {
    const mockGetSession = vi.fn(
      () => new Promise(() => {}), // Never resolves to stay in loading
    );

    const { createClient } = await import("@/lib/supabase/client");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: mockGetSession,
      },
    } as any);

    render(<ResetPasswordConfirmPage />);

    expect(screen.getByText("Verificando...")).toBeInTheDocument();
  });

  it("should show invalid session message when no session exists", async () => {
    const mockGetSession = vi
      .fn()
      .mockResolvedValue({ data: { session: null } });

    const { createClient } = await import("@/lib/supabase/client");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: mockGetSession,
      },
    } as any);

    render(<ResetPasswordConfirmPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Enlace Inválido o Expirado"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Solicitar nuevo enlace" }),
      ).toBeInTheDocument();
    });
  });

  it("should render password reset form with valid session", async () => {
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: "123" } } },
    });

    const { createClient } = await import("@/lib/supabase/client");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: mockGetSession,
        updateUser: vi.fn(),
      },
    } as any);

    render(<ResetPasswordConfirmPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Nueva Contraseña")).toBeInTheDocument();
      expect(screen.getByLabelText("Confirmar Contraseña")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Restablecer contraseña" }),
      ).toBeInTheDocument();
    });
  });

  it("should validate password length", async () => {
    const user = userEvent.setup();
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: "123" } } },
    });

    const { createClient } = await import("@/lib/supabase/client");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: mockGetSession,
        updateUser: vi.fn(),
      },
    } as any);

    render(<ResetPasswordConfirmPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Nueva Contraseña")).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText("Nueva Contraseña");
    const confirmInput = screen.getByLabelText("Confirmar Contraseña");
    const submitButton = screen.getByRole("button", {
      name: "Restablecer contraseña",
    });

    await user.type(passwordInput, "123");
    await user.type(confirmInput, "123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("La contraseña debe tener al menos 6 caracteres"),
      ).toBeInTheDocument();
    });
  });

  it("should validate password match", async () => {
    const user = userEvent.setup();
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: "123" } } },
    });

    const { createClient } = await import("@/lib/supabase/client");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: mockGetSession,
        updateUser: vi.fn(),
      },
    } as any);

    render(<ResetPasswordConfirmPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Nueva Contraseña")).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText("Nueva Contraseña");
    const confirmInput = screen.getByLabelText("Confirmar Contraseña");
    const submitButton = screen.getByRole("button", {
      name: "Restablecer contraseña",
    });

    await user.type(passwordInput, "password123");
    await user.type(confirmInput, "different123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Las contraseñas no coinciden"),
      ).toBeInTheDocument();
    });
  });

  it("should call updateUser with valid passwords", async () => {
    const user = userEvent.setup();
    const mockUpdateUser = vi.fn().mockResolvedValue({ error: null });
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: "123" } } },
    });

    const { createClient } = await import("@/lib/supabase/client");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: mockGetSession,
        updateUser: mockUpdateUser,
      },
    } as any);

    render(<ResetPasswordConfirmPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Nueva Contraseña")).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText("Nueva Contraseña");
    const confirmInput = screen.getByLabelText("Confirmar Contraseña");
    const submitButton = screen.getByRole("button", {
      name: "Restablecer contraseña",
    });

    await user.type(passwordInput, "newpassword123");
    await user.type(confirmInput, "newpassword123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: "newpassword123",
      });
    });
  });

  it("should show success message after password update", async () => {
    const user = userEvent.setup();
    const mockUpdateUser = vi.fn().mockResolvedValue({ error: null });
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: "123" } } },
    });

    const { createClient } = await import("@/lib/supabase/client");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: mockGetSession,
        updateUser: mockUpdateUser,
      },
    } as any);

    render(<ResetPasswordConfirmPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Nueva Contraseña")).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText("Nueva Contraseña");
    const confirmInput = screen.getByLabelText("Confirmar Contraseña");
    const submitButton = screen.getByRole("button", {
      name: "Restablecer contraseña",
    });

    await user.type(passwordInput, "newpassword123");
    await user.type(confirmInput, "newpassword123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Contraseña Actualizada")).toBeInTheDocument();
      expect(
        screen.getByText(/Tu contraseña ha sido actualizada correctamente/),
      ).toBeInTheDocument();
    });
  });

  it("should toggle password visibility", async () => {
    const user = userEvent.setup();
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: "123" } } },
    });

    const { createClient } = await import("@/lib/supabase/client");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: mockGetSession,
        updateUser: vi.fn(),
      },
    } as any);

    render(<ResetPasswordConfirmPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Nueva Contraseña")).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText(
      "Nueva Contraseña",
    ) as HTMLInputElement;

    // Initially password type
    expect(passwordInput.type).toBe("password");

    // Find and click the toggle button (there are two, one for each password field)
    const toggleButtons = screen.getAllByRole("button", { name: "" });
    await user.click(toggleButtons[0]);

    // Should now be text type
    expect(passwordInput.type).toBe("text");
  });
});
