/**
 * Route guards — protect pages by role.
 */
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { token, role } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (role !== "admin") return <Navigate to="/captain" replace />;
  return <>{children}</>;
}

export function RequireCaptain({ children }: { children: React.ReactNode }) {
  const { token, role } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (role === "admin") return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
