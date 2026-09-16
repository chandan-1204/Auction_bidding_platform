/**
 * Auth store — persists auth state in localStorage.
 * Single source of truth for the current user/token/role.
 */
import { create } from "zustand";
import type { AuthState, TokenResponse, User } from "@/types";

interface AuthStore extends AuthState {
  setAuth: (data: TokenResponse) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

const loadFromStorage = (): Partial<AuthState> => {
  try {
    const token = localStorage.getItem("flyhigh_token");
    const raw = localStorage.getItem("flyhigh_user");
    const user = raw ? (JSON.parse(raw) as User) : null;
    return {
      token,
      user,
      role: user?.role ?? null,
      teamId: user?.team_id ?? null,
    };
  } catch {
    return {};
  }
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  token: null,
  user: null,
  role: null,
  teamId: null,
  ...loadFromStorage(),

  setAuth: (data: TokenResponse) => {
    localStorage.setItem("flyhigh_token", data.access_token);
    const user: User = {
      id: data.user_id,
      username: data.username,
      email: "",
      role: data.role,
      is_active: true,
      team_id: data.team_id,
      created_at: new Date().toISOString(),
    };
    localStorage.setItem("flyhigh_user", JSON.stringify(user));
    set({ token: data.access_token, user, role: data.role, teamId: data.team_id });
  },

  setUser: (user: User) => {
    localStorage.setItem("flyhigh_user", JSON.stringify(user));
    set({ user, role: user.role, teamId: user.team_id });
  },

  clearAuth: () => {
    localStorage.removeItem("flyhigh_token");
    localStorage.removeItem("flyhigh_user");
    set({ token: null, user: null, role: null, teamId: null });
  },

  isAuthenticated: () => !!get().token,
}));
