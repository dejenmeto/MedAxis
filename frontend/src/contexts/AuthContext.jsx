import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("medaxis_user")) || null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  const persistSession = useCallback((data) => {
    localStorage.setItem("medaxis_access_token", data.accessToken);
    localStorage.setItem("medaxis_refresh_token", data.refreshToken);
    localStorage.setItem("medaxis_user", JSON.stringify(data.user));
    localStorage.setItem("medaxis_hospital_id", String(data.activeHospitalId));

    setUser(data.user);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const response = await api.post("/auth/login", credentials);
      persistSession(response.data);
      return response.data;
    },
    [persistSession],
  );

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem("medaxis_refresh_token");

    try {
      await api.post("/auth/logout", { refreshToken });
    } catch {
      // Clear the local session even if the network is unavailable.
    } finally {
      localStorage.removeItem("medaxis_access_token");
      localStorage.removeItem("medaxis_refresh_token");
      localStorage.removeItem("medaxis_user");
      localStorage.removeItem("medaxis_hospital_id");
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      const token = localStorage.getItem("medaxis_access_token");

      if (!token) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");
        if (mounted) {
          setUser(response.data.user);
          localStorage.setItem(
            "medaxis_user",
            JSON.stringify(response.data.user),
          );
        }
      } catch {
        if (mounted) {
          localStorage.removeItem("medaxis_access_token");
          localStorage.removeItem("medaxis_refresh_token");
          localStorage.removeItem("medaxis_user");
          localStorage.removeItem("medaxis_hospital_id");
          setUser(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, isAuthenticated: Boolean(user) }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
