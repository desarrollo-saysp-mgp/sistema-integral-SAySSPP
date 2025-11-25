import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { UserProvider, useUser } from "./UserContext";
import type { User } from "@/types/database";

// Mock Supabase client
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
    from: mockFrom,
  }),
}));

// Test component that uses the hook
function TestComponent() {
  const { user, profile, loading, isAdmin, isAuthenticated } = useUser();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div data-testid="authenticated">
        {isAuthenticated ? "true" : "false"}
      </div>
      <div data-testid="is-admin">{isAdmin ? "true" : "false"}</div>
      {profile && <div data-testid="profile-name">{profile.full_name}</div>}
      {profile && <div data-testid="profile-role">{profile.role}</div>}
      {user && <div data-testid="user-email">{user.email}</div>}
    </div>
  );
}

describe("UserContext", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    // Default mock: unauthenticated state
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
  });

  it("should throw error when useUser is used outside UserProvider", () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = vi.fn();

    expect(() => {
      render(<TestComponent />);
    }).toThrow("useUser must be used within a UserProvider");

    console.error = originalError;
  });

  it("should provide loading state initially", () => {
    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>,
    );

    // Should show loading initially
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should handle unauthenticated user", async () => {
    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
      expect(screen.getByTestId("is-admin")).toHaveTextContent("false");
    });
  });

  it("should handle authenticated admin user", async () => {
    const mockUser = {
      id: "123",
      email: "admin@example.com",
      aud: "authenticated",
      created_at: "2024-01-01",
    };

    const mockProfile: User = {
      id: "123",
      email: "admin@example.com",
      full_name: "Admin User",
      role: "Admin",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    };

    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser } as any },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        })),
      })),
    } as any);

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
      expect(screen.getByTestId("is-admin")).toHaveTextContent("true");
      expect(screen.getByTestId("profile-name")).toHaveTextContent(
        "Admin User",
      );
      expect(screen.getByTestId("profile-role")).toHaveTextContent("Admin");
      expect(screen.getByTestId("user-email")).toHaveTextContent(
        "admin@example.com",
      );
    });
  });

  it("should handle authenticated administrative user", async () => {
    const mockUser = {
      id: "456",
      email: "user@example.com",
      aud: "authenticated",
      created_at: "2024-01-01",
    };

    const mockProfile: User = {
      id: "456",
      email: "user@example.com",
      full_name: "Regular User",
      role: "Administrative",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    };

    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser } as any },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        })),
      })),
    } as any);

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
      expect(screen.getByTestId("is-admin")).toHaveTextContent("false");
      expect(screen.getByTestId("profile-name")).toHaveTextContent(
        "Regular User",
      );
      expect(screen.getByTestId("profile-role")).toHaveTextContent(
        "Administrative",
      );
    });
  });

  it("should handle profile fetch error", async () => {
    const mockUser = {
      id: "789",
      email: "error@example.com",
      aud: "authenticated",
      created_at: "2024-01-01",
    };

    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser } as any },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Profile not found" },
          }),
        })),
      })),
    } as any);

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
      expect(screen.getByTestId("is-admin")).toHaveTextContent("false");
      expect(screen.queryByTestId("profile-name")).not.toBeInTheDocument();
    });
  });

  it("should handle session error", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Session error" } as any,
    });

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    });
  });
});
