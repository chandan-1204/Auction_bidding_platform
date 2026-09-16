import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import LoginPage from "@/pages/LoginPage";
import LiveDisplayPage from "@/pages/LiveDisplayPage";
import AdminLayout from "@/layouts/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminAuctionPage from "@/pages/admin/AdminAuctionPage";
import AdminPlayersPage from "@/pages/admin/AdminPlayersPage";
import AdminTeamsPage from "@/pages/admin/AdminTeamsPage";
import AdminHistoryPage from "@/pages/admin/AdminHistoryPage";
import AdminResultsPage from "@/pages/admin/AdminResultsPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";
import CaptainDashboard from "@/pages/captain/CaptainDashboard";
import { RequireAdmin, RequireCaptain } from "@/components/ProtectedRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/live" element={<LiveDisplayPage />} />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="auction" element={<AdminAuctionPage />} />
            <Route path="players" element={<AdminPlayersPage />} />
            <Route path="teams" element={<AdminTeamsPage />} />
            <Route path="history" element={<AdminHistoryPage />} />
            <Route path="results" element={<AdminResultsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          {/* Captain routes */}
          <Route
            path="/captain"
            element={
              <RequireCaptain>
                <CaptainDashboard />
              </RequireCaptain>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: "rgba(17,24,39,0.95)",
            color: "#f1f5f9",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            fontSize: "14px",
            backdropFilter: "blur(12px)",
          },
          success: {
            iconTheme: { primary: "#10b981", secondary: "white" },
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "white" },
          },
        }}
      />
    </QueryClientProvider>
  );
}
