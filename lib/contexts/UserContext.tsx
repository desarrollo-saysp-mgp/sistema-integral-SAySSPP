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
    let isLoadingSession = false;

    // Handle session loading from any event
    const loadUserSession = async (sessionUser: AuthUser) => {
      // Prevent concurrent loads
      if (isLoadingSession) {
        console.log("[UserContext] Already loading, skipping");
        return;
      }

      // If we already have this user loaded, just ensure loading is false
      if (userIdRef.current === sessionUser.id) {
        console.log("[UserContext] User already loaded, skipping");
        if (!cancelled) setLoading(false);
        return;
      }

      isLoadingSession = true;
      console.log("[UserContext] Loading user session:", sessionUser.id);

      userIdRef.current = sessionUser.id;
      setUser(sessionUser);

      try {
        const profileData = await fetchProfile(sessionUser.id);
        console.log("[UserContext] Profile loaded:", profileData?.full_name);

        if (!cancelled) {
          setProfile(profileData);
          setLoading(false);
        }
      } catch (error) {
        console.error("[UserContext] Error loading profile:", error);
        if (!cancelled) setLoading(false);
      } finally {
        isLoadingSession = false;
      }
    };

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[UserContext] onAuthStateChange:", event, "user:", session?.user?.id);

      if (cancelled) return;

      // INITIAL_SESSION or SIGNED_IN with user - load the session
      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session?.user) {
        await loadUserSession(session.user);
        return;
      }

      // No session events - set loading to false
      if (event === "INITIAL_SESSION" && !session) {
        console.log("[UserContext] No session");
        setLoading(false);
        return;
      }

      if (event === "SIGNED_OUT") {
        console.log("[UserContext] SIGNED_OUT");
        userIdRef.current = null;
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event === "TOKEN_REFRESHED" && session?.user) {
        console.log("[UserContext] TOKEN_REFRESHED");
        try {
          const profileData = await fetchProfile(session.user.id);
          if (!cancelled) {
            setUser(session.user);
            setProfile(profileData);
          }
        } catch (error) {
          console.error("[UserContext] Error refreshing profile:", error);
        }
      }
    });

    return () => {
      console.log("[UserContext] cleanup");
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
