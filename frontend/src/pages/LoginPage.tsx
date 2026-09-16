/**
 * Login page — used by both admin and captain.
 * Redirects automatically based on role after successful login.
 */
import { useState, FormEvent } from "react";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Zap, Eye, EyeOff, Loader } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getApiError } from "@/services/api";

export default function LoginPage() {
  const { isAuthenticated, role, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // Already logged in — redirect
  if (isAuthenticated) {
    return <Navigate to={role === "admin" ? "/admin" : "/captain"} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter your credentials");
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      toast.success("Welcome back!");
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-in">
        {/* Header */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #6366f1)",
              boxShadow: "0 0 40px rgba(59,130,246,0.4)",
            }}
          >
            <Zap size={36} color="white" />
          </div>
          <h1 className="text-4xl font-black text-gradient mb-2">FLYHIGH</h1>
          <p className="text-base" style={{ color: "var(--color-text-muted)" }}>
            Team Event — Live Auction Platform
          </p>
        </div>

        {/* Card */}
        <div className="glass-card-elevated p-8">
          <h2
            className="text-xl font-bold mb-6"
            style={{ color: "var(--color-text)" }}
          >
            Sign in to continue
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--color-text-muted)" }}
              >
                Username
              </label>
              <input
                id="login-username"
                type="text"
                className="input"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--color-text-muted)" }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? "text" : "password"}
                  className="input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  style={{ paddingRight: "44px" }}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer" }}
                  onClick={() => setShowPw((p) => !p)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary btn-lg w-full mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader size={18} className="spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-6 pt-6" style={{ borderTop: "1px solid var(--color-border)" }}>
            <p className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
              <span className="font-semibold">Demo credentials</span>
            </p>
            <div className="mt-3 space-y-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <div className="flex justify-between">
                <span>Admin:</span>
                <span className="font-mono" style={{ color: "var(--color-accent-glow)" }}>
                  admin / admin123
                </span>
              </div>
              <div className="flex justify-between">
                <span>Team Blaze:</span>
                <span className="font-mono" style={{ color: "var(--color-cyan)" }}>
                  blaze_captain / blaze123
                </span>
              </div>
              <div className="flex justify-between">
                <span>Net Masters:</span>
                <span className="font-mono" style={{ color: "var(--color-cyan)" }}>
                  netmasters_captain / netmasters123
                </span>
              </div>
              <div className="flex justify-between">
                <span>Court Commandos:</span>
                <span className="font-mono" style={{ color: "var(--color-cyan)" }}>
                  commandos_captain / commandos123
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
