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

    // Get initial session directly (not relying on events)
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session?.user) {
          const profileData = await fetchProfile(session.user.id);
          if (!cancelled) {
            setUser(session.user);
            setProfile(profileData);
          }
        }
      } catch (error) {
        console.error("Error getting initial session:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      // Skip INITIAL_SESSION - we handle it above with getSession()
      if (event === "INITIAL_SESSION") {
        return;
      }

      // SIGNED_IN fires after login
      if (event === "SIGNED_IN" && session?.user) {
        const profileData = await fetchProfile(session.user.id);
        if (!cancelled) {
          setUser(session.user);
          setProfile(profileData);
          setLoading(false);
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      // Handle TOKEN_REFRESHED - update profile silently
      if (event === "TOKEN_REFRESHED" && session?.user) {
        const profileData = await fetchProfile(session.user.id);
        if (!cancelled) {
          setUser(session.user);
          setProfile(profileData);
        }
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
