"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
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
  // Ref to track current user ID for checking in event handlers
  const userIdRef = useRef<string | null>(null);

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

    // Initialize auth using getUser() which validates JWT with server
    const initializeAuth = async () => {
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser();

        if (cancelled) return;

        if (error) {
          // Try fallback to getSession for edge cases
          const { data: { session } } = await supabase.auth.getSession();
          if (!cancelled && session?.user) {
            userIdRef.current = session.user.id;
            setUser(session.user);
            const profileData = await fetchProfile(session.user.id);
            if (!cancelled) setProfile(profileData);
          }
        } else if (authUser) {
          userIdRef.current = authUser.id;
          setUser(authUser);
          const profileData = await fetchProfile(authUser.id);
          if (!cancelled) setProfile(profileData);
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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      // Skip INITIAL_SESSION - handled by initializeAuth
      if (event === "INITIAL_SESSION") {
        return;
      }

      // SIGNED_IN: Only handle for fresh login
      // If we already have the same user (reload case), skip to avoid duplicate processing
      if (event === "SIGNED_IN" && session?.user) {
        if (userIdRef.current === session.user.id) {
          // Same user already loaded (reload case), skip
          return;
        }
        // Fresh login - load user and profile
        userIdRef.current = session.user.id;
        const profileData = await fetchProfile(session.user.id);
        if (!cancelled) {
          setUser(session.user);
          setProfile(profileData);
          setLoading(false);
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        userIdRef.current = null;
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
