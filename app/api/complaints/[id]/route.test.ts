import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH, DELETE } from "./route";

// Mock Supabase
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn((table: string) => ({
  select: mockSelect,
  update: mockUpdate,
  delete: mockDelete,
}));
const mockGetUser = vi.fn();
const mockAuth = {
  getUser: mockGetUser,
};
const mockSupabase = {
  from: mockFrom,
  auth: mockAuth,
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe("GET /api/complaints/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const request = new NextRequest(
      "http://localhost:3000/api/complaints/1",
    );
    const context = { params: Promise.resolve({ id: "1" }) };
    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return complaint with related data for authenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const mockComplaint = {
      id: 1,
      complaint_number: "SASP-R000001",
      complainant_name: "Juan Pérez",
      status: "En proceso",
      service: { id: 1, name: "Alumbrado Público" },
      cause: { id: 1, name: "Lámpara fundida" },
      loaded_by_user: { id: "user-123", full_name: "Admin User" },
    };

    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockComplaint,
          error: null,
        }),
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/complaints/1",
    );
    const context = { params: Promise.resolve({ id: "1" }) };
    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockComplaint);
  });

  it("should return 404 if complaint not found", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/complaints/999",
    );
    const context = { params: Promise.resolve({ id: "999" }) };
    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Reclamo no encontrado");
  });

  it("should return 500 on database error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error" },
        }),
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/complaints/1",
    );
    const context = { params: Promise.resolve({ id: "1" }) };
    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Error al cargar reclamo");
  });
});

describe("PATCH /api/complaints/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const request = new NextRequest(
      "http://localhost:3000/api/complaints/1",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "Resuelto" }),
      },
    );
    const context = { params: Promise.resolve({ id: "1" }) };
    const response = await PATCH(request, context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should update complaint successfully with valid data", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const mockUpdatedComplaint = {
      id: 1,
      complaint_number: "SASP-R000001",
      status: "Resuelto",
    };

    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockUpdatedComplaint,
            error: null,
          }),
        }),
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/complaints/1",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "Resuelto" }),
      },
    );
    const context = { params: Promise.resolve({ id: "1" }) };
    const response = await PATCH(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockUpdatedComplaint);
    expect(data.message).toBe("Reclamo actualizado exitosamente");
  });

  it("should return 400 for invalid status", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/complaints/1",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "InvalidStatus" }),
      },
    );
    const context = { params: Promise.resolve({ id: "1" }) };
    const response = await PATCH(request, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Estado inválido");
  });

  it("should return 400 for invalid contact method", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/complaints/1",
      {
        method: "PATCH",
        body: JSON.stringify({ contact_method: "InvalidMethod" }),
      },
    );
    const context = { params: Promise.resolve({ id: "1" }) };
    const response = await PATCH(request, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Método de contacto inválido");
  });

  it("should update only provided fields", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    let updateData: any = null;
    mockUpdate.mockImplementation((data) => {
      updateData = data;
      return {
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 1, ...data },
              error: null,
            }),
          }),
        }),
      };
    });

    const request = new NextRequest(
      "http://localhost:3000/api/complaints/1",
      {
        method: "PATCH",
        body: JSON.stringify({
          complainant_name: "Updated Name",
          status: "Resuelto",
        }),
      },
    );
    const context = { params: Promise.resolve({ id: "1" }) };
    await PATCH(request, context);

    expect(updateData).toHaveProperty("complainant_name", "Updated Name");
    expect(updateData).toHaveProperty("status", "Resuelto");
    expect(updateData).not.toHaveProperty("address");
  });

  it("should return 500 on database error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error" },
          }),
        }),
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/complaints/1",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "Resuelto" }),
      },
    );
    const context = { params: Promise.resolve({ id: "1" }) };
    const response = await PATCH(request, context);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Error al actualizar reclamo");
  });
});

describe("DELETE /api/complaints/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const request = new NextRequest(
      "http://localhost:3000/api/complaints/1",
      {
        method: "DELETE",
      },
    );
    const context = { params: Promise.resolve({ id: "1" }) };
    const response = await DELETE(request, context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 403 if user is not Admin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { role: "Administrative" },
          error: null,
        }),
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/complaints/1",
      {
        method: "DELETE",
      },
    );
    const context = { params: Promise.resolve({ id: "1" }) };
    const response = await DELETE(request, context);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe(
      "No autorizado. Solo administradores pueden eliminar reclamos",
    );
  });

  it("should delete complaint successfully for Admin user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "admin-123" } },
      error: null,
    });

    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { role: "Admin" },
          error: null,
        }),
      }),
    });

    mockDelete.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/complaints/1",
      {
        method: "DELETE",
      },
    );
    const context = { params: Promise.resolve({ id: "1" }) };
    const response = await DELETE(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Reclamo eliminado exitosamente");
  });

  it("should return 500 on database error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "admin-123" } },
      error: null,
    });

    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { role: "Admin" },
          error: null,
        }),
      }),
    });

    mockDelete.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/complaints/1",
      {
        method: "DELETE",
      },
    );
    const context = { params: Promise.resolve({ id: "1" }) };
    const response = await DELETE(request, context);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Error al eliminar reclamo");
  });
});
