import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ComplaintDetailPage from "./page";

// Mock next/navigation
const mockPush = vi.fn();
const mockParams = { id: "1" };
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useParams: () => mockParams,
}));

// Mock useUser hook
const mockUseUser = vi.fn();
vi.mock("@/hooks/useUser", () => ({
  useUser: () => mockUseUser(),
}));

// Mock ComplaintForm
vi.mock("@/components/forms/ComplaintForm", () => ({
  ComplaintForm: ({ complaint, onSubmit, onCancel }: any) => (
    <div data-testid="complaint-form">
      <div>Form for complaint: {complaint?.complaint_number}</div>
      <button onClick={() => onSubmit({})}>Submit</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe("ComplaintDetailPage", () => {
  const mockComplaint = {
    id: 1,
    complaint_number: "SASP-R000001",
    complaint_date: "2024-01-15",
    complainant_name: "Juan Pérez",
    address: "Calle Principal",
    street_number: "123",
    dni: "12345678",
    service_id: 1,
    cause_id: 1,
    zone: "Centro",
    since_when: "2024-01-10",
    contact_method: "Email" as const,
    details: "Problema con el alumbrado",
    status: "En proceso" as const,
    referred: false,
    loaded_by: "user-123",
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      profile: { id: "user-123", full_name: "Test User", role: "Admin" },
      user: { id: "user-123" },
      loading: false,
      isAdmin: true,
      isAdministrative: false,
      isAuthenticated: true,
    });
  });

  it("should show loading state initially", () => {
    (global.fetch as any).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(<ComplaintDetailPage />);

    expect(screen.getByText("Cargando reclamo...")).toBeInTheDocument();
  });

  it("should fetch and display complaint data", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockComplaint }),
    });

    render(<ComplaintDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Reclamo SASP-R000001")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Form for complaint: SASP-R000001"),
    ).toBeInTheDocument();
  });

  it("should show error and redirect if complaint not found", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Reclamo no encontrado" }),
    });

    render(<ComplaintDetailPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/complaints");
    });
  });

  it("should render form for editing", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockComplaint }),
    });

    render(<ComplaintDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId("complaint-form")).toBeInTheDocument();
    });
  });

  it("should display complaint number in header", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockComplaint }),
    });

    render(<ComplaintDetailPage />);

    await waitFor(() => {
      const headers = screen.getAllByText(/Reclamo SASP-R000001/);
      expect(headers.length).toBeGreaterThan(0);
    });
  });

  it("should show delete button for admin users", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockComplaint }),
    });

    render(<ComplaintDetailPage />);

    await waitFor(async () => {
      const deleteButtons = await screen.findAllByText("Eliminar Reclamo");
      expect(deleteButtons.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("should render form for non-admin users", async () => {
    mockUseUser.mockReturnValue({
      profile: {
        id: "user-123",
        full_name: "Test User",
        role: "Administrative",
      },
      user: { id: "user-123" },
      loading: false,
      isAdmin: false,
      isAdministrative: true,
      isAuthenticated: true,
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockComplaint }),
    });

    render(<ComplaintDetailPage />);

    await waitFor(async () => {
      const forms = await screen.findAllByTestId("complaint-form");
      expect(forms.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("should render back button", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockComplaint }),
    });

    render(<ComplaintDetailPage />);

    await waitFor(async () => {
      const backButtons = await screen.findAllByText("Volver");
      expect(backButtons.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("should render edit instructions", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockComplaint }),
    });

    render(<ComplaintDetailPage />);

    await waitFor(async () => {
      const instructions = await screen.findAllByText("Editar información del reclamo");
      expect(instructions.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });
});
