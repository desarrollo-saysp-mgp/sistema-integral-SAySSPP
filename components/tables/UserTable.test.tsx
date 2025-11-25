import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { UserTable } from "./UserTable";
import type { User } from "@/types";

describe("UserTable", () => {
  const mockUsers: User[] = [
    {
      id: "1",
      full_name: "Juan Pérez",
      email: "juan@example.com",
      role: "Admin",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "2",
      full_name: "María García",
      email: "maria@example.com",
      role: "Administrative",
      created_at: "2024-01-02T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
    },
  ];

  const mockHandlers = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onSearchChange: vi.fn(),
    onRoleFilter: vi.fn(),
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("should render users table with data", () => {
    render(<UserTable users={mockUsers} {...mockHandlers} />);

    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("María García")).toBeInTheDocument();
    expect(screen.getByText("juan@example.com")).toBeInTheDocument();
    expect(screen.getByText("maria@example.com")).toBeInTheDocument();
  });

  it("should render loading state", () => {
    render(<UserTable users={[]} loading={true} {...mockHandlers} />);

    expect(screen.getByText("Cargando usuarios...")).toBeInTheDocument();
  });

  it("should render empty state when no users", () => {
    render(<UserTable users={[]} loading={false} {...mockHandlers} />);

    expect(screen.getByText("No se encontraron usuarios")).toBeInTheDocument();
  });

  it("should call onSearchChange when typing in search input", async () => {
    const user = userEvent.setup();
    render(<UserTable users={mockUsers} {...mockHandlers} />);

    const searchInput = screen.getByPlaceholderText(
      "Buscar por nombre o email...",
    );
    await user.type(searchInput, "juan");

    expect(mockHandlers.onSearchChange).toHaveBeenCalled();
  });

  it("should call onEdit when edit button is clicked", async () => {
    const user = userEvent.setup();
    render(<UserTable users={mockUsers} {...mockHandlers} />);

    const editButtons = screen.getAllByTitle("Editar usuario");
    await user.click(editButtons[0]);

    expect(mockHandlers.onEdit).toHaveBeenCalledWith(mockUsers[0]);
  });

  it("should call onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    render(<UserTable users={mockUsers} {...mockHandlers} />);

    const deleteButtons = screen.getAllByTitle("Eliminar usuario");
    await user.click(deleteButtons[0]);

    expect(mockHandlers.onDelete).toHaveBeenCalledWith(mockUsers[0]);
  });

  it("should display role badges correctly", () => {
    render(<UserTable users={mockUsers} {...mockHandlers} />);

    const adminBadge = screen.getByText("Admin");
    const adminBadge2 = screen.getByText("Administrative");

    expect(adminBadge).toBeInTheDocument();
    expect(adminBadge2).toBeInTheDocument();
  });

  it("should show user count when users are present", () => {
    render(<UserTable users={mockUsers} {...mockHandlers} />);

    expect(screen.getByText("Mostrando 2 usuarios")).toBeInTheDocument();
  });
});
