import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH, DELETE } from "./route";
import { NextRequest } from "next/server";

// Mock Supabase clients
const mockAuth = {
  getUser: vi.fn(),
};

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

// Mock admin auth
const mockAdminAuth = {
  admin: {
    updateUserById: vi.fn(),
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

describe("GET /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if user is not authenticated", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const request = new NextRequest("http://localhost:3000/api/users/user-123");
    const response = await GET(request, {
      params: Promise.resolve({ id: "user-123" }),
    });
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

    const request = new NextRequest("http://localhost:3000/api/users/user-456");
    const response = await GET(request, {
      params: Promise.resolve({ id: "user-456" }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe(
      "No autorizado. Solo administradores pueden ver usuarios",
    );
  });

  it("should return 404 if user not found", async () => {
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
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" },
            }),
          })),
        })),
      });

    const request = new NextRequest(
      "http://localhost:3000/api/users/nonexistent",
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Usuario no encontrado");
  });

  it("should return user data for Admin", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "admin-123" } },
      error: null,
    });

    const mockUser = {
      id: "user-456",
      email: "user@example.com",
      full_name: "Test User",
      role: "Administrative",
    };

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
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockUser,
              error: null,
            }),
          })),
        })),
      });

    const request = new NextRequest("http://localhost:3000/api/users/user-456");
    const response = await GET(request, {
      params: Promise.resolve({ id: "user-456" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockUser);
  });

  it("should return 500 on database error", async () => {
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
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Database error" },
            }),
          })),
        })),
      });

    const request = new NextRequest("http://localhost:3000/api/users/user-456");
    const response = await GET(request, {
      params: Promise.resolve({ id: "user-456" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Error al cargar usuario");
  });
});

describe("PATCH /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if user is not authenticated", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const request = new NextRequest("http://localhost:3000/api/users/user-123", {
      method: "PATCH",
      body: JSON.stringify({
        full_name: "Updated Name",
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "user-123" }),
    });
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

    const request = new NextRequest("http://localhost:3000/api/users/user-456", {
      method: "PATCH",
      body: JSON.stringify({
        full_name: "Updated Name",
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "user-456" }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe(
      "No autorizado. Solo administradores pueden editar usuarios",
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

    const request = new NextRequest("http://localhost:3000/api/users/user-456", {
      method: "PATCH",
      body: JSON.stringify({
        role: "InvalidRole",
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "user-456" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Rol inválido. Debe ser "Admin" o "Administrative"');
  });

  it("should update email using admin client", async () => {
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
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "user-456",
                  email: "newemail@example.com",
                  full_name: "Test User",
                  role: "Administrative",
                },
                error: null,
              }),
            })),
          })),
        })),
      });

    mockAdminAuth.admin.updateUserById.mockResolvedValue({
      data: { user: { id: "user-456" } },
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/users/user-456", {
      method: "PATCH",
      body: JSON.stringify({
        email: "newemail@example.com",
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "user-456" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockAdminAuth.admin.updateUserById).toHaveBeenCalledWith("user-456", {
      email: "newemail@example.com",
    });
    expect(data.message).toBe("Usuario actualizado exitosamente");
  });

  it("should update password using admin client", async () => {
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
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "user-456",
                  email: "user@example.com",
                  full_name: "Test User",
                  role: "Administrative",
                },
                error: null,
              }),
            })),
          })),
        })),
      });

    mockAdminAuth.admin.updateUserById.mockResolvedValue({
      data: { user: { id: "user-456" } },
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/users/user-456", {
      method: "PATCH",
      body: JSON.stringify({
        password: "newpassword123",
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "user-456" }),
    });

    expect(response.status).toBe(200);
    expect(mockAdminAuth.admin.updateUserById).toHaveBeenCalledWith("user-456", {
      password: "newpassword123",
    });
  });

  it("should return 500 if email update fails", async () => {
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

    mockAdminAuth.admin.updateUserById.mockResolvedValue({
      data: null,
      error: { message: "Email update failed" },
    });

    const request = new NextRequest("http://localhost:3000/api/users/user-456", {
      method: "PATCH",
      body: JSON.stringify({
        email: "newemail@example.com",
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "user-456" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Error al actualizar email en autenticación");
  });

  it("should return 500 if password update fails", async () => {
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

    mockAdminAuth.admin.updateUserById.mockResolvedValue({
      data: null,
      error: { message: "Password update failed" },
    });

    const request = new NextRequest("http://localhost:3000/api/users/user-456", {
      method: "PATCH",
      body: JSON.stringify({
        password: "newpassword123",
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "user-456" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Error al actualizar contraseña");
  });

  it("should update database fields without admin client", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "admin-123" } },
      error: null,
    });

    const updatedUser = {
      id: "user-456",
      email: "user@example.com",
      full_name: "Updated Name",
      role: "Admin",
    };

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
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: updatedUser,
                error: null,
              }),
            })),
          })),
        })),
      });

    const request = new NextRequest("http://localhost:3000/api/users/user-456", {
      method: "PATCH",
      body: JSON.stringify({
        full_name: "Updated Name",
        role: "Admin",
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "user-456" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(updatedUser);
    expect(mockAdminAuth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("should return 500 on database update error", async () => {
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
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Database error" },
              }),
            })),
          })),
        })),
      });

    const request = new NextRequest("http://localhost:3000/api/users/user-456", {
      method: "PATCH",
      body: JSON.stringify({
        full_name: "Updated Name",
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "user-456" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Error al actualizar usuario");
  });
});

describe("DELETE /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if user is not authenticated", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const request = new NextRequest("http://localhost:3000/api/users/user-123", {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "user-123" }),
    });
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

    const request = new NextRequest("http://localhost:3000/api/users/user-456", {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "user-456" }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe(
      "No autorizado. Solo administradores pueden eliminar usuarios",
    );
  });

  it("should return 400 if user tries to delete themselves", async () => {
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

    const request = new NextRequest(
      "http://localhost:3000/api/users/admin-123",
      {
        method: "DELETE",
      },
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "admin-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("No puedes eliminar tu propio usuario");
  });

  it("should delete user using admin client for auth deletion", async () => {
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
        delete: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        })),
      });

    mockAdminAuth.admin.deleteUser.mockResolvedValue({
      data: {},
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/users/user-456", {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "user-456" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockAdminAuth.admin.deleteUser).toHaveBeenCalledWith("user-456");
    expect(data.message).toBe("Usuario eliminado exitosamente");
  });

  it("should return 500 on database delete error", async () => {
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
        delete: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error" },
          }),
        })),
      });

    const request = new NextRequest("http://localhost:3000/api/users/user-456", {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "user-456" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Error al eliminar usuario de la base de datos");
  });

  it("should succeed even if auth deletion fails", async () => {
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
        delete: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        })),
      });

    mockAdminAuth.admin.deleteUser.mockResolvedValue({
      data: null,
      error: { message: "Auth deletion failed" },
    });

    const request = new NextRequest("http://localhost:3000/api/users/user-456", {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "user-456" }),
    });
    const data = await response.json();

    // Should still succeed because DB deletion worked
    expect(response.status).toBe(200);
    expect(data.message).toBe("Usuario eliminado exitosamente");
  });
});
