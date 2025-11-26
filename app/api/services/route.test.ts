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

describe("GET /api/services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockEq.mockReturnValue({ single: mockSingle });
    mockOrder.mockReturnValue({ eq: mockEq });
  });

  it("should return 401 if not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const request = new NextRequest("http://localhost:3000/api/services");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return all services for authenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123" } },
      error: null,
    });

    const mockServices = [
      { id: 1, name: "Alumbrado Público", active: true },
      { id: 2, name: "Recolección de Residuos", active: true },
    ];

    mockOrder.mockResolvedValue({ data: mockServices, error: null });

    const request = new NextRequest("http://localhost:3000/api/services");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockServices);
  });

  it("should filter services by active status", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123" } },
      error: null,
    });

    const mockActiveServices = [
      { id: 1, name: "Alumbrado Público", active: true },
    ];

    mockEq.mockResolvedValue({ data: mockActiveServices, error: null });

    const request = new NextRequest(
      "http://localhost:3000/api/services?active=true",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockEq).toHaveBeenCalledWith("active", true);
  });
});

describe("POST /api/services", () => {
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

    const request = new NextRequest("http://localhost:3000/api/services", {
      method: "POST",
      body: JSON.stringify({ name: "New Service" }),
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

    const request = new NextRequest("http://localhost:3000/api/services", {
      method: "POST",
      body: JSON.stringify({ name: "New Service" }),
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

    const request = new NextRequest("http://localhost:3000/api/services", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("El nombre del servicio es requerido");
  });

  it("should return 409 if service name already exists", async () => {
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
        data: { id: 1, name: "Existing Service" },
        error: null,
      });

    const request = new NextRequest("http://localhost:3000/api/services", {
      method: "POST",
      body: JSON.stringify({ name: "Existing Service" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("Ya existe un servicio con este nombre");
  });

  it("should create a new service successfully", async () => {
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
      })
      .mockResolvedValueOnce({
        data: { id: 1, name: "New Service", active: true },
        error: null,
      });

    const request = new NextRequest("http://localhost:3000/api/services", {
      method: "POST",
      body: JSON.stringify({ name: "New Service" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.name).toBe("New Service");
    expect(data.message).toBe("Servicio creado exitosamente");
  });
});
