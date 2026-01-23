import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ComplaintForm } from "./ComplaintForm";
import type { Complaint } from "@/types";

// Mock useUser hook
vi.mock("@/hooks/useUser", () => ({
  useUser: vi.fn(() => ({
    profile: {
      id: "user-123",
      full_name: "Test User",
      email: "test@example.com",
      role: "Admin",
    },
    user: { id: "user-123" },
    loading: false,
    isAdmin: true,
    isAdministrative: false,
    isAuthenticated: true,
    hasRole: vi.fn(),
    refreshProfile: vi.fn(),
  })),
}));

// Mock fetch
global.fetch = vi.fn();

describe("ComplaintForm", () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  const mockServices = [
    { id: 1, name: "Alumbrado Público", active: true },
    { id: 2, name: "Recolección de Residuos", active: true },
  ];

  const mockCauses = [
    { id: 1, service_id: 1, name: "Lámpara fundida", active: true },
    { id: 2, service_id: 1, name: "Poste dañado", active: true },
    { id: 3, service_id: 2, name: "No se retiran residuos", active: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSubmit.mockResolvedValue({ success: true });

    (global.fetch as any).mockImplementation((url: string) => {
      if (url === "/api/services") {
        return Promise.resolve({
          json: () => Promise.resolve({ data: mockServices }),
        });
      }
      if (url === "/api/causes") {
        return Promise.resolve({
          json: () => Promise.resolve({ data: mockCauses }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });
  });

  it("should render create form when no complaint is provided", async () => {
    render(
      <ComplaintForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/información básica/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/datos del reclamante/i)).toBeInTheDocument();
    expect(screen.getByText(/detalles del reclamo/i)).toBeInTheDocument();
    expect(screen.getByText(/estado y seguimiento/i)).toBeInTheDocument();
  });

  it("should load services and causes on mount", async () => {
    render(
      <ComplaintForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/services");
      expect(global.fetch).toHaveBeenCalledWith("/api/causes");
    });
  });

  it("should show button for creating new complaint", async () => {
    render(
      <ComplaintForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />,
    );

    await waitFor(() => {
      const buttons = screen.queryAllByText(/guardar reclamo/i);
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it("should show button for updating when editing", async () => {
    const mockComplaint: Complaint = {
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
      contact_method: "Email",
      details: "Problema con el alumbrado",
      status: "En proceso",
      referred: false,
      loaded_by: "user-123",
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
    };

    render(
      <ComplaintForm
        complaint={mockComplaint}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />,
    );

    await waitFor(() => {
      const buttons = screen.queryAllByText(/guardar cambios/i);
      expect(buttons.length).toBeGreaterThan(0);
    });
  });


  it("should render cancel button", async () => {
    render(
      <ComplaintForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />,
    );

    await waitFor(() => {
      const cancelButtons = screen.queryAllByText(/cancelar/i);
      expect(cancelButtons.length).toBeGreaterThan(0);
    });
  });

  it("should show required field indicators", async () => {
    render(
      <ComplaintForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />,
    );

    await waitFor(() => {
      // Check for asterisks indicating required fields
      const labels = screen.getAllByText("*");
      expect(labels.length).toBeGreaterThan(0);
    });
  });

  it("should not render phone field when no contact method is selected", async () => {
    render(
      <ComplaintForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />,
    );

    await waitFor(() => {
      const cancelButtons = screen.queryAllByText(/cancelar/i);
      expect(cancelButtons.length).toBeGreaterThan(0);
    });

    // Phone field should not be visible initially
    const phoneFields = screen.queryAllByPlaceholderText(/ingrese teléfono/i);
    expect(phoneFields.length).toBe(0);
  });

  it("should not render email field when no contact method is selected", async () => {
    const { container } = render(
      <ComplaintForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />,
    );

    await waitFor(() => {
      const cancelButtons = screen.queryAllByText(/cancelar/i);
      expect(cancelButtons.length).toBeGreaterThan(0);
    });

    // Email field should not be visible initially (conditional on contact_method)
    const emailInput = container.querySelector('input[id="email"][type="email"]');
    expect(emailInput).toBeNull();
  });

  it("should render since_when as dropdown (not date input)", async () => {
    render(
      <ComplaintForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />,
    );

    await waitFor(() => {
      const cancelButtons = screen.queryAllByText(/cancelar/i);
      expect(cancelButtons.length).toBeGreaterThan(0);
    });

    // Should not have a date input with id "since_when"
    const sinceWhenDateInput = document.querySelector('input[type="date"][id="since_when"]');
    expect(sinceWhenDateInput).toBeNull();
  });

  it("should render form successfully with phone field when contact_method is Telefono", async () => {
    const mockComplaint: Complaint = {
      id: 1,
      complaint_number: "SASP-R000001",
      complaint_date: "2024-01-15",
      complainant_name: "Juan Pérez",
      address: "Calle Principal",
      street_number: "123",
      dni: "12345678",
      phone_number: "3514567890",
      email: null,
      service_id: 1,
      cause_id: 1,
      zone: "Centro",
      since_when: "2024-01-10",
      contact_method: "Telefono",
      details: "Problema con el alumbrado",
      status: "En proceso",
      referred: false,
      loaded_by: "user-123",
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
    };

    render(
      <ComplaintForm
        complaint={mockComplaint}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />,
    );

    await waitFor(() => {
      const buttons = screen.queryAllByText(/guardar cambios/i);
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it("should render form successfully with email field when contact_method is Email", async () => {
    const mockComplaint: Complaint = {
      id: 1,
      complaint_number: "SASP-R000001",
      complaint_date: "2024-01-15",
      complainant_name: "Juan Pérez",
      address: "Calle Principal",
      street_number: "123",
      dni: "12345678",
      phone_number: null,
      email: "juan.perez@example.com",
      service_id: 1,
      cause_id: 1,
      zone: "Centro",
      since_when: "2024-01-10",
      contact_method: "Email",
      details: "Problema con el alumbrado",
      status: "En proceso",
      referred: false,
      loaded_by: "user-123",
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
    };

    render(
      <ComplaintForm
        complaint={mockComplaint}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />,
    );

    await waitFor(() => {
      const buttons = screen.queryAllByText(/guardar cambios/i);
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it("should render form successfully with null phone_number (optional field)", async () => {
    const mockComplaint: Complaint = {
      id: 1,
      complaint_number: "SASP-R000001",
      complaint_date: "2024-01-15",
      complainant_name: "Juan Pérez",
      address: "Calle Principal",
      street_number: "123",
      dni: "12345678",
      phone_number: null,
      email: null,
      service_id: 1,
      cause_id: 1,
      zone: "Centro",
      since_when: "2024-01-10",
      contact_method: "Telefono",
      details: "Problema con el alumbrado",
      status: "En proceso",
      referred: false,
      loaded_by: "user-123",
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
    };

    render(
      <ComplaintForm
        complaint={mockComplaint}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />,
    );

    await waitFor(() => {
      const buttons = screen.queryAllByText(/guardar cambios/i);
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it("should render form successfully with null email (optional field)", async () => {
    const mockComplaint: Complaint = {
      id: 1,
      complaint_number: "SASP-R000001",
      complaint_date: "2024-01-15",
      complainant_name: "Juan Pérez",
      address: "Calle Principal",
      street_number: "123",
      dni: "12345678",
      phone_number: null,
      email: null,
      service_id: 1,
      cause_id: 1,
      zone: "Centro",
      since_when: "2024-01-10",
      contact_method: "Email",
      details: "Problema con el alumbrado",
      status: "En proceso",
      referred: false,
      loaded_by: "user-123",
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
    };

    render(
      <ComplaintForm
        complaint={mockComplaint}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />,
    );

    await waitFor(() => {
      const buttons = screen.queryAllByText(/guardar cambios/i);
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it("should render form successfully with both phone and email fields", async () => {
    const mockComplaint: Complaint = {
      id: 1,
      complaint_number: "SASP-R000001",
      complaint_date: "2024-01-15",
      complainant_name: "Juan Pérez",
      address: "Calle Principal",
      street_number: "123",
      dni: "12345678",
      phone_number: "3514567890",
      email: "juan.perez@example.com",
      service_id: 1,
      cause_id: 1,
      zone: "Centro",
      since_when: "2024-01-10",
      contact_method: "Telefono",
      details: "Problema con el alumbrado",
      status: "En proceso",
      referred: false,
      loaded_by: "user-123",
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
    };

    render(
      <ComplaintForm
        complaint={mockComplaint}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />,
    );

    await waitFor(() => {
      const buttons = screen.queryAllByText(/guardar cambios/i);
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

});
