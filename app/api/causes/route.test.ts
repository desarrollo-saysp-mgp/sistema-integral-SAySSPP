import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { NextRequest } from "next/server";

// Mock Supabase
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockInsert = vi.fn();
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

describe("GET /api/causes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockEq.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockOrder.mockReturnValue({ eq: mockEq });
  });

  it("should return 401 if not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const request = new NextRequest("http://localhost:3000/api/causes");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return all causes for authenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123" } },
      error: null,
    });

    const mockCauses = [
      { id: 1, service_id: 1, name: "Lámpara fundida", active: true },
      { id: 2, service_id: 1, name: "Poste dañado", active: true },
    ];

    mockOrder.mockResolvedValue({ data: mockCauses, error: null });

    const request = new NextRequest("http://localhost:3000/api/causes");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockCauses);
  });

  it("should filter causes by service_id", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123" } },
      error: null,
    });

    const mockCauses = [
      { id: 1, service_id: 1, name: "Lámpara fundida", active: true },
    ];

    mockEq.mockResolvedValue({ data: mockCauses, error: null });

    const request = new NextRequest(
      "http://localhost:3000/api/causes?service_id=1",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockEq).toHaveBeenCalledWith("service_id", 1);
  });

  it("should filter causes by active status", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123" } },
      error: null,
    });

    const mockActiveCauses = [
      { id: 1, service_id: 1, name: "Lámpara fundida", active: true },
    ];

    mockEq.mockResolvedValue({ data: mockActiveCauses, error: null });

    const request = new NextRequest(
      "http://localhost:3000/api/causes?active=true",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockEq).toHaveBeenCalledWith("active", true);
  });
});

describe("POST /api/causes", () => {
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
        };
      }
      if (table === "causes") {
        return {
          select: () => ({
            eq: () => ({
              single: mockSingle,
              eq: () => ({
                single: mockSingle,
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: mockSingle,
            }),
          }),
        };
      }
      return {
        select: mockSelect,
        insert: mockInsert,
      };
    });
  });

  it("should return 401 if not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const request = new NextRequest("http://localhost:3000/api/causes", {
      method: "POST",
      body: JSON.stringify({ name: "New Cause", service_id: 1 }),
    });

    const response = await POST(request);
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

    const request = new NextRequest("http://localhost:3000/api/causes", {
      method: "POST",
      body: JSON.stringify({ name: "New Cause", service_id: 1 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("Solo administradores");
  });

  it("should return 400 if name is missing", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123" } },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: { role: "Admin" },
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/causes", {
      method: "POST",
      body: JSON.stringify({ service_id: 1 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("El nombre de la causa es requerido");
  });

  it("should return 400 if service_id is missing", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123" } },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: { role: "Admin" },
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/causes", {
      method: "POST",
      body: JSON.stringify({ name: "New Cause" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("El ID del servicio es requerido");
  });

  it("should return 404 if service does not exist", async () => {
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

    const request = new NextRequest("http://localhost:3000/api/causes", {
      method: "POST",
      body: JSON.stringify({ name: "New Cause", service_id: 999 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("El servicio especificado no existe");
  });

  it("should return 409 if cause name already exists for service", async () => {
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
        data: { id: 1 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 1, name: "Existing Cause" },
        error: null,
      });

    const request = new NextRequest("http://localhost:3000/api/causes", {
      method: "POST",
      body: JSON.stringify({ name: "Existing Cause", service_id: 1 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe(
      "Ya existe una causa con este nombre para este servicio",
    );
  });

  it("should create a new cause successfully", async () => {
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
        data: { id: 1 },
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
          name: "New Cause",
          active: true,
        },
        error: null,
      });

    const request = new NextRequest("http://localhost:3000/api/causes", {
      method: "POST",
      body: JSON.stringify({ name: "New Cause", service_id: 1 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.name).toBe("New Cause");
    expect(data.message).toBe("Causa creada exitosamente");
  });
});
