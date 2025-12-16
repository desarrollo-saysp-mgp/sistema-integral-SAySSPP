import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { NextRequest } from "next/server";

// Mock Supabase clients
const mockAuth = {
  getUser: vi.fn(),
};

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockOr = vi.fn();
const mockOrder = vi.fn();

// Mock admin auth
const mockAdminAuth = {
  admin: {
    inviteUserByEmail: vi.fn(),
    deleteUser: vi.fn(),
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: mockAuth,
    from: mockFrom,
  })),
  createAdminClient: vi.fn(() => ({
    auth: mockAdminAuth,
  })),
}));

describe("GET /api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if user is not authenticated", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const request = new NextRequest("http://localhost:3000/api/users");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 403 if user is not Admin", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { role: "Administrative" },
            error: null,
          }),
        })),
      })),
    });

    const request = new NextRequest("http://localhost:3000/api/users");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe(
      "No autorizado. Solo administradores pueden ver usuarios",
    );
  });

  it("should return users list for Admin user", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "admin-123" } },
      error: null,
    });

    const mockUsers = [
      {
        id: "user-1",
        email: "user1@example.com",
        full_name: "User One",
        role: "Administrative",
      },
      {
        id: "user-2",
        email: "user2@example.com",
        full_name: "User Two",
        role: "Admin",
      },
    ];

    mockSelect.mockReturnValue({
      order: vi.fn(() => ({
        or: mockOr,
        eq: mockEq,
      })),
    });

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { role: "Admin" },
              error: null,
            }),
          })),
        })),
      })
      .mockReturnValueOnce({
        select: mockSelect,
      });

    // Mock the final query execution
    mockSelect.mockReturnValue({
      order: vi.fn().mockResolvedValue({
        data: mockUsers,
        error: null,
      }),
    });

    const request = new NextRequest("http://localhost:3000/api/users");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockUsers);
  });

  it("should apply search filter", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "admin-123" } },
      error: null,
    });

    mockSelect.mockReturnValue({
      order: vi.fn(() => ({
        or: mockOr.mockResolvedValue({
          data: [],
          error: null,
        }),
      })),
    });

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { role: "Admin" },
              error: null,
            }),
          })),
        })),
      })
      .mockReturnValueOnce({
        select: mockSelect,
      });

    const request = new NextRequest(
      "http://localhost:3000/api/users?search=john",
    );
    const response = await GET(request);

    expect(mockOr).toHaveBeenCalledWith(
      "full_name.ilike.%john%,email.ilike.%john%",
    );
  });

  it("should apply role filter", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "admin-123" } },
      error: null,
    });

    mockEq.mockResolvedValue({
      data: [],
      error: null,
    });

    mockSelect.mockReturnValue({
      order: vi.fn(() => ({
        eq: mockEq,
      })),
    });

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { role: "Admin" },
              error: null,
            }),
          })),
        })),
      })
      .mockReturnValueOnce({
        select: mockSelect,
      });

    const request = new NextRequest(
      "http://localhost:3000/api/users?role=Administrative",
    );
    const response = await GET(request);

    expect(mockEq).toHaveBeenCalledWith("role", "Administrative");
  });

  it("should return 500 on database error", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "admin-123" } },
      error: null,
    });

    mockSelect.mockReturnValue({
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      }),
    });

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { role: "Admin" },
              error: null,
            }),
          })),
        })),
      })
      .mockReturnValueOnce({
        select: mockSelect,
      });

    const request = new NextRequest("http://localhost:3000/api/users");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Error al cargar usuarios");
  });
});

describe("POST /api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if user is not authenticated", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const request = new NextRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        full_name: "John Doe",
        email: "john@example.com",
        role: "Administrative",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 403 if user is not Admin", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { role: "Administrative" },
            error: null,
          }),
        })),
      })),
    });

    const request = new NextRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        full_name: "John Doe",
        email: "john@example.com",
        role: "Administrative",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe(
      "No autorizado. Solo administradores pueden crear usuarios",
    );
  });

  it("should return 400 if required fields are missing", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "admin-123" } },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { role: "Admin" },
            error: null,
          }),
        })),
      })),
    });

    const request = new NextRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        full_name: "John Doe",
        // Missing email and role
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe(
      "Todos los campos son requeridos: full_name, email, role",
    );
  });

  it("should return 400 if role is invalid", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "admin-123" } },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { role: "Admin" },
            error: null,
          }),
        })),
      })),
    });

    const request = new NextRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        full_name: "John Doe",
        email: "john@example.com",
        role: "InvalidRole",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Rol inválido. Debe ser "Admin" o "Administrative"');
  });

  it("should create user using admin client for inviteUserByEmail", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "admin-123" } },
      error: null,
    });

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { role: "Admin" },
              error: null,
            }),
          })),
        })),
      })
      .mockReturnValueOnce({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "new-user-123",
                full_name: "John Doe",
                email: "john@example.com",
                role: "Administrative",
              },
              error: null,
            }),
          })),
        })),
      });

    mockAdminAuth.admin.inviteUserByEmail.mockResolvedValue({
      data: {
        user: {
          id: "new-user-123",
          email: "john@example.com",
        },
      },
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        full_name: "John Doe",
        email: "john@example.com",
        role: "Administrative",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(mockAdminAuth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      "john@example.com",
      expect.objectContaining({
        redirectTo: expect.stringContaining("/dashboard"),
      }),
    );
    expect(data.message).toBe("Usuario creado exitosamente");
  });

  it("should return 500 if inviteUserByEmail fails", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "admin-123" } },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { role: "Admin" },
            error: null,
          }),
        })),
      })),
    });

    mockAdminAuth.admin.inviteUserByEmail.mockResolvedValue({
      data: { user: null },
      error: { message: "Email already registered" },
    });

    const request = new NextRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        full_name: "John Doe",
        email: "john@example.com",
        role: "Administrative",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Email already registered");
  });

  it("should rollback auth user if database insert fails", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "admin-123" } },
      error: null,
    });

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { role: "Admin" },
              error: null,
            }),
          })),
        })),
      })
      .mockReturnValueOnce({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Database error" },
            }),
          })),
        })),
      });

    mockAdminAuth.admin.inviteUserByEmail.mockResolvedValue({
      data: {
        user: {
          id: "new-user-123",
          email: "john@example.com",
        },
      },
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        full_name: "John Doe",
        email: "john@example.com",
        role: "Administrative",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(mockAdminAuth.admin.deleteUser).toHaveBeenCalledWith("new-user-123");
    expect(data.error).toBe("Error al crear usuario en la base de datos");
  });
});
