import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import SetPasswordPage from "./page";

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

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
  useSearchParams: vi.fn(() => ({
    get: vi.fn(),
  })),
}));

describe("SetPasswordPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("should render password setup form", async () => {
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

    render(<SetPasswordPage />);

    expect(
      screen.getByText("Crea una contraseña segura para acceder al sistema"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nueva Contraseña")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar Contraseña")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Configurar Contraseña" }),
    ).toBeInTheDocument();
  });

  it("should check for existing session on mount", async () => {
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

    render(<SetPasswordPage />);

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalled();
    });
  });

  it("should show error toast when no session exists", async () => {
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: null },
    });

    const mockSearchParams = vi.fn((key: string) => {
      if (key === "error") return "invalid_token";
      if (key === "error_description") return "Token expirado";
      return null;
    });

    const { createClient } = await import("@/lib/supabase/client");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: mockGetSession,
        updateUser: vi.fn(),
      },
    } as any);

    const { useSearchParams } = await import("next/navigation");
    vi.mocked(useSearchParams).mockReturnValue({
      get: mockSearchParams,
    } as any);

    const { toast } = await import("sonner");

    render(<SetPasswordPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Token expirado");
    });
  });

  it("should validate password length (less than 6 characters)", async () => {
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

    const { toast } = await import("sonner");

    render(<SetPasswordPage />);

    const passwordInput = screen.getByLabelText("Nueva Contraseña");
    const confirmInput = screen.getByLabelText("Confirmar Contraseña");
    const submitButton = screen.getByRole("button", {
      name: "Configurar Contraseña",
    });

    await user.type(passwordInput, "123");
    await user.type(confirmInput, "123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "La contraseña debe tener al menos 6 caracteres",
      );
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

    const { toast } = await import("sonner");

    render(<SetPasswordPage />);

    const passwordInput = screen.getByLabelText("Nueva Contraseña");
    const confirmInput = screen.getByLabelText("Confirmar Contraseña");
    const submitButton = screen.getByRole("button", {
      name: "Configurar Contraseña",
    });

    await user.type(passwordInput, "password123");
    await user.type(confirmInput, "different123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Las contraseñas no coinciden");
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

    render(<SetPasswordPage />);

    const passwordInput = screen.getByLabelText("Nueva Contraseña");
    const confirmInput = screen.getByLabelText("Confirmar Contraseña");
    const submitButton = screen.getByRole("button", {
      name: "Configurar Contraseña",
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

  it("should show success message after password setup", async () => {
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

    render(<SetPasswordPage />);

    const passwordInput = screen.getByLabelText("Nueva Contraseña");
    const confirmInput = screen.getByLabelText("Confirmar Contraseña");
    const submitButton = screen.getByRole("button", {
      name: "Configurar Contraseña",
    });

    await user.type(passwordInput, "newpassword123");
    await user.type(confirmInput, "newpassword123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("¡Contraseña configurada!")).toBeInTheDocument();
      expect(
        screen.getByText("Redirigiendo al sistema..."),
      ).toBeInTheDocument();
    });
  });

  it("should redirect to dashboard after successful password setup", async () => {
    const user = userEvent.setup();
    const mockPush = vi.fn();
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

    const { useRouter } = await import("next/navigation");
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
    } as any);

    render(<SetPasswordPage />);

    const passwordInput = screen.getByLabelText("Nueva Contraseña");
    const confirmInput = screen.getByLabelText("Confirmar Contraseña");
    const submitButton = screen.getByRole("button", {
      name: "Configurar Contraseña",
    });

    await user.type(passwordInput, "newpassword123");
    await user.type(confirmInput, "newpassword123");
    await user.click(submitButton);

    // Wait for the timeout in the component (1500ms)
    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      },
      { timeout: 2000 },
    );
  });

  it("should show error message when updateUser fails", async () => {
    const user = userEvent.setup();
    const mockUpdateUser = vi.fn().mockResolvedValue({
      error: { message: "Error de servidor" },
    });
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

    const { toast } = await import("sonner");

    render(<SetPasswordPage />);

    const passwordInput = screen.getByLabelText("Nueva Contraseña");
    const confirmInput = screen.getByLabelText("Confirmar Contraseña");
    const submitButton = screen.getByRole("button", {
      name: "Configurar Contraseña",
    });

    await user.type(passwordInput, "newpassword123");
    await user.type(confirmInput, "newpassword123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Error de servidor");
    });
  });

  it("should disable form inputs while submitting", async () => {
    const user = userEvent.setup();
    const mockUpdateUser = vi
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );
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

    render(<SetPasswordPage />);

    const passwordInput = screen.getByLabelText(
      "Nueva Contraseña",
    ) as HTMLInputElement;
    const confirmInput = screen.getByLabelText(
      "Confirmar Contraseña",
    ) as HTMLInputElement;
    const submitButton = screen.getByRole("button", {
      name: "Configurar Contraseña",
    }) as HTMLButtonElement;

    await user.type(passwordInput, "newpassword123");
    await user.type(confirmInput, "newpassword123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(passwordInput.disabled).toBe(true);
      expect(confirmInput.disabled).toBe(true);
      expect(submitButton.disabled).toBe(true);
      expect(screen.getByText("Configurando...")).toBeInTheDocument();
    });
  });

  it("should show loading spinner in submit button", async () => {
    const user = userEvent.setup();
    const mockUpdateUser = vi
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );
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

    render(<SetPasswordPage />);

    const passwordInput = screen.getByLabelText("Nueva Contraseña");
    const confirmInput = screen.getByLabelText("Confirmar Contraseña");
    const submitButton = screen.getByRole("button", {
      name: "Configurar Contraseña",
    });

    await user.type(passwordInput, "newpassword123");
    await user.type(confirmInput, "newpassword123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Configurando...")).toBeInTheDocument();
    });
  });
});
