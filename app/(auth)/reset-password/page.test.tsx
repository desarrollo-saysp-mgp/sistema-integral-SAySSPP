import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import ResetPasswordPage from "./page";

// Mock dependencies
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      resetPasswordForEmail: vi.fn(),
    },
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("should render the password reset form", () => {
    render(<ResetPasswordPage />);

    expect(screen.getByText("Recuperar Contraseña")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ingresa tu email para recibir un enlace de recuperación",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enviar enlace de recuperación" }),
    ).toBeInTheDocument();
  });

  it("should have a link back to login", () => {
    render(<ResetPasswordPage />);

    const loginLink = screen.getByRole("link", {
      name: /volver al inicio de sesión/i,
    });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");
  });

  it("should validate email format", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    const emailInput = screen.getByLabelText("Email");
    const submitButton = screen.getByRole("button", {
      name: "Enviar enlace de recuperación",
    });

    // Try with invalid email (passes HTML5 validation but fails our regex)
    await user.type(emailInput, "test@test");
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Por favor ingresa un email válido"),
      ).toBeInTheDocument();
    });
  });

  it("should call resetPasswordForEmail with valid email", async () => {
    const user = userEvent.setup();
    const mockResetPasswordForEmail = vi
      .fn()
      .mockResolvedValue({ error: null });

    const { createClient } = await import("@/lib/supabase/client");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        resetPasswordForEmail: mockResetPasswordForEmail,
      },
    } as any);

    render(<ResetPasswordPage />);

    const emailInput = screen.getByLabelText("Email");
    const submitButton = screen.getByRole("button", {
      name: "Enviar enlace de recuperación",
    });

    await user.type(emailInput, "test@example.com");
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "test@example.com",
        expect.objectContaining({
          redirectTo: expect.stringContaining("/reset-password/confirm"),
        }),
      );
    });
  });

  it("should show success message after sending reset email", async () => {
    const user = userEvent.setup();
    const mockResetPasswordForEmail = vi
      .fn()
      .mockResolvedValue({ error: null });

    const { createClient } = await import("@/lib/supabase/client");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        resetPasswordForEmail: mockResetPasswordForEmail,
      },
    } as any);

    render(<ResetPasswordPage />);

    const emailInput = screen.getByLabelText("Email");
    const submitButton = screen.getByRole("button", {
      name: "Enviar enlace de recuperación",
    });

    await user.type(emailInput, "test@example.com");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Email Enviado")).toBeInTheDocument();
      expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
    });
  });

  it("should show error message on reset failure", async () => {
    const user = userEvent.setup();
    const mockResetPasswordForEmail = vi
      .fn()
      .mockResolvedValue({ error: { message: "Email not found" } });

    const { createClient } = await import("@/lib/supabase/client");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        resetPasswordForEmail: mockResetPasswordForEmail,
      },
    } as any);

    render(<ResetPasswordPage />);

    const emailInput = screen.getByLabelText("Email");
    const submitButton = screen.getByRole("button", {
      name: "Enviar enlace de recuperación",
    });

    await user.type(emailInput, "test@example.com");
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Error al enviar el email de recuperación/),
      ).toBeInTheDocument();
    });
  });

  it("should disable submit button while loading", async () => {
    const user = userEvent.setup();
    const mockResetPasswordForEmail = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ error: null }), 100),
          ),
      );

    const { createClient } = await import("@/lib/supabase/client");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        resetPasswordForEmail: mockResetPasswordForEmail,
      },
    } as any);

    render(<ResetPasswordPage />);

    const emailInput = screen.getByLabelText("Email");
    const submitButton = screen.getByRole("button", {
      name: "Enviar enlace de recuperación",
    });

    await user.type(emailInput, "test@example.com");
    await user.click(submitButton);

    // Button should be disabled and show loading text
    expect(submitButton).toBeDisabled();
    expect(screen.getByText("Enviando...")).toBeInTheDocument();
  });
});
