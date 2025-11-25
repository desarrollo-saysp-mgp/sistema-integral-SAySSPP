import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateSession } from "./middleware";
import { NextRequest } from "next/server";

// Mock Supabase client
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

// Mock Supabase SSR
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

describe("updateSession middleware", () => {
  let mockCookies: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup cookie mocks
    mockCookies = {
      getAll: vi.fn(() => []),
      set: vi.fn(),
    };

    // Setup Supabase query chain
    mockSingle.mockResolvedValue({ data: null });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  const createMockRequest = (pathname: string) => {
    return {
      nextUrl: {
        pathname,
      },
      url: `http://localhost:3000${pathname}`,
      cookies: mockCookies,
    } as unknown as NextRequest;
  };

  it("should allow access to public routes without authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const request = createMockRequest("/login");
    const response = await updateSession(request);

    expect(response.status).toBe(200);
  });

  it("should redirect unauthenticated users from dashboard to login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const request = createMockRequest("/dashboard");
    const response = await updateSession(request);

    expect(response.status).toBe(307); // Redirect status
    expect(response.headers.get("location")).toContain("/login");
    expect(response.headers.get("location")).toContain(
      "redirectTo=%2Fdashboard",
    );
  });

  it("should redirect unauthenticated users from admin to login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const request = createMockRequest("/admin/users");
    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
    expect(response.headers.get("location")).toContain(
      "redirectTo=%2Fadmin%2Fusers",
    );
  });

  it("should allow admin users to access admin routes", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123", email: "admin@test.com" } },
    });
    mockSingle.mockResolvedValue({
      data: { role: "Admin" },
    });

    const request = createMockRequest("/admin/users");
    const response = await updateSession(request);

    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockSelect).toHaveBeenCalledWith("role");
    expect(mockEq).toHaveBeenCalledWith("id", "123");
    expect(response.status).toBe(200);
  });

  it("should redirect non-admin users from admin routes to dashboard", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "456", email: "user@test.com" } },
    });
    mockSingle.mockResolvedValue({
      data: { role: "Administrative" },
    });

    const request = createMockRequest("/admin/users");
    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/dashboard");
  });

  it("should allow authenticated users to access dashboard", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123", email: "user@test.com" } },
    });

    const request = createMockRequest("/dashboard");
    const response = await updateSession(request);

    expect(response.status).toBe(200);
  });

  it("should redirect authenticated users from login to dashboard", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123", email: "user@test.com" } },
    });

    const request = createMockRequest("/login");
    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/dashboard");
  });

  it("should handle missing profile when accessing admin routes", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "789", email: "noProfile@test.com" } },
    });
    mockSingle.mockResolvedValue({
      data: null,
    });

    const request = createMockRequest("/admin/services");
    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/dashboard");
  });

  it("should allow reset-password routes without authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const request = createMockRequest("/reset-password");
    const response = await updateSession(request);

    expect(response.status).toBe(200);
  });

  it("should allow reset-password/confirm routes without authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const request = createMockRequest("/reset-password/confirm");
    const response = await updateSession(request);

    expect(response.status).toBe(200);
  });
});
