"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { createClient } from "@/lib/supabase/client";

import type { User, UserRole } from "@/types";
import type { User as AuthUser } from "@supabase/supabase-js";

interface UserContextType {
  user: AuthUser | null;
  profile: User | null;
  loading: boolean;
  isAdmin: boolean;
  isAdministrative: boolean;
  canManagePersonnel: boolean;
  isAuthenticated: boolean;
  hasRole: (role: UserRole) => boolean;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const PROFILE_TIMEOUT_MS = 15000;
const VISIBILITY_REFRESH_COOLDOWN_MS = 3000;

/**
 * Evita que una consulta pueda quedar esperando indefinidamente.
 */
function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs = PROFILE_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `La consulta excedió el tiempo máximo de ${timeoutMs / 1000} segundos.`,
        ),
      );
    }, timeoutMs);
  });

  return Promise.race([
    Promise.resolve(promise),
    timeoutPromise,
  ]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

export function UserProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Guarda el usuario actualmente activo sin depender
   * del estado asincrónico de React.
   */
  const userIdRef = useRef<string | null>(null);

  /**
   * Evita ejecutar varias revalidaciones seguidas cuando
   * el navegador dispara visibilitychange/focus rápidamente.
   */
  const lastVisibilityRefreshRef = useRef(0);

  /**
   * Obtiene el perfil interno del usuario.
   *
   * Incluye timeout para evitar que una consulta que quedó
   * pendiente por problemas de red mantenga la aplicación
   * esperando indefinidamente.
   */
  const fetchProfile = useCallback(
    async (userId: string): Promise<User | null> => {
      try {
        const supabase = createClient();

        const { data, error } = await withTimeout(
          supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .single(),
        );

        if (error) {
          console.error(
            "Error fetching user profile:",
            error.message,
          );

          return null;
        }

        if (!data) {
          console.error("User profile not found");

          return null;
        }

        return data as User;
      } catch (error) {
        console.error(
          "Unexpected error fetching profile:",
          error,
        );

        return null;
      }
    },
    [],
  );

  /**
   * Permite actualizar manualmente el perfil.
   *
   * Si Supabase falla temporalmente, conservamos el perfil
   * existente en lugar de reemplazarlo por null.
   */
  const refreshProfile = useCallback(async () => {
    if (!user) return;

    const profileData = await fetchProfile(user.id);

    if (profileData) {
      setProfile(profileData);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    const supabase = createClient();

    let cancelled = false;

    let subscription: {
      unsubscribe: () => void;
    } | null = null;

    let profileRefreshTimeout:
      | ReturnType<typeof setTimeout>
      | null = null;

    /**
     * Actualiza el perfil fuera del callback interno de Auth.
     *
     * No hacemos await directamente dentro de
     * onAuthStateChange.
     */
    const scheduleProfileRefresh = (
      authUser: AuthUser,
    ) => {
      if (cancelled) return;

      if (profileRefreshTimeout) {
        clearTimeout(profileRefreshTimeout);
      }

      profileRefreshTimeout = setTimeout(() => {
        void (async () => {
          const profileData = await fetchProfile(
            authUser.id,
          );

          /**
           * Puede ocurrir que mientras esperábamos la respuesta
           * el usuario haya cerrado sesión.
           */
          if (
            cancelled ||
            userIdRef.current !== authUser.id
          ) {
            return;
          }

          if (profileData) {
            setProfile(profileData);
          }
        })();
      }, 0);
    };

    /**
     * Inicialización de la sesión al cargar la aplicación.
     */
    const initialize = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (error) {
          console.error(
            "Error obteniendo sesión inicial:",
            error,
          );

          setLoading(false);
          return;
        }

        if (!session?.user) {
          userIdRef.current = null;

          setUser(null);
          setProfile(null);
          setLoading(false);

          return;
        }

        userIdRef.current = session.user.id;

        setUser(session.user);

        const profileData = await fetchProfile(
          session.user.id,
        );

        if (cancelled) return;

        /**
         * Solamente reemplazamos el perfil si la consulta
         * efectivamente respondió correctamente.
         */
        if (profileData) {
          setProfile(profileData);
        }

        setLoading(false);
      } catch (error) {
        console.error(
          "Error inicializando sesión:",
          error,
        );

        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    /**
     * Escuchamos los eventos de autenticación.
     *
     * IMPORTANTE:
     * el callback NO es async.
     */
    const { data } =
      supabase.auth.onAuthStateChange(
        (event, eventSession) => {
          if (cancelled) return;

          if (event === "INITIAL_SESSION") {
            return;
          }

          if (event === "SIGNED_OUT") {
            userIdRef.current = null;

            setUser(null);
            setProfile(null);
            setLoading(false);

            return;
          }

          if (
            event === "SIGNED_IN" &&
            eventSession?.user
          ) {
            const authUser = eventSession.user;

            const isSameUser =
              userIdRef.current === authUser.id;

            userIdRef.current = authUser.id;

            setUser(authUser);
            setLoading(false);

            /**
             * Si cambió realmente el usuario,
             * obtenemos su perfil.
             */
            if (!isSameUser) {
              scheduleProfileRefresh(authUser);
            }

            return;
          }

          if (
            event === "TOKEN_REFRESHED" &&
            eventSession?.user
          ) {
            const authUser = eventSession.user;

            userIdRef.current = authUser.id;

            setUser(authUser);

            /**
             * El token se renovó correctamente.
             *
             * Actualizamos también el perfil, pero fuera
             * del callback de Auth.
             */
            scheduleProfileRefresh(authUser);

            return;
          }

          if (
            event === "USER_UPDATED" &&
            eventSession?.user
          ) {
            const authUser = eventSession.user;

            userIdRef.current = authUser.id;

            setUser(authUser);

            scheduleProfileRefresh(authUser);
          }
        },
      );

    subscription = data.subscription;

    /**
     * Revalida la sesión cuando el usuario vuelve
     * a una pestaña que estuvo inactiva.
     */
    const revalidateSession = async () => {
      if (cancelled) return;

      const now = Date.now();

      /**
       * Chrome puede generar varios eventos casi juntos.
       */
      if (
        now - lastVisibilityRefreshRef.current <
        VISIBILITY_REFRESH_COOLDOWN_MS
      ) {
        return;
      }

      lastVisibilityRefreshRef.current = now;

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (error) {
          console.warn(
            "No se pudo revalidar la sesión:",
            error,
          );

          return;
        }

        /**
         * Si después de volver no existe una sesión válida,
         * limpiamos el contexto.
         */
        if (!session?.user) {
          userIdRef.current = null;

          setUser(null);
          setProfile(null);

          return;
        }

        const authUser = session.user;

        userIdRef.current = authUser.id;

        setUser(authUser);

        /**
         * Además de recuperar la sesión,
         * actualizamos el perfil.
         */
        const profileData = await fetchProfile(
          authUser.id,
        );

        if (
          cancelled ||
          userIdRef.current !== authUser.id
        ) {
          return;
        }

        if (profileData) {
          setProfile(profileData);
        }
      } catch (error) {
        /**
         * Una falla temporal de Internet no debe
         * destruir la sesión local ni dejar la app trabada.
         */
        console.warn(
          "Error recuperando sesión después de inactividad:",
          error,
        );
      }
    };

    /**
     * Se ejecuta especialmente cuando Chrome pasa de
     * pestaña suspendida/inactiva a visible nuevamente.
     */
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void revalidateSession();
    };

    /**
     * También escuchamos focus como respaldo.
     *
     * Esto ayuda en casos como:
     * - PC bloqueada
     * - navegador minimizado
     * - cambio de aplicación
     * - pestaña que Chrome suspendió
     */
    const handleWindowFocus = () => {
      void revalidateSession();
    };

    void initialize();

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    window.addEventListener(
      "focus",
      handleWindowFocus,
    );

    return () => {
      cancelled = true;

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      window.removeEventListener(
        "focus",
        handleWindowFocus,
      );

      if (profileRefreshTimeout) {
        clearTimeout(profileRefreshTimeout);
      }

      subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  const value: UserContextType = {
    user,
    profile,
    loading,

    isAdmin:
      profile?.role === "Admin" ||
      profile?.role === "AdminLectura",

    isAdministrative:
      profile?.role === "Admin" ||
      profile?.role === "AdminLectura",

    canManagePersonnel:
      profile?.role === "Admin" ||
      profile?.role === "SecretariaPrivada",

    isAuthenticated: !!user,

    hasRole: (role: UserRole) =>
      profile?.role === role,

    refreshProfile,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);

  if (context === undefined) {
    throw new Error(
      "useUser must be used within a UserProvider",
    );
  }

  return context;
}