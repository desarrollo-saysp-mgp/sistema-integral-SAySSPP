import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

// Mock Supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
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

describe("GET /api/complaints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const request = new NextRequest("http://localhost:3000/api/complaints");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return all complaints for authenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const mockComplaints = [
      {
        id: 1,
        complaint_number: "SASP-R000001",
        complainant_name: "Juan Pérez",
        status: "En proceso",
      },
      {
        id: 2,
        complaint_number: "SASP-R000002",
        complainant_name: "María García",
        status: "Resuelto",
      },
    ];

    const mockQuery = {
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: mockComplaints,
        error: null,
      }),
    };

    mockSelect.mockReturnValue(mockQuery);

    const request = new NextRequest("http://localhost:3000/api/complaints");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockComplaints);
  });


  it("should return 500 on database error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    mockSelect.mockReturnValue({
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      }),
    });

    const request = new NextRequest("http://localhost:3000/api/complaints");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Error al cargar reclamos");
  });

  it("should return all complaints when no service filter is provided (Todos los servicios)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const mockComplaintsAllServices = [
      {
        id: 1,
        complaint_number: 1,
        complainant_name: "Juan Pérez",
        service_id: 1,
        status: "En proceso",
      },
      {
        id: 2,
        complaint_number: 2,
        complainant_name: "María García",
        service_id: 2,
        status: "Resuelto",
      },
      {
        id: 3,
        complaint_number: 3,
        complainant_name: "Pedro López",
        service_id: 3,
        status: "En proceso",
      },
    ];

    const mockQuery = {
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: mockComplaintsAllServices,
        error: null,
      }),
    };

    mockSelect.mockReturnValue(mockQuery);

    // Request without service_id parameter (empty string simulates "Todos los servicios")
    const request = new NextRequest("http://localhost:3000/api/complaints?service_id=");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockComplaintsAllServices);
    expect(data.data).toHaveLength(3);
    // Verify eq was NOT called with service_id (since it's empty)
    expect(mockQuery.eq).not.toHaveBeenCalledWith("service_id", expect.anything());
  });

  it("should return complaints in any state when 'Todos los servicios' filter is selected", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    // Mock complaints with ALL three possible statuses across different services
    const mockComplaintsAllStates = [
      {
        id: 1,
        complaint_number: 1,
        complainant_name: "Juan Pérez",
        service_id: 1,
        status: "En proceso",
      },
      {
        id: 2,
        complaint_number: 2,
        complainant_name: "María García",
        service_id: 2,
        status: "Resuelto",
      },
      {
        id: 3,
        complaint_number: 3,
        complainant_name: "Pedro López",
        service_id: 3,
        status: "No resuelto",
      },
      {
        id: 4,
        complaint_number: 4,
        complainant_name: "Ana Torres",
        service_id: 1,
        status: "En proceso",
      },
    ];

    const mockQuery = {
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: mockComplaintsAllStates,
        error: null,
      }),
    };

    mockSelect.mockReturnValue(mockQuery);

    // Request with "all" service_id (Todos los servicios)
    const request = new NextRequest("http://localhost:3000/api/complaints?service_id=all");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(4);

    // Verify all three statuses are present in the results
    const statuses = data.data.map((c: any) => c.status);
    expect(statuses).toContain("En proceso");
    expect(statuses).toContain("Resuelto");
    expect(statuses).toContain("No resuelto");

    // Verify eq was NOT called with service_id filter
    expect(mockQuery.eq).not.toHaveBeenCalledWith("service_id", expect.anything());
  });
});

describe("POST /api/complaints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const request = new NextRequest("http://localhost:3000/api/complaints", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 400 if required fields are missing", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/complaints", {
      method: "POST",
      body: JSON.stringify({
        complainant_name: "Juan Pérez",
        // Missing other required fields
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("requerido");
  });

  it("should return 400 for invalid contact method", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/complaints", {
      method: "POST",
      body: JSON.stringify({
        complainant_name: "Juan Pérez",
        address: "Calle Principal",
        street_number: "123",
        service_id: 1,
        cause_id: 1,
        zone: "Centro",
        since_when: "2024-01-01",
        contact_method: "InvalidMethod",
        details: "Test complaint details",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Método de contacto inválido");
  });

  it("should create complaint successfully with valid data", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const mockComplaint = {
      id: 1,
      complaint_number: "SASP-R000001",
      complainant_name: "Juan Pérez",
      address: "Calle Principal",
      street_number: "123",
      status: "En proceso",
    };

    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockComplaint,
          error: null,
        }),
      }),
    });

    const request = new NextRequest("http://localhost:3000/api/complaints", {
      method: "POST",
      body: JSON.stringify({
        complainant_name: "Juan Pérez",
        address: "Calle Principal",
        street_number: "123",
        service_id: 1,
        cause_id: 1,
        zone: "Centro",
        since_when: "2024-01-01",
        contact_method: "Presencial",
        details: "Test complaint details",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data).toEqual(mockComplaint);
    expect(data.message).toBe("Reclamo creado exitosamente");
  });

  it("should set default values for optional fields", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const mockComplaint = {
      id: 1,
      complaint_number: "SASP-R000001",
      status: "En proceso",
      referred: false,
    };

    let insertedData: any = null;
    mockInsert.mockImplementation((data) => {
      insertedData = data;
      return {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockComplaint,
            error: null,
          }),
        }),
      };
    });

    const request = new NextRequest("http://localhost:3000/api/complaints", {
      method: "POST",
      body: JSON.stringify({
        complainant_name: "Juan Pérez",
        address: "Calle Principal",
        street_number: "123",
        service_id: 1,
        cause_id: 1,
        zone: "Centro",
        since_when: "2024-01-01",
        contact_method: "Email",
        details: "Test complaint details",
      }),
    });

    await POST(request);

    expect(insertedData.status).toBe("En proceso");
    expect(insertedData.referred).toBe(false);
    expect(insertedData.loaded_by).toBe("user-123");
  });

  it("should return 500 on database error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error" },
        }),
      }),
    });

    const request = new NextRequest("http://localhost:3000/api/complaints", {
      method: "POST",
      body: JSON.stringify({
        complainant_name: "Juan Pérez",
        address: "Calle Principal",
        street_number: "123",
        service_id: 1,
        cause_id: 1,
        zone: "Centro",
        since_when: "2024-01-01",
        contact_method: "WhatsApp",
        details: "Test complaint details",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Error al crear reclamo");
  });
});
