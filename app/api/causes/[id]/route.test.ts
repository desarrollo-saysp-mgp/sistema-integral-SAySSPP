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

describe("PATCH /api/causes/[id]", () => {
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
      if (table === "causes") {
        return {
          select: () => ({
            eq: () => ({
              single: mockSingle,
              eq: () => ({
                neq: () => ({
                  single: mockSingle,
                }),
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

    const request = new NextRequest("http://localhost:3000/api/causes/1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Cause" }),
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

    const request = new NextRequest("http://localhost:3000/api/causes/1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Cause" }),
    });

    const response = await PATCH(request, { params: { id: "1" } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("Solo administradores");
  });

  it("should return 400 for invalid cause ID", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123" } },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: { role: "Admin" },
      error: null,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/causes/invalid",
      {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Cause" }),
      },
    );

    const response = await PATCH(request, { params: { id: "invalid" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("ID de causa inválido");
  });

  it("should return 404 if cause not found", async () => {
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

    const request = new NextRequest("http://localhost:3000/api/causes/999", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Cause" }),
    });

    const response = await PATCH(request, { params: { id: "999" } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Causa no encontrada");
  });

  it("should update cause name successfully", async () => {
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
        data: {
          id: 1,
          service_id: 1,
          name: "Old Name",
          active: true,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      })
      .mockResolvedValueOnce({
        data: {
          id: 1,
          service_id: 1,
          name: "Updated Cause",
          active: true,
        },
        error: null,
      });

    const request = new NextRequest("http://localhost:3000/api/causes/1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Cause" }),
    });

    const response = await PATCH(request, { params: { id: "1" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.name).toBe("Updated Cause");
    expect(data.message).toBe("Causa actualizada exitosamente");
  });

  it("should update cause active status successfully", async () => {
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
        data: {
          id: 1,
          service_id: 1,
          name: "Cause",
          active: true,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 1,
          service_id: 1,
          name: "Cause",
          active: false,
        },
        error: null,
      });

    const request = new NextRequest("http://localhost:3000/api/causes/1", {
      method: "PATCH",
      body: JSON.stringify({ active: false }),
    });

    const response = await PATCH(request, { params: { id: "1" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.active).toBe(false);
  });
});

describe("DELETE /api/causes/[id]", () => {
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
      if (table === "causes") {
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

    const request = new NextRequest("http://localhost:3000/api/causes/1", {
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

    const request = new NextRequest("http://localhost:3000/api/causes/1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: { id: "1" } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("Solo administradores");
  });

  it("should soft delete cause successfully", async () => {
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
        data: {
          id: 1,
          service_id: 1,
          name: "Cause",
          active: true,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 1,
          service_id: 1,
          name: "Cause",
          active: false,
        },
        error: null,
      });

    const request = new NextRequest("http://localhost:3000/api/causes/1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: { id: "1" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.active).toBe(false);
    expect(data.message).toBe("Causa eliminada exitosamente");
  });
});
