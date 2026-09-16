/**
 * Axios HTTP client configured to talk to the FastAPI backend.
 * Automatically attaches the JWT Authorization header.
 */
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
});

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("flyhigh_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 by clearing auth state and redirecting
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("flyhigh_token");
      localStorage.removeItem("flyhigh_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    api.post("/api/auth/login", { username, password }),
  me: () => api.get("/api/auth/me"),
  register: (data: object) => api.post("/api/auth/register", data),
  listUsers: (role?: string) =>
    api.get("/api/auth/users", { params: role ? { role } : {} }),
  updateUser: (id: string, data: object) =>
    api.patch(`/api/auth/users/${id}`, data),
};

// ── Tournaments ──────────────────────────────────────────────────────
export const tournamentApi = {
  list: () => api.get("/api/tournaments/"),
  get: (id: string) => api.get(`/api/tournaments/${id}`),
  create: (data: object) => api.post("/api/tournaments/", data),
  update: (id: string, data: object) => api.patch(`/api/tournaments/${id}`, data),
  getChecklist: (id: string) => api.get(`/api/tournaments/${id}/checklist`),
  reset: (id: string, data: { password: string; mode?: "PRACTICE" | "LIVE"; confirm_phrase?: string }) =>
    api.post(`/api/tournaments/${id}/reset`, data),
};

// ── Teams ────────────────────────────────────────────────────────────
export const teamApi = {
  list: (tournamentId: string) =>
    api.get("/api/teams/", { params: { tournament_id: tournamentId } }),
  get: (id: string) => api.get(`/api/teams/${id}`),
  create: (data: object) => api.post("/api/teams/", data),
  update: (id: string, data: object) => api.patch(`/api/teams/${id}`, data),
  delete: (id: string) => api.delete(`/api/teams/${id}`),
};

// ── Players ──────────────────────────────────────────────────────────
export const playerApi = {
  list: (tournamentId: string, status?: string, category?: string) =>
    api.get("/api/players/", {
      params: { tournament_id: tournamentId, status, category },
    }),
  get: (id: string) => api.get(`/api/players/${id}`),
  create: (data: object) => api.post("/api/players/", data),
  update: (id: string, data: object) => api.patch(`/api/players/${id}`, data),
  delete: (id: string) => api.delete(`/api/players/${id}`),
  uploadPhoto: (id: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post(`/api/players/${id}/photo`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  exportCsv: (tournamentId: string) =>
    api.get("/api/players/export-csv", {
      params: { tournament_id: tournamentId },
      responseType: "blob",
    }),
  importCsv: (tournamentId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/api/players/import-csv", fd, {
      params: { tournament_id: tournamentId },
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ── Auctions ─────────────────────────────────────────────────────────
export const auctionApi = {
  create: (data: object) => api.post("/api/auctions/", data),
  get: (id: string) => api.get(`/api/auctions/${id}`),
  getState: (id: string) => api.get(`/api/auctions/${id}/state`),
  getActive: (tournamentId: string) =>
    api.get("/api/auctions/active", { params: { tournament_id: tournamentId } }),
  updateConfig: (id: string, data: object) =>
    api.patch(`/api/auctions/${id}/config`, data),

  // Admin controls
  start: (id: string) => api.post(`/api/auctions/${id}/start`),
  setPlayer: (id: string, playerId: string) =>
    api.post(`/api/auctions/${id}/player/${playerId}`),
  pause: (id: string) => api.post(`/api/auctions/${id}/pause`),
  resume: (id: string) => api.post(`/api/auctions/${id}/resume`),
  adminBid: (id: string, amount: number) =>
    api.post(`/api/auctions/${id}/admin-bid`, null, { params: { amount } }),
  undoBid: (id: string) => api.post(`/api/auctions/${id}/undo-bid`),
  markSold: (id: string) => api.post(`/api/auctions/${id}/sold`),
  markUnsold: (id: string) => api.post(`/api/auctions/${id}/unsold`),
  nextPlayer: (id: string) => api.post(`/api/auctions/${id}/next-player`),
  complete: (id: string) => api.post(`/api/auctions/${id}/complete`),

  // Bidding
  placeBid: (id: string, amount: number) =>
    api.post(`/api/auctions/${id}/bid`, { auction_id: id, amount }),

  // History & results
  getBids: (id: string, limit = 50) =>
    api.get(`/api/auctions/${id}/bids`, { params: { limit } }),
  getResults: (id: string) => api.get(`/api/auctions/${id}/results`),
  exportResultsCsv: (id: string) =>
    api.get(`/api/auctions/${id}/results/export-csv`, { responseType: "blob" }),
};

// ── Helpers ──────────────────────────────────────────────────────────
export function getApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (detail && typeof detail === "object" && "message" in detail) {
      return detail.message as string;
    }
    if (typeof detail === "string") return detail;
    return err.message;
  }
  return "An unexpected error occurred";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
