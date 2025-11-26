import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "./route";
import { NextRequest } from "next/server";

// Mock Supabase
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockNeq = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

describe("PATCH /api/services/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock chain
    mockFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              single: mockSingle,
            }),
          }),
        };
      }
      if (table === "services") {
        return {
          select: () => ({
            eq: () => ({
              single: mockSingle,
              neq: () => ({
                single: mockSingle,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: mockSingle,
              }),
            }),
          }),
        };
      }
      return {
        select: mockSelect,
        update: mockUpdate,
      };
    });
  });

  it("should return 401 if not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const request = new NextRequest("http://localhost:3000/api/services/1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Service" }),
    });

    const response = await PATCH(request, { params: { id: "1" } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 403 if user is not Admin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123" } },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: { role: "Administrative" },
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/services/1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Service" }),
    });

    const response = await PATCH(request, { params: { id: "1" } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("Solo administradores");
  });

  it("should return 400 for invalid service ID", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123" } },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: { role: "Admin" },
      error: null,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/services/invalid",
      {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Service" }),
      },
    );

    const response = await PATCH(request, { params: { id: "invalid" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("ID de servicio inválido");
  });

  it("should return 404 if service not found", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123" } },
      error: null,
    });

    mockSingle
      .mockResolvedValueOnce({
        data: { role: "Admin" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });

    const request = new NextRequest("http://localhost:3000/api/services/999", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Service" }),
    });

    const response = await PATCH(request, { params: { id: "999" } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Servicio no encontrado");
  });

  it("should update service name successfully", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123" } },
      error: null,
    });

    mockSingle
      .mockResolvedValueOnce({
        data: { role: "Admin" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 1, name: "Old Name", active: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      })
      .mockResolvedValueOnce({
        data: { id: 1, name: "Updated Service", active: true },
        error: null,
      });

    const request = new NextRequest("http://localhost:3000/api/services/1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Service" }),
    });

    const response = await PATCH(request, { params: { id: "1" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.name).toBe("Updated Service");
    expect(data.message).toBe("Servicio actualizado exitosamente");
  });

  it("should update service active status successfully", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123" } },
      error: null,
    });

    mockSingle
      .mockResolvedValueOnce({
        data: { role: "Admin" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 1, name: "Service", active: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 1, name: "Service", active: false },
        error: null,
      });

    const request = new NextRequest("http://localhost:3000/api/services/1", {
      method: "PATCH",
      body: JSON.stringify({ active: false }),
    });

    const response = await PATCH(request, { params: { id: "1" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.active).toBe(false);
  });
});

describe("DELETE /api/services/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock chain
    mockFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              single: mockSingle,
            }),
          }),
        };
      }
      if (table === "services") {
        return {
          select: () => ({
            eq: () => ({
              single: mockSingle,
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: mockSingle,
              }),
            }),
          }),
        };
      }
      return {
        select: mockSelect,
        update: mockUpdate,
      };
    });
  });

  it("should return 401 if not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const request = new NextRequest("http://localhost:3000/api/services/1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: { id: "1" } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 403 if user is not Admin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123" } },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: { role: "Administrative" },
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/services/1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: { id: "1" } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("Solo administradores");
  });

  it("should soft delete service successfully", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123" } },
      error: null,
    });

    mockSingle
      .mockResolvedValueOnce({
        data: { role: "Admin" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 1, name: "Service", active: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 1, name: "Service", active: false },
        error: null,
      });

    const request = new NextRequest("http://localhost:3000/api/services/1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: { id: "1" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.active).toBe(false);
    expect(data.message).toBe("Servicio eliminado exitosamente");
  });
});
