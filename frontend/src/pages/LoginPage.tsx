/**
 * Login page — used by both admin and captain.
 * Includes both "Sign In" and "Register User" tabs for seamless access.
 * Redirects automatically based on role after successful login/signup.
 */
import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Zap, Eye, EyeOff, Loader, UserPlus, LogIn, Shield, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getApiError } from "@/services/api";

export default function LoginPage() {
  const { isAuthenticated, role, login, signup } = useAuth();
  const [activeTab, setActiveTab] = useState<"signin" | "register">("signin");

  // Sign In form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // Register form state
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regRole, setRegRole] = useState<"captain" | "admin">("captain");
  const [showRegPw, setShowRegPw] = useState(false);

  // Already logged in — redirect
  if (isAuthenticated) {
    return <Navigate to={role === "admin" ? "/admin" : "/captain"} replace />;
  }

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter your username and password");
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

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!regUsername.trim()) {
      toast.error("Please enter a username");
      return;
    }
    if (regUsername.trim().length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }
    if (!regEmail.trim() || !regEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (regPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await signup({
        username: regUsername.trim(),
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        role: regRole,
      });
      toast.success("Account registered successfully! Welcome to FlyHigh!");
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-in my-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl mb-4 sm:mb-6"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #6366f1)",
              boxShadow: "0 0 35px rgba(59,130,246,0.45)",
            }}
          >
            <Zap size={32} color="white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gradient mb-2 tracking-tight">FLYHIGH</h1>
          <p className="text-sm sm:text-base" style={{ color: "var(--color-text-muted)" }}>
            Team Event — Live Auction Platform
          </p>
        </div>

        {/* Card */}
        <div className="glass-card-elevated p-6 sm:p-8">
          {/* Tab Selector: Sign In vs Register */}
          <div
            className="grid grid-cols-2 p-1 rounded-xl mb-6"
            style={{ background: "rgba(255, 255, 255, 0.05)", border: "1px solid var(--color-border)" }}
          >
            <button
              type="button"
              id="tab-signin-btn"
              onClick={() => setActiveTab("signin")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "signin" ? "text-white shadow-md" : "text-slate-400 hover:text-slate-200"
              }`}
              style={
                activeTab === "signin"
                  ? { background: "linear-gradient(135deg, #3b82f6, #6366f1)" }
                  : { background: "transparent" }
              }
            >
              <LogIn size={16} />
              Sign In
            </button>
            <button
              type="button"
              id="tab-register-btn"
              onClick={() => setActiveTab("register")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "register" ? "text-white shadow-md" : "text-slate-400 hover:text-slate-200"
              }`}
              style={
                activeTab === "register"
                  ? { background: "linear-gradient(135deg, #3b82f6, #6366f1)" }
                  : { background: "transparent" }
              }
            >
              <UserPlus size={16} />
              Register User
            </button>
          </div>

          {activeTab === "signin" ? (
            /* ── Sign In Form ── */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
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
                  required
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
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
                    required
                    style={{ paddingRight: "44px" }}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
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
                className="btn btn-primary btn-lg w-full mt-3"
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

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("register")}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Don't have an account? <span className="font-semibold underline">Register here</span>
                </button>
              </div>

              {/* Demo credentials hint */}
              <div className="mt-6 pt-5" style={{ borderTop: "1px solid var(--color-border)" }}>
                <p className="text-xs text-center font-medium mb-2.5" style={{ color: "var(--color-text-muted)" }}>
                  Demo credentials
                </p>
                <div className="space-y-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  <div className="flex justify-between items-center py-0.5">
                    <span>Admin:</span>
                    <span className="font-mono font-medium" style={{ color: "var(--color-accent-glow)" }}>
                      admin / admin123
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span>Team Blaze:</span>
                    <span className="font-mono font-medium" style={{ color: "var(--color-cyan)" }}>
                      blaze_captain / blaze123
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span>Net Masters:</span>
                    <span className="font-mono font-medium" style={{ color: "var(--color-cyan)" }}>
                      netmasters_captain / netmasters123
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span>Court Commandos:</span>
                    <span className="font-mono font-medium" style={{ color: "var(--color-cyan)" }}>
                      commandos_captain / commandos123
                    </span>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            /* ── Register User Form ── */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Username
                </label>
                <input
                  id="reg-username"
                  type="text"
                  className="input"
                  placeholder="e.g. warrior_captain"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  autoFocus
                  autoComplete="username"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Email Address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  className="input"
                  placeholder="e.g. captain@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                  required
                />
              </div>

              {/* Role Selection */}
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Account Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegRole("captain")}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                      regRole === "captain"
                        ? "border-blue-500 bg-blue-500/20 text-white"
                        : "border-slate-700 bg-slate-800/40 text-slate-400"
                    }`}
                  >
                    <Users size={14} />
                    Team Captain
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegRole("admin")}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                      regRole === "admin"
                        ? "border-indigo-500 bg-indigo-500/20 text-white"
                        : "border-slate-700 bg-slate-800/40 text-slate-400"
                    }`}
                  >
                    <Shield size={14} />
                    Administrator
                  </button>
                </div>
              </div>



              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Password (min. 6 chars)
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showRegPw ? "text" : "password"}
                    className="input"
                    placeholder="Create a password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={loading}
                    required
                    style={{ paddingRight: "44px" }}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    onClick={() => setShowRegPw((p) => !p)}
                    aria-label={showRegPw ? "Hide password" : "Show password"}
                  >
                    {showRegPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Confirm Password
                </label>
                <input
                  id="reg-confirm-password"
                  type={showRegPw ? "text" : "password"}
                  className="input"
                  placeholder="Re-enter password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                  required
                />
              </div>

              <button
                id="reg-submit-btn"
                type="submit"
                className="btn btn-primary btn-lg w-full mt-3"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader size={18} className="spin" />
                    Registering account…
                  </>
                ) : (
                  "Create Account & Sign In"
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("signin")}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Already have an account? <span className="font-semibold underline">Sign In</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
