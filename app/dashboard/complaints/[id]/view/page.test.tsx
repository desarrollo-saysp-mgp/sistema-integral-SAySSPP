import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ComplaintViewPage from "./page";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useParams: () => ({
    id: "1",
  }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ComplaintViewPage", () => {
  const mockComplaint = {
    id: 1,
    complaint_number: "SASP-R000001",
    complaint_date: "2024-01-15",
    complainant_name: "Juan Pérez",
    address: "Calle Principal",
    street_number: "123",
    dni: "12345678",
    phone_number: null,
    email: "juan@example.com",
    service_id: 1,
    cause_id: 1,
    zone: "Centro",
    since_when: "2024-01-10",
    contact_method: "Email",
    details: "Problema con el alumbrado público",
    status: "En proceso",
    referred: false,
    loaded_by: "user-123",
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
    service: {
      id: 1,
      name: "Alumbrado Público",
      active: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    cause: {
      id: 1,
      service_id: 1,
      name: "Lámpara fundida",
      active: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    loaded_by_user: {
      id: "user-123",
      full_name: "Admin User",
      email: "admin@example.com",
      role: "Admin",
      active: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<ComplaintViewPage />);

    expect(screen.getByText("Cargando reclamo...")).toBeInTheDocument();
  });

  it("should render complaint details when loaded", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockComplaint }),
    });

    render(<ComplaintViewPage />);

    await waitFor(() => {
      expect(screen.getByText("SASP-R000001")).toBeInTheDocument();
    });

    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("Calle Principal")).toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();
    expect(screen.getByText("Centro")).toBeInTheDocument();
    expect(screen.getByText("Alumbrado Público")).toBeInTheDocument();
    expect(screen.getByText("Lámpara fundida")).toBeInTheDocument();
    expect(screen.getByText("Problema con el alumbrado público")).toBeInTheDocument();
  });

  it("should show status badge", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockComplaint }),
    });

    render(<ComplaintViewPage />);

    await waitFor(() => {
      const statusBadges = screen.getAllByText("En proceso");
      expect(statusBadges.length).toBeGreaterThan(0);
    });
  });

  it("should show email when contact method is Email", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockComplaint }),
    });

    render(<ComplaintViewPage />);

    await waitFor(() => {
      const emails = screen.getAllByText("juan@example.com");
      expect(emails.length).toBeGreaterThan(0);
    });
  });

  it("should show phone when contact method is Telefono", async () => {
    const complaintWithPhone = {
      ...mockComplaint,
      contact_method: "Telefono",
      phone_number: "1234567890",
      email: null,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: complaintWithPhone }),
    });

    render(<ComplaintViewPage />);

    await waitFor(() => {
      expect(screen.getByText("1234567890")).toBeInTheDocument();
    });
  });

  it("should have edit button that navigates to edit page", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockComplaint }),
    });

    render(<ComplaintViewPage />);

    await waitFor(() => {
      const editButtons = screen.getAllByText("Editar Reclamo");
      expect(editButtons.length).toBeGreaterThan(0);
    });
  });

  it("should have back button", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockComplaint }),
    });

    render(<ComplaintViewPage />);

    await waitFor(() => {
      const backButtons = screen.getAllByText("Volver");
      expect(backButtons.length).toBeGreaterThan(0);
    });
  });

  it("should redirect to complaints list on error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Reclamo no encontrado" }),
    });

    render(<ComplaintViewPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/complaints");
    });
  });

  it("should show loaded by user name", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockComplaint }),
    });

    render(<ComplaintViewPage />);

    await waitFor(() => {
      const userNames = screen.getAllByText("Admin User");
      expect(userNames.length).toBeGreaterThan(0);
    });
  });
});
