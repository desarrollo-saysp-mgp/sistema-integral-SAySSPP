import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";

// Mock Supabase
const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
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

describe("GET /api/dashboard/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return dashboard statistics for authenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const mockComplaints = [
      { status: "En proceso" },
      { status: "En proceso" },
      { status: "Resuelto" },
      { status: "No resuelto" },
    ];

    const mockRecentComplaints = [
      {
        id: 1,
        complaint_number: "SASP-R000001",
        complaint_date: "2024-01-15",
        complainant_name: "Juan Pérez",
        status: "En proceso",
        service: { id: 1, name: "Alumbrado Público" },
        cause: { id: 1, name: "Lámpara fundida" },
      },
    ];

    // Mock total count
    mockSelect
      .mockResolvedValueOnce({
        count: 4,
        error: null,
      })
      // Mock status counts
      .mockResolvedValueOnce({
        data: mockComplaints,
        error: null,
      })
      // Mock recent complaints
      .mockReturnValueOnce({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: mockRecentComplaints,
            error: null,
          }),
        }),
      });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual({
      total: 4,
      inProgress: 2,
      resolved: 1,
      unresolved: 1,
      recentComplaints: mockRecentComplaints,
    });
  });

  it("should return 500 on total count error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    mockSelect.mockResolvedValueOnce({
      count: null,
      error: { message: "Database error" },
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Error al cargar estadísticas");
  });

  it("should return 500 on status counts error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    mockSelect
      .mockResolvedValueOnce({
        count: 4,
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Database error" },
      });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Error al cargar estadísticas");
  });

  it("should return 500 on recent complaints error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const mockComplaints = [{ status: "En proceso" }];

    mockSelect
      .mockResolvedValueOnce({
        count: 1,
        error: null,
      })
      .mockResolvedValueOnce({
        data: mockComplaints,
        error: null,
      })
      .mockReturnValueOnce({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error" },
          }),
        }),
      });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Error al cargar reclamos recientes");
  });

  it("should handle zero complaints", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    mockSelect
      .mockResolvedValueOnce({
        count: 0,
        error: null,
      })
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockReturnValueOnce({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual({
      total: 0,
      inProgress: 0,
      resolved: 0,
      unresolved: 0,
      recentComplaints: [],
    });
  });
});
