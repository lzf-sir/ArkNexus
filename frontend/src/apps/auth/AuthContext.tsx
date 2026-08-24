import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AuthUser,
  fetchMe,
  getToken,
  login as doLogin,
  logout as doLogout,
  register as doRegister,
  setToken,
} from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<AuthUser>;
  logout: () => void;
  setSession: (token: string, user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(!!getToken());

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchMe()
      .then((u) => setUser(u))
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const resp = await doLogin({ email, password });
    setUser(resp.user);
    return resp.user;
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const resp = await doRegister({
        email,
        password,
        display_name: displayName,
      });
      setUser(resp.user);
      return resp.user;
    },
    []
  );

  const logout = useCallback(() => {
    doLogout();
    setUser(null);
  }, []);

  const setSession = useCallback((token: string, u: AuthUser) => {
    setToken(token);
    setUser(u);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, setSession }),
    [user, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}