/**
 * useAuth hook — login, logout, current user helpers.
 */
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authApi, getApiError } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { disconnectSocket } from "@/services/socket";

export function useAuth() {
  const store = useAuthStore();
  const navigate = useNavigate();

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await authApi.login(username, password);
      store.setAuth(res.data);

      if (res.data.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/captain");
      }
    },
    [store, navigate]
  );

  const logout = useCallback(() => {
    disconnectSocket();
    store.clearAuth();
    navigate("/login");
    toast.success("Logged out");
  }, [store, navigate]);

  const fetchMe = useCallback(async () => {
    try {
      const res = await authApi.me();
      store.setUser(res.data);
    } catch {
      store.clearAuth();
    }
  }, [store]);

  return {
    user: store.user,
    token: store.token,
    role: store.role,
    teamId: store.teamId,
    isAuthenticated: store.isAuthenticated(),
    isAdmin: store.role === "admin",
    isCaptain: store.role === "captain",
    login,
    logout,
    fetchMe,
  };
}
