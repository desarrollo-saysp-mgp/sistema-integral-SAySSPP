"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/types/database";
import type { User as AuthUser } from "@supabase/supabase-js";

interface UserContextType {
  user: AuthUser | null;
  profile: User | null;
  loading: boolean;
  isAdmin: boolean;
  isAdministrative: boolean;
  isAuthenticated: boolean;
  hasRole: (role: "Admin" | "Administrative") => boolean;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error.message);
        return null;
      }

      if (!data) {
        console.error("User profile not found");
        return null;
      }

      return data;
    } catch (error) {
      console.error("Unexpected error fetching profile:", error);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    const profileData = await fetchProfile(user.id);
    setProfile(profileData);
  };

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    // Get initial session
    const initializeAuth = async () => {
      try {
        // Try getUser() first (validates JWT)
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        // If getUser() fails with session error, try getSession() as fallback
        if (error) {
          console.error("Error getting user:", error);

          // Try fallback to getSession for graceful degradation
          try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (!sessionError && session?.user) {
              setUser(session.user);
              fetchProfile(session.user.id).then(profileData => {
                if (!cancelled) {
                  setProfile(profileData);
                }
              });
            }
          } catch (fallbackError) {
            console.error("Fallback session retrieval also failed:", fallbackError);
          }

          setLoading(false);
          return;
        }

        if (user) {
          setUser(user);
          // Fetch profile in parallel with setting user
          fetchProfile(user.id).then(profileData => {
            if (!cancelled) {
              setProfile(profileData);
            }
          });
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;

      setUser(session?.user ?? null);
      setLoading(false); // Set loading false immediately when auth state is known

      if (session?.user) {
        // Fetch profile in background, don't block loading state
        const profileData = await fetchProfile(session.user.id);
        if (!cancelled) {
          setProfile(profileData);
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const value: UserContextType = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === "Admin",
    isAdministrative: profile?.role === "Administrative",
    isAuthenticated: !!user,
    hasRole: (role: "Admin" | "Administrative") => profile?.role === role,
    refreshProfile,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);

  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }

  return context;
}
