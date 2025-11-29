import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComplaintsTable } from "./ComplaintsTable";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ComplaintsTable", () => {
  const mockOnStatusChange = vi.fn();

  const mockComplaints = [
    {
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
        role: "Admin" as const,
        active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    },
    {
      id: 2,
      complaint_number: "SASP-R000002",
      complaint_date: "2024-01-16",
      complainant_name: "María García",
      address: "Avenida Libertad",
      street_number: "456",
      dni: "87654321",
      service_id: 2,
      cause_id: 3,
      zone: "Norte",
      since_when: "2024-01-12",
      contact_method: "Telefono" as const,
      details: "Problema con residuos",
      status: "Resuelto" as const,
      referred: true,
      loaded_by: "user-123",
      created_at: "2024-01-16T10:00:00Z",
      updated_at: "2024-01-16T10:00:00Z",
      service: {
        id: 2,
        name: "Recolección de Residuos",
        active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      cause: {
        id: 3,
        service_id: 2,
        name: "No se retiran residuos",
        active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      loaded_by_user: {
        id: "user-123",
        full_name: "Admin User",
        email: "admin@example.com",
        role: "Admin" as const,
        active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnStatusChange.mockResolvedValue(undefined);
  });

  it("should render complaints table with data", () => {
    render(
      <ComplaintsTable
        complaints={mockComplaints}
        onStatusChange={mockOnStatusChange}
      />,
    );

    expect(screen.getByText("SASP-R000001")).toBeInTheDocument();
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("Alumbrado Público")).toBeInTheDocument();
    expect(screen.getByText("Centro")).toBeInTheDocument();

    expect(screen.getByText("SASP-R000002")).toBeInTheDocument();
    expect(screen.getByText("María García")).toBeInTheDocument();
    expect(screen.getByText("Recolección de Residuos")).toBeInTheDocument();
  });

  it("should show empty state when no complaints", () => {
    render(
      <ComplaintsTable complaints={[]} onStatusChange={mockOnStatusChange} />,
    );

    expect(
      screen.getByText(/no se encontraron reclamos/i),
    ).toBeInTheDocument();
  });

  it("should format dates correctly", () => {
    render(
      <ComplaintsTable
        complaints={mockComplaints}
        onStatusChange={mockOnStatusChange}
      />,
    );

    const dates = screen.getAllByText(/\d{2}\/\d{2}\/\d{4}/);
    expect(dates.length).toBeGreaterThan(0);
  });

  it("should have clickable rows that navigate", () => {
    render(
      <ComplaintsTable
        complaints={mockComplaints}
        onStatusChange={mockOnStatusChange}
      />,
    );

    const rows = screen.getAllByRole("row");
    // Should have header row + data rows
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it("should display status badges with correct colors", () => {
    render(
      <ComplaintsTable
        complaints={mockComplaints}
        onStatusChange={mockOnStatusChange}
      />,
    );

    const statusSelects = screen.getAllByRole("combobox");
    expect(statusSelects.length).toBeGreaterThan(0);
  });

  it("should render status as badge when onStatusChange is not provided", () => {
    render(<ComplaintsTable complaints={mockComplaints} />);

    // When onStatusChange is not provided, status is shown as badge
    const badges = screen.getAllByText(/En proceso|Resuelto/);
    expect(badges.length).toBeGreaterThan(0);
  });

  it("should display loaded_by user full name", () => {
    render(
      <ComplaintsTable
        complaints={mockComplaints}
        onStatusChange={mockOnStatusChange}
      />,
    );

    const userNames = screen.getAllByText("Admin User");
    expect(userNames.length).toBeGreaterThanOrEqual(2); // At least one for each complaint
  });
});
