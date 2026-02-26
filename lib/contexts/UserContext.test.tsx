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
  const {
    user,
    profile,
    loading,
    isAdmin,
    isAdministrative,
    isAuthenticated,
    hasRole,
  } = useUser();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div data-testid="authenticated">
        {isAuthenticated ? "true" : "false"}
      </div>
      <div data-testid="is-admin">{isAdmin ? "true" : "false"}</div>
      <div data-testid="is-administrative">
        {isAdministrative ? "true" : "false"}
      </div>
      <div data-testid="has-admin-role">
        {hasRole("Admin") ? "true" : "false"}
      </div>
      <div data-testid="has-administrative-role">
        {hasRole("Administrative") ? "true" : "false"}
      </div>
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

    // Default: no session
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    // Default: subscription that does nothing (we skip INITIAL_SESSION now)
    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
  });

  it("should throw error when useUser is used outside UserProvider", () => {
    const originalError = console.error;
    console.error = vi.fn();

    expect(() => {
      render(<TestComponent />);
    }).toThrow("useUser must be used within a UserProvider");

    console.error = originalError;
  });

  it("should provide loading state initially", () => {
    // Make getSession never resolve
    mockGetSession.mockReturnValue(new Promise(() => {}));

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>,
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should handle unauthenticated user", async () => {
    // INITIAL_SESSION with no user (default setup)
    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
      expect(screen.getByTestId("is-admin")).toHaveTextContent("false");
      expect(screen.getByTestId("is-administrative")).toHaveTextContent("false");
    });
  });

  it("should handle authenticated admin user on reload", async () => {
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

    // getSession returns existing session (simulates page reload)
    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser } },
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
      expect(screen.getByTestId("is-administrative")).toHaveTextContent("false");
      expect(screen.getByTestId("profile-name")).toHaveTextContent("Admin User");
      expect(screen.getByTestId("profile-role")).toHaveTextContent("Admin");
      expect(screen.getByTestId("user-email")).toHaveTextContent("admin@example.com");
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

    // getSession returns existing session
    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser } },
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
      expect(screen.getByTestId("is-administrative")).toHaveTextContent("true");
      expect(screen.getByTestId("profile-name")).toHaveTextContent("Regular User");
    });
  });

  it("should handle profile fetch error", async () => {
    const mockUser = {
      id: "789",
      email: "error@example.com",
      aud: "authenticated",
      created_at: "2024-01-01",
    };

    // getSession returns user but profile fetch will fail
    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser } },
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

  it("should handle SIGNED_IN event for login", async () => {
    const mockUser = {
      id: "login-user",
      email: "login@example.com",
      aud: "authenticated",
      created_at: "2024-01-01",
    };

    const mockProfile: User = {
      id: "login-user",
      email: "login@example.com",
      full_name: "Login User",
      role: "Admin",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    };

    // Initial: no session
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    // Set up profile mock for when SIGNED_IN fires
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

    // Capture the callback to trigger SIGNED_IN later
    let authCallback: any;
    mockOnAuthStateChange.mockImplementation((callback: any) => {
      authCallback = callback;
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    });

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>,
    );

    // Wait for initial load (no user)
    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    });

    // Simulate login by triggering SIGNED_IN
    await authCallback("SIGNED_IN", { user: mockUser });

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
      expect(screen.getByTestId("profile-name")).toHaveTextContent("Login User");
    });
  });

  it("should wait for profile to load before setting loading to false", async () => {
    const mockUser = {
      id: "user-with-profile",
      email: "user@example.com",
      aud: "authenticated",
      created_at: "2024-01-01",
    };

    const mockProfile: User = {
      id: "user-with-profile",
      email: "user@example.com",
      full_name: "Test User",
      role: "Admin",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    };

    // getSession returns user
    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser } },
    });

    // Mock with delayed profile fetch
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            new Promise((resolve) =>
              setTimeout(
                () => resolve({ data: mockProfile, error: null }),
                100
              )
            )
          ),
        })),
      })),
    } as any);

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>,
    );

    // Should show loading initially
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    // Wait for profile to load
    await waitFor(
      () => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
        expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
        expect(screen.getByTestId("profile-name")).toHaveTextContent("Test User");
      },
      { timeout: 500 }
    );
  });
});
