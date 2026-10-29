"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, setToken, removeToken } from "@/lib/api";

export interface User {
  id: number;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    try {
      const data = await api.get<User>("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
      removeToken();
      setTokenState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const savedToken = getToken();

    if (!savedToken) {
      queueMicrotask(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });
      return;
    }

    api
      .get<User>("/auth/me")
      .then((data) => {
        if (mounted) {
          setTokenState(savedToken);
          setUser(data);
        }
      })
      .catch(() => {
        if (mounted) {
          setUser(null);
          removeToken();
          setTokenState(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(
    async (newToken: string) => {
      setToken(newToken);
      setTokenState(newToken);
      setIsLoading(true);
      try {
        const data = await api.get<User>("/auth/me");
        setUser(data);
        router.push("/transactions");
      } catch {
        setUser(null);
        removeToken();
        setTokenState(null);
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  const logout = useCallback(() => {
    removeToken();
    setTokenState(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
