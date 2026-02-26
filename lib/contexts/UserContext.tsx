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
    let subscription: { unsubscribe: () => void } | null = null;

    const initialize = async () => {
      // FIRST: Load existing session from cookies
      const { data: { session } } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session?.user) {
        userIdRef.current = session.user.id;
        setUser(session.user);

        const profileData = await fetchProfile(session.user.id);

        if (!cancelled) {
          setProfile(profileData);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }

      if (cancelled) return;

      // THEN: Set up listener for future auth changes (login, logout)
      const { data } = supabase.auth.onAuthStateChange(async (event, eventSession) => {
        if (cancelled) return;

        // Skip INITIAL_SESSION - already handled above
        if (event === "INITIAL_SESSION") {
          return;
        }

        // SIGNED_IN - user just logged in
        if (event === "SIGNED_IN" && eventSession?.user) {
          // Skip if same user already loaded
          if (userIdRef.current === eventSession.user.id) {
            return;
          }

          userIdRef.current = eventSession.user.id;
          setUser(eventSession.user);

          const profileData = await fetchProfile(eventSession.user.id);

          if (!cancelled) {
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

        if (event === "TOKEN_REFRESHED" && eventSession?.user) {
          const profileData = await fetchProfile(eventSession.user.id);
          if (!cancelled) {
            setUser(eventSession.user);
            setProfile(profileData);
          }
        }
      });

      subscription = data.subscription;
    };

    initialize();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
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
